import { useCallback } from "react";

const playTone = (frequency, type, duration, volume = 0.06) => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);

  oscillator.start();
  gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
  oscillator.stop(audioCtx.currentTime + duration);
  oscillator.onended = () => {
    audioCtx.close().catch(() => {});
  };
};

export function useSound() {
  const playCorrect = useCallback(() => {
    playTone(523.25, "sine", 0.1); // C5
    setTimeout(() => playTone(659.25, "sine", 0.2), 100); // E5
  }, []);

  const playIncorrect = useCallback(() => {
    playTone(300, "sawtooth", 0.2);
    setTimeout(() => playTone(250, "sawtooth", 0.3), 150);
  }, []);

  const playCountdown = useCallback(() => {
    playTone(440, "square", 0.1); // A4
  }, []);

  const playGo = useCallback(() => {
    playTone(880, "square", 0.4); // A5
  }, []);

  const playWin = useCallback(() => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      setTimeout(() => playTone(freq, "triangle", 0.24, 0.08), i * 150);
    });

    setTimeout(() => playTone(120, "sawtooth", 0.45, 0.09), 120);
    setTimeout(() => playTone(180, "triangle", 0.3, 0.05), 260);
  }, []);

  return { playCorrect, playIncorrect, playCountdown, playGo, playWin };
}
