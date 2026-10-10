// ClubScene methods: wall decorations, real 3D pieces hung on the back walls
// (hanging fern, pendant lights, LED poles, a neon heart, a speaker, fairy
// lights, a living vine wall, a bottle shelf; art/blender/decor_batch3.py).
// They're sold with the Decorations (catalog: `wallDecor: true`, `span`
// wall sections wide) and hang on a wall section over whatever wallpaper is
// there: this.wallDecor maps the section a piece starts at ('R3', 'L0', see
// wallpaper.js) to its type, saved under `wallDecor`. The right wall shows
// the piece's facing 0 picture, the left wall its facing 90 one. Placed with
// a click on a wall section; the Edit tools move, put away or sell them (a
// click on the section), and right-click sells one.
// (The first wall decorations were drawn flat on the wall; the owner wanted
// them 3D and in Decorations, October 2026. The keys stayed the same.)
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PROP_TYPES } from '../catalog.js';
import { SELL_REFUND_RATIO } from '../config.js';
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

  // The piece's picture, hung on the wall: its back on the wall's base
  // line, centred on the sections it covers.
  wallDecorImage(section, type) {
    const def = PROP_TYPES[type];
    const right = section[0] === 'R';
    const along = Number(section.slice(1)) + (this.wallSpan(type) - 1) / 2;
    const { sx, sy } = right ? this.gridToScreen(along, -0.5) : this.gridToScreen(-0.5, along);
    const img = this.add.image(sx, sy, def.sprites[right ? 0 : 90]);
    img.setOrigin(def.originX, def.originY);
    img.setDisplaySize(def.displayWidth, def.displayWidth * (img.height / img.width));
    return img;
  }

  drawWallDecor(section, type) {
    this.wallDecorImages = this.wallDecorImages || {};
    this.wallDecorImages[section]?.destroy();
    const img = this.wallDecorImage(section, type);
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
    if (tool === 'rotate') { SFX.denied(); return true; }
    this.removeWallDecor(anchor);
    if (tool === 'sell') {
      this.cash += Math.floor((PROP_TYPES[type].cost || 0) * SELL_REFUND_RATIO);
      SFX.sell();
    } else {
      this.addToInventory(type);
      SFX.sell();
      if (tool === 'move') this.selectFromInventory(type);
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
  restoreWallDecor(saved) {
    this.wallDecor = {};
    if (!saved || typeof saved !== 'object') return;
    for (const [section, type] of Object.entries(saved)) {
      if (!/^[RL]\d+$/.test(section) || !PROP_TYPES[type] || !PROP_TYPES[type].wallDecor) continue;
      if (!this.wallDecorFits(section, type)) continue;
      this.wallDecor[section] = type;
      this.drawWallDecor(section, type);
    }
  }
}
