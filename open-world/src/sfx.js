// Small sound effects made on the fly with Web Audio (no sound files).
let ctx = null;
let muted = false;
export function initAudio() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
export function setMuted(m) { muted = m; }
export const isMuted = () => muted;

function tone(freq, dur, { type = 'sine', vol = 0.15, slide = 0, delay = 0 } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.12, hi = 2000) {
  if (!ctx || muted) return;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = hi; g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start();
}

export const sfx = {
  swing: () => noise(0.18, 0.18, 1800),
  hit: () => { tone(220, 0.12, { type: 'square', vol: 0.08, slide: -120 }); noise(0.08, 0.1, 900); },
  pop: () => { tone(520, 0.18, { type: 'triangle', vol: 0.12, slide: 500 }); },
  hurt: () => tone(180, 0.25, { type: 'sawtooth', vol: 0.08, slide: -90 }),
  coin: () => { tone(988, 0.08, { type: 'square', vol: 0.05 }); tone(1319, 0.2, { type: 'square', vol: 0.05, delay: 0.07 }); },
  shard: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.09, delay: i * 0.09 })),
  chest: () => [392, 494, 587, 784].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.08, delay: i * 0.07 })),
  talk: () => tone(420 + Math.random() * 80, 0.06, { type: 'square', vol: 0.03 }),
  jump: () => tone(300, 0.12, { type: 'triangle', vol: 0.05, slide: 200 }),
  quest: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.09, delay: i * 0.12 })),
  splash: () => noise(0.3, 0.12, 600),
};
