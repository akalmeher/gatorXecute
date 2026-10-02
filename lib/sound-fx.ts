/**
 * Zero-dependency Web Audio synthesizer for tactile UI micro-interactions.
 * Generates soft chimes, pops, and celebratory milestone chords natively
 * without any external audio assets or npm packages.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function isAudioMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("gatorxecute_muted") === "true";
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("gatorxecute_muted", muted ? "true" : "false");
}

export function toggleAudioMute(): boolean {
  const next = !isAudioMuted();
  setAudioMuted(next);
  return next;
}

/** Soft tactile pop when moving a task or clicking a primary button */
export function playPop(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.05);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    // Audio autoplay restrictions or unsupported
  }
}

/** Celebratory ascending harmonic chime when all tasks are done or milestone star pops */
export function playMilestoneChime(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // SFSU Gold victory arpeggio: C5, E5, G5, B5, C6, E6
    const freqs = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51];
    const now = ctx.currentTime;

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      const start = now + idx * 0.09;
      const duration = 0.55;

      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    });
  } catch {
    // Audio autoplay restrictions or unsupported
  }
}

/** Delicate twin sparkle sound when clicking the star */
export function playTwinkle(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const freqs = [1174.66, 1567.98, 1975.53]; // D6, G6, B6
    const now = ctx.currentTime;

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      const start = now + idx * 0.07;
      const duration = 0.35;

      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.07, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    });
  } catch {
    // Audio autoplay restrictions or unsupported
  }
}
