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
    if (gx < 0 || gy < 0 || gx >= this.gridSize || gy >= this.gridSize) return false;
    if (!this.isUnlocked(type)) { SFX.denied(); return false; }
    const key = `${gx},${gy}`;
    if (this.floorPaint[key] === type) return false; // already this floor
    const cost = this.currentCost(type);
    if (this.cash < cost) { SFX.denied(); return false; }
    this.cash -= cost;
    this.floorPaint[key] = type;
    this.drawFloorPaint(gx, gy, type);
    SFX.place();
    this.updateUI();
    return true;
  }

  // Preview of the selected floor on the hovered tile.
  updateFloorPaintGhost() {
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

  // Restores saved floors, skipping anything unknown or off the grid.
  restoreFloorPaint(saved) {
    if (!saved || typeof saved !== 'object') return;
    for (const [key, type] of Object.entries(saved)) {
      const [gx, gy] = key.split(',').map(Number);
      if (!PROP_TYPES[type] || !PROP_TYPES[type].paintStyle) continue;
      if (!(gx >= 0 && gy >= 0 && gx < this.gridSize && gy < this.gridSize)) continue;
      this.floorPaint[key] = type;
      this.drawFloorPaint(gx, gy, type);
    }
  }
}
