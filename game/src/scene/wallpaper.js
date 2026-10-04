// ClubScene methods: Wallpaper. Painting wall sections, drawing them, and
// animating the animated designs (src/walls.js).
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
//
// Each back wall is split into sections one tile wide: 'R<i>' is section i
// of the right wall (along gx), 'L<i>' section i of the left wall (along
// gy), counted from the corner. this.wallpaper maps a section to the
// wallpaper type painted on it; unpainted sections show the plain wall.
import { PROP_TYPES } from '../catalog.js';
import { TILE_H, TILE_W, WALL_HEIGHT } from '../config.js';
import { SFX } from '../sfx.js';
import { WALL_STYLES, WALL_TEX_H, WALL_TEX_W, wallFrameCanvas, wallFrameFor, wallTextureKey } from '../walls.js';

const SIDES = { R: 'right', L: 'left' };

export class WallpaperMixin {
  // Draws every frame of every wallpaper design, for both walls.
  registerWallTextures() {
    for (const [style, st] of Object.entries(WALL_STYLES)) {
      for (const side of Object.values(SIDES)) {
        for (let f = 0; f < st.frames; f++) {
          const key = wallTextureKey(style, f, side);
          if (!this.textures.exists(key)) this.textures.addCanvas(key, wallFrameCanvas(style, f, side));
        }
      }
    }
  }

  // The wall section under a point in world-local space, or null.
  wallSectionAt(x, y) {
    const half = TILE_W / 2;
    if (x >= 0) {
      const gx = x / half - 0.5;
      const h = (gx - 0.5) * (TILE_H / 2) - y;
      if (gx < -0.5 || gx > this.gridSize - 0.5 || h < 0 || h > WALL_HEIGHT) return null;
      return `R${Math.min(this.gridSize - 1, Math.round(gx))}`;
    }
    const gy = -x / half - 0.5;
    const h = (gy - 0.5) * (TILE_H / 2) - y;
    if (gy < -0.5 || gy > this.gridSize - 0.5 || h < 0 || h > WALL_HEIGHT) return null;
    return `L${Math.min(this.gridSize - 1, Math.round(gy))}`;
  }

  // Top-left screen position of a section's wallpaper image.
  wallSectionOrigin(section) {
    const i = Number(section.slice(1));
    const y = (i - 1) * (TILE_H / 2) - WALL_HEIGHT;
    return section[0] === 'R' ? { x: i * (TILE_W / 2), y } : { x: (-1 - i) * (TILE_W / 2), y };
  }

  wallImage(section, type, frame = 0) {
    const { x, y } = this.wallSectionOrigin(section);
    const key = wallTextureKey(PROP_TYPES[type].wallStyle, frame, SIDES[section[0]]);
    return this.add.image(x, y, key).setOrigin(0, 0).setDisplaySize(WALL_TEX_W / 2, WALL_TEX_H / 2);
  }

  // The bare walls: old brick on every section, under any wallpaper.
  // Redrawn whenever the walls are (the club may have grown).
  drawBareWalls(size) {
    for (const img of this.bareWallImages || []) img.destroy();
    this.bareWallImages = [];
    for (const side of ['R', 'L']) {
      for (let i = 0; i < size; i++) {
        const section = `${side}${i}`;
        const { x, y } = this.wallSectionOrigin(section);
        // One of the torn paper's variations, picked by section.
        const variant = (i * 7 + (side === 'L' ? 3 : 0)) % WALL_STYLES.tornPaper.frames;
        const img = this.add.image(x, y, wallTextureKey('tornPaper', variant, SIDES[side]))
          .setOrigin(0, 0).setDisplaySize(WALL_TEX_W / 2, WALL_TEX_H / 2);
        this.bareWallLayer.add(img);
        this.bareWallImages.push(img);
      }
    }
  }

  // Shows or replaces the wallpaper on one section.
  drawWallSection(section, type) {
    if (!this.wallImages) this.wallImages = {};
    if (this.wallImages[section]) this.wallImages[section].destroy();
    const img = this.wallImage(section, type);
    img.wallFrame = 0;
    this.wallpaperLayer.add(img);
    this.wallImages[section] = img;
  }

  // Paints the hovered wall section with the selected wallpaper.
  paintWall(section) {
    const type = this.selectedProp;
    const def = PROP_TYPES[type];
    if (!def || !def.wallStyle) return;
    if (!this.isUnlocked(type)) { SFX.denied(); return; }
    if (this.wallpaper[section] === type) return; // already this wallpaper
    const cost = this.currentCost(type);
    if (this.cash < cost) { SFX.denied(); return; }
    this.cash -= cost;
    this.wallpaper[section] = type;
    this.drawWallSection(section, type);
    SFX.place();
    this.updateUI();
    this.saveGame();
  }

  // Preview of the selected wallpaper on the hovered wall section.
  updateWallGhost() {
    const def = PROP_TYPES[this.selectedProp];
    const section = def && def.wallStyle ? this.hoverWall : null;
    if (this.wallGhost && this.wallGhost.section === section) return;
    if (this.wallGhost) { this.wallGhost.destroy(); this.wallGhost = null; }
    if (!section) return;
    this.wallGhost = this.wallImage(section, this.selectedProp).setAlpha(0.8);
    this.wallGhost.section = section;
    this.wallpaperLayer.add(this.wallGhost);
  }

  // Steps animated wallpaper while a DJ plays (called from animateFloors()).
  animateWalls(music) {
    for (const section in this.wallImages || {}) {
      const img = this.wallImages[section];
      const style = PROP_TYPES[this.wallpaper[section]].wallStyle;
      if (WALL_STYLES[style].frames <= 1) continue;
      const frame = music ? wallFrameFor(style, Number(section.slice(1)), this.floorTick) : 0;
      if (img.wallFrame !== frame) {
        img.wallFrame = frame;
        img.setTexture(wallTextureKey(style, frame, SIDES[section[0]]));
      }
    }
  }

  // Restores saved wallpaper, skipping anything unknown.
  restoreWallpaper(saved) {
    if (!saved || typeof saved !== 'object') return;
    for (const [section, type] of Object.entries(saved)) {
      if (!/^[RL]\d+$/.test(section) || !PROP_TYPES[type] || !PROP_TYPES[type].wallStyle) continue;
      if (Number(section.slice(1)) >= this.gridSize) continue;
      this.wallpaper[section] = type;
      this.drawWallSection(section, type);
    }
  }
}
