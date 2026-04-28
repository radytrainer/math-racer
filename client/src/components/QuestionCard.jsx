export default function QuestionCard({
  question,
  value,
  onChange,
  onSubmit,
  disabled,
  feedback,
  helperText
}) {
  return (
    <div className="playing-split-layout">
      {/* Left Panel */}
      <div className="playing-left-panel">
        <div className="panel-badge">🎮 CHALLENGE MODE</div>
        
        <div className="question-content">
          <div className="question-label-box">
             <span className="question-icon">⛑️</span>
             <span className="question-label">QUESTION</span>
          </div>
          
          <div className="huge-question">{question}</div>
          
          <div className={`answer-display-box ${feedback === "incorrect" ? "shake" : ""}`}>
            {value ? value : <span className="placeholder">?</span>}
          </div>
          
          <div className="feedback-text">
            {feedback === "correct" && <span className="success-text">Correct! Speed up!</span>}
            {feedback === "incorrect" && <span className="danger-text">Not quite. Try again!</span>}
            {!feedback && <span>{helperText}</span>}
          </div>
        </div>
        
        <div className="sync-badge">⟳ SYNCING...</div>
      </div>

      {/* Right Panel */}
      <form
        className="playing-right-panel"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="right-panel-header">
          <span className="streak-badge">⚡ FAST PACE</span>
        </div>
        
        <div className="dark-keypad-grid">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "DEL"].map((key) => (
            <button
              key={key}
              type="button"
              className={`dark-keypad-btn ${key === "C" ? "keypad-clear" : key === "DEL" ? "keypad-del" : ""}`}
              onClick={() => {
                if (disabled) return;
                if (key === 'C') onChange("");
                else if (key === 'DEL') onChange(String(value).slice(0, -1));
                else {
                  if (String(value) === "0" && key !== "0") onChange(key);
                  else if (String(value) === "0" && key === "0") { /* do nothing */ }
                  else onChange(String(value) + key);
                }
              }}
              disabled={disabled}
            >
              <span>{key === "DEL" ? "⌫" : key}</span>
            </button>
          ))}
        </div>
        
        <button 
          className="join-game-btn submit-answer-btn" 
          type="submit" 
          disabled={disabled || value === ""}
        >
          <span className="btn-text">SUBMIT ANSWER ⚡</span>
        </button>
      </form>
    </div>
  );
}
