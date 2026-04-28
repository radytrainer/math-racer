import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 4000;
const FINISH_SCORE = 15;
const COUNTDOWN_SECONDS = 3;

const rooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function createQuestion(difficulty = "easy") {
  const ranges = {
    easy: { min: 1, max: 10, operations: ["+", "-"] },
    medium: { min: 2, max: 12, operations: ["+", "-", "*"] },
    hard: { min: 5, max: 20, operations: ["+", "-", "*", "/"] }
  };

  const config = ranges[difficulty] || ranges.easy;
  const a = randomInt(config.min, config.max);
  const b = randomInt(config.min, config.max);
  const operation = config.operations[Math.floor(Math.random() * config.operations.length)];

  if (operation === "+") {
    return { prompt: `${a} + ${b}`, answer: a + b };
  }

  if (operation === "-") {
    const top = Math.max(a, b);
    const bottom = Math.min(a, b);
    return { prompt: `${top} - ${bottom}`, answer: top - bottom };
  }

  if (operation === "/") {
    const dividend = a * b;
    return { prompt: `${dividend} ÷ ${a}`, answer: b };
  }

  return { prompt: `${a} x ${b}`, answer: a * b };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createPlayerState(role, initialQuestion) {
  return {
    role,
    socketId: null,
    name: role === "A" ? "Turtle" : "Rabbit",
    score: 0,
    questionIndex: 0,
    question: initialQuestion,
    lastResult: null,
    connected: false
  };
}

function createRoom(roomCode) {
  const initialQuestion = createQuestion("easy");
  return {
    roomCode,
    status: "waiting",
    difficulty: "easy",
    winner: null,
    countdown: null,
    countdownTimer: null,
    teacherSocketId: null,
    questionBank: [initialQuestion],
    players: {
      A: createPlayerState("A", initialQuestion),
      B: createPlayerState("B", initialQuestion)
    }
  };
}

function clearCountdown(room) {
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
    room.countdownTimer = null;
  }
}

function ensureRoom(roomCode) {
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, createRoom(roomCode));
  }

  return rooms.get(roomCode);
}

function sanitizeRoom(room) {
  return {
    roomCode: room.roomCode,
    status: room.status,
    difficulty: room.difficulty,
    winner: room.winner,
    countdown: room.countdown,
    finishScore: FINISH_SCORE,
    players: {
      A: sanitizePlayer(room.players.A),
      B: sanitizePlayer(room.players.B)
    }
  };
}

function sanitizePlayer(player) {
  return {
    role: player.role,
    name: player.name,
    score: player.score,
    question: player.question.prompt,
    connected: player.connected,
    lastResult: player.lastResult
  };
}

function emitRoomState(roomCode) {
  const room = rooms.get(roomCode);

  if (!room) {
    return;
  }

  io.to(roomCode).emit("room:state", sanitizeRoom(room));
}

function startCountdown(room) {
  clearCountdown(room);
  room.status = "countdown";
  room.countdown = COUNTDOWN_SECONDS;
  room.winner = null;
  room.questionBank = [createQuestion(room.difficulty)];
  room.players.A.score = 0;
  room.players.B.score = 0;
  room.players.A.questionIndex = 0;
  room.players.B.questionIndex = 0;
  room.players.A.question = room.questionBank[0];
  room.players.B.question = room.questionBank[0];
  room.players.A.lastResult = null;
  room.players.B.lastResult = null;
  emitRoomState(room.roomCode);

  room.countdownTimer = setInterval(() => {
    room.countdown -= 1;

    if (room.countdown > 0) {
      emitRoomState(room.roomCode);
      return;
    }

    clearCountdown(room);
    room.countdown = 0;
    room.status = "active";
    emitRoomState(room.roomCode);
  }, 1000);
}

app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.get("/api/room/new", (_, res) => {
  let roomCode = generateRoomCode();

  while (rooms.has(roomCode)) {
    roomCode = generateRoomCode();
  }

  const room = ensureRoom(roomCode);
  res.json(sanitizeRoom(room));
});

io.on("connection", (socket) => {
  socket.on("room:join", ({ roomCode, role, name }) => {
    if (!roomCode || !role) {
      socket.emit("room:error", "Room code and role are required.");
      return;
    }

    const normalizedRoom = String(roomCode).trim().toUpperCase();
    const normalizedRole = role === "teacher" ? "teacher" : String(role).toUpperCase();

    if (!["teacher", "A", "B"].includes(normalizedRole)) {
      socket.emit("room:error", "Invalid role.");
      return;
    }

    const room = ensureRoom(normalizedRoom);

    socket.join(normalizedRoom);
    socket.data.roomCode = normalizedRoom;
    socket.data.role = normalizedRole;

    if (normalizedRole === "teacher") {
      room.teacherSocketId = socket.id;
    } else {
      const player = room.players[normalizedRole];
      player.socketId = socket.id;
      player.connected = true;
      player.name = name?.trim() || player.name;
    }

    emitRoomState(normalizedRoom);
  });

  socket.on("room:setDifficulty", ({ roomCode, difficulty }) => {
    const room = rooms.get(String(roomCode).trim().toUpperCase());

    if (!room || room.status === "active" || room.status === "countdown") {
      return;
    }

    room.difficulty = ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "easy";
    room.questionBank = [createQuestion(room.difficulty)];
    room.players.A.questionIndex = 0;
    room.players.B.questionIndex = 0;
    room.players.A.question = room.questionBank[0];
    room.players.B.question = room.questionBank[0];
    emitRoomState(room.roomCode);
  });

  socket.on("race:start", ({ roomCode }) => {
    const room = rooms.get(String(roomCode).trim().toUpperCase());

    if (!room || room.status === "countdown" || room.status === "active") {
      return;
    }

    if (!room.players.A.connected || !room.players.B.connected) {
      socket.emit("room:error", "Both players must join before the race can start.");
      return;
    }

    startCountdown(room);
  });

  socket.on("race:reset", ({ roomCode }) => {
    const room = rooms.get(String(roomCode).trim().toUpperCase());

    if (!room) {
      return;
    }

    clearCountdown(room);
    room.status = "waiting";
    room.countdown = null;
    room.winner = null;
    room.questionBank = [createQuestion(room.difficulty)];
    room.players.A.score = 0;
    room.players.B.score = 0;
    room.players.A.questionIndex = 0;
    room.players.B.questionIndex = 0;
    room.players.A.question = room.questionBank[0];
    room.players.B.question = room.questionBank[0];
    room.players.A.lastResult = null;
    room.players.B.lastResult = null;
    emitRoomState(room.roomCode);
  });

  socket.on("answer:submit", ({ roomCode, role, answer }) => {
    const room = rooms.get(String(roomCode).trim().toUpperCase());
    const playerRole = String(role).toUpperCase();

    if (!room || room.status !== "active" || !room.players[playerRole]) {
      return;
    }

    const player = room.players[playerRole];
    const numericAnswer = Number(answer);
    const isCorrect = numericAnswer === player.question.answer;

    player.lastResult = isCorrect ? "correct" : "incorrect";

    if (isCorrect) {
      player.score += 1;

      if (player.score >= FINISH_SCORE && !room.winner) {
        room.winner = playerRole;
        room.status = "finished";
      }
    }

    // Advance to next shared question
    player.questionIndex += 1;
    if (room.questionBank.length <= player.questionIndex) {
      room.questionBank.push(createQuestion(room.difficulty));
    }
    player.question = room.questionBank[player.questionIndex];

    emitRoomState(room.roomCode);
  });

  socket.on("disconnect", () => {
    const { roomCode, role } = socket.data;

    if (!roomCode || !role || !rooms.has(roomCode)) {
      return;
    }

    const room = rooms.get(roomCode);

    if (role === "teacher" && room.teacherSocketId === socket.id) {
      room.teacherSocketId = null;
    }

    if ((role === "A" || role === "B") && room.players[role].socketId === socket.id) {
      room.players[role].connected = false;
      room.players[role].socketId = null;
    }

    emitRoomState(roomCode);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Racing Calculator Game server running on port ${PORT}`);
});
