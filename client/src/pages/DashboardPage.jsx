import { useEffect, useRef, useState } from "react";
import FireworksOverlay from "../components/FireworksOverlay";
import RaceTrack from "../components/RaceTrack";
import StatusPill from "../components/StatusPill";
import { useSocket } from "../context/SocketContext";
import { createRoom } from "../utils/api";
import { useSound } from "../utils/useSound";

const CHARACTER_MAP = {
  "1": { name: "Turtle" },
  "2": { name: "Rabbit" },
  "3": { name: "Snail" },
  "4": { name: "Cat" },
  "5": { name: "Crab" },
  A: { name: "Turtle" },
  B: { name: "Rabbit" }
};

const STATUS_LABELS = {
  waiting: "Waiting",
  countdown: "Countdown",
  active: "Live",
  finished: "Finished"
};

const OVERTIME_WARNING_MS = 3 * 60 * 1000;

function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const { socket, roomState, error } = useSocket();
  const [roomCode, setRoomCode] = useState("");
  const [gameMode, setGameMode] = useState("pair");
  const [finishScoreDraft, setFinishScoreDraft] = useState(15);
  const [now, setNow] = useState(Date.now());
  const { playCountdown, playGo, playWin } = useSound();
  const [prevCountdown, setPrevCountdown] = useState(null);
  const [prevWinner, setPrevWinner] = useState(null);
  const [matchHistory, setMatchHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("racer_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const scoreboardRef = useRef(null);

  useEffect(() => {
    createRoom(gameMode, finishScoreDraft)
      .then((room) => {
        setRoomCode(room.roomCode);
        setGameMode(room.gameMode);
      })
      .catch(() => {
        setRoomCode("");
      });
  }, []);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    socket.emit("room:join", {
      roomCode,
      role: "teacher"
    });
  }, [roomCode, socket]);

  useEffect(() => {
    if (!roomState?.finishScore) {
      return;
    }

    setFinishScoreDraft(roomState.finishScore);
  }, [roomState?.finishScore]);

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

  const players = roomState?.players;
  const playerEntries = Object.entries(players || {});
  const connectedPlayers = Object.values(players || {}).filter((player) => player.connected).length;
  const minRequired = roomState?.gameMode === "pair" ? 2 : 2;
  const isReady = connectedPlayers >= minRequired;
  const statusLabel = STATUS_LABELS[roomState?.status] || STATUS_LABELS.waiting;
  const winnerName = roomState?.winner ? roomState.players?.[roomState.winner]?.name || CHARACTER_MAP[roomState.winner]?.name : "";
  const launchLinks = roomState
    ? roomState.gameMode === "pair"
      ? ["A", "B"]
      : Object.keys(roomState.players)
    : [];
  const raceElapsedMs = roomState?.activeStartedAt
    ? Math.max(0, (roomState?.finishedAt || now) - roomState.activeStartedAt)
    : 0;
  const raceDurationLabel = roomState?.activeStartedAt ? formatDuration(raceElapsedMs) : "00:00";
  const hasOvertimeWarning = roomState?.status === "active" && raceElapsedMs >= OVERTIME_WARNING_MS;

  useEffect(() => {
    if (roomState?.status === "countdown" && roomState.countdown !== prevCountdown) {
      playCountdown();
      setPrevCountdown(roomState.countdown);
    } else if (roomState?.status === "active" && prevCountdown !== 0) {
      playGo();
      setPrevCountdown(0);
    }

    if (roomState?.status !== "finished" && prevWinner !== null) {
      setPrevWinner(null);
    }

    if (roomState?.status === "finished" && roomState.winner !== prevWinner) {
      playWin();
      setPrevWinner(roomState.winner);

      const newEntry = {
        id: Date.now(),
        roomCode,
        winner: winnerName,
        role: roomState.winner,
        date: new Date().toLocaleTimeString()
      };

      setMatchHistory((previous) => {
        const updated = [newEntry, ...previous].slice(0, 5);
        localStorage.setItem("racer_history", JSON.stringify(updated));
        return updated;
      });
    }
  }, [
    playCountdown,
    playGo,
    playWin,
    prevCountdown,
    prevWinner,
    roomCode,
    roomState?.countdown,
    roomState?.status,
    roomState?.winner,
    winnerName
  ]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      if (scoreboardRef.current) {
        scoreboardRef.current.requestFullscreen().catch((fullscreenError) => {
          console.error(`Error attempting to enable full-screen mode: ${fullscreenError.message}`);
        });
      }
      return;
    }

    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const handleGameModeChange = async (newMode) => {
    if (roomState?.status !== "waiting" || roomState?.gameMode === newMode) {
      return;
    }

    const room = await createRoom(newMode, finishScoreDraft);
    setRoomCode(room.roomCode);
    setGameMode(room.gameMode);
  };

  const handleFinishScoreApply = () => {
    const nextValue = Number.parseInt(finishScoreDraft, 10);

    if (!roomCode || Number.isNaN(nextValue)) {
      return;
    }

    socket.emit("room:setFinishScore", {
      roomCode,
      finishScore: nextValue
    });
  };

  const statusTone =
    roomState?.status === "finished"
      ? "success"
      : roomState?.status === "active"
        ? "accent"
        : "neutral";

  return (
    <main className="page-shell dashboard-shell">
      {roomState?.status === "countdown" && <div className="countdown-overlay">{roomState.countdown}</div>}

      <section className="hero-card">
        <div className="hero-content dashboard-hero-content">
          <p className="eyebrow">Teacher Dashboard</p>
          <h1>Racing Calculator</h1>
          <p className="hero-copy">
            Set up the race, launch player screens, and monitor the live scoreboard from one clean control panel.
          </p>

          <div className="dashboard-summary-grid">
            <div className="summary-stat">
              <span className="summary-label">Players Ready</span>
              <strong>
                {connectedPlayers}/{Object.keys(players || {}).length}
              </strong>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Session</span>
              <strong>{statusLabel}</strong>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Finish Score</span>
              <strong>{roomState?.finishScore || 15} points</strong>
            </div>
          </div>
        </div>

        <div className="room-panel">
          <div className="room-panel-header">
            <div>
              <label className="field-label" htmlFor="room-code">
                Room Code
              </label>
              <p className="room-panel-hint">Share this code with players before starting the race.</p>
            </div>
            <StatusPill label={roomState?.gameMode === "multiple" ? "Multiple" : "Pair"} tone="neutral" />
          </div>

          <input id="room-code" className="room-code-input" value={roomCode} readOnly maxLength={6} />

          <div className="room-panel-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={async () => {
                const room = await createRoom(gameMode, finishScoreDraft);
                setRoomCode(room.roomCode);
                setGameMode(room.gameMode);
              }}
            >
              New Room
            </button>
          </div>
        </div>
      </section>

      {roomState && (
        <section className="dashboard-grid">
          <aside className="control-card dashboard-sidebar">
            <div className="card-title-row">
              <h2>Game Setup</h2>
              <StatusPill label={roomState.gameMode === "pair" ? "Pair" : "Multiple"} tone="neutral" />
            </div>

            <div className="dashboard-section">
              <div className="section-heading">
                <h3>Mode</h3>
                <p>Choose how many racers can join this room.</p>
              </div>

              <div className="chip-grid chip-grid-double">
                <button
                  type="button"
                  className={roomState.gameMode === "pair" ? "chip active" : "chip"}
                  onClick={() => handleGameModeChange("pair")}
                  disabled={roomState.status !== "waiting"}
                >
                  Pair
                </button>
                <button
                  type="button"
                  className={roomState.gameMode === "multiple" ? "chip active" : "chip"}
                  onClick={() => handleGameModeChange("multiple")}
                  disabled={roomState.status !== "waiting"}
                >
                  Multiple
                </button>
              </div>
            </div>

            <div className="dashboard-section">
              <div className="section-heading">
                <h3>Difficulty</h3>
                <p>Set the level for the next race.</p>
              </div>

              <div className="chip-grid chip-grid-triple">
                {["easy", "medium", "hard"].map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={roomState.difficulty === level ? "chip active" : "chip"}
                    onClick={() => socket.emit("room:setDifficulty", { roomCode, difficulty: level })}
                    disabled={roomState.status !== "waiting"}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-section">
              <div className="section-heading">
                <h3>Finish Target</h3>
                <p>Choose how many correct steps racers need to win.</p>
              </div>

              <div className="inline-input-group">
                <input
                  className="number-input"
                  type="number"
                  min="1"
                  max="99"
                  value={finishScoreDraft}
                  onChange={(event) => setFinishScoreDraft(event.target.value)}
                  disabled={roomState.status !== "waiting"}
                />
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleFinishScoreApply}
                  disabled={roomState.status !== "waiting"}
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="dashboard-section">
              <div className="card-title-row section-title-row">
                <div className="section-heading">
                  <h3>Session Control</h3>
                  <p>
                    {isReady
                      ? "Everyone is connected and ready to race."
                      : `Waiting for ${minRequired - connectedPlayers} more player${minRequired - connectedPlayers === 1 ? "" : "s"}.`}
                  </p>
                </div>
                <StatusPill label={statusLabel} tone={statusTone} />
              </div>

              <div className="participant-grid">
                {playerEntries.map(([role, player]) => (
                  <div key={role} className={`participant-card ${player.connected ? "connected" : ""}`}>
                    <div className="participant-main">
                      <span className="participant-name">{player.name || CHARACTER_MAP[role]?.name || `Player ${role}`}</span>
                      <span className="participant-role">Player {role}</span>
                    </div>
                    <strong>{player.connected ? "Connected" : "Waiting"}</strong>
                  </div>
                ))}
              </div>

              <div className="button-row button-row-stacked">
                <button
                  className="primary-button"
                  type="button"
                  disabled={!isReady || roomState.status === "active" || roomState.status === "countdown"}
                  onClick={() => socket.emit("race:start", { roomCode })}
                >
                  Start Race
                </button>
                <button className="secondary-button" type="button" onClick={() => socket.emit("race:reset", { roomCode })}>
                  Reset Game
                </button>
              </div>
            </div>

            <div className="dashboard-section">
              <div className="section-heading">
                <h3>Player Screens</h3>
                <p>Open each player screen in a separate tab or on a separate device.</p>
              </div>

              <div className="player-links-grid">
                {launchLinks.map((role) => (
                  <a
                    key={role}
                    href={`/player/${role}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`player-link-btn ${role === "A" || role === "1" ? "turtle-btn" : role === "B" || role === "2" ? "rabbit-btn" : "neutral-btn"}`}
                  >
                    Open {CHARACTER_MAP[role]?.name || `Player ${role}`}
                  </a>
                ))}
              </div>
            </div>

            {matchHistory.length > 0 && (
              <div className="match-history">
                <div className="section-heading">
                  <h3>Recent Winners</h3>
                  <p>Latest race results saved in this browser.</p>
                </div>
                <div className="history-list">
                  {matchHistory.map((match) => (
                    <div key={match.id} className="history-item">
                      <span>{match.winner}</span>
                      <span className="history-time">{match.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <section className="score-card dashboard-main celebration-host" ref={scoreboardRef}>
            {roomState.status === "finished" && <FireworksOverlay message={`${winnerName} wins the race!`} />}

            <div className="card-title-row scoreboard-header">
              <div>
                <h2 className="scoreboard-title">Live Scoreboard</h2>
                <p className="scoreboard-subtitle">
                  Room {roomCode} <span className="fullscreen-room-code">| Fullscreen scoreboard view</span>
                </p>
              </div>
              <div className="scoreboard-actions">
                <StatusPill label={`Finish at ${roomState.finishScore}`} tone="accent" />
                <button className="secondary-button fullscreen-btn" onClick={toggleFullScreen} title="Toggle Fullscreen" type="button">
                  Fullscreen
                </button>
              </div>
            </div>

            <div className="scoreboard-metrics">
              <div className="metric-card">
                <span className="metric-label">Mode</span>
                <strong>{roomState.gameMode === "pair" ? "Two-player race" : "Multiplayer race"}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Connected</span>
                <strong>{connectedPlayers} racers</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Difficulty</span>
                <strong>{roomState.difficulty}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Race Timer</span>
                <strong>{raceDurationLabel}</strong>
              </div>
              <div className={`metric-card warning-card ${hasOvertimeWarning ? "active" : ""}`}>
                <span className="metric-label">Warning Signal</span>
                <div className="warning-signal">
                  <span className={`warning-light ${hasOvertimeWarning ? "alert" : "safe"}`}></span>
                  <strong>{hasOvertimeWarning ? "Over 3 minutes" : "Normal"}</strong>
                </div>
              </div>
            </div>

            {roomState.status === "countdown" && <div className="dashboard-banner info">Starting in {roomState.countdown}...</div>}
            {hasOvertimeWarning && <div className="dashboard-banner warning">Warning: the race has been active for more than 3 minutes.</div>}
            {roomState.status === "finished" && (
              <div className="dashboard-banner success celebration-banner">
                Finish! {winnerName} reached {roomState.finishScore} points in {raceDurationLabel}.
              </div>
            )}
            {error && <p className="error-text dashboard-error">{error}</p>}

            <RaceTrack players={roomState.players} finishScore={roomState.finishScore} winner={roomState.winner} />
          </section>
        </section>
      )}
    </main>
  );
}
