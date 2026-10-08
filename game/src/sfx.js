// Sound effects.

// ---------------------------------------------------------------------
// Sound effects — plain Web Audio oscillators with a short attack/decay
// envelope, not audio files, so the game stays a single self-contained
// page (no assets to load, nothing that can 404 or trip a CORS issue).
// Muted state is a device preference, not club progress, so it's kept
// under its own localStorage key instead of living in the save file.
// ---------------------------------------------------------------------
export const SFX_MUTE_KEY = 'clubNovaMuted_v1';
export const SFX = {
  ctx: null,
  muted: (() => {
    try { return localStorage.getItem(SFX_MUTE_KEY) === '1'; } catch (e) { return false; }
  })(),

  // Browsers refuse to make sound until a real user gesture has happened.
  // Safe to call repeatedly — only builds the AudioContext once.
  unlock() {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
    } catch (e) {
      this.ctx = null; // Web Audio unsupported — every SFX call below becomes a silent no-op
    }
  },

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem(SFX_MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* best-effort */ }
  },

  // One short oscillator "blip" with a quick linear attack and exponential
  // decay, so it reads as a soft percussive hit rather than a harsh beep.
  tone(freq, { duration = 0.12, type = 'sine', gain = 0.15, delay = 0 } = {}) {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  },

  place() { this.tone(220, { duration: 0.1, type: 'triangle', gain: 0.18 }); },
  sell() {
    this.tone(320, { duration: 0.09, type: 'triangle', gain: 0.14 });
    this.tone(200, { duration: 0.12, type: 'triangle', gain: 0.12, delay: 0.05 });
  },
  tip() {
    this.tone(880, { duration: 0.08, type: 'sine', gain: 0.12 });
    this.tone(1320, { duration: 0.14, type: 'sine', gain: 0.12, delay: 0.06 });
  },
  denied() { this.tone(140, { duration: 0.1, type: 'square', gain: 0.08 }); },
  expand() {
    // A low-to-high "whoosh" of three quick notes — distinct from both the
    // single blip of a normal placement and levelUp()'s longer fanfare,
    // since growing the floor itself is a bigger, rarer purchase than any
    // one prop but isn't tied to a level-up moment.
    this.tone(220, { duration: 0.1, type: 'sawtooth', gain: 0.12, delay: 0 });
    this.tone(330, { duration: 0.1, type: 'sawtooth', gain: 0.14, delay: 0.08 });
    this.tone(440, { duration: 0.2, type: 'sawtooth', gain: 0.16, delay: 0.16 });
  },
  // Bar Tricks: a cocktail shaker's quick rattle, then a little ding.
  shaker() {
    for (let i = 0; i < 6; i++) this.tone(i % 2 ? 1900 : 2300, { duration: 0.035, type: 'square', gain: 0.05, delay: i * 0.055 });
    this.tone(1568, { duration: 0.2, type: 'sine', gain: 0.12, delay: 0.38 });
  },
  // A bouncer walks a troublemaker out: a two-note whistle.
  whistle() {
    this.tone(1760, { duration: 0.12, type: 'sine', gain: 0.1 });
    this.tone(2350, { duration: 0.22, type: 'sine', gain: 0.1, delay: 0.14 });
  },
  // Restocking the bars: bottles clinking.
  clink() {
    for (const [f, d] of [[2637, 0], [3136, 0.09], [2794, 0.17], [3520, 0.26]]) this.tone(f, { duration: 0.09, type: 'triangle', gain: 0.08, delay: d });
  },
  // A party starts: a party-horn blare over the fanfare.
  partyHorn() {
    this.tone(392, { duration: 0.32, type: 'sawtooth', gain: 0.1 });
    this.tone(494, { duration: 0.32, type: 'sawtooth', gain: 0.08 });
    this.tone(587, { duration: 0.45, type: 'sawtooth', gain: 0.08, delay: 0.1 });
    this.levelUp();
  },
  // An achievement: a bright arpeggio with a sparkle on top.
  trophy() {
    [523, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, { duration: 0.14, type: 'triangle', gain: 0.14, delay: i * 0.07 }));
    this.tone(2093, { duration: 0.35, type: 'sine', gain: 0.08, delay: 0.38 });
  },
  levelUp() {
    // A short ascending 4-note fanfare — a bigger moment than a tip or a
    // placement, so it gets more notes and a brighter waveform.
    this.tone(523, { duration: 0.12, type: 'triangle', gain: 0.16, delay: 0 });
    this.tone(659, { duration: 0.12, type: 'triangle', gain: 0.16, delay: 0.1 });
    this.tone(784, { duration: 0.12, type: 'triangle', gain: 0.16, delay: 0.2 });
    this.tone(1047, { duration: 0.22, type: 'triangle', gain: 0.18, delay: 0.32 });
  },
};
