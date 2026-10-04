// ClubScene methods: Saving and loading the club to localStorage.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PROP_TYPES } from '../catalog.js';
import { BASE_GRID_SIZE, SAVE_KEY } from '../config.js';

export class SaveMixin {
  // A lightweight peek at the save file for just its gridSize, called
  // before the tile grid is built (see create()) — reading the WHOLE save
  // that early isn't possible yet (loadGame() needs the grid/layers to
  // already exist so restoreProp() has somewhere to draw into). Returns
  // null on any missing/corrupt/pre-expansion save, which just means
  // "start at BASE_GRID_SIZE", same as a first-ever play session.
  peekSavedGridSize() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data.gridSize === 'number' && data.gridSize >= BASE_GRID_SIZE) return data.gridSize;
    } catch (e) { /* corrupted save — loadGame() below will also hit and log this */ }
    return null;
  }

  // ---------------------------------------------------------------------
  // Save / load. Patrons are deliberately NOT saved — they're transient
  // visitors, not part of the club's persistent state, so a reload just
  // starts with an empty floor that fills back up as new patrons spawn.
  // ---------------------------------------------------------------------

  // Builds the plain-object save shape: cash, fans, and one entry per
  // distinct placed prop (deduped the same way placedCount() dedupes a
  // multi-tile prop's record, which is stored once per occupied tile).
  serializeState() {
    const seen = new Set();
    const placedList = [];
    for (const key in this.placed) {
      const rec = this.placed[key];
      if (seen.has(rec)) continue;
      seen.add(rec);
      placedList.push({ type: rec.type, facing: rec.facing, anchor: rec.anchor, ...(rec.staff ? { staff: true } : {}) });
    }
    return { cash: this.cash, fans: this.fans, gridSize: this.gridSize, placed: placedList, wallpaper: { ...this.wallpaper }, floorPaint: { ...this.floorPaint }, night: this.night, nightOver: this.nightPhase === 'closed', bestNightProfit: this.bestNightProfit, vips: this.vips || [], nightStars: this.nightStars || [] };
  }

  saveGame() {
    if (this.restarting) return; // don't write the old club back on the way out
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.serializeState()));
    } catch (e) {
      // Private-browsing quota errors, storage disabled, etc. — saving is
      // best-effort and should never break gameplay if it fails.
      console.error('[Club Nova] save failed:', e);
    }
  }

  // Wipes the save and reloads into a brand-new club, after asking (see
  // #restartConfirm in index.html).
  setupRestart() {
    const box = document.getElementById('restartConfirm');
    if (!box) return;
    document.getElementById('restartButton')?.addEventListener('click', () => box.classList.add('open'));
    document.getElementById('restartNo')?.addEventListener('click', () => box.classList.remove('open'));
    document.getElementById('restartYes')?.addEventListener('click', () => this.restartClub());
  }

  restartClub() {
    this.restarting = true;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) { /* storage blocked: the reload just starts as usual */ }
    window.location.reload();
  }

  loadGame() {
    let raw;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (e) {
      console.error('[Club Nova] could not read save:', e);
      return;
    }
    if (!raw) { // first time playing, or storage was cleared
      this.freshClub = true;
      return;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error('[Club Nova] save data was corrupted, starting fresh:', e);
      return;
    }

    if (typeof data.cash === 'number') this.cash = data.cash;
    if (typeof data.fans === 'number') this.fans = data.fans;
    // Already set once, before the tile grid was built, by
    // peekSavedGridSize() in create() — re-applying it here is just
    // defensive (e.g. if this.gridSize somehow got out of sync) and never
    // shrinks it, since a corrupt/missing value just leaves it as-is.
    if (typeof data.gridSize === 'number' && data.gridSize > this.gridSize) this.gridSize = data.gridSize;
    if (Array.isArray(data.placed)) {
      // The DJ booth goes last, so if it has to move (see below) it can't
      // take the place of something else.
      const isBooth = (e) => (e && PROP_TYPES[e.type] && PROP_TYPES[e.type].staff === 'dj' ? 1 : 0);
      const entries = [...data.placed].sort((a, b) => isBooth(a) - isBooth(b));
      for (const entry of entries) {
        if (!entry || !PROP_TYPES[entry.type] || !Array.isArray(entry.anchor)) continue;
        let rec = this.restoreProp(entry.type, entry.facing, entry.anchor);
        // A DJ booth saved against the wall, from before the DJ had their
        // own tiles: move it out into the room until it fits.
        if (!rec && PROP_TYPES[entry.type].staff === 'dj') {
          const out = { 0: [0, 1], 90: [1, 0], 180: [0, -1], 270: [-1, 0] }[entry.facing] || [0, 1];
          for (let k = 1; k <= 3 && !rec; k++) {
            rec = this.restoreProp(entry.type, entry.facing, [entry.anchor[0] + out[0] * k, entry.anchor[1] + out[1] * k]);
          }
        }
        if (rec && entry.staff && PROP_TYPES[entry.type].staff) this.attachStaff(rec);
      }
    }
    // The night to open on load: a reload mid-night replays it, a finished
    // one moves on to the next (see setupNights()).
    if (typeof data.night === 'number') this.savedNight = data.night + (data.nightOver ? 1 : 0);
    if (typeof data.bestNightProfit === 'number') this.bestNightProfit = data.bestNightProfit;
    if (Array.isArray(data.vips)) {
      this.vips = data.vips.filter((v) => v && typeof v.name === 'string' && typeof v.character === 'number')
        .map((v) => ({ name: v.name, character: v.character, visits: Number(v.visits) || 1 }));
    }
    if (Array.isArray(data.nightStars)) this.nightStars = data.nightStars.filter((n) => n >= 1 && n <= 5).slice(-5);
    this.restoreWallpaper(data.wallpaper);
    this.restoreFloorPaint(data.floorPaint);
  }
}
