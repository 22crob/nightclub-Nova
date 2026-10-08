// ClubScene methods: regular floors, painted onto the room's floor tile by
// tile (designs in floors.js, FLOOR_PAINTS). Paint lies under everything,
// so furniture can stand on it; patrons walk on it but only dance on dance
// floors. Click a tile to paint it, or hold the button and drag to paint a
// stroke.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PROP_TYPES } from '../catalog.js';
import { FLOOR_PAINTS, floorFrameCanvas, floorTextureKey } from '../floors.js';
import { TILE_H, TILE_W } from '../config.js';
import { SFX } from '../sfx.js';

// How see-through furniture is while a regular floor is held.
const FLOOR_FADE_ALPHA = 0.3;

export class FloorPaintMixin {
  registerFloorPaintTextures() {
    for (const style of Object.keys(FLOOR_PAINTS)) {
      const key = floorTextureKey(style, 0);
      if (!this.textures.exists(key)) this.textures.addCanvas(key, floorFrameCanvas(style, 0));
    }
  }

  // The layer the paint is drawn on: over the bare floor, under everything
  // else. Called from create() right after the floor layer is added.
  createFloorPaintLayer() {
    this.floorPaint = this.floorPaint || {};
    this.floorPaintImages = {};
    this.floorPaintLayer = this.add.container(0, 0);
    this.world.add(this.floorPaintLayer);
  }

  floorPaintImage(gx, gy, type) {
    const { sx, sy } = this.gridToScreen(gx, gy);
    return this.add.image(sx, sy, floorTextureKey(PROP_TYPES[type].paintStyle, 0)).setDisplaySize(TILE_W, TILE_H);
  }

  drawFloorPaint(gx, gy, type) {
    const key = `${gx},${gy}`;
    if (this.floorPaintImages[key]) this.floorPaintImages[key].destroy();
    const img = this.floorPaintImage(gx, gy, type);
    this.floorPaintLayer.add(img);
    this.floorPaintImages[key] = img;
  }

  // Paints one tile with the selected floor. Returns true if it painted.
  paintFloor(gx, gy) {
    const type = this.selectedProp;
    const def = PROP_TYPES[type];
    if (!def || !def.paintStyle) return false;
    if (!this.inGrid(gx, gy)) return false;
    if (!this.isUnlocked(type)) { SFX.denied(); return false; }
    const key = `${gx},${gy}`;
    if (this.floorPaint[key] === type) return false; // already this floor
    // Laying one from the inventory (picked up with Move) is free.
    const fromInventory = this.holdingFromInventory && this.inventoryCount(type) > 0;
    const cost = fromInventory ? 0 : this.currentCost(type);
    if (this.cash < cost) { SFX.denied(); return false; }
    this.cash -= cost;
    this.floorPaint[key] = type;
    this.drawFloorPaint(gx, gy, type);
    if (fromInventory) {
      this.takeInventoryXp(type);
      this.addToInventory(type, -1);
      if (this.inventoryCount(type) <= 0) { this.holdingFromInventory = false; this.selectedProp = null; this.updateGhost(); }
      this.refreshDock();
    } else {
      this.awardPurchaseXp(cost, undefined, undefined, type);
    }
    SFX.place();
    this.updateUI();
    return true;
  }

  // While a regular floor is held, the furniture, bartenders and DJ go
  // see-through, so the floor under them shows and the tiles there can be
  // pointed at and floored; they come back when it's put down.
  fadeFurnitureForFloor() {
    const on = !!(PROP_TYPES[this.selectedProp] && PROP_TYPES[this.selectedProp].paintStyle);
    if (on === !!this.furnitureFaded) return;
    this.furnitureFaded = on;
    const alpha = on ? FLOOR_FADE_ALPHA : 1;
    const seen = new Set();
    for (const key in this.placed) {
      const rec = this.placed[key];
      if (seen.has(rec)) continue;
      seen.add(rec);
      if (PROP_TYPES[rec.type].floorStyle) continue; // dance floors are floor
      for (const obj of [rec.gameObject, rec.frontObject, rec.staff && rec.staff.container]) if (obj) obj.setAlpha(alpha);
    }
  }

  // Preview of the selected floor on the hovered tile.
  updateFloorPaintGhost() {
    this.fadeFurnitureForFloor();
    const def = PROP_TYPES[this.selectedProp];
    const tile = def && def.paintStyle ? this.hoverTile : null;
    const key = tile ? `${tile.gx},${tile.gy},${this.selectedProp}` : null;
    if (this.floorPaintGhost && this.floorPaintGhost.key === key) return;
    if (this.floorPaintGhost) { this.floorPaintGhost.destroy(); this.floorPaintGhost = null; }
    if (!tile) return;
    this.floorPaintGhost = this.floorPaintImage(tile.gx, tile.gy, this.selectedProp).setAlpha(0.85);
    this.floorPaintGhost.key = key;
    this.floorPaintLayer.add(this.floorPaintGhost);
  }

  // Takes the paint off a tile: the basic floor shows again.
  removeFloorPaint(gx, gy) {
    const key = `${gx},${gy}`;
    delete this.floorPaint[key];
    if (this.floorPaintImages[key]) { this.floorPaintImages[key].destroy(); delete this.floorPaintImages[key]; }
  }

  // Restores saved floors, skipping anything unknown or off the grid.
  restoreFloorPaint(saved) {
    if (!saved || typeof saved !== 'object') return;
    for (const [key, type] of Object.entries(saved)) {
      const [gx, gy] = key.split(',').map(Number);
      if (!PROP_TYPES[type] || !PROP_TYPES[type].paintStyle) continue;
      if (!this.inGrid(gx, gy)) continue;
      this.floorPaint[key] = type;
      this.drawFloorPaint(gx, gy, type);
    }
  }
}
