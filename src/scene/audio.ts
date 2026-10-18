const KISS_SRC = "/sfx/kiss.mp3";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    audioCtx = audioCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    // Mobile browsers hand back a suspended context until a user gesture has
    // touched it; resuming here is a no-op once it is already running.
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

/** Call from the first user gesture so the context is live before the first
 * cue has to fire, and so the kiss sample is decoded and ready by then. */
export function unlockAudio(): void {
  if (getCtx()) void loadKissBuffer();
}

let kissBuffer: AudioBuffer | null = null;
let kissLoad: Promise<AudioBuffer | null> | null = null;
let kissVoice: AudioBufferSourceNode | null = null;

function loadKissBuffer(): Promise<AudioBuffer | null> {
  kissLoad ??= (async () => {
    const ctx = getCtx();
    if (!ctx) return null;
    try {
      const res = await fetch(KISS_SRC);
      if (!res.ok) return null;
      const bytes = await res.arrayBuffer();
      // Safari still only has the callback form of decodeAudioData.
      kissBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        const maybe = ctx.decodeAudioData(bytes, resolve, reject);
        if (maybe) void maybe.then(resolve, reject);
      });
      return kissBuffer;
    } catch {
      return null;
    }
  })();
  return kissLoad;
}

/** Short upward-then-down blip — boarding/disembarking footstep cue. */
export function playBoop(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(560, t0);
  osc.frequency.exponentialRampToValueAtTime(300, t0 + 0.12);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.2);
}

/** Two quick descending blips — the synthesized stand-in used when the
 * recorded kiss sample is unavailable (offline, decode failure, no WebAudio). */
export function playSmoochFallback(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [0, 0.14].forEach((delay) => {
    const t = t0 + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.11);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  });
}

/**
 * The recorded smooch for the kiss beat. The sample is ~2.2s, cut to match
 * the kiss hold, so it ends on its own; stopKiss() only matters when the
 * player retries early. Falls back to the synthesized blips if the sample
 * is not ready or could not be decoded.
 */
export function playKiss(): void {
  const ctx = getCtx();
  if (!ctx) return;

  const start = (buffer: AudioBuffer): void => {
    stopKiss();
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.onended = () => {
      if (kissVoice === src) kissVoice = null;
    };
    src.start();
    kissVoice = src;
  };

  if (kissBuffer) {
    start(kissBuffer);
    return;
  }

  // Not decoded yet: fire the synth cue now so the beat is never silent, and
  // let the sample finish loading for the next kiss.
  playSmoochFallback();
  void loadKissBuffer();
}

/** Cuts the kiss sample short — used when the kiss beat is interrupted. */
export function stopKiss(): void {
  if (!kissVoice) return;
  try {
    kissVoice.stop();
  } catch {
    // already stopped
  }
  kissVoice = null;
}

/** Slide-whistle-ish descending sting for game over. */
export function playGameOverSting(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(520, t0);
  osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.6);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.7);
}
