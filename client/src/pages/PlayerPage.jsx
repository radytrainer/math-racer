import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import QuestionCard from "../components/QuestionCard";
import StatusPill from "../components/StatusPill";
import { useSocket } from "../context/SocketContext";
import { useSound } from "../utils/useSound";

const icons = {
  A: "🐢",
  B: "🐇"
};

export default function PlayerPage() {
  const { role } = useParams();
  const playerRole = String(role || "").toUpperCase() === "B" ? "B" : "A";
  const { socket, roomState, error } = useSocket();
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState(playerRole === "A" ? "Turtle" : "Rabbit");
  const [answer, setAnswer] = useState("");
  const [joined, setJoined] = useState(false);
  const [prevQuestion, setPrevQuestion] = useState("");
  const { playCorrect, playIncorrect, playWin } = useSound();

  useEffect(() => {
    if (!joined) {
      return;
    }

    socket.emit("room:join", {
      roomCode,
      role: playerRole,
      name: playerName
    });
  }, [joined, playerName, playerRole, roomCode, socket]);

  const player = roomState?.players?.[playerRole];
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
        if (roomState?.winner === playerRole) playWin();
        setPrevQuestion(prevQuestion + "WIN");
    }
  }, [player?.question, player?.lastResult, prevQuestion, raceState, roomState?.winner, playerRole, playCorrect, playIncorrect, playWin]);

  let helperText = "Solve quickly and move your racer forward.";

  if (raceState === "waiting") {
    helperText = "Waiting for the teacher to start the race.";
  } else if (raceState === "countdown") {
    helperText = `Get ready... ${roomState.countdown}`;
  } else if (raceState === "finished") {
    helperText = roomState.winner === playerRole ? "You won the race!" : "Race finished. Great effort!";
  }

  return (
    <main className="dark-player-screen">
      {roomState?.status === "countdown" && (
        <div className="countdown-overlay">
          {roomState.countdown}
        </div>
      )}
      {!joined ? (
        <div className="dark-theme-wrapper">
          <h1 className="join-title">JOIN THE RACE</h1>
          <div className="join-container">
            <div className="avatar-section">
               <div className="avatar-glow-ring">
                 <div className="avatar-image">
                    <span className="avatar-role-text">{playerRole}</span>
                 </div>
                 <div className="online-badge">ONLINE</div>
               </div>
               <h2 className="player-label">PLAYER {playerRole}</h2>
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
      ) : (
        <div className="dark-theme-wrapper playing-wrapper">
          <div className="player-top-header">
            <div className="player-info-row">
              <div className="avatar-info">
                <div className="small-avatar-ring">
                  <span className="small-avatar-text">{playerRole}</span>
                </div>
                <div className="info-text">
                  <h2>PLAYER {playerRole}</h2>
                  <span className="vehicle-text">ROOM CODE: {roomCode}</span>
                </div>
              </div>
              <div className="score-info">
                <span className="score-label">CURRENT SCORE</span>
                <span className="score-value">{player?.score || 0}</span>
              </div>
            </div>
            <div className="player-progress-bar">
               <div className="progress-fill" style={{ width: `${Math.min(((player?.score || 0) / (roomState?.finishScore || 15)) * 100, 100)}%`, background: playerRole === 'A' ? '#00f0ff' : '#f97316' }}></div>
               <div className="progress-flag">🏁</div>
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
                  role: playerRole,
                  answer
                });
                setAnswer("");
              }}
            />
          )}
        </div>
      )}
    </main>
  );
}
