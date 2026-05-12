const BURST_COUNT = 10;

export default function FireworksOverlay({ message }) {
  return (
    <div className="fireworks-overlay" aria-hidden="true">
      {Array.from({ length: BURST_COUNT }).map((_, index) => (
        <span
          key={index}
          className="firework-burst"
          style={{
            "--burst-left": `${8 + ((index * 9) % 84)}%`,
            "--burst-top": `${12 + ((index * 13) % 56)}%`,
            "--burst-delay": `${index * 0.18}s`
          }}
        />
      ))}
      {message && <div className="fireworks-message">{message}</div>}
    </div>
  );
}
