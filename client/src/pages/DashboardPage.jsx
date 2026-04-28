import { useEffect, useState, useRef } from "react";
import RaceTrack from "../components/RaceTrack";
import StatusPill from "../components/StatusPill";
import { useSocket } from "../context/SocketContext";
import { createRoom } from "../utils/api";
import { useSound } from "../utils/useSound";

export default function DashboardPage() {
  const { socket, roomState, error } = useSocket();
  const [roomCode, setRoomCode] = useState("");
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
    createRoom()
      .then((room) => {
        setRoomCode(room.roomCode);
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

  const players = roomState?.players;
  const isReady = players?.A?.connected && players?.B?.connected;

  useEffect(() => {
    if (roomState?.status === "countdown" && roomState.countdown !== prevCountdown) {
        playCountdown();
        setPrevCountdown(roomState.countdown);
    } else if (roomState?.status === "active" && prevCountdown !== 0) {
        playGo();
        setPrevCountdown(0);
    }

    if (roomState?.status === "finished" && roomState.winner !== prevWinner) {
        playWin();
        setPrevWinner(roomState.winner);
        
        const winnerName = roomState.players[roomState.winner].name;
        const newEntry = {
            id: Date.now(),
            roomCode: roomCode,
            winner: winnerName,
            role: roomState.winner,
            date: new Date().toLocaleTimeString()
        };
        setMatchHistory(prev => {
            const updated = [newEntry, ...prev].slice(0, 5);
            localStorage.setItem("racer_history", JSON.stringify(updated));
            return updated;
        });
    }
  }, [roomState?.status, roomState?.countdown, roomState?.winner, roomState?.players, prevCountdown, prevWinner, playCountdown, playGo, playWin, roomCode]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      if (scoreboardRef.current) {
        scoreboardRef.current.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <main className="page-shell dashboard-shell">
      {roomState?.status === "countdown" && (
        <div className="countdown-overlay">
          {roomState.countdown}
        </div>
      )}
      <section className="hero-card">
        <div className="hero-content">
          <p className="eyebrow">Teacher Dashboard</p>
          <h1>Racing Calculator</h1>
          <p className="hero-copy">
            Share the room code with both players, then watch the turtle and rabbit race in real time.
          </p>
        </div>

        <div className="room-panel">
          <label className="field-label" htmlFor="room-code">
            Room Code
          </label>
          <input
            id="room-code"
            className="room-code-input"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            maxLength={6}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="secondary-button"
              type="button"
              style={{ flex: 1 }}
              onClick={async () => {
                const room = await createRoom();
                setRoomCode(room.roomCode);
              }}
            >
              New Room
            </button>
          </div>
        </div>
      </section>

      {roomState && (
        <>
          <section className="dashboard-grid">
            <div className="control-card">
              <div className="card-title-row">
                <h2>Session Control</h2>
                <StatusPill
                  label={roomState.status === "waiting" ? "Waiting" : roomState.status}
                  tone={roomState.status === "finished" ? "success" : "neutral"}
                />
              </div>

              <div className="status-grid">
                <div className="status-box">
                  <span>Player A</span>
                  <strong>{roomState.players.A.connected ? "Connected" : "Waiting"}</strong>
                </div>
                <div className="status-box">
                  <span>Player B</span>
                  <strong>{roomState.players.B.connected ? "Connected" : "Waiting"}</strong>
                </div>
              </div>

              <div className="difficulty-row">
                {["easy", "medium", "hard"].map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={roomState.difficulty === level ? "chip active" : "chip"}
                    onClick={() => socket.emit("room:setDifficulty", { roomCode, difficulty: level })}
                  >
                    {level}
                  </button>
                ))}
              </div>

              <div className="button-row">
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

              <div className="player-links-row">
                <a href="/player/A" target="_blank" rel="noreferrer" className="player-link-btn turtle-btn">
                  🐢 Open Player A
                </a>
                <a href="/player/B" target="_blank" rel="noreferrer" className="player-link-btn rabbit-btn">
                  🐇 Open Player B
                </a>
              </div>

              {roomState.status === "countdown" && <div className="countdown-banner">Starting in {roomState.countdown}...</div>}
              {roomState.status === "finished" && (
                <div className="winner-banner">
                  Winner: {roomState.winner === "A" ? `🐢 ${roomState.players.A.name}` : `🐇 ${roomState.players.B.name}`}
                </div>
              )}
              {error && <p className="error-text">{error}</p>}
              
              {matchHistory.length > 0 && (
                <div className="match-history">
                  <h3>Recent Winners</h3>
                  <div className="history-list">
                    {matchHistory.map(match => (
                      <div key={match.id} className="history-item">
                         <span>{match.role === "A" ? "🐢" : "🐇"} {match.winner}</span>
                         <span className="history-time">{match.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="score-card" ref={scoreboardRef}>
              <div className="card-title-row">
                <h2 className="scoreboard-title">
                  Live Scoreboard
                  <span className="fullscreen-room-code"> — Room: {roomCode}</span>
                </h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <StatusPill label={`Finish at ${roomState.finishScore}`} tone="accent" />
                  <button 
                    className="secondary-button fullscreen-btn" 
                    onClick={toggleFullScreen} 
                    style={{ padding: '8px 12px' }}
                    title="Toggle Fullscreen"
                  >
                    ⛶
                  </button>
                </div>
              </div>

              <RaceTrack players={roomState.players} finishScore={roomState.finishScore} winner={roomState.winner} />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
