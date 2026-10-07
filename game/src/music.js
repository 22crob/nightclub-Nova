// The club's music. Real songs (MP3s in assets/music/, added with
// tools/add_song.py, listed in SONG_FILES) play when there are any; without
// them, a simple house beat made with Web Audio (SYNTH_TRACKS). It plays
// while the DJ does, which is always once the club is open. During a Bass
// Boost (see boost.js) a low-shelf filter turns the bass way up.
//
// Beats are counted a little ahead of time from a short timer, the usual
// way to keep Web Audio rhythm steady: for a real song from its measured
// tempo and first beat, so the speakers bump in time with it.
import { SFX } from './sfx.js';

const STEPS = 32; // two bars
const VOLUME = 0.16;
const BOOST_VOLUME = 0.22;
const SONG_VOLUME = 0.6;
const SONG_BOOST_VOLUME = 0.75;
const BOOST_BASS_DB = 14;

// The real songs: only ones the game may use (Pixabay Music's licence lets
// games use its tracks without credit; we credit them anyway). tools/
// add_song.py shrinks each into assets/music/ and measures bpm (tempo) and
// offset (seconds to the first beat); lengthMs is how long it plays.
const SONG_FILES = [
  { file: 'deep-house-sunset.mp3', title: 'Deep House Sunset', artist: 'Sunset House Grooves', bpm: 122.51, offset: 0.464, lengthMs: 191184 },
  { file: 'sunset-house-classic.mp3', title: 'Sunset House Classic', artist: 'Sunset House Grooves', bpm: 128.19, offset: 0.139, lengthMs: 243312 },
  { file: 'house-july.mp3', title: 'House July', artist: 'Easy Eva', bpm: 127.0, offset: 0.441, lengthMs: 65207 },
];
const songUrls = import.meta.glob('./assets/music/*.mp3', { eager: true, import: 'default' });
const SONGS_REAL = SONG_FILES.filter((s) => songUrls[`./assets/music/${s.file}`])
  .map((s) => ({ ...s, url: songUrls[`./assets/music/${s.file}`], kick: [0, 4, 8, 12], clap: [4, 12] }));

// The made-in-code tracks (original names; see the song box in scene/songs.js).
// Each has its own tempo and two-bar pattern: kick and clap steps (of 16,
// repeated each bar), a bassline in semitones above A1 (55 Hz) on each 16th
// step (null for a rest), chords (MIDI notes) at the top of each bar, and
// how busy the hi-hats are.
const _ = null;
const SYNTH_TRACKS = [
  { title: 'Basement Lights', artist: 'DJ Nova', bpm: 122, kick: [0, 4, 8, 12], clap: [4, 12], hats: 'house',
    bass: [0, _, 0, _, 12, _, 0, 10, _, 0, _, 7, 0, _, 12, _, 5, _, 5, _, 17, _, 5, 3, _, 3, _, 7, 3, _, 15, _],
    chords: [[57, 60, 64], [62, 65, 69]] },
  { title: 'Neon Heartbeat', artist: 'Kitty Volt', bpm: 128, kick: [0, 4, 8, 12], clap: [4, 12], hats: 'offbeat',
    bass: [_, _, 7, _, _, _, 7, _, _, _, 7, _, _, _, 10, _, _, _, 3, _, _, _, 3, _, _, _, 5, _, _, _, 7, _],
    chords: [[55, 58, 62], [51, 55, 58]] },
  { title: 'Velvet Rope', artist: 'Smooth K', bpm: 96, kick: [0, 7, 10], clap: [4, 12], hats: 'swing',
    bass: [0, _, _, _, _, _, _, 0, _, _, 3, _, _, _, 5, _, 7, _, _, _, _, _, _, 5, _, _, 3, _, _, _, 0, _],
    chords: [[60, 63, 67], [58, 62, 65]] },
  { title: 'Brick City Funk', artist: 'The Low End', bpm: 114, kick: [0, 6, 8, 14], clap: [4, 12], hats: 'busy',
    bass: [0, _, 12, 0, _, 10, _, 12, 0, _, 7, _, 10, _, 12, _, 5, _, 17, 5, _, 15, _, 17, 5, _, 12, _, 15, _, 17, _],
    chords: [[57, 61, 64], [62, 66, 69]] },
  { title: 'Last Call', artist: 'Midnight Ave', bpm: 124, kick: [0, 4, 8, 12], clap: [4, 12], hats: 'house',
    bass: [0, _, _, 0, _, _, 0, _, 3, _, _, 3, _, _, 5, _, 7, _, _, 7, _, _, 7, _, 5, _, _, 5, _, _, 3, _],
    chords: [[57, 60, 64], [53, 57, 60]] },
];
// What the DJ plays: the real songs, or the made-in-code ones if there are none.
export const TRACKS = SONGS_REAL.length ? SONGS_REAL : SYNTH_TRACKS;
const hz = (semi) => 55 * 2 ** (semi / 12);

export const Music = {
  playing: false,
  boosted: false,
  nodes: null,
  timer: null,
  nextTime: 0,
  step: 0,
  track: TRACKS[0],

  // Switches to another track (a real song starts from its beginning; a
  // made-in-code one carries on from the next 16th note).
  setTrack(i) {
    this.track = TRACKS[((i % TRACKS.length) + TRACKS.length) % TRACKS.length];
    this.songPos = 0;
    if (this.playing && this.track.url) this.playSong(0);
    else if (this.source) { this.source.stop(); this.source = null; }
  },

  // A real song's sound, decoded once and kept while it's the current one.
  loadSong(track) {
    if (this.loaded && this.loaded.url === track.url) return this.loaded.promise;
    const promise = fetch(track.url).then((r) => r.arrayBuffer()).then((data) => SFX.ctx.decodeAudioData(data));
    this.loaded = { url: track.url, promise };
    return promise;
  },

  // Plays the current real song from `pos` seconds, and lines the beat
  // counter up with it.
  playSong(pos) {
    const ctx = SFX.ctx;
    const track = this.track;
    if (this.source) { this.source.stop(); this.source = null; }
    this.loadSong(track).then((buffer) => {
      if (!this.playing || this.track !== track) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(this.nodes.master);
      const at = ctx.currentTime + 0.05;
      src.start(at, pos % buffer.duration);
      this.source = src;
      this.songStart = at - pos;
      const stepDur = 60 / track.bpm / 4;
      const k = Math.max(0, Math.ceil((at - this.songStart - track.offset) / stepDur));
      this.step = k % STEPS;
      this.nextTime = this.songStart + track.offset + k * stepDur;
    }).catch(() => {});
  },

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
    if (this.track.url) {
      this.nextTime = Infinity;     // the beat waits for the song to load
      this.playSong(this.songPos || 0);
    }
    this.timer = setInterval(() => this.schedule(), 25);
  },

  stop() {
    if (!this.playing) return;
    clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
    if (this.source) {
      this.songPos = SFX.ctx.currentTime - this.songStart;    // carry on from here next time
      this.source.stop();
      this.source = null;
    }
  },

  setBoost(on) {
    this.boosted = on;
    this.applyLevels();
  },

  // Volume and bass, following the mute button and the boost.
  applyLevels() {
    if (!this.nodes) return;
    const t = SFX.ctx.currentTime;
    const song = !!this.track.url;
    const volume = SFX.muted ? 0 : this.boosted ? (song ? SONG_BOOST_VOLUME : BOOST_VOLUME) : (song ? SONG_VOLUME : VOLUME);
    this.nodes.master.gain.setTargetAtTime(volume, t, 0.05);
    this.nodes.shelf.gain.setTargetAtTime(this.boosted ? BOOST_BASS_DB : 0, t, 0.3);
  },

  schedule() {
    const ctx = SFX.ctx;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.track.bpm / 4; // one 16th note
      this.step = (this.step + 1) % STEPS;
    }
  },

  playStep(i, t) {
    const tr = this.track;
    const s = i % 16;
    if (this.onStep) this.onStep(s, t - SFX.ctx.currentTime); // the speakers move to it (speakers.js)
    if (tr.url) return; // a real song: just the beat count, the song is the sound
    if (tr.kick.includes(s)) this.kick(t);
    if (tr.clap.includes(s)) this.clap(t);
    if (tr.hats === 'house') {
      if (s % 4 === 2) this.hat(t, 0.09, 0.35);
      else if (s % 2 === 1) this.hat(t, 0.03, 0.12);
    } else if (tr.hats === 'offbeat') {
      if (s % 4 === 2) this.hat(t, 0.12, 0.4);
    } else if (tr.hats === 'swing') {
      if (s % 4 === 0 || s % 4 === 3) this.hat(t, 0.04, 0.2);
    } else if (s % 2 === 0 || s % 4 === 3) {
      this.hat(t, 0.03, s % 4 === 2 ? 0.3 : 0.14); // busy
    }
    if (tr.bass[i] != null) this.bass(t, hz(tr.bass[i]));
    if (i === 0 || i === 16) this.chord(t, tr.chords[i === 0 ? 0 : 1]);
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
