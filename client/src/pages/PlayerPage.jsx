import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import FireworksOverlay from "../components/FireworksOverlay";
import QuestionCard from "../components/QuestionCard";
import { useSocket } from "../context/SocketContext";
import { useSound } from "../utils/useSound";

const CHARACTER_MAP = {
  "1": { emoji: "🐢", name: "Turtle", color: "#00f0ff" },
  "2": { emoji: "🐇", name: "Rabbit", color: "#f97316" },
  "3": { emoji: "🐌", name: "Snail", color: "#a855f7" },
  "4": { emoji: "🐱", name: "Cat", color: "#ec4899" },
  "5": { emoji: "🦀", name: "Crab", color: "#14b8a6" },
  A: { emoji: "🐢", name: "Turtle", color: "#00f0ff" },
  B: { emoji: "🐇", name: "Rabbit", color: "#f97316" }
};

const OVERTIME_WARNING_MS = 3 * 60 * 1000;

function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function PlayerPage() {
  const { role } = useParams();
  const { socket, roomState, error } = useSocket();
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [answer, setAnswer] = useState("");
  const [joined, setJoined] = useState(false);
  const [prevQuestion, setPrevQuestion] = useState("");
  const [now, setNow] = useState(Date.now());
  const [finishCelebrated, setFinishCelebrated] = useState(false);
  const { playCorrect, playIncorrect, playWin } = useSound();

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

  useEffect(() => {
    if (!roomState?.activeStartedAt || (roomState.status !== "active" && roomState.status !== "finished")) {
      setNow(Date.now());
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [roomState?.activeStartedAt, roomState?.status]);

  const player = roomState?.players?.[finalRole];
  const raceState = roomState?.status || "waiting";
  const disabled = raceState !== "active";
  const winnerName = roomState?.winner ? roomState.players?.[roomState.winner]?.name || CHARACTER_MAP[roomState.winner]?.name : "";
  const raceElapsedMs = roomState?.activeStartedAt
    ? Math.max(0, (roomState?.finishedAt || now) - roomState.activeStartedAt)
    : 0;
  const raceDurationLabel = roomState?.activeStartedAt ? formatDuration(raceElapsedMs) : "00:00";
  const hasOvertimeWarning = raceState === "active" && raceElapsedMs >= OVERTIME_WARNING_MS;

  useEffect(() => {
    if (player?.question && player.question !== prevQuestion) {
      if (prevQuestion) {
        if (player.lastResult === "correct") {
          playCorrect();
        } else if (player.lastResult === "incorrect") {
          playIncorrect();
        }
      }

      setPrevQuestion(player.question);
    }
  }, [player?.lastResult, player?.question, playCorrect, playIncorrect, prevQuestion]);

  useEffect(() => {
    if (raceState === "finished" && !finishCelebrated) {
      playWin();
      setFinishCelebrated(true);
      return;
    }

    if (raceState !== "finished" && finishCelebrated) {
      setFinishCelebrated(false);
    }
  }, [finishCelebrated, playWin, raceState]);

  let helperText = "Solve quickly and move your racer forward.";

  if (raceState === "waiting") {
    helperText = "Waiting for the teacher to start the race.";
  } else if (raceState === "countdown") {
    helperText = `Get ready... ${roomState.countdown}`;
  } else if (raceState === "active") {
    helperText = "One wrong answer sends your racer back one step.";
  } else if (raceState === "finished") {
    helperText = roomState.winner === finalRole ? "You won the race!" : `${winnerName} won this round.`;
  }

  if (isCharacterSelectionMode && !selectedRole) {
    const availableCharacters = Object.entries(CHARACTER_MAP)
      .filter(([key]) => !Number.isNaN(Number(key)))
      .map(([characterRole, data]) => ({ role: characterRole, ...data }));

    return (
      <main className="dark-player-screen">
        <div className="dark-theme-wrapper">
          <h1 className="join-title">SELECT YOUR RACER</h1>
          <div className="character-selection-grid">
            {availableCharacters.map(({ role: characterRole, emoji, name }) => {
              const isAvailable = !roomState.players[characterRole]?.connected;
              return (
                <button
                  key={characterRole}
                  className={`character-card ${isAvailable ? "" : "unavailable"}`}
                  onClick={() => {
                    if (isAvailable) {
                      setSelectedRole(characterRole);
                    }
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

                <button className="join-game-btn" disabled={!roomCode.trim() || !playerName.trim()} onClick={() => setJoined(true)}>
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

  return (
    <main className="dark-player-screen">
      {roomState?.status === "countdown" && <div className="countdown-overlay">{roomState.countdown}</div>}
      <div className="dark-theme-wrapper playing-wrapper">
        <div className="player-top-header celebration-host">
          {raceState === "finished" && (
            <>
              <FireworksOverlay message={roomState.winner === finalRole ? "You won the race!" : `${winnerName} wins!`} />
              <div className="finish-status-banner">
                {roomState.winner === finalRole
                  ? `Finish! You reached ${roomState.finishScore} points first.`
                  : `Finish! ${winnerName} reached ${roomState.finishScore} points first.`}
              </div>
            </>
          )}

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

          <div className="player-race-meta">
            <div className="player-meta-pill">
              <span className="player-meta-label">FINISH AT</span>
              <strong>{roomState?.finishScore || 15}</strong>
            </div>
            <div className="player-meta-pill">
              <span className="player-meta-label">TIMER</span>
              <strong>{raceDurationLabel}</strong>
            </div>
            <div className={`player-meta-pill warning-meta ${hasOvertimeWarning ? "active" : ""}`}>
              <span className="player-meta-label">WARNING</span>
              <div className="warning-signal">
                <span className={`warning-light ${hasOvertimeWarning ? "alert" : "safe"}`}></span>
                <strong>{hasOvertimeWarning ? "Over 3 min" : "Normal"}</strong>
              </div>
            </div>
          </div>

          {hasOvertimeWarning && <div className="player-warning-banner">Warning: race time is over 3 minutes. Push to the finish!</div>}

          <div className="progress-bars-section">
            {Object.entries(roomState?.players || {}).map(([playerRole, currentPlayer]) => {
              const isYou = playerRole === finalRole;
              const isConnected = currentPlayer.connected;
              const color = CHARACTER_MAP[playerRole]?.color || "#666";
              const progress = Math.min(((currentPlayer.score || 0) / (roomState?.finishScore || 15)) * 100, 100);

              return (
                <div key={playerRole} className={`progress-bar-row ${isYou ? "you-bar" : "other-bar"}`}>
                  <div className="progress-bar-label">
                    <span className="progress-bar-dot" style={{ background: isConnected ? color : "#444" }}></span>
                    <span className="progress-bar-name">{isYou ? "YOU" : currentPlayer.name?.toUpperCase() || "PLAYER"}</span>
                    <span className="progress-bar-score">
                      {currentPlayer.score || 0}/{roomState?.finishScore || 15}
                    </span>
                  </div>
                  <div className={`player-progress-bar ${isYou ? "" : "compact"}`}>
                    <div className="progress-fill" style={{ width: `${progress}%`, background: color }}></div>
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
