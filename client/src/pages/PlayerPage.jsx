import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import QuestionCard from "../components/QuestionCard";
import StatusPill from "../components/StatusPill";
import { useSocket } from "../context/SocketContext";
import { useSound } from "../utils/useSound";

const CHARACTER_MAP = {
  "1": { emoji: "🐢", name: "Turtle", color: "#00f0ff" },
  "2": { emoji: "🐇", name: "Rabbit", color: "#f97316" },
  "3": { emoji: "🐌", name: "Snail", color: "#a855f7" },
  "4": { emoji: "🐱", name: "Cat", color: "#ec4899" },
  "5": { emoji: "🦀", name: "Crab", color: "#14b8a6" },
  "A": { emoji: "🐢", name: "Turtle", color: "#00f0ff" },
  "B": { emoji: "🐇", name: "Rabbit", color: "#f97316" }
};

export default function PlayerPage() {
  const { role } = useParams();
  const { socket, roomState, error } = useSocket();
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [answer, setAnswer] = useState("");
  const [joined, setJoined] = useState(false);
  const [prevQuestion, setPrevQuestion] = useState("");
  const { playCorrect, playIncorrect, playWin } = useSound();

  // If role is provided in URL, use it (pair mode)
  const defaultRole = role ? String(role).toUpperCase() : null;
  const isCharacterSelectionMode = !defaultRole && roomState?.gameMode === "multiple";

  const finalRole = selectedRole || defaultRole;

  useEffect(() => {
    if (!joined || !finalRole) {
      return;
    }

    socket.emit("room:join", {
      roomCode,
      role: finalRole,
      name: playerName
    });
  }, [joined, playerName, finalRole, roomCode, socket]);

  const player = roomState?.players?.[finalRole];
  const raceState = roomState?.status || "waiting";
  const disabled = raceState !== "active";

  useEffect(() => {
    if (player?.question && player.question !== prevQuestion) {
      if (prevQuestion) {
        if (player.lastResult === "correct") playCorrect();
        else if (player.lastResult === "incorrect") playIncorrect();
      }
      setPrevQuestion(player.question);
    }
    if (raceState === "finished" && !prevQuestion.includes("WIN")) {
      if (roomState?.winner === finalRole) playWin();
      setPrevQuestion(prevQuestion + "WIN");
    }
  }, [player?.question, player?.lastResult, prevQuestion, raceState, roomState?.winner, finalRole, playCorrect, playIncorrect, playWin]);

  let helperText = "Solve quickly and move your racer forward.";

  if (raceState === "waiting") {
    helperText = "Waiting for the teacher to start the race.";
  } else if (raceState === "countdown") {
    helperText = `Get ready... ${roomState.countdown}`;
  } else if (raceState === "finished") {
    helperText = roomState.winner === finalRole ? "You won the race!" : "Race finished. Great effort!";
  }

  // Character selection screen for multiple mode
  if (isCharacterSelectionMode && !selectedRole) {
    const availableCharacters = Object.entries(CHARACTER_MAP)
      .filter(([key]) => !isNaN(key))
      .map(([role, data]) => ({ role, ...data }));

    return (
      <main className="dark-player-screen">
        <div className="dark-theme-wrapper">
          <h1 className="join-title">SELECT YOUR RACER</h1>
          <div className="character-selection-grid">
            {availableCharacters.map(({ role, emoji, name }) => {
              const isAvailable = !roomState.players[role]?.connected;
              return (
                <button
                  key={role}
                  className={`character-card ${isAvailable ? "" : "unavailable"}`}
                  onClick={() => {
                    if (isAvailable) setSelectedRole(role);
                  }}
                  disabled={!isAvailable}
                >
                  <div className="character-emoji">{emoji}</div>
                  <div className="character-name">{name}</div>
                  {!isAvailable && <div className="character-taken">TAKEN</div>}
                </button>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  // Join screen
  if (!joined) {
    const charData = CHARACTER_MAP[finalRole] || { emoji: "🎮", name: "Player" };

    return (
      <main className="dark-player-screen">
        <div className="dark-theme-wrapper">
          <h1 className="join-title">JOIN THE RACE</h1>
          <div className="join-container">
            <div className="avatar-section">
              <div className="avatar-glow-ring">
                <div className="avatar-image" style={{ borderColor: charData.color }}>
                  <span className="avatar-emoji">{charData.emoji}</span>
                </div>
                <div className="online-badge">ONLINE</div>
              </div>
              <h2 className="player-label">{charData.name.toUpperCase()}</h2>
              <div className="tier-pill">GOLD TIER</div>
            </div>

            <div className="matchmaking-card">
              <div className="matchmaking-header">
                <span className="mm-title">🎮 MATCHMAKING</span>
                <span className="mm-timer">02:45</span>
              </div>

              <div className="dark-form">
                <div className="dark-form-group">
                  <label>RACER ALIAS</label>
                  <div className="input-with-icon">
                    <span className="input-icon">👤</span>
                    <input
                      placeholder="Enter your handle..."
                      value={playerName}
                      onChange={(event) => setPlayerName(event.target.value)}
                    />
                  </div>
                </div>

                <div className="dark-form-group">
                  <label>ROOM CODE</label>
                  <div className="input-with-icon">
                    <span className="input-icon">🔑</span>
                    <input
                      placeholder="Enter room code..."
                      value={roomCode}
                      onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                      maxLength={6}
                    />
                  </div>
                </div>

                <button
                  className="join-game-btn"
                  disabled={!roomCode.trim() || !playerName.trim()}
                  onClick={() => setJoined(true)}
                >
                  <span className="btn-text">JOIN GAME ⚡</span>
                </button>
                {error && <p className="error-text">{error}</p>}
              </div>

              <div className="matchmaking-footer">
                <span>🟢 1,429 PLAYERS ONLINE</span>
                <div className="footer-stats">
                  <span>📶 24MS</span>
                  <span>🌍 REGION: US-EAST</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Playing screen
  return (
    <main className="dark-player-screen">
      {roomState?.status === "countdown" && (
        <div className="countdown-overlay">
          {roomState.countdown}
        </div>
      )}
      <div className="dark-theme-wrapper playing-wrapper">
        <div className="player-top-header">
          <div className="player-info-row">
            <div className="avatar-info">
              <div className="small-avatar-ring" style={{ borderColor: CHARACTER_MAP[finalRole]?.color }}>
                <span className="small-avatar-emoji">{CHARACTER_MAP[finalRole]?.emoji}</span>
              </div>
              <div className="info-text">
                <h2>{CHARACTER_MAP[finalRole]?.name.toUpperCase()}</h2>
                <span className="vehicle-text">ROOM CODE: {roomCode}</span>
              </div>
            </div>
            <div className="score-info">
              <span className="score-label">CURRENT SCORE</span>
              <span className="score-value">{player?.score || 0}</span>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="progress-bars-section">
            {Object.entries(roomState?.players || {}).map(([role, p]) => {
              const isYou = role === finalRole;
              const isConnected = p.connected;
              const color = CHARACTER_MAP[role]?.color || "#666";
              const progress = Math.min(((p.score || 0) / (roomState?.finishScore || 15)) * 100, 100);

              return (
                <div key={role} className={`progress-bar-row ${isYou ? "you-bar" : "other-bar"}`}>
                  <div className="progress-bar-label">
                    <span className="progress-bar-dot" style={{ background: isConnected ? color : "#444" }}></span>
                    <span className="progress-bar-name">
                      {isYou ? "YOU" : p.name?.toUpperCase() || "PLAYER"}
                    </span>
                    <span className="progress-bar-score">
                      {p.score || 0}/{roomState?.finishScore || 15}
                    </span>
                  </div>
                  <div className={`player-progress-bar ${isYou ? "" : "compact"}`}>
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%`, background: color }}
                    ></div>
                    <div className="progress-flag">🏁</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {player && (
          <QuestionCard
            question={player.question}
            value={answer}
            onChange={setAnswer}
            disabled={disabled}
            feedback={player.lastResult}
            helperText={helperText}
            onSubmit={() => {
              socket.emit("answer:submit", {
                roomCode,
                role: finalRole,
                answer
              });
              setAnswer("");
            }}
          />
        )}
      </div>
    </main>
  );
}
