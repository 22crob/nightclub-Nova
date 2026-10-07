// ClubScene methods: Saving and loading the club to localStorage.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PROP_TYPES } from '../catalog.js';
import { cleanClubName } from './clubName.js';
import { BASE_GRID_SIZE, SAVE_KEY as REAL_SAVE_KEY, TEST, TEST_MODE } from '../config.js';

const SAVE_KEY = TEST_MODE ? TEST.saveKey : REAL_SAVE_KEY;
// Save codes (Save backup) start with this, so other pasted text is refused.
const SAVE_CODE_PREFIX = 'NOVA1:';

export class SaveMixin {
  // A lightweight peek at the save file for just the room's size [gridW,
  // gridH] (older saves have one square gridSize), called
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
      const ok = (v) => typeof v === 'number' && v >= BASE_GRID_SIZE;
      if (ok(data.gridW) && ok(data.gridH)) return [data.gridW, data.gridH];
      if (ok(data.gridSize)) return [data.gridSize, data.gridSize]; // from when the room was always square

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
      placedList.push({ type: rec.type, facing: rec.facing, anchor: rec.anchor, ...(rec.staff ? { staff: true } : {}), ...(rec.xp ? { xp: rec.xp } : {}) });
    }
    // A DJ booth in the middle of a move is saved where it was.
    const inventory = { ...(this.inventory || {}) };
    const inventoryXp = Object.fromEntries(Object.entries(this.inventoryXp || {}).map(([t, l]) => [t, [...l]]));
    if (this.movingBooth) {
      const xp = (inventoryXp[this.movingBooth.type] || []).pop() || 0;
      placedList.push({ type: this.movingBooth.type, facing: this.movingBooth.facing, anchor: this.movingBooth.anchor, staff: true, xp });
      inventory[this.movingBooth.type] -= 1;
      if (inventory[this.movingBooth.type] <= 0) delete inventory[this.movingBooth.type];
    }
    return { cash: this.cash, fans: this.fans, gridW: this.gridW, gridH: this.gridH, placed: placedList, wallpaper: { ...this.wallpaper }, floorPaint: { ...this.floorPaint }, nightStars: this.nightStars || [], inventory, inventoryXp, goalsDone: this.goalsDone || [], goalStats: this.goalStats || {}, clubName: this.clubName || '', daily: this.daily || null, celebs: this.celebState || {}, celebInvited: Object.keys(this.celebInvites || {}) };
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

  // The save as a code you can copy (base64 of the save, with a prefix so
  // anything else pasted is refused), and back.
  saveCode() {
    const json = JSON.stringify(this.serializeState());
    return SAVE_CODE_PREFIX + btoa(unescape(encodeURIComponent(json)));
  }

  readSaveCode(code) {
    const text = String(code || '').replace(/\s+/g, '');
    if (!text.startsWith(SAVE_CODE_PREFIX)) return null;
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(text.slice(SAVE_CODE_PREFIX.length)))));
      return data && typeof data === 'object' && Array.isArray(data.placed) ? data : null;
    } catch (e) {
      return null;
    }
  }

  setupBackup() {
    const box = document.getElementById('backupBox');
    if (!box) return;
    const msg = document.getElementById('backupMsg');
    const paste = document.getElementById('backupPaste');
    for (const type of ['keydown', 'keyup', 'keypress']) paste.addEventListener(type, (e) => e.stopPropagation());
    document.getElementById('backupButton')?.addEventListener('click', () => {
      this.saveGame();
      document.getElementById('backupCode').value = this.saveCode();
      paste.value = '';
      msg.textContent = '';
      box.classList.add('open');
    });
    document.getElementById('backupClose')?.addEventListener('click', () => box.classList.remove('open'));
    document.getElementById('backupCopy')?.addEventListener('click', () => {
      const area = document.getElementById('backupCode');
      area.select();
      const done = () => { msg.textContent = 'Copied! Keep it somewhere safe.'; };
      if (navigator.clipboard) navigator.clipboard.writeText(area.value).then(done, () => { document.execCommand('copy'); done(); });
      else { document.execCommand('copy'); done(); }
    });
    document.getElementById('backupLoad')?.addEventListener('click', () => {
      const data = this.readSaveCode(paste.value);
      if (!data) { msg.textContent = "That isn't a Club Nova save code."; return; }
      this.loadSaveData(data);
    });
  }

  // Replaces this club with one from a save code, then reloads into it.
  loadSaveData(data) {
    this.restarting = true; // don't save the old club over it on the way out
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('[Club Nova] could not store the loaded club:', e);
      return;
    }
    window.location.reload();
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
    if (typeof data.clubName === 'string') this.clubName = cleanClubName(data.clubName);
    if (data.daily && typeof data.daily.last === 'string') this.daily = { last: data.daily.last, streak: Number(data.daily.streak) || 1 };
    if (typeof data.fans === 'number') this.fans = data.fans;
    // Already set once, before the tile grid was built, by
    // peekSavedGridSize() in create() — re-applying it here is just
    // defensive and never shrinks it, since a corrupt/missing value just
    // leaves it as-is.
    const size = this.peekSavedGridSize();
    if (size && (size[0] > this.gridW || size[1] > this.gridH)) {
      this.gridW = Math.max(this.gridW, size[0]);
      this.gridH = Math.max(this.gridH, size[1]);
      this.buildTiles();
      this.buildWalls();
    }
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
        if (rec && typeof entry.xp === 'number') rec.xp = entry.xp; // what it gave when bought
      }
    }
    // (Saves from when the club had separate nights also have night,
    // nightOver and bestNightProfit; they're no longer used.)
    if (data.inventory && typeof data.inventory === 'object') {
      this.inventory = {};
      for (const [type, n] of Object.entries(data.inventory)) if (PROP_TYPES[type] && n > 0) this.inventory[type] = Math.floor(n);
    }
    if (Array.isArray(data.goalsDone)) this.goalsDone = data.goalsDone.filter((id) => typeof id === 'string');
    // What each celebrity thinks of the club (see celebrities.js).
    this.celebState = {};
    if (data.celebs && typeof data.celebs === 'object') {
      for (const [key, rec] of Object.entries(data.celebs)) {
        if (rec && typeof rec === 'object') this.celebState[key] = { visits: Math.max(0, rec.visits | 0), liking: Math.max(0, Math.min(100, Number(rec.liking) || 0)) };
      }
    }
    // Invitations already paid for: they turn up as soon as there's room.
    this.celebInvites = {};
    if (Array.isArray(data.celebInvited)) for (const key of data.celebInvited) if (typeof key === 'string') this.celebInvites[key] = 0;
    if (data.goalStats && typeof data.goalStats === 'object') {
      this.goalStats = {};
      for (const [k, v] of Object.entries(data.goalStats)) if (typeof v === 'number') this.goalStats[k] = v;
    }
    if (data.inventoryXp && typeof data.inventoryXp === 'object') {
      this.inventoryXp = {};
      for (const [type, list] of Object.entries(data.inventoryXp)) {
        if (Array.isArray(list)) this.inventoryXp[type] = list.filter((x) => typeof x === 'number' && x >= 0);
      }
    }
    if (Array.isArray(data.nightStars)) this.nightStars = data.nightStars.filter((n) => n >= 1 && n <= 5).slice(-5);
    this.restoreWallpaper(data.wallpaper);
    this.restoreFloorPaint(data.floorPaint);
  }
}
