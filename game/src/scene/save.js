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
      placedList.push({ type: rec.type, facing: rec.facing, anchor: rec.anchor });
    }
    return { cash: this.cash, fans: this.fans, gridSize: this.gridSize, placed: placedList };
  }

  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.serializeState()));
    } catch (e) {
      // Private-browsing quota errors, storage disabled, etc. — saving is
      // best-effort and should never break gameplay if it fails.
      console.error('[Club Nova] save failed:', e);
    }
  }

  loadGame() {
    let raw;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (e) {
      console.error('[Club Nova] could not read save:', e);
      return;
    }
    if (!raw) return; // first time playing, or storage was cleared

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
      for (const entry of data.placed) {
        if (!entry || !PROP_TYPES[entry.type] || !Array.isArray(entry.anchor)) continue;
        this.restoreProp(entry.type, entry.facing, entry.anchor);
      }
    }
  }
}
