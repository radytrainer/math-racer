const racers = {
  A: "🐢",
  B: "🐇"
};

export default function RaceTrack({ players, finishScore, winner }) {
  return (
    <div className="track-card">
      {Object.values(players).map((player) => {
        const percent = Math.min((player.score / finishScore) * 100, 100);
        const laneClass = winner === player.role ? "track-lane winner" : "track-lane";

        return (
          <div className={laneClass} key={player.role}>
            <div className="lane-header">
              <span className="lane-name">
                {racers[player.role]} {player.name}
              </span>
              <span className="lane-score">{player.score}/{finishScore}</span>
            </div>
            <div className="lane-strip">
              <div 
                className={`lane-progress lane-progress-${player.role}`} 
                style={{ width: `${percent}%` }}
              />
              <div className="finish-flag">🏁</div>
              <div
                className={`racer-token ${winner === player.role ? "racer-bounce" : ""}`}
                style={{ left: `calc(${percent}% - ${percent === 100 ? 45 : 0}px)` }}
              >
                <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>
                  {racers[player.role]}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
