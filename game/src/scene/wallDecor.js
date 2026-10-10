// ClubScene methods: wall decorations, real 3D pieces hung on the back walls
// (hanging fern, pendant lights, LED poles, a neon heart, a speaker, fairy
// lights, a living vine wall, a bottle shelf; art/blender/decor_batch3.py).
// They're sold with the Decorations (catalog: `wallDecor: true`, `span`
// wall sections wide) and hang on a wall section over whatever wallpaper is
// there: this.wallDecor maps the section a piece starts at ('R3', 'L0', see
// wallpaper.js) to its type, saved under `wallDecor`. The right wall shows
// the piece's facing 0 picture, the left wall its facing 90 one. Placed with
// a click on a wall section; the Edit tools move, put away or sell them (a
// click on the section), and right-click sells one. Each hangs low, in the
// middle or high on the wall (this.wallDecorLevels, saved under
// `wallDecorLevel`, the owner's ask): picked before hanging from the
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

  // The section the piece covering `section` starts at, or null.
  wallDecorAnchor(section) {
    if (!section) return null;
    for (const [anchor, type] of Object.entries(this.wallDecor || {})) {
      if (anchor[0] !== section[0]) continue;
      const i = Number(anchor.slice(1));
      const j = Number(section.slice(1));
      if (j >= i && j < i + this.wallSpan(type)) return anchor;
    }
    return null;
  }

  // The piece's picture, hung on the wall: the point where it meets the
  // wall stays over the middle of the sections it covers, and it's drawn
  // WALL_DECOR.scale bigger (at most the wall's height) at the chosen
  // height: its top just under the wall's top ('high'), its bottom just
  // above the floor ('low'), or centred between ('mid').
  wallDecorImage(section, type, level = 'mid') {
    const def = PROP_TYPES[type];
    const right = section[0] === 'R';
    const along = Number(section.slice(1)) + (this.wallSpan(type) - 1) / 2;
    const { sx, sy } = right ? this.gridToScreen(along, -0.5) : this.gridToScreen(-0.5, along);
    const key = def.sprites[right ? 0 : 90];
    const img = this.add.image(sx, sy, key);
    // The picture is cropped to fit all four of the piece's facings, so
    // the piece itself fills only part of it: place and size by that part.
    const box = this.opaqueBox(key);
    const k0 = def.displayWidth / img.width; // display px per picture px, unscaled
    const room = WALL_HEIGHT - 2 * WALL_DECOR.margin;
    const k = k0 * Math.min(WALL_DECOR.scale, room / ((box.bottom - box.top) * k0));
    const h = (box.bottom - box.top) * k;
    const top = sy - WALL_HEIGHT + WALL_DECOR.margin;
    const bottom = sy - WALL_DECOR.margin;
    const y = level === 'high' ? top : level === 'low' ? bottom - h : (top + bottom - h) / 2;
    img.setOrigin(def.originX, 0);
    img.setScale(k);
    img.setPosition(sx, y - box.top * k);
    return img;
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

  wallDecorLevelOf(section) {
    return (this.wallDecorLevels || {})[section] || 'mid';
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

  // Moves the decoration covering `section` to its next height.
  cycleWallDecorLevel(section) {
    const anchor = this.wallDecorAnchor(section);
    if (!anchor) return false;
    this.wallDecorLevels = this.wallDecorLevels || {};
    this.wallDecorLevels[anchor] = this.nextWallLevel(this.wallDecorLevelOf(anchor));
    this.drawWallDecor(anchor, this.wallDecor[anchor]);
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

  drawWallDecor(section, type) {
    this.wallDecorImages = this.wallDecorImages || {};
    this.wallDecorImages[section]?.destroy();
    const img = this.wallDecorImage(section, type, this.wallDecorLevelOf(section));
    this.wallDecorLayerReady().add(img);
    this.wallDecorImages[section] = img;
  }

  // Can the held piece hang starting at `section`?
  wallDecorFits(section, type) {
    const sections = this.wallDecorSections(section, type);
    return !!sections && sections.every((s) => !this.wallDecorAnchor(s));
  }

  // Hangs the held decoration starting at a wall section.
  placeWallDecor(section) {
    const type = this.selectedProp;
    const def = PROP_TYPES[type];
    if (!def || !def.wallDecor || !section) return false;
    this.wallDecor = this.wallDecor || {};
    if (!this.wallDecorFits(section, type)) {
      SFX.denied();
      this.showToast(this.wallDecorSections(section, type) ? '🖼️ Something already hangs there: move or sell it first (Club, Edit).' : '🖼️ It doesn\'t fit there: the wall ends.');
      return false;
    }
    const fromInventory = this.holdingFromInventory && this.inventoryCount(type) > 0;
    if (!fromInventory && !this.isUnlocked(type)) { SFX.denied(); return false; }
    const cost = fromInventory ? 0 : this.currentCost(type);
    if (this.cash < cost) { SFX.denied(); return false; }
    this.cash -= cost;
    this.wallDecor[section] = type;
    this.wallDecorLevels = this.wallDecorLevels || {};
    this.wallDecorLevels[section] = this.heldWallLevel || 'mid';
    this.drawWallDecor(section, type);
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

  // Takes the decoration covering `section` off the wall.
  removeWallDecor(section) {
    const anchor = this.wallDecorAnchor(section);
    const type = anchor && this.wallDecor[anchor];
    if (!type) return null;
    delete this.wallDecor[anchor];
    if (this.wallDecorLevels) delete this.wallDecorLevels[anchor];
    this.wallDecorImages?.[anchor]?.destroy();
    if (this.wallDecorImages) delete this.wallDecorImages[anchor];
    return type;
  }

  // The Edit tools on a wall section with a decoration: sell refunds part
  // of its price, put away stores it, move stores it and holds it. True if
  // there was one.
  editWallDecor(section, tool = this.editTool || 'move') {
    const anchor = this.wallDecorAnchor(section);
    const type = anchor && this.wallDecor[anchor];
    if (!type) return false;
    if (tool === 'rotate') return this.cycleWallDecorLevel(anchor); // Turn: its next height
    const level = this.wallDecorLevelOf(anchor);
    this.removeWallDecor(anchor);
    if (tool === 'sell') {
      this.cash += Math.floor((PROP_TYPES[type].cost || 0) * SELL_REFUND_RATIO);
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
  // longer fits.
  restoreWallDecor(saved, levels) {
    this.wallDecor = {};
    this.wallDecorLevels = {};
    if (!saved || typeof saved !== 'object') return;
    for (const [section, type] of Object.entries(saved)) {
      if (!/^[RL]\d+$/.test(section) || !PROP_TYPES[type] || !PROP_TYPES[type].wallDecor) continue;
      if (!this.wallDecorFits(section, type)) continue;
      this.wallDecor[section] = type;
      if (levels && WALL_DECOR.levels.includes(levels[section])) this.wallDecorLevels[section] = levels[section];
      this.drawWallDecor(section, type);
    }
  }
}
