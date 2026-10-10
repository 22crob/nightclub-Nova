// ClubScene methods: wall decorations (hanging plants, pendant lights, LED
// poles, a neon heart, ...; designs in WALL_DECOR, src/walls.js). They hang
// on a wall section, one per section, over whatever wallpaper is there:
// this.wallDecor maps a section ('R3', 'L0', see wallpaper.js) to the type
// hung there, saved under `wallDecor`. Bought from the Walls key in Build,
// placed with a click on a wall section; the Edit tools move, put away or
// sell them (a click on the section), and right-click sells one.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PROP_TYPES } from '../catalog.js';
import { SELL_REFUND_RATIO } from '../config.js';
import { SFX } from '../sfx.js';
import { WALL_DECOR, WALL_TEX_H, WALL_TEX_W, wallDecorCanvas, wallDecorFrameFor, wallDecorKey } from '../walls.js';

const SIDES = { R: 'right', L: 'left' };

export class WallDecorMixin {
  // Draws every frame of every wall decoration, for both walls.
  registerWallDecorTextures() {
    for (const [style, st] of Object.entries(WALL_DECOR)) {
      for (const side of Object.values(SIDES)) {
        for (let f = 0; f < st.frames; f++) {
          const key = wallDecorKey(style, f, side);
          if (!this.textures.exists(key)) this.textures.addCanvas(key, wallDecorCanvas(style, f, side));
        }
      }
    }
  }

  // Their own layer over the wallpaper and over the room's mood shade, so
  // the neon and LED pieces glow instead of being dimmed with the wall.
  wallDecorLayerReady() {
    if (!this.wallDecorLayer) {
      this.wallDecorLayer = this.add.container(0, 0);
      this.wallLayer.addAt(this.wallDecorLayer, this.wallLayer.getIndex(this.wallShade) + 1);
    }
    return this.wallDecorLayer;
  }

  wallDecorImage(section, type, frame = 0) {
    this.registerWallDecorTextures();
    const { x, y } = this.wallSectionOrigin(section);
    const key = wallDecorKey(PROP_TYPES[type].wallDecor, frame, SIDES[section[0]]);
    return this.add.image(x, y, key).setOrigin(0, 0).setDisplaySize(WALL_TEX_W / 2, WALL_TEX_H / 2);
  }

  drawWallDecor(section, type) {
    this.wallDecorImages = this.wallDecorImages || {};
    this.wallDecorImages[section]?.destroy();
    const img = this.wallDecorImage(section, type);
    img.wallFrame = 0;
    this.wallDecorLayerReady().add(img);
    this.wallDecorImages[section] = img;
  }

  // Hangs the held decoration on a wall section (one per section).
  placeWallDecor(section) {
    const type = this.selectedProp;
    const def = PROP_TYPES[type];
    if (!def || !def.wallDecor || !section) return false;
    this.wallDecor = this.wallDecor || {};
    if (this.wallDecor[section]) { SFX.denied(); this.showToast('🖼️ Something already hangs there: move or sell it first (Club, Edit).'); return false; }
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

  // Takes a decoration off its wall section.
  removeWallDecor(section) {
    const type = this.wallDecor?.[section];
    if (!type) return null;
    delete this.wallDecor[section];
    this.wallDecorImages?.[section]?.destroy();
    if (this.wallDecorImages) delete this.wallDecorImages[section];
    return type;
  }

  // The Edit tools on a wall section with a decoration: sell refunds part
  // of its price, put away stores it, move stores it and holds it. True if
  // there was one.
  editWallDecor(section, tool = this.editTool || 'move') {
    const type = this.wallDecor?.[section];
    if (!type) return false;
    if (tool === 'rotate') { SFX.denied(); return true; }
    this.removeWallDecor(section);
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

  // Animated ones (LED poles, the neon heart, fairy lights) step while a DJ
  // plays (called from animateFloors() with the walls).
  animateWallDecor(music) {
    for (const section in this.wallDecorImages || {}) {
      const img = this.wallDecorImages[section];
      const style = PROP_TYPES[this.wallDecor[section]].wallDecor;
      if (WALL_DECOR[style].frames <= 1) continue;
      const frame = music ? wallDecorFrameFor(style, Number(section.slice(1)), this.floorTick) : 0;
      if (img.wallFrame !== frame) {
        img.wallFrame = frame;
        img.setTexture(wallDecorKey(style, frame, SIDES[section[0]]));
      }
    }
  }

  // Their price counts toward Luxury, like furniture.
  wallDecorLuxuryDollars() {
    return Object.values(this.wallDecor || {}).reduce((n, type) => n + ((PROP_TYPES[type] && PROP_TYPES[type].cost) || 0), 0);
  }

  // Restores saved wall decorations, skipping anything unknown.
  restoreWallDecor(saved) {
    this.wallDecor = {};
    if (!saved || typeof saved !== 'object') return;
    for (const [section, type] of Object.entries(saved)) {
      if (!/^[RL]\d+$/.test(section) || !PROP_TYPES[type] || !PROP_TYPES[type].wallDecor) continue;
      if (Number(section.slice(1)) >= (section[0] === 'R' ? this.gridW : this.gridH)) continue;
      this.wallDecor[section] = type;
      this.drawWallDecor(section, type);
    }
  }
}
