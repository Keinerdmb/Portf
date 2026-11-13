// Sintetizador ligero usando Web Audio API nativa (0 archivos externos, 0 KB de descarga)

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function playTone(
  enabled: boolean,
  freq: number,
  duration = 0.08,
  type: OscillatorType = 'triangle',
  volume = 0.08
): void {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playStartHorn(enabled: boolean): void {
  if (!enabled) return;
  playTone(true, 220, 0.14, 'triangle', 0.09);
  setTimeout(() => playTone(true, 330, 0.18, 'triangle', 0.09), 110);
  setTimeout(() => playTone(true, 440, 0.28, 'sine', 0.1), 230);
}

export function playCannonHit(enabled: boolean): void {
  if (!enabled) return;
  playTone(true, 130, 0.12, 'sawtooth', 0.1);
  setTimeout(() => playTone(true, 587, 0.14, 'triangle', 0.09), 80);
}

export function playHullBump(enabled: boolean): void {
  if (!enabled) return;
  playTone(true, 95, 0.14, 'triangle', 0.11);
}
