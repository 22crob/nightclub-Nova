// ClubScene methods: hovering and selecting things in the club. The thing
// under the cursor is whatever is actually drawn there, pixel for pixel,
// nearest the camera first (`objectAt()`): a guest, a bartender, the DJ, the
// security guard or a piece of furniture. Hovering one gives it a soft
// outline glow round its exact shape (every layer of a bar, all of a
// three-tile booth). Clicking furniture selects the whole piece and outlines
// its full floor footprint; the Edit tools act on whatever was clicked.
// Bonus badges (bonuses.js) are checked before any of this.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PROP_TYPES } from '../catalog.js';
import { HOVER, TOUCH } from '../config.js';

export class SelectionMixin {
  // Everything that can be hovered: its images (in draw order) and depth.
  hoverCandidates() {
    const out = [];
    const person = (kind, target, container, image) => {
      if (!container || !container.active || !container.visible || !image) return;
      out.push({ kind, target, images: [image], depth: container.depth });
    };
    for (const p of this.patrons) if (!p.gone) person('guest', p, p.container, p.container.patronSprite);
    for (const rec of this.staffableRecords()) {
      if (rec.staff) person(rec.staff.kind === 'dj' ? 'dj' : 'bartender', rec, rec.staff.container, rec.staff.container.staffSprite);
    }
    if (this.guard) person('guard', this.guard, this.guard.container, this.guard.container.patronSprite);
    const seen = new Set();
    for (const key in this.placed) {
      const rec = this.placed[key];
      if (seen.has(rec)) continue;
      seen.add(rec);
      const images = [rec.gameObject, rec.frontObject].filter((o) => o && o.active && o.frame);
      if (images.length) out.push({ kind: 'prop', target: rec, images, depth: Math.max(...images.map((o) => o.depth)) });
    }
    return out;
  }

  // True if an image draws a (non-transparent) pixel at screen point (x, y).
  imageHit(img, x, y) {
    const m = img.getWorldTransformMatrix();
    const local = m.applyInverse(x, y);
    const lx = local.x + img.displayOriginX;
    const ly = local.y + img.displayOriginY;
    if (lx < 0 || ly < 0 || lx >= img.frame.width || ly >= img.frame.height) return false;
    const alpha = this.textures.getPixelAlpha(Math.floor(lx), Math.floor(ly), img.texture.key, img.frame.name);
    return alpha === null || alpha > HOVER.alphaHit;
  }

  // Whatever is drawn under a screen point, nearest the camera, or null:
  // { kind: 'guest' | 'bartender' | 'dj' | 'guard' | 'prop', target, images }.
  objectAt(x, y) {
    const hits = this.hoverCandidates().filter((c) => c.images.some((img) => this.imageHit(img, x, y)));
    if (hits.length === 0) return null;
    hits.sort((a, b) => b.depth - a.depth);
    return hits[0];
  }

  // A finger is less exact than a mouse: if nothing is drawn right under
  // the tap, take the nearest thing within TOUCH.reach px around it.
  objectNear(x, y) {
    const hit = this.objectAt(x, y);
    if (hit) return hit;
    const r = TOUCH.reach;
    for (const k of [0.5, 1]) {
      for (let a = 0; a < 8; a++) {
        const t = (a / 8) * Math.PI * 2;
        const near = this.objectAt(x + Math.cos(t) * r * k, y + Math.sin(t) * r * k);
        if (near) return near;
      }
    }
    return null;
  }

  // --- The outline glow -------------------------------------------------------

  glowOn(hit, color, strength) {
    if (!hit) return;
    for (const img of hit.images) {
      if (!img.preFX || img.selectGlow) continue;
      img.preFX.setPadding(HOVER.padding);
      img.selectGlow = img.preFX.addGlow(color, strength, 0, false, 0.1, 10);
    }
  }

  glowOff(hit) {
    if (!hit) return;
    for (const img of hit.images) {
      if (!img.selectGlow) continue;
      if (img.active && img.preFX) img.preFX.remove(img.selectGlow);
      img.selectGlow = null;
    }
  }

  // Called as the pointer moves: glows whatever is under it.
  updateHoverObject(pointer) {
    if (this.selectedProp || this.bonusAt(pointer.x, pointer.y)) { this.setHovered(null); return; }
    this.setHovered(this.objectAt(pointer.x, pointer.y));
    if (this.dockTab === 'edit') this.drawSelectionFootprint(); // floor tiles follow the cursor
  }

  setHovered(hit) {
    const same = (a, b) => (!a && !b) || (a && b && a.target === b.target);
    if (same(hit, this.hovered)) return;
    // The selected piece keeps its glow.
    if (this.hovered && !(this.selected && this.hovered.target === this.selected.target)) this.glowOff(this.hovered);
    this.hovered = hit;
    if (hit && !(this.selected && hit.target === this.selected.target)) this.glowOn(hit, HOVER.color, HOVER.strength);
    this.drawSelectionFootprint();
  }

  // --- Selecting furniture ----------------------------------------------------

  // Selects a placed piece: a stronger glow and its whole floor footprint.
  selectRecord(rec) {
    this.clearSelection();
    const hit = this.hoverCandidates().find((c) => c.target === rec);
    if (!hit) return;
    this.glowOff(hit);
    this.selected = hit;
    this.glowOn(hit, HOVER.selectColor, HOVER.selectStrength);
    this.drawSelectionFootprint();
  }

  clearSelection() {
    if (!this.selected) return;
    this.glowOff(this.selected);
    this.selected = null;
    this.drawSelectionFootprint();
  }

  // Outlines the floor under the selected piece (and, in Edit mode, under
  // the piece being hovered).
  drawSelectionFootprint() {
    if (!this.selectionOutline) {
      // On the floor: over dance floors (depth -1000 + ...), under people
      // and furniture.
      this.selectionOutline = this.add.graphics().setDepth(-500);
      this.propLayer.add(this.selectionOutline);
      this.propLayer.sort('depth');
    }
    const g = this.selectionOutline;
    g.clear();
    const outline = (rec, color, alpha) => {
      g.fillStyle(color, 0.18 * alpha);
      g.lineStyle(2, color, alpha);
      for (const [x, y] of rec.tiles) {
        const pts = [[x - 0.5, y - 0.5], [x + 0.5, y - 0.5], [x + 0.5, y + 0.5], [x - 0.5, y + 0.5]]
          .map(([gx, gy]) => { const { sx, sy } = this.gridToScreen(gx, gy); return { x: sx, y: sy }; });
        g.fillPoints(pts, true);
        g.strokePoints(pts, true);
      }
    };
    if (this.dockTab === 'edit' && this.hovered && this.hovered.kind === 'prop') outline(this.hovered.target, HOVER.color, 0.8);
    // In Edit, a painted floor tile under the cursor is selectable too.
    else if (this.dockTab === 'edit' && !this.selectedProp && this.hoverTile && this.floorPaint[`${this.hoverTile.gx},${this.hoverTile.gy}`]) {
      outline({ tiles: [[this.hoverTile.gx, this.hoverTile.gy]] }, HOVER.color, 0.8);
    }
    if (this.selected && this.placed[`${this.selected.target.anchor[0]},${this.selected.target.anchor[1]}`] === this.selected.target) {
      outline(this.selected.target, HOVER.selectColor, 1);
    }
  }

  // A piece is going away (sold, stored, picked up): forget it.
  forgetHovered(rec) {
    if (this.hovered && this.hovered.target === rec) { this.glowOff(this.hovered); this.hovered = null; }
    if (this.selected && this.selected.target === rec) { this.glowOff(this.selected); this.selected = null; }
    this.drawSelectionFootprint();
  }

  // A click with nothing in hand: the Edit tools act on the piece clicked
  // (anywhere on it), a person opens their card, and furniture is selected.
  // True if the click was used.
  clickObject(pointer) {
    const hit = pointer.wasTouch ? this.objectNear(pointer.x, pointer.y) : this.objectAt(pointer.x, pointer.y);
    if (this.dockTab === 'edit') {
      if (hit && hit.kind === 'prop') {
        const [ax, ay] = hit.target.anchor;
        this.forgetHovered(hit.target);
        return this.editClick(ax, ay);
      }
      return false;
    }
    if (!hit) { this.clearSelection(); return false; }
    if (hit.kind === 'prop') {
      if (PROP_TYPES[hit.target.type]) this.selectRecord(hit.target);
      return true;
    }
    this.clearSelection();
    if (hit.kind === 'guest') { this.openInfoCard('guest', hit.target); return true; }
    if (hit.kind === 'bartender') { this.openInfoCard('bartender', hit.target); return true; }
    return true; // the DJ and the guard have no card yet
  }
}
