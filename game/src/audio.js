// All sound is synthesized with WebAudio — no audio files, no network.
// The context is created lazily on the first user gesture (browsers block it
// before one); screenshot mode never touches it at all.
let context = null;
let master = null;
let muted = false;

function ensureContext() {
  if (context) return context;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    context = new AC();
    master = context.createGain();
    master.gain.value = 0.22;
    master.connect(context.destination);
  } catch {
    context = null;
  }
  return context;
}

export function unlockAudio() {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function tone({ type = 'sine', from = 440, to = null, seconds = 0.15, volume = 1, delay = 0 }) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx || !master) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
  osc.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(start + seconds + 0.05);
}

function noise({ seconds = 0.2, volume = 0.6, lowpass = 1200, delay = 0 }) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx || !master) return;
  const start = ctx.currentTime + delay;
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(start);
}

export const sfx = {
  shoot() {
    tone({ type: 'square', from: 740, to: 320, seconds: 0.09, volume: 0.35 });
  },
  hit() {
    noise({ seconds: 0.12, volume: 0.5, lowpass: 900 });
    tone({ type: 'triangle', from: 220, to: 90, seconds: 0.12, volume: 0.4 });
  },
  kill() {
    tone({ type: 'sawtooth', from: 330, to: 60, seconds: 0.22, volume: 0.4 });
    noise({ seconds: 0.18, volume: 0.35, lowpass: 1600 });
  },
  ember() {
    tone({ type: 'sine', from: 880, to: 1320, seconds: 0.1, volume: 0.3 });
  },
  heart() {
    tone({ type: 'sine', from: 523, seconds: 0.12, volume: 0.4 });
    tone({ type: 'sine', from: 784, seconds: 0.18, volume: 0.4, delay: 0.09 });
  },
  power() {
    tone({ type: 'sine', from: 392, seconds: 0.1, volume: 0.4 });
    tone({ type: 'sine', from: 523, seconds: 0.1, volume: 0.4, delay: 0.08 });
    tone({ type: 'sine', from: 659, seconds: 0.16, volume: 0.4, delay: 0.16 });
  },
  hurt() {
    tone({ type: 'sawtooth', from: 160, to: 50, seconds: 0.3, volume: 0.55 });
    noise({ seconds: 0.25, volume: 0.4, lowpass: 500 });
  },
  wave() {
    tone({ type: 'triangle', from: 196, to: 392, seconds: 0.5, volume: 0.35 });
    tone({ type: 'triangle', from: 294, to: 588, seconds: 0.5, volume: 0.25, delay: 0.12 });
  },
  over() {
    tone({ type: 'sawtooth', from: 220, to: 55, seconds: 0.9, volume: 0.45 });
    tone({ type: 'sine', from: 110, to: 55, seconds: 1.0, volume: 0.3, delay: 0.2 });
  },
  click() {
    tone({ type: 'sine', from: 660, to: 880, seconds: 0.07, volume: 0.3 });
  },
};
