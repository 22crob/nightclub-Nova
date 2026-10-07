// ClubScene methods: Footprints, the placement ghost, and placing / rotating / selling / restoring props.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PROP_TYPES, STAFF_TYPES } from '../catalog.js';
import { FACINGS, FALLBACK_PROP_HEIGHT, SELL_REFUND_RATIO, TILE_H, TILE_W } from '../config.js';
import { floorTextureKey } from '../floors.js';
import { SFX } from '../sfx.js';

// Where a held item would go: green if it fits, red if it doesn't.
const PLACE_OK = 0x3dff6a;
const PLACE_BLOCKED = 0xff3b3b;

export class PlacementMixin {
  // Grid tiles a prop occupies, given the tile that was clicked/hovered
  // (the "anchor") and the current facing. Single-tile props just occupy
  // the one tile they were placed on.
  // A DJ booth also takes the tiles behind its desk, where the DJ stands
  // (def.backTiles); those are tagged .back, and the art and draw order go
  // by the desk tiles alone (see deskTiles()).
  getFootprint(propType, facing, gx, gy) {
    const def = PROP_TYPES[propType];
    if (!def.footprint) return [[gx, gy]];
    const offsets = def.footprint[facing] || [[0, 0]];
    const tiles = offsets.map(([dx, dy]) => [gx + dx, gy + dy]);
    for (const [dx, dy] of (def.backTiles && def.backTiles[facing]) || []) {
      const t = [gx + dx, gy + dy];
      t.back = true;
      tiles.push(t);
    }
    return tiles;
  }

  // The tiles a prop's art stands on (all of them, less a booth's DJ tiles).
  deskTiles(tiles) {
    const desk = tiles.filter((t) => !t.back);
    return desk.length ? desk : tiles;
  }

  // True only if every tile in the footprint is on the grid and empty. The
  // doorway tile stays free of anything solid, or no one could get in.
  // (A save from before this rule may still have something there; loading
  // it passes allowDoor.)
  footprintValid(tiles, type = this.selectedProp, allowDoor = false) {
    const solid = !allowDoor && !(PROP_TYPES[type] && PROP_TYPES[type].floorStyle);
    return tiles.every(([tx, ty]) => (
      this.inGrid(tx, ty) && !this.placed[`${tx},${ty}`] &&
      !(solid && tx === this.doorTile().gx && ty === this.doorTile().gy)
    ));
  }

  // Screen position at the center of a footprint (the midpoint between
  // tile centers for a multi-tile prop, or just that tile's center for a
  // single-tile one) — this is where the sprite's origin point gets drawn.
  footprintCenter(allTiles) {
    const tiles = this.deskTiles(allTiles);
    const avgGx = tiles.reduce((s, [tx]) => s + tx, 0) / tiles.length;
    const avgGy = tiles.reduce((s, [, ty]) => s + ty, 0) / tiles.length;
    return this.gridToScreen(avgGx, avgGy);
  }

  handleRotateKey() {
    if (this.hoverTile) {
      const tileKey = `${this.hoverTile.gx},${this.hoverTile.gy}`;
      const placed = this.placed[tileKey];
      if (placed && PROP_TYPES[placed.type].rotatable) {
        this.rotatePlacedProp(tileKey);
        return;
      }
    }
    // Nothing placed/rotatable under the cursor — rotate the pending
    // facing instead, so the next prop you place comes in already turned.
    const idx = FACINGS.indexOf(this.currentFacing);
    this.currentFacing = FACINGS[(idx + 1) % FACINGS.length];
    this.updateGhost();
  }

  rotatePlacedProp(tileKey) {
    const placed = this.placed[tileKey];
    // A multi-tile prop's shared record is stored under every tile it
    // occupies; always pivot around its original anchor tile so rotating
    // from a "second" tile doesn't shift the piece.
    if (PROP_TYPES[placed.type].seats) this.releaseSeats(placed); // anyone sitting gets up first
    this.clearBarQueue(placed); // the line moves with the bar
    const [agx, agy] = placed.anchor;
    const idx = FACINGS.indexOf(placed.facing);
    const newFacing = FACINGS[(idx + 1) % FACINGS.length];
    const newTiles = this.getFootprint(placed.type, newFacing, agx, agy);

    // Free the old tiles first so the new footprint's validity check
    // doesn't see the prop's own current tiles as "occupied".
    for (const [tx, ty] of placed.tiles) delete this.placed[`${tx},${ty}`];
    if (!this.footprintValid(newTiles, placed.type)) {
      // Can't rotate in place (would overlap something else or fall off
      // the grid) — put the old occupancy back and leave it as-is.
      for (const [tx, ty] of placed.tiles) this.placed[`${tx},${ty}`] = placed;
      return;
    }

    placed.facing = newFacing;
    placed.tiles = newTiles;
    for (const [tx, ty] of newTiles) this.placed[`${tx},${ty}`] = placed;

    const { sx, sy } = this.footprintCenter(newTiles);
    // The real sprite image swaps to that facing's texture. The fallback
    // box (drawFallbackBox(), used when this prop's sprites failed to load)
    // is a plain Rectangle shape with no facing-specific art and no
    // .setTexture() at all — just move it (and its label) to the new
    // footprint center instead, using the same offsets drawFallbackBox()
    // placed them at originally.
    if (placed.frontObject) {
      placed.gameObject.setTexture(this.layerKeyFor(placed.type, placed.facing, 'back')).setPosition(sx, sy);
      placed.frontObject.setTexture(this.layerKeyFor(placed.type, placed.facing, 'front')).setPosition(sx, sy);
    } else if (typeof placed.gameObject.setTexture === 'function') {
      const texKey = this.spriteKeyFor(placed.type, placed.facing);
      placed.gameObject.setTexture(texKey);
      placed.gameObject.setPosition(sx, sy);
    } else {
      placed.gameObject.setPosition(sx, sy - FALLBACK_PROP_HEIGHT / 2);
      if (placed.label) placed.label.setPosition(sx, sy - FALLBACK_PROP_HEIGHT - 10);
    }
    if (placed.lightPool) placed.lightPool.setPosition(sx, sy);
    if (placed.lightRig) placed.lightRig.container.setPosition(sx, sy);
    this.setPropDepth(placed.gameObject, placed.type, newTiles, placed.frontObject, placed.facing);
    this.destroyGlowFx(placed);
    this.createGlowFx(placed); // the glow follows the turned prop
    this.positionStaff(placed);
    this.saveGame();
  }

  // Draws a bright outline around exactly the tiles a footprint occupies,
  // on the top-most layer, so a tall sprite's artwork can never visually
  // hide (or make you doubt) which floor tiles are actually claimed.
  drawFootprintOutline(tiles, color) {
    this.footprintOutline.clear();
    this.footprintOutline.lineStyle(3, color, 1);
    for (const [tx, ty] of tiles) this.footprintOutline.strokePoints(this.tileCorners(tx, ty), true);
  }

  // The four corners of a floor tile on screen (in world coordinates).
  tileCorners(tx, ty) {
    const { sx, sy } = this.gridToScreen(tx, ty);
    return [
      { x: sx, y: sy - TILE_H / 2 },
      { x: sx + TILE_W / 2, y: sy },
      { x: sx, y: sy + TILE_H / 2 },
      { x: sx - TILE_W / 2, y: sy },
    ];
  }

  // While holding something to place, it always shows where the pointer
  // is: a see-through picture of the item, and the tiles it would take,
  // filled and outlined in green where it fits and in red where it doesn't
  // (with the picture tinted red too), so you can see the item and its
  // space before finding a free spot.
  updateGhost() {
    this.updateWallGhost();
    this.updateFloorPaintGhost();
    if (this.ghost) {
      this.ghost.destroy();
      this.ghost = null;
    }
    this.footprintOutline.clear();
    if (!this.footprintFill) {
      // On the floor: over dance floors and painted tiles, under furniture
      // and people (like the selection outline, see selection.js).
      this.footprintFill = this.add.graphics().setDepth(-499);
      this.propLayer.add(this.footprintFill);
      this.propLayer.sort('depth');
    }
    this.footprintFill.clear();

    // With nothing to place, show the normal system cursor so the player
    // can still see where they're pointing.
    this.game.canvas.style.cursor = 'default';
    if (!this.selectedProp || !this.hoverTile) return; // deselected (see deselectProp()) — no ghost/highlight to show

    const def = PROP_TYPES[this.selectedProp];
    if (def.paintStyle) { this.drawFootprintOutline([[this.hoverTile.gx, this.hoverTile.gy]], PLACE_OK); return; } // the tile to floor, over everything
    if (def.wallStyle) return; // wallpaper has its own preview

    const { gx, gy } = this.hoverTile;
    const facing = def.rotatable ? this.currentFacing : 0;
    // This is THE ONLY place footprint tiles get computed for hover
    // feedback, and it's the exact same call placeProp() makes. The tile
    // fill, the ghost sprite and the outline all draw from this one array,
    // so they can't disagree about which tiles are involved.
    const tiles = this.getFootprint(this.selectedProp, facing, gx, gy);
    const valid = this.footprintValid(tiles);
    const color = valid ? PLACE_OK : PLACE_BLOCKED;

    this.footprintFill.fillStyle(color, 0.4);
    for (const [tx, ty] of tiles) this.footprintFill.fillPoints(this.tileCorners(tx, ty), true);

    if (def.floorStyle) {
      const { sx, sy } = this.gridToScreen(tiles[0][0], tiles[0][1]);
      this.ghost = this.add.image(sx, sy, floorTextureKey(def.floorStyle, 0)).setDisplaySize(TILE_W, TILE_H).setAlpha(0.75);
    } else if (this.hasAnySprite(this.selectedProp)) {
      const { sx, sy } = this.footprintCenter(tiles);
      const img = this.add.image(sx, sy, this.spriteKeyFor(this.selectedProp, facing));
      img.setOrigin(def.originX, def.originY);
      img.setDisplaySize(def.displayWidth, def.displayWidth * (img.height / img.width));
      img.setAlpha(0.65);
      this.ghost = img;
    }
    if (this.ghost) {
      if (!valid) this.ghost.setTint(0xff7a7a);
      this.ghostLayer.add(this.ghost);
    }
    // The outline goes on the highest-depth layer, so it always shows
    // through the item's artwork (and any furniture in the way).
    this.drawFootprintOutline(tiles, color);
    // The normal system cursor stays visible (see the 'default' above) so
    // the pointer never seems to vanish while something is held.
  }

  placeProp(gx, gy) {
    if (!this.selectedProp) return; // nothing selected (see deselectProp()) — an empty-handed click does nothing
    const def = PROP_TYPES[this.selectedProp];
    if (def.wallStyle || def.paintStyle) return; // painted with paintWall() / paintFloor()
    // Things from the inventory are already paid for, and can be placed
    // whatever your level.
    const fromInventory = this.holdingFromInventory && this.inventoryCount(this.selectedProp) > 0;
    if (!fromInventory && !this.isUnlocked(this.selectedProp)) { SFX.denied(); return; } // never buy something not yet unlocked
    const cost = fromInventory ? 0 : this.currentCost(this.selectedProp); // fixed price for this item — see currentCost()
    if (this.cash < cost) { SFX.denied(); return; }

    const tiles = this.getFootprint(this.selectedProp, this.currentFacing, gx, gy);
    if (!this.footprintValid(tiles)) { SFX.denied(); return; } // occupied or off-grid

    this.cash -= cost;
    const facing = def.rotatable ? this.currentFacing : 0;
    const { gameObject, frontObject, label, lightRig, lightPool } = this.createPropVisual(this.selectedProp, facing, tiles);

    const record = {
      type: this.selectedProp,
      facing,
      gameObject,
      frontObject,
      label,
      lightRig,
      lightPool,
      tiles,
      anchor: [gx, gy],
    };
    for (const [tx, ty] of tiles) {
      this.placed[`${tx},${ty}`] = record;
    }
    this.createGlowFx(record); // a spotlight or disco ball shines (lighting.js)
    // XP for a purchase; an item from the inventory brings back the XP it
    // gave when it was first bought.
    const center = this.footprintCenter(tiles);
    record.xp = fromInventory ? this.takeInventoryXp(record.type) : this.awardPurchaseXp(cost, center.sx, center.sy - 60);
    if (!fromInventory && cost > 0) {
      this.bumpGoal('bought');
      if (def.category === 'Decorations') this.bumpGoal('decorBought');
    }
    if (fromInventory) this.placedFromInventory(record);

    SFX.place();
    this.updateGhost();
    this.updateUI();
    this.saveGame();
    const staffKind = def.staff && STAFF_TYPES[def.staff];
    if (staffKind && !this.isWorked(record)) this.showToast(`Now hire a ${staffKind.label.toLowerCase()} for it in the Staff tab.`, 3500);
  }

  // Right-clicking a placed prop sells it back for a fraction of its fixed
  // price — enough that rearranging your club isn't a total loss, but not
  // full price, so buy-then-sell isn't a way to print money.
  sellProp(gx, gy) {
    const key = `${gx},${gy}`;
    const placed = this.placed[key];
    if (!placed) return; // nothing here to sell
    if (PROP_TYPES[placed.type].staff === 'dj') {
      // The club's DJ booth stays; it can only be swapped for another tier.
      SFX.denied();
      this.showToast('🎧 Your DJ booth stays! Upgrade it from the DJ Booths tab.');
      return;
    }

    const refund = Math.round(PROP_TYPES[placed.type].cost * SELL_REFUND_RATIO);
    this.cash += refund;
    const center = this.footprintCenter(placed.tiles);
    this.revokePurchaseXp(placed.xp, center.sx, center.sy - 60); // no farming XP by buying and selling
    this.removeProp(placed);

    SFX.sell();
    this.updateGhost(); // the hover tint/ghost may be stale now that this tile is free
    this.updateUI();
    this.saveGame();
  }

  // Takes a placed prop out of the club (its tiles, art, staff and lights),
  // with no refund: used by selling and by swapping the DJ booth.
  removeProp(placed) {
    this.forgetHovered(placed); // no glow or outline left on it (selection.js)
    // A long bar keeps its bartender when one of its units goes.
    const mates = placed.staff && placed.staff.kind === 'bartender' ? this.barGroup(placed).filter((r) => r !== placed) : [];
    if (PROP_TYPES[placed.type].seats) this.releaseSeats(placed);
    this.clearBarQueue(placed); // anyone lined up at a bar wanders off
    // The record is stored under every tile a multi-tile prop occupies —
    // free all of them, not just the tile that was clicked.
    for (const [tx, ty] of placed.tiles) delete this.placed[`${tx},${ty}`];
    placed.gameObject.destroy();
    if (placed.frontObject) placed.frontObject.destroy();
    this.detachStaff(placed);
    const free = mates.filter((r) => !r.staff);
    if (free.length) this.attachStaff(free[Math.floor(free.length / 2)]);
    if (placed.label) {
      // Selling the one prop whose label is currently shown (the player was
      // hovering it to right-click-sell it) would otherwise leave a
      // destroyed object referenced as "currently shown" — clear it so a
      // later hover doesn't try to hide an already-destroyed label.
      if (this.hoveredPropLabel === placed.label) this.hoveredPropLabel = null;
      placed.label.destroy();
    }
    if (placed.lightPool) placed.lightPool.destroy();
    this.destroyGlowFx(placed);
    if (placed.lightRig) {
      // Stop the rotation tween before destroying its target — otherwise
      // the tween keeps a dead reference around until it next ticks.
      placed.lightRig.tween.remove();
      placed.lightRig.container.destroy();
    }
  }

  // Recreates one prop from a save entry — same visual as placeProp() but
  // skips the cost check (already paid for in the saved session). Silently
  // drops a prop that no longer fits (e.g. a hand-edited or corrupted save
  // claims a tile that's somehow already taken) rather than throwing and
  // aborting the rest of the load.
  restoreProp(type, facing, anchor) {
    const tiles = this.getFootprint(type, facing, anchor[0], anchor[1]);
    if (!this.footprintValid(tiles, type, true)) {
      console.warn('[Club Nova] skipped restoring a saved prop that no longer fits:', type, anchor);
      return;
    }
    const { gameObject, frontObject, label, lightRig, lightPool } = this.createPropVisual(type, facing, tiles);
    const record = { type, facing, gameObject, frontObject, label, lightRig, lightPool, tiles, anchor };
    for (const [tx, ty] of tiles) {
      this.placed[`${tx},${ty}`] = record;
    }
    this.createGlowFx(record);
    return record;
  }

  // Number of distinct placed props, deduped by record identity so a
  // multi-tile prop (the 2-tile DJ booth) counts once, not once per tile —
  // same dedup pattern as the fan-rate timer in create().
  placedCount() {
    const counted = new Set();
    for (const key in this.placed) counted.add(this.placed[key]);
    return counted.size;
  }
}
