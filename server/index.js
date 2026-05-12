import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 4000;
const FINISH_SCORE = 15;
const COUNTDOWN_SECONDS = 3;

const rooms = new Map();
const QUESTION_RANGES = {
  easy: { min: 1, max: 15, operations: ["+", "-"] },
  medium: { min: 2, max: 50, operations: ["+", "-", "*"] },
  hard: { min: 5, max: 100, operations: ["+", "-", "*", "/"] }
};

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function generateQuestion(difficulty = "easy", forcedOperation = null) {
  const config = QUESTION_RANGES[difficulty] || QUESTION_RANGES.easy;
  const a = randomInt(config.min, config.max);
  const b = randomInt(config.min, config.max);
  const operation = forcedOperation || config.operations[Math.floor(Math.random() * config.operations.length)];

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

function generateQuestionPair(difficulty = "easy") {
  const config = QUESTION_RANGES[difficulty] || QUESTION_RANGES.easy;
  const operation = config.operations[Math.floor(Math.random() * config.operations.length)];

  return {
    A: generateQuestion(difficulty, operation),
    B: generateQuestion(difficulty, operation)
  };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const CHARACTER_MAP = {
  "1": { emoji: "🐢", name: "Turtle" },
  "2": { emoji: "🐇", name: "Rabbit" },
  "3": { emoji: "🐌", name: "Snail" },
  "4": { emoji: "🐱", name: "Cat" },
  "5": { emoji: "🦀", name: "Crab" },
  "A": { emoji: "🐢", name: "Turtle" },
  "B": { emoji: "🐇", name: "Rabbit" }
};

function createPlayerState(role, initialQuestion) {
  const charData = CHARACTER_MAP[String(role)];
  return {
    role,
    socketId: null,
    name: charData?.name || `Player ${role}`,
    emoji: charData?.emoji || "🎮",
    score: 0,
    questionIndex: 0,
    question: initialQuestion,
    lastResult: null,
    connected: false
  };
}

function createRoom(roomCode, gameMode = "pair") {
  const initialPair = generateQuestionPair("easy");
  const players = {};
  
  if (gameMode === "pair") {
    players.A = createPlayerState("A", initialPair.A);
    players.B = createPlayerState("B", initialPair.B);
  } else {
    // For multiple mode, create empty slots for players 1-5
    for (let i = 1; i <= 5; i++) {
      const role = String(i);
      players[role] = createPlayerState(role, initialPair[role] || generateQuestion("easy"));
    }
  }
  
  return {
    roomCode,
    gameMode,
    status: "waiting",
    difficulty: "easy",
    winner: null,
    countdown: null,
    countdownTimer: null,
    teacherSocketId: null,
    questionBank: [initialPair],
    players
  };
}

function clearCountdown(room) {
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
    room.countdownTimer = null;
  }
}

function ensureRoom(roomCode, gameMode = "pair") {
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, createRoom(roomCode, gameMode));
  }

  return rooms.get(roomCode);
}

function sanitizeRoom(room) {
  const sanitizedPlayers = {};
  for (const [key, player] of Object.entries(room.players)) {
    sanitizedPlayers[key] = sanitizePlayer(player);
  }
  
  return {
    roomCode: room.roomCode,
    gameMode: room.gameMode,
    status: room.status,
    difficulty: room.difficulty,
    winner: room.winner,
    countdown: room.countdown,
    finishScore: FINISH_SCORE,
    players: sanitizedPlayers
  };
}

function sanitizePlayer(player) {
  return {
    role: player.role,
    name: player.name,
    emoji: player.emoji,
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
  room.questionBank = [generateQuestionPair(room.difficulty)];
  
  // Reset all connected players
  for (const [, player] of Object.entries(room.players)) {
    player.score = 0;
    player.questionIndex = 0;
    player.question = room.questionBank[0][player.role] || room.questionBank[0]["A"] || generateQuestion(room.difficulty);
    player.lastResult = null;
  }
  
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

  const room = ensureRoom(roomCode, "pair");
  res.json(sanitizeRoom(room));
});

app.post("/api/room/new", (req, res) => {
  const { gameMode } = req.body;
  let roomCode = generateRoomCode();

  while (rooms.has(roomCode)) {
    roomCode = generateRoomCode();
  }

  const mode = ["pair", "multiple"].includes(gameMode) ? gameMode : "pair";
  const room = ensureRoom(roomCode, mode);
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

    const room = ensureRoom(normalizedRoom, "pair");
    
    if (normalizedRole !== "teacher" && !room.players[normalizedRole]) {
      socket.emit("room:error", "Invalid role for this game mode.");
      return;
    }

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

  socket.on("room:setGameMode", ({ roomCode, gameMode }) => {
    const room = rooms.get(String(roomCode).trim().toUpperCase());

    if (!room || room.status === "active" || room.status === "countdown") {
      return;
    }

    const mode = ["pair", "multiple"].includes(gameMode) ? gameMode : "pair";
    if (room.gameMode !== mode) {
      room.gameMode = mode;
      // Reset players for new mode
      room.players = {};
      if (mode === "pair") {
        room.players.A = createPlayerState("A", generateQuestion("easy"));
        room.players.B = createPlayerState("B", generateQuestion("easy"));
      } else {
        for (let i = 1; i <= 5; i++) {
          room.players[String(i)] = createPlayerState(String(i), generateQuestion("easy"));
        }
      }
    }
    
    emitRoomState(room.roomCode);
  });

  socket.on("room:setDifficulty", ({ roomCode, difficulty }) => {
    const room = rooms.get(String(roomCode).trim().toUpperCase());

    if (!room || room.status === "active" || room.status === "countdown") {
      return;
    }

    room.difficulty = ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "easy";
    room.questionBank = [generateQuestionPair(room.difficulty)];
    
    for (const [, player] of Object.entries(room.players)) {
      player.questionIndex = 0;
      player.question = room.questionBank[0][player.role] || room.questionBank[0]["A"] || generateQuestion(room.difficulty);
    }
    
    emitRoomState(room.roomCode);
  });

  socket.on("race:start", ({ roomCode }) => {
    const room = rooms.get(String(roomCode).trim().toUpperCase());

    if (!room || room.status === "countdown" || room.status === "active") {
      return;
    }

    // Check minimum players based on game mode
    const connectedCount = Object.values(room.players).filter(p => p.connected).length;
    const minRequired = room.gameMode === "pair" ? 2 : 2; // Minimum 2 players for any mode
    
    if (connectedCount < minRequired) {
      socket.emit("room:error", `At least ${minRequired} players must join before the race can start.`);
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
    room.questionBank = [generateQuestionPair(room.difficulty)];
    
    for (const [, player] of Object.entries(room.players)) {
      player.score = 0;
      player.questionIndex = 0;
      player.question = room.questionBank[0][player.role] || room.questionBank[0]["A"] || generateQuestion(room.difficulty);
      player.lastResult = null;
    }
    
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

    // Advance to next shared question pair
    player.questionIndex += 1;
    if (room.questionBank.length <= player.questionIndex) {
      room.questionBank.push(generateQuestionPair(room.difficulty));
    }
    
    const nextQuestion = room.questionBank[player.questionIndex];
    player.question = nextQuestion[playerRole] || nextQuestion["A"] || generateQuestion(room.difficulty);

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

    if (room.players[role] && room.players[role].socketId === socket.id) {
      room.players[role].connected = false;
      room.players[role].socketId = null;
    }

    emitRoomState(roomCode);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Racing Calculator Game server running on port ${PORT}`);
});
