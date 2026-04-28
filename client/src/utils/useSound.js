import { useCallback } from "react";

const playTone = (frequency, type, duration) => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
  oscillator.stop(audioCtx.currentTime + duration);
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
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      setTimeout(() => playTone(freq, "sine", 0.2), i * 150);
    });
  }, []);

  return { playCorrect, playIncorrect, playCountdown, playGo, playWin };
}
