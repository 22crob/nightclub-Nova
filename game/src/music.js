// The club's music: a simple house beat made with Web Audio (no audio
// files, so the game stays one self-contained page). It plays while the DJ
// does, which is always once the club is open. During a Drop the Bass
// boost (see boost.js) a low-shelf filter turns the bass way up and a sub
// bass joins in.
//
// Notes are scheduled a little ahead of time from a short timer, the usual
// way to keep Web Audio rhythm steady.
import { SFX } from './sfx.js';

const BPM = 122;
const STEP = 60 / BPM / 4; // one 16th note, in seconds
const STEPS = 32; // two bars
const VOLUME = 0.16;
const BOOST_VOLUME = 0.22;
const BOOST_BASS_DB = 14;

// Bassline: semitones above A1 (55 Hz) on each 16th step, null for a rest.
const BASS = [
  0, null, 0, null, 12, null, 0, 10, null, 0, null, 7, 0, null, 12, null,
  5, null, 5, null, 17, null, 5, 3, null, 3, null, 7, 3, null, 15, null,
];
const hz = (semi) => 55 * 2 ** (semi / 12);

export const Music = {
  playing: false,
  boosted: false,
  nodes: null,
  timer: null,
  nextTime: 0,
  step: 0,

  // Starts the beat, if sound is available (it needs a user gesture first:
  // see SFX.unlock()).
  start() {
    const ctx = SFX.ctx;
    if (this.playing || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!this.nodes) {
      const master = ctx.createGain();
      const shelf = ctx.createBiquadFilter();
      shelf.type = 'lowshelf';
      shelf.frequency.value = 140;
      shelf.gain.value = 0;
      master.connect(shelf);
      shelf.connect(ctx.destination);
      const noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.nodes = { master, shelf, noise };
    }
    this.applyLevels();
    this.playing = true;
    this.nextTime = ctx.currentTime + 0.05;
    this.step = 0;
    this.timer = setInterval(() => this.schedule(), 25);
  },

  stop() {
    if (!this.playing) return;
    clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
  },

  setBoost(on) {
    this.boosted = on;
    this.applyLevels();
  },

  // Volume and bass, following the mute button and the boost.
  applyLevels() {
    if (!this.nodes) return;
    const t = SFX.ctx.currentTime;
    const volume = SFX.muted ? 0 : (this.boosted ? BOOST_VOLUME : VOLUME);
    this.nodes.master.gain.setTargetAtTime(volume, t, 0.05);
    this.nodes.shelf.gain.setTargetAtTime(this.boosted ? BOOST_BASS_DB : 0, t, 0.3);
  },

  schedule() {
    const ctx = SFX.ctx;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % STEPS;
    }
  },

  playStep(i, t) {
    if (i % 4 === 0) this.kick(t);
    if (i % 8 === 4) this.clap(t);
    if (i % 4 === 2) this.hat(t, 0.09, 0.35);
    else if (i % 2 === 1) this.hat(t, 0.03, 0.12);
    if (BASS[i] != null) this.bass(t, hz(BASS[i]));
    if (i === 0 || i === 16) this.chord(t, i === 0 ? [57, 60, 64] : [62, 65, 69]);
  },

  voice(t, type, freq, gain, attack, decay, filter) {
    const ctx = SFX.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    let out = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      osc.connect(f);
      out = f;
    }
    out.connect(g);
    g.connect(this.nodes.master);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
    return osc;
  },

  kick(t) {
    const osc = this.voice(t, 'sine', 150, this.boosted ? 1.3 : 1.0, 0.003, 0.32);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  },

  bass(t, freq) {
    this.voice(t, 'sawtooth', freq, 0.35, 0.01, 0.2, this.boosted ? 900 : 520);
    if (this.boosted) this.voice(t, 'sine', freq / 2, 0.55, 0.01, 0.24);
  },

  noiseHit(t, type, freq, gain, decay) {
    const ctx = SFX.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.nodes.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f);
    f.connect(g);
    g.connect(this.nodes.master);
    src.start(t);
    src.stop(t + decay + 0.02);
  },

  hat(t, decay, gain) { this.noiseHit(t, 'highpass', 7500, gain, decay); },
  clap(t) { this.noiseHit(t, 'bandpass', 1600, 0.6, 0.14); },

  // A soft chord stab (MIDI note numbers) at the top of each bar.
  chord(t, notes) {
    for (const n of notes) this.voice(t, 'triangle', 440 * 2 ** ((n - 69) / 12), 0.07, 0.02, 0.5);
  },
};
