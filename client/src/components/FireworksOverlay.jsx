const BURST_COUNT = 7;

export default function FireworksOverlay({ message }) {
  return (
    <div className="fireworks-overlay" aria-hidden="true">
      {Array.from({ length: BURST_COUNT }).map((_, index) => (
        <span
          key={index}
          className="firework-burst"
          style={{
            "--burst-left": `${10 + ((index * 12) % 78)}%`,
            "--burst-top": `${8 + ((index * 11) % 42)}%`,
            "--burst-delay": `${index * 0.22}s`,
            "--burst-hue": `${18 + index * 42}deg`
          }}
        />
      ))}
      {message && <div className="fireworks-message">{message}</div>}
    </div>
  );
}
