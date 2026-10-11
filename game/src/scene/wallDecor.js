// ClubScene methods: wall decorations, real 3D pieces hung on the back walls
// (hanging fern, pendant lights, LED poles, a neon heart, a speaker, fairy
// lights, a living vine wall, a bottle shelf; art/blender/decor_batch3.py).
// They're sold with the Decorations (catalog: `wallDecor: true`, `span`
// wall sections wide) and hang on a wall section over whatever wallpaper is
// there: this.wallDecor maps each piece's key, the section it starts at
// and its height ('R3:mid', 'L0:high'; sections are in wallpaper.js), to its
// type, saved under `wallDecor` (older saves keyed by the section alone,
// with the height under `wallDecorLevel`, still load). Pieces can share a
// section at different heights as long as they don't overlap on the wall
// (the owner's ask: a row of fairy lights in the middle and another above). The right wall shows
// the piece's facing 0 picture, the left wall its facing 90 one. Placed with
// a click on a wall section; the Edit tools move, put away or sell them (a
// click on the section), and right-click sells one. Each hangs low, in the
// middle or high on the wall (the owner's ask): picked before hanging from the
// Low / Middle / High bar under the name tag (#wallHeightBar) or with R,
// and changed afterwards with the Edit tools' Turn or R over it. They're
// drawn WALL_DECOR.scale bigger than their render, never taller than the
// wall.
// (The first wall decorations were drawn flat on the wall; the owner wanted
// them 3D and in Decorations, October 2026. The keys stayed the same.)
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PROP_TYPES } from '../catalog.js';
import { SELL_REFUND_RATIO, WALL_DECOR, WALL_HEIGHT } from '../config.js';
import { SFX } from '../sfx.js';

export class WallDecorMixin {
  // Their own layer over the wallpaper and over the room's mood shade, so
  // the neon and LED pieces glow instead of being dimmed with the wall.
  wallDecorLayerReady() {
    if (!this.wallDecorLayer) {
      this.wallDecorLayer = this.add.container(0, 0);
      this.wallLayer.addAt(this.wallDecorLayer, this.wallLayer.getIndex(this.wallShade) + 1);
    }
    return this.wallDecorLayer;
  }

  wallSpan(type) {
    return PROP_TYPES[type].span || 1;
  }

  // The wall sections a piece starting at `section` covers, or null if it
  // runs off the end of the wall.
  wallDecorSections(section, type) {
    const side = section[0];
    const i = Number(section.slice(1));
    const len = side === 'R' ? this.gridW : this.gridH;
    const out = [];
    for (let k = 0; k < this.wallSpan(type); k++) {
      if (i + k >= len) return null;
      out.push(`${side}${i + k}`);
    }
    return out;
  }

  // A piece's key ('R3:mid') split up: its side, first section number,
  // section ('R3') and height.
  decorKey(key) {
    const [section, level = 'mid'] = key.split(':');
    return { side: section[0], i: Number(section.slice(1)), section, level };
  }

  // Where a piece hangs on the wall: its picture, scale, and the top and
  // height (screen px) of the piece itself in it. The point where it meets
  // the wall stays over the middle of the sections it covers, and it's
  // drawn WALL_DECOR.scale bigger (at most the wall's height) at the chosen
  // height: its top just under the wall's top ('high'), its bottom just
  // above the floor ('low'), or centred between ('mid').
  wallDecorSpot(section, type, level = 'mid') {
    const def = PROP_TYPES[type];
    const right = section[0] === 'R';
    const along = Number(section.slice(1)) + (this.wallSpan(type) - 1) / 2;
    const { sx, sy } = right ? this.gridToScreen(along, -0.5) : this.gridToScreen(-0.5, along);
    const key = def.sprites[right ? 0 : 90];
    const width = this.textures.get(key).getSourceImage().width;
    // The picture is cropped to fit all four of the piece's facings, so
    // the piece itself fills only part of it: place and size by that part.
    const box = this.opaqueBox(key);
    const k0 = def.displayWidth / width; // display px per picture px, unscaled
    const room = WALL_HEIGHT - 2 * WALL_DECOR.margin;
    const k = k0 * Math.min(def.wallScale || WALL_DECOR.scale, room / ((box.bottom - box.top) * k0));
    const h = (box.bottom - box.top) * k;
    const top = sy - WALL_HEIGHT + WALL_DECOR.margin;
    const bottom = sy - WALL_DECOR.margin;
    const y = level === 'high' ? top : level === 'low' ? bottom - h : (top + bottom - h) / 2;
    return { sx, key, k, box, y, h };
  }

  wallDecorImage(section, type, level = 'mid') {
    const { sx, key, k, box, y } = this.wallDecorSpot(section, type, level);
    const img = this.add.image(sx, y - box.top * k, key);
    img.setOrigin(PROP_TYPES[type].originX, 0);
    img.setScale(k);
    return img;
  }

  // The keys of the pieces covering `section`.
  wallDecorsAt(section) {
    if (!section) return [];
    const j = Number(section.slice(1));
    return Object.entries(this.wallDecor || {}).filter(([key, type]) => {
      const { side, i } = this.decorKey(key);
      return side === section[0] && j >= i && j < i + this.wallSpan(type);
    }).map(([key]) => key);
  }

  // The piece covering `section` under the pointer (`y` in the world's
  // own coordinates, the hovered point by default), else the nearest one
  // on that section, or null.
  wallDecorAnchor(section, y = this.hoverWallY) {
    const keys = this.wallDecorsAt(section);
    if (keys.length < 2 || y === undefined) return keys[0] || null;
    let best = null;
    let bestD = Infinity;
    for (const key of keys) {
      const { level } = this.decorKey(key);
      const spot = this.wallDecorSpot(section, this.wallDecor[key], level);
      const d = y < spot.y ? spot.y - y : y > spot.y + spot.h ? y - spot.y - spot.h : 0;
      if (d < bestD) { bestD = d; best = key; }
    }
    return best;
  }

  // The piece already hanging that a piece of `type` at `section` and
  // `level` would overlap on the wall (sharing a section and crossing
  // heights), or null. `except` is left out (a piece changing height).
  wallDecorClash(section, type, level, except = null) {
    const mine = this.wallDecorSections(section, type);
    if (!mine) return null;
    const me = this.wallDecorSpot(section, type, level);
    for (const [key, other] of Object.entries(this.wallDecor || {})) {
      if (key === except) continue;
      const o = this.decorKey(key);
      const theirs = this.wallDecorSections(o.section, other) || [o.section];
      if (!theirs.some((x) => mine.includes(x))) continue;
      const them = this.wallDecorSpot(o.section, other, o.level);
      const overlap = Math.min(me.y + me.h, them.y + them.h) - Math.max(me.y, them.y);
      if (overlap > WALL_DECOR.stackSlack) return key;
    }
    return null;
  }

  // The rows and columns of a texture that aren't see-through, measured
  // once per texture.
  opaqueBox(key) {
    this.opaqueBoxes = this.opaqueBoxes || {};
    if (this.opaqueBoxes[key]) return this.opaqueBoxes[key];
    const src = this.textures.get(key).getSourceImage();
    const w = src.width;
    const h = src.height;
    let out = { left: 0, top: 0, right: w, bottom: h };
    try {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.drawImage(src, 0, 0);
      const d = g.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] > 16) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 >= 0) out = { left: x0, top: y0, right: x1 + 1, bottom: y1 + 1 };
    } catch (e) { /* unreadable: use the whole picture */ }
    this.opaqueBoxes[key] = out;
    return out;
  }

  // The height of the piece covering `section` (or with this key).
  wallDecorLevelOf(section) {
    const key = section.includes(':') ? section : this.wallDecorAnchor(section);
    return key ? this.decorKey(key).level : 'mid';
  }

  // The next height after `level` (low, middle, high, then low again).
  nextWallLevel(level) {
    const L = WALL_DECOR.levels;
    return L[(L.indexOf(level) + 1) % L.length];
  }

  // While a wall decoration is held: the height it will hang at.
  setHeldWallLevel(level) {
    if (!WALL_DECOR.levels.includes(level)) return;
    this.heldWallLevel = level;
    if (this.wallGhost) { this.wallGhost.destroy(); this.wallGhost = null; }
    this.updateWallGhost();
    this.updateWallHeightBar();
  }

  // Moves the decoration covering `section` (or with this key) to the
  // next height it fits at, past anything else hanging there.
  cycleWallDecorLevel(section) {
    const key = section.includes(':') ? section : this.wallDecorAnchor(section);
    if (!key || !this.wallDecor[key]) return false;
    const type = this.wallDecor[key];
    const { section: at, level } = this.decorKey(key);
    let next = level;
    do next = this.nextWallLevel(next); while (next !== level && this.wallDecorClash(at, type, next, key));
    if (next === level) { SFX.denied(); this.showToast('🖼️ No other height is free there.'); return false; }
    this.removeWallDecor(key);
    this.hangWallDecor(at, type, next);
    SFX.place();
    this.saveGame();
    return true;
  }

  // R: with a wall decoration in hand, the next height; else the one
  // hanging under the cursor goes to its next height. True if handled.
  wallDecorRotateKey() {
    const held = PROP_TYPES[this.selectedProp];
    if (held && held.wallDecor) {
      this.setHeldWallLevel(this.nextWallLevel(this.heldWallLevel || 'mid'));
      return true;
    }
    if (!this.selectedProp && this.hoverWall && this.wallDecorAnchor(this.hoverWall)) return this.cycleWallDecorLevel(this.hoverWall);
    return false;
  }

  // The Low / Middle / High bar under the name tag, shown while a wall
  // decoration is held.
  setupWallHeightBar() {
    const bar = document.getElementById('wallHeightBar');
    if (!bar) return;
    bar.innerHTML = '';
    for (const level of WALL_DECOR.levels) {
      const b = document.createElement('div');
      b.className = 'wallHeightOption';
      b.dataset.level = level;
      b.textContent = WALL_DECOR.labels[level];
      b.dataset.tipName = `Hang it ${WALL_DECOR.labels[level].toLowerCase()}`;
      b.dataset.tipText = 'How high on the wall it hangs. R switches too; change it later with Club, Edit, Turn.';
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.setHeldWallLevel(level); });
      bar.appendChild(b);
    }
    this.updateWallHeightBar();
  }

  updateWallHeightBar() {
    const bar = document.getElementById('wallHeightBar');
    if (!bar) return;
    const held = PROP_TYPES[this.selectedProp];
    bar.hidden = !(held && held.wallDecor);
    for (const b of bar.children) b.classList.toggle('on', b.dataset.level === (this.heldWallLevel || 'mid'));
  }

  // Puts a piece on the wall (its record and its picture).
  hangWallDecor(section, type, level = 'mid') {
    const key = `${section}:${level}`;
    this.wallDecor[key] = type;
    this.wallDecorImages = this.wallDecorImages || {};
    this.wallDecorImages[key]?.destroy();
    const img = this.wallDecorImage(section, type, level);
    this.wallDecorLayerReady().add(img);
    this.wallDecorImages[key] = img;
    return key;
  }

  // Can a piece of `type` hang starting at `section` at that height?
  wallDecorFits(section, type, level = this.heldWallLevel || 'mid') {
    return !!this.wallDecorSections(section, type) && !this.wallDecorClash(section, type, level);
  }

  // Hangs the held decoration starting at a wall section.
  placeWallDecor(section) {
    const type = this.selectedProp;
    const def = PROP_TYPES[type];
    if (!def || !def.wallDecor || !section) return false;
    this.wallDecor = this.wallDecor || {};
    const level = this.heldWallLevel || 'mid';
    if (!this.wallDecorFits(section, type, level)) {
      SFX.denied();
      this.showToast(this.wallDecorSections(section, type) ? '🖼️ Something already hangs there: try another height, or move it first (Club, Edit).' : '🖼️ It doesn\'t fit there: the wall ends.');
      return false;
    }
    const fromInventory = this.holdingFromInventory && this.inventoryCount(type) > 0;
    if (!fromInventory && !this.isUnlocked(type)) { SFX.denied(); return false; }
    const cost = fromInventory ? 0 : this.currentCost(type);
    if (this.cash < cost) { SFX.denied(); return false; }
    this.cash -= cost;
    this.hangWallDecor(section, type, level);
    if (fromInventory) {
      this.takeInventoryXp(type);
      this.addToInventory(type, -1);
      if (this.inventoryCount(type) <= 0) { this.holdingFromInventory = false; this.selectedProp = null; }
      this.refreshDock();
    } else {
      this.awardPurchaseXp(cost, undefined, undefined, type);
      this.bumpGoal('bought');
      this.bumpGoal('decorBought');
    }
    this.updateWallGhost();
    SFX.place();
    this.updateUI();
    this.saveGame();
    return true;
  }

  // Takes a decoration off the wall: the one with this key, or the one
  // covering this section (under the pointer). Gives its type.
  removeWallDecor(section) {
    const key = section.includes(':') ? section : this.wallDecorAnchor(section);
    const type = key && this.wallDecor[key];
    if (!type) return null;
    delete this.wallDecor[key];
    this.wallDecorImages?.[key]?.destroy();
    if (this.wallDecorImages) delete this.wallDecorImages[key];
    return type;
  }

  // The Edit tools on a wall section with a decoration: sell refunds part
  // of its price, put away stores it, move stores it and holds it. True if
  // there was one.
  editWallDecor(section, tool = this.editTool || 'move') {
    const anchor = section.includes(':') ? section : this.wallDecorAnchor(section);
    const type = anchor && this.wallDecor[anchor];
    if (!type) return false;
    if (tool === 'rotate') return this.cycleWallDecorLevel(anchor); // Turn: its next height
    const { level } = this.decorKey(anchor);
    this.removeWallDecor(anchor);
    if (tool === 'sell') {
      this.cash += Math.floor((PROP_TYPES[type].price || 0) * SELL_REFUND_RATIO);
      SFX.sell();
    } else {
      this.addToInventory(type);
      SFX.sell();
      if (tool === 'move') { this.selectFromInventory(type); this.setHeldWallLevel(level); } // keeps its height
      else this.showToast(`📦 ${PROP_TYPES[type].label} put away in your inventory.`);
    }
    this.updateUI();
    this.refreshDock();
    this.saveGame();
    return true;
  }

  // Their price counts toward Luxury, like furniture.
  wallDecorLuxuryDollars() {
    return Object.values(this.wallDecor || {}).reduce((n, type) => n + ((PROP_TYPES[type] && PROP_TYPES[type].cost) || 0), 0);
  }

  // Restores saved wall decorations, skipping anything unknown or that no
  // longer fits. Older saves keyed them by section, the height apart.
  restoreWallDecor(saved, levels) {
    this.wallDecor = {};
    if (!saved || typeof saved !== 'object') return;
    for (const [key, type] of Object.entries(saved)) {
      const m = /^([RL]\d+)(?::(\w+))?$/.exec(key);
      if (!m || !PROP_TYPES[type] || !PROP_TYPES[type].wallDecor) continue;
      const level = m[2] || (levels && levels[m[1]]) || 'mid';
      if (!WALL_DECOR.levels.includes(level) || !this.wallDecorFits(m[1], type, level)) continue;
      this.hangWallDecor(m[1], type, level);
    }
  }
}
