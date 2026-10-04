// ClubScene methods: Footprints, the placement ghost, and placing / rotating / selling / restoring props.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PROP_TYPES, STAFF_TYPES } from '../catalog.js';
import { FACINGS, FALLBACK_PROP_HEIGHT, FLOOR_COLOR, SELL_REFUND_RATIO, TILE_H, TILE_W } from '../config.js';
import { floorTextureKey } from '../floors.js';
import { SFX } from '../sfx.js';

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
      tx >= 0 && tx < this.gridSize && ty >= 0 && ty < this.gridSize && !this.placed[`${tx},${ty}`] &&
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
    if (placed.queue) this.clearBarQueue(placed); // the line moves with the bar
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
    this.positionStaff(placed);
    this.saveGame();
  }

  // Draws a bright outline around exactly the tiles a footprint occupies,
  // on the top-most layer, so a tall sprite's artwork can never visually
  // hide (or make you doubt) which floor tiles are actually claimed.
  drawFootprintOutline(tiles, color) {
    this.footprintOutline.clear();
    this.footprintOutline.lineStyle(3, color, 1);
    for (const [tx, ty] of tiles) {
      const { sx, sy } = this.gridToScreen(tx, ty);
      this.footprintOutline.strokePoints([
        { x: sx, y: sy - TILE_H / 2 },
        { x: sx + TILE_W / 2, y: sy },
        { x: sx, y: sy + TILE_H / 2 },
        { x: sx - TILE_W / 2, y: sy },
      ], true);
    }
  }

  updateGhost() {
    this.updateWallGhost();
    this.updateFloorPaintGhost();
    if (this.ghost) {
      this.ghost.destroy();
      this.ghost = null;
    }
    this.footprintOutline.clear();
    // Un-tint whatever tiles were highlighted for the LAST hover/facing/
    // prop combo before computing the new set — the highlight always
    // tracks the current footprint exactly, nothing else touches tile fills.
    for (const t of this.highlightedTiles) t.setFillStyle(FLOOR_COLOR, 0); // back to invisible
    this.highlightedTiles = [];

    // With nothing to place, show the normal system cursor so the player
    // can still see where they're pointing.
    this.game.canvas.style.cursor = 'default';
    if (!this.selectedProp || !this.hoverTile) return; // deselected (see deselectProp()) — no ghost/highlight to show

    const def = PROP_TYPES[this.selectedProp];
    if (def.wallStyle || def.paintStyle) return; // wallpaper and floor paint have their own previews

    const { gx, gy } = this.hoverTile;
    const facing = def.rotatable ? this.currentFacing : 0;
    // This is THE ONLY place footprint tiles get computed for hover
    // feedback, and it's the exact same call placeProp() makes. The tile
    // highlight below, the ghost sprite, and the green outline all draw
    // from this one array — they cannot disagree about which tiles are
    // involved because there's only one array now.
    const tiles = this.getFootprint(this.selectedProp, facing, gx, gy);
    const valid = this.footprintValid(tiles);

    // Tint exactly the tiles this click would occupy — purple if it's a
    // legal placement, dim red if it's blocked (occupied or off-grid).
    const fillColor = valid ? 0x3a2060 : 0x5a1030;
    for (const [tx, ty] of tiles) {
      const t = this.tiles[`${tx},${ty}`];
      if (t) {
        t.setFillStyle(fillColor, 1);
        this.highlightedTiles.push(t);
      }
    }
    if (!valid) return; // occupied or off-grid — no ghost sprite, just the red tint
    if (def.floorStyle) {
      const { sx, sy } = this.gridToScreen(tiles[0][0], tiles[0][1]);
      this.ghost = this.add.image(sx, sy, floorTextureKey(def.floorStyle, 0)).setDisplaySize(TILE_W, TILE_H).setAlpha(0.7);
      this.ghostLayer.add(this.ghost);
      return;
    }
    if (!def.rotatable || !this.hasAnySprite(this.selectedProp)) return; // placeholder-box props have no sprite ghost

    const { sx, sy } = this.footprintCenter(tiles);
    const texKey = this.spriteKeyFor(this.selectedProp, facing);
    const img = this.add.image(sx, sy, texKey);
    img.setOrigin(def.originX, def.originY);
    img.setDisplaySize(def.displayWidth, def.displayWidth * (img.height / img.width));
    img.setAlpha(0.5);
    this.ghostLayer.add(img);
    this.ghost = img;
    // Green outline reinforces the same tiles, drawn on the highest-depth
    // graphics layer so it always shows through the booth's artwork
    // instead of being hidden behind it.
    this.drawFootprintOutline(tiles, 0x00ff88);
    // The normal system cursor stays visible here (see the 'default' set
    // at the top of this method) even with the translucent ghost booth
    // showing — hiding it used to make the pointer vanish for as long as
    // a rotatable prop (currently just the DJ Booth) stayed selected,
    // which read as the mouse being stuck/broken rather than intentional.
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
    this.removeProp(placed);

    SFX.sell();
    this.updateGhost(); // the hover tint/ghost may be stale now that this tile is free
    this.updateUI();
    this.saveGame();
  }

  // Takes a placed prop out of the club (its tiles, art, staff and lights),
  // with no refund: used by selling and by swapping the DJ booth.
  removeProp(placed) {
    // A long bar keeps its bartender when one of its units goes.
    const mates = placed.staff && placed.staff.kind === 'bartender' ? this.barGroup(placed).filter((r) => r !== placed) : [];
    if (PROP_TYPES[placed.type].seats) this.releaseSeats(placed);
    if (placed.queue) this.clearBarQueue(placed); // anyone lined up at a bar wanders off
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
