// ClubScene methods: placing things on a phone or tablet. A tap is too
// fiddly to aim with a finger, so on touch screens picking an item from the
// store (or the inventory, or Move) drops it, see-through, on a free spot in
// the middle of the view (`placeSpot`). Dragging it (a finger starting on or
// next to it) slides it round the floor; dragging anywhere else moves the
// view as usual, and a tap elsewhere hops it there. Nothing is bought until
// the green ✓ on the bar above the dock (#placeBar), which also has Turn and
// Cancel. With a mouse, a click still places straight away.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PROP_TYPES } from '../catalog.js';
import { FACINGS, TOUCH } from '../config.js';
import { SFX } from '../sfx.js';
import { formatMoney } from '../util.js';

export class TouchPlaceMixin {
  setupTouchPlace() {
    this.touchUI = !!window.matchMedia?.('(pointer: coarse)').matches;
    // Whatever was used last decides: set before any button's own handler runs.
    document.addEventListener('pointerdown', (e) => {
      const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
      if (touch !== this.touchUI) { this.touchUI = touch; this.updateGhost(); }
    }, true);
    const on = (id, fn) => document.getElementById(id)?.addEventListener('click', (e) => { e.stopPropagation(); SFX.unlock(); fn(); });
    on('placeOk', () => this.confirmTouchPlace());
    on('placeTurn', () => this.turnTouchPlace());
    on('placeCancel', () => this.deselectProp());
  }

  // Holding something that goes on the floor, on a touch screen (wallpaper
  // and floor paint are tapped / dragged straight on).
  touchPlacing() {
    const def = this.touchUI && PROP_TYPES[this.selectedProp];
    return !!def && !def.wallStyle && !def.paintStyle;
  }

  // Keeps the held item on its spot (called by updateGhost()): picks a spot
  // when something is first held, forgets it when it's put down.
  syncPlaceSpot() {
    if (!this.touchPlacing()) {
      this.placeSpot = null;
      this.showPlaceBar(false);
      return;
    }
    if (!this.placeSpot || this.placeSpotFor !== this.selectedProp) {
      this.placeSpot = this.freeSpotNear(this.viewCentreTile());
      this.placeSpotFor = this.selectedProp;
    }
    this.hoverTile = this.placeSpot;
  }

  // The floor tile in the middle of the open view, between the bar at the
  // top and the dock, clamped into the room.
  viewCentreTile() {
    const { top, bottom } = this.openViewBand();
    const x = (this.scale.width / 2 - this.world.x) / this.world.scaleX;
    const y = ((top + bottom) / 2 + 30 - this.world.y) / this.world.scaleY; // +30: the picture stands up off its tiles
    const { gx, gy } = this.screenToGrid(x, y);
    return { gx: Math.max(0, Math.min(this.gridW - 1, gx)), gy: Math.max(0, Math.min(this.gridH - 1, gy)) };
  }

  fitsAt(gx, gy) {
    const def = PROP_TYPES[this.selectedProp];
    return this.footprintValid(this.getFootprint(this.selectedProp, def.rotatable ? this.currentFacing : 0, gx, gy));
  }

  // The nearest spot from `from` where the held item fits (or `from` itself
  // if it fits nowhere).
  freeSpotNear(from) {
    for (let r = 0; r < this.gridW + this.gridH; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (const dy of r === Math.abs(dx) ? [r - Math.abs(dx)] : [r - Math.abs(dx), -(r - Math.abs(dx))]) {
          const gx = from.gx + dx;
          const gy = from.gy + dy;
          if (this.inGrid(gx, gy) && this.fitsAt(gx, gy)) return { gx, gy };
        }
      }
    }
    return from;
  }

  moveTouchPlace(gx, gy) {
    gx = Math.max(0, Math.min(this.gridW - 1, gx));
    gy = Math.max(0, Math.min(this.gridH - 1, gy));
    if (this.placeSpot && this.placeSpot.gx === gx && this.placeSpot.gy === gy) return;
    this.placeSpot = { gx, gy };
    this.updateGhost();
  }

  // The tile under a screen point (may be off the floor).
  tileAtScreen(x, y) {
    return this.screenToGrid((x - this.world.x) / this.world.scaleX, (y - this.world.y) / this.world.scaleY);
  }

  // A finger coming down on or right next to the held item grabs it: until
  // it lifts, the item follows it (keeping where on the item it was held).
  grabTouchPlace(p) {
    if (!this.placeSpot) return false;
    const at = this.tileAtScreen(p.x, p.y);
    const def = PROP_TYPES[this.selectedProp];
    const tiles = this.getFootprint(this.selectedProp, def.rotatable ? this.currentFacing : 0, this.placeSpot.gx, this.placeSpot.gy);
    // The picture stands up off the floor, so a touch a little above the tiles counts too.
    const near = tiles.some(([tx, ty]) => Math.abs(tx - at.gx) <= 1 && Math.abs(ty - at.gy) <= 1)
      || tiles.some(([tx, ty]) => at.gx >= tx - 2 && at.gy >= ty - 2 && at.gx <= tx && at.gy <= ty);
    if (!near) return false;
    this.placeGrab = { dx: this.placeSpot.gx - at.gx, dy: this.placeSpot.gy - at.gy, x: p.x, y: p.y, moved: false };
    return true;
  }

  dragTouchPlace(p) {
    const g = this.placeGrab;
    if (!g.moved && Math.abs(p.x - g.x) + Math.abs(p.y - g.y) <= TOUCH.tapSlop) return; // still a tap
    g.moved = true;
    const at = this.tileAtScreen(p.x, p.y);
    this.moveTouchPlace(at.gx + g.dx, at.gy + g.dy);
  }

  // A finger lifted: a grab that never moved was a tap, which hops the item
  // to the tile tapped (like a tap anywhere else).
  releaseTouchPlace(p) {
    const g = this.placeGrab;
    this.placeGrab = null;
    if (g.moved) return;
    const at = this.tileAtScreen(p.x, p.y);
    if (this.inGrid(at.gx, at.gy)) this.moveTouchPlace(at.gx, at.gy);
  }

  turnTouchPlace() {
    const def = PROP_TYPES[this.selectedProp];
    if (!def || !def.rotatable) { SFX.denied(); return; }
    this.currentFacing = FACINGS[(FACINGS.indexOf(this.currentFacing) + 1) % FACINGS.length];
    SFX.place();
    this.updateGhost();
  }

  // The ✓: buys (or places, from the inventory) the item where it stands,
  // then has the next one ready on the nearest free spot.
  confirmTouchPlace() {
    const spot = this.placeSpot;
    if (!spot || !this.fitsAt(spot.gx, spot.gy)) { SFX.denied(); this.showToast('It doesn\'t fit there. Drag it to a green spot.', 2500); return; }
    const before = this.placed[`${spot.gx},${spot.gy}`];
    this.placeProp(spot.gx, spot.gy);
    if (this.placed[`${spot.gx},${spot.gy}`] === before) return; // not placed (not enough cash, say)
    if (this.touchPlacing()) { this.placeSpot = this.freeSpotNear(spot); this.updateGhost(); }
  }

  // The screen's open strip: under the name tag and bar at the top, above
  // the dock's tray (in canvas pixels, which are the page's).
  openViewBand() {
    const rect = (id) => { const el = document.getElementById(id); return el && el.offsetParent ? el.getBoundingClientRect() : null; };
    const chip = rect('selectedChip');
    const tray = rect('dockCenter') || rect('navBar');
    const top = chip ? chip.bottom + 60 : this.scale.height * 0.25;
    const bottom = tray ? tray.top : this.scale.height * 0.8;
    return { top, bottom: Math.max(bottom, top + 40) };
  }

  // The bar of buttons, just under the name tag at the top, with the price on the ✓.
  showPlaceBar(open) {
    const bar = document.getElementById('placeBar');
    if (!bar) return;
    bar.classList.toggle('open', open);
    if (!open) return;
    const def = PROP_TYPES[this.selectedProp];
    const fromInventory = this.holdingFromInventory && this.inventoryCount(this.selectedProp) > 0;
    const fits = !!this.placeSpot && this.fitsAt(this.placeSpot.gx, this.placeSpot.gy);
    const ok = document.getElementById('placeOk');
    ok.textContent = fromInventory || this.movingBooth ? '✓ Place' : `✓ Buy ${formatMoney(this.currentCost(this.selectedProp))}`;
    ok.classList.toggle('blocked', !fits);
    document.getElementById('placeTurn').classList.toggle('blocked', !def.rotatable);
    const chip = document.getElementById('selectedChip');
    const below = chip && chip.offsetParent ? chip.getBoundingClientRect().bottom : 100;
    bar.style.top = `${below + 6}px`;
  }
}
