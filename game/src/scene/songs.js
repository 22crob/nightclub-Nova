// ClubScene methods: the DJ's songs and the now-playing box, like Nightclub
// City's. The box under the profile shows the track, its artist and when it
// ends on the night's clock; Change skips to the next track, and Like gives
// a fan once a song. Each song plays to its end (songLength()), then the next starts,
// and the dancers cheer a new one. The tracks themselves are in music.js.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { SONGS } from '../config.js';
import { Music, TRACKS } from '../music.js';
import { SFX } from '../sfx.js';

export class SongsMixin {
  currentSong() {
    return TRACKS[this.songIndex || 0];
  }

  // How long the current song plays: a real song its own length, a
  // made-in-code one SONGS.lengthMs.
  songLength() {
    return this.currentSong().lengthMs || SONGS.lengthMs;
  }

  // Starts track `index` (wrapping round the list).
  playSong(index) {
    this.songIndex = ((index % TRACKS.length) + TRACKS.length) % TRACKS.length;
    this.songStartedAt = this.time.now;
    this.songLiked = false;
    Music.setTrack(this.songIndex);
    // The dancers love a new tune.
    for (const p of this.patrons) {
      const c = p.container;
      if (p.gone || p.leaving || typeof c.patronAnimState !== 'string' || !c.patronAnimState.startsWith('dance')) continue;
      p.fun = Math.min(100, p.fun + SONGS.newSongFun);
      this.floatText(c.x, c.y - 70, '♪', '#ff7ae0');
    }
    this.updateSongBox();
  }

  // The Change button: skip to the next track.
  changeSong() {
    if (!this.clubOpen()) { SFX.denied(); return; }
    SFX.unlock();
    this.playSong((this.songIndex || 0) + 1);
    this.showToast(`🎵 Now playing: ${this.currentSong().title} by ${this.currentSong().artist}`);
  }

  // The Like button: a fan, once a song.
  likeSong() {
    if (this.songLiked || !this.clubOpen()) { SFX.denied(); return; }
    this.songLiked = true;
    this.fans += SONGS.likeFans;
    SFX.tip();
    this.updateUI();
    this.updateSongBox();
  }

  // Runs every second: the next song when this one is over.
  tickSongs() {
    if (!this.clubOpen()) return;
    if (this.time.now - this.songStartedAt >= this.songLength()) this.playSong(this.songIndex + 1);
    this.updateSongBox();
  }

  updateSongBox() {
    const box = document.getElementById('songBox');
    if (!box) return;
    const song = this.currentSong();
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el && el.textContent !== text) el.textContent = text;
    };
    set('songTitle', song.title);
    set('songArtist', song.artist);
    const left = Math.max(0, Math.ceil((this.songStartedAt + this.songLength() - this.time.now) / 1000));
    const ends = `Ends in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    set('songEnds', ends);
    const row = box.querySelector('.songText');
    if (row) { row.dataset.tipName = song.title; row.dataset.tipText = `${song.artist} · ${ends}`; }
    const like = document.getElementById('songLike');
    if (like) like.classList.toggle('liked', !!this.songLiked);
  }

  setupSongs() {
    window.__clubMusic = Music; // for tests: is the song really playing?
    document.getElementById('songChange')?.addEventListener('click', () => this.changeSong());
    document.getElementById('songLike')?.addEventListener('click', () => this.likeSong());
    this.playSong(0);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickSongs() });
  }
}
