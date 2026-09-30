// ClubScene methods: Floor tiles, back walls, entrance, grid math, hover tracking and club expansion.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { GRID_EXPANSIONS } from '../catalog.js';
import { FLOOR_COLOR, FLOOR_SEAM, PATRON_SPAWN_TILE, TILE_H, TILE_W, WALL_BASEBOARD, WALL_COLORS, WALL_HEIGHT, ZOOM_MAX, ZOOM_MIN } from '../config.js';
import { SFX } from '../sfx.js';

export class WorldMixin {
  gridToScreen(gx, gy) {
    return {
      sx: (gx - gy) * (TILE_W / 2),
      sy: (gx + gy) * (TILE_H / 2),
    };
  }

  // Builds any tile in [0, upToSize) x [0, upToSize) that doesn't already
  // exist in this.tiles yet. Called once for the whole starting grid in
  // create(), and again with a bigger upToSize from expandClub() — in that
  // second case every already-built tile is skipped, so this only ever
  // adds the newly exposed strip of floor rather than rebuilding anything.
  buildTiles(upToSize) {
    for (let gx = 0; gx < upToSize; gx++) {
      for (let gy = 0; gy < upToSize; gy++) {
        const key = `${gx},${gy}`;
        if (this.tiles[key]) continue;
        const { sx, sy } = this.gridToScreen(gx, gy);
        // IMPORTANT: Phaser's Polygon shape computes its bounds/origin
        // incorrectly when any of its points are negative (a documented
        // Phaser quirk) — this silently renders the shape offset from the
        // (x,y) position you gave it. Our diamond points used to be
        // centered on (0,0) (e.g. -24, -48), which is exactly that trap:
        // the outline (drawn with plain Graphics, unaffected by this
        // Polygon-specific bug) was rendering in the true correct spot the
        // whole time, while every tile's actual fill/hit area was quietly
        // shifted — which is why the purple highlight and the green
        // footprint outline could never visually agree. Using all
        // non-negative points (and shifting the origin math to match)
        // sidesteps the bug entirely.
        const tile = this.add.polygon(
          sx, sy,
          [TILE_W / 2, 0, TILE_W, TILE_H / 2, TILE_W / 2, TILE_H, 0, TILE_H / 2],
          FLOOR_COLOR, 1
        );
        tile.setStrokeStyle(1, FLOOR_SEAM.color, FLOOR_SEAM.alpha);
        tile.gx = gx;
        tile.gy = gy;
        this.tileLayer.add(tile);
        this.tiles[key] = tile;
      }
    }
  }

  // Draws the two "back" walls that frame the floor, along the gx=0 and
  // gy=0 edges (the ones furthest from this fixed camera angle), leaving the
  // (0,0) corner tile's two edges open as a one-tile doorway (see
  // buildDoor(), and PATRON_SPAWN_TILE, which is that same tile). Plain
  // painted walls: one flat colour per wall, a dark baseboard, and a thin
  // lighter edge along the top so the wall reads against the dark
  // background.
  //
  // Built with plain Graphics rather than the Polygon shape buildTiles()
  // uses: Polygon mis-renders when its points go negative (see the note
  // there), and a wall's top edge sits WALL_HEIGHT px above the floor.
  // Each wall is one quad per run of tiles rather than one per tile, so
  // there are no seams between segments.
  //
  // Redraws everything from scratch every call (cheap: this only runs from
  // create() and on the rare expandClub() purchase).
  buildWalls(upToSize) {
    if (!this.wallGraphics) {
      this.wallGraphics = this.add.graphics();
      this.wallLayer.add(this.wallGraphics);
    }
    const g = this.wallGraphics;
    g.clear();

    const quad = (a, b, bottom, top, color) => {
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(a[0], a[1] - bottom);
      g.lineTo(b[0], b[1] - bottom);
      g.lineTo(b[0], b[1] - top);
      g.lineTo(a[0], a[1] - top);
      g.closePath();
      g.fillPath();
    };
    const drawWall = (groundNear, groundFar, color) => {
      quad(groundNear, groundFar, 0, WALL_HEIGHT, color);
      quad(groundNear, groundFar, 0, WALL_BASEBOARD, WALL_COLORS.baseboard);
      g.lineStyle(2, WALL_COLORS.topEdge, 1);
      g.lineBetween(groundNear[0], groundNear[1] - WALL_HEIGHT, groundFar[0], groundFar[1] - WALL_HEIGHT);
    };

    // gridToScreen(gx,gy) is the CENTER of a tile's diamond, so its corners
    // sit at that center ± half a tile width/height.
    const last = upToSize - 1;

    // Right-hand back wall along gy=0, from tile gx=1's top corner (gx=0 is
    // the doorway) to the last tile's right corner.
    const r0 = this.gridToScreen(1, 0);
    const r1 = this.gridToScreen(last, 0);
    drawWall([r0.sx, r0.sy - TILE_H / 2], [r1.sx + TILE_W / 2, r1.sy], WALL_COLORS.right);

    // Left-hand back wall along gx=0, from tile gy=1's top corner to the
    // last tile's left corner. A shade darker than the right wall so the two
    // faces read as separate surfaces.
    const l0 = this.gridToScreen(0, 1);
    const l1 = this.gridToScreen(0, last);
    drawWall([l0.sx, l0.sy - TILE_H / 2], [l1.sx - TILE_W / 2, l1.sy], WALL_COLORS.left);
  }

  // A doorway sitting in the one-tile gap the back walls leave open at
  // (0,0) — the exact tile patrons already spawn and despawn on
  // (PATRON_SPAWN_TILE) — drawn as an actual dark opening in the wall
  // (rather than a glow effect) so it reads as a real door. Called once
  // from create(); the door's tile never moves, so unlike the walls/floor
  // there's nothing for expandClub() to extend later.
  //
  // Built from the SAME two ground-edge points buildWalls() would have
  // used for this tile (its top-right and top-left edges), rather than an
  // axis-aligned rectangle floating over the tile's top corner. A plain
  // rectangle's bottom is a flat horizontal line, but the floor boundary
  // here is a shallow "V" (the tile's top corner sits higher than its left
  // and right corners) — that mismatch is exactly what left a wedge of
  // bare void between the door and the floor grid lines. Using the tile's
  // real corners means the opening's edges land exactly on top of where
  // the neighboring wall segments start, with no gap or overlap either way.
  buildDoor() {
    const { sx, sy } = this.gridToScreen(PATRON_SPAWN_TILE.gx, PATRON_SPAWN_TILE.gy);
    const wallHeight = WALL_HEIGHT; // same as buildWalls() so the opening's top edge lines up with the walls beside it
    // (sx,sy) is this tile's CENTER (see the note in buildWalls()) — corners
    // sit at center ± half a tile width/height, not at center+(raw offset).
    const apex = [sx, sy - TILE_H / 2]; // this tile's top corner — where the two skipped wall segments would have met
    const right = [sx + TILE_W / 2, sy]; // its top-right corner (start of the right-hand wall run)
    const left = [sx - TILE_W / 2, sy]; // its top-left corner (start of the left-hand wall run)

    if (!this.doorGraphics) {
      this.doorGraphics = this.add.graphics();
      this.wallLayer.add(this.doorGraphics);
    }
    const g = this.doorGraphics;
    g.clear();

    const drawOpeningQuad = (groundNear, groundFar) => {
      const topNear = [groundNear[0], groundNear[1] - wallHeight];
      const topFar = [groundFar[0], groundFar[1] - wallHeight];
      g.fillStyle(0x0d0818, 1);
      g.lineStyle(2, WALL_COLORS.doorFrame, 1);
      g.beginPath();
      g.moveTo(groundNear[0], groundNear[1]);
      g.lineTo(groundFar[0], groundFar[1]);
      g.lineTo(topFar[0], topFar[1]);
      g.lineTo(topNear[0], topNear[1]);
      g.closePath();
      g.fillPath();
      g.strokePath();
    };

    // Same two edges the wall loops in buildWalls() skip for this tile —
    // filling them in dark instead of wall-gray is what makes this read as
    // an opening rather than a solid corner.
    drawOpeningQuad(apex, right);
    drawOpeningQuad(apex, left);

    const label = this.add.text(apex[0], apex[1] - wallHeight - 6, 'ENTRANCE', {
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#c9c4d6',
    }).setOrigin(0.5, 1);
    this.wallLayer.add(label);
  }

  // Inverse of gridToScreen: given a point in world-local space (already
  // adjusted for the world container's pan offset), find which tile it
  // falls in. Solves sx=(gx-gy)*(TILE_W/2), sy=(gx+gy)*(TILE_H/2) for
  // gx,gy, then rounds to the nearest whole tile.
  screenToGrid(localX, localY) {
    const gxF = (localX / (TILE_W / 2) + localY / (TILE_H / 2)) / 2;
    const gyF = (localY / (TILE_H / 2) - localX / (TILE_W / 2)) / 2;
    return { gx: Math.round(gxF), gy: Math.round(gyF) };
  }

  // Single source of truth for "which tile is the mouse over right now".
  // Called on every pointermove; updates the hover highlight and the
  // ghost preview together so they can never fall out of sync with each
  // other or with what a click would actually place.
  updateHoverFromPointer(pointer) {
    const localX = (pointer.x - this.world.x) / this.world.scaleX;
    const localY = (pointer.y - this.world.y) / this.world.scaleY;
    const { gx, gy } = this.screenToGrid(localX, localY);
    const onGrid = gx >= 0 && gx < this.gridSize && gy >= 0 && gy < this.gridSize;
    const next = onGrid ? { gx, gy } : null;

    const same = (!this.hoverTile && !next) ||
      (this.hoverTile && next && this.hoverTile.gx === next.gx && this.hoverTile.gy === next.gy);
    if (same) return;

    this.hoverTile = next;
    // Tile highlighting itself now lives entirely in updateGhost(), driven
    // off the SAME footprint tiles the ghost/outline use — there is no
    // separate "which single tile is hovered" fill anymore. That old,
    // separate system was the actual bug: it highlighted the raw hovered
    // tile while the footprint (and the booth itself) were computed
    // independently, so on a tall sprite the two could visually read as
    // different tiles even though the code never disagreed about the
    // number itself. Highlighting exactly the footprint tiles makes that
    // impossible by construction.
    this.updateGhost();
    this.updateHoveredPropLabel(next);
  }

  // Shows the name label for whichever placed prop the cursor is currently
  // over, and hides whichever one was shown before — every prop's label
  // itself starts hidden (see drawFallbackBox()/drawIsoBox()), so at most
  // one is ever visible at a time instead of a floor full of them stacking
  // into unreadable clutter. A multi-tile prop's label is the same shared
  // object under all of its tiles, so hovering any tile of it just shows
  // that one label again rather than double-showing anything.
  updateHoveredPropLabel(hoverTile) {
    const placed = hoverTile ? this.placed[`${hoverTile.gx},${hoverTile.gy}`] : null;
    const nextLabel = placed && placed.label ? placed.label : null;
    if (nextLabel === this.hoveredPropLabel) return;
    if (this.hoveredPropLabel) this.hoveredPropLabel.setVisible(false);
    if (nextLabel) nextLabel.setVisible(true);
    this.hoveredPropLabel = nextLabel;
  }

  // The next not-yet-reached tier in GRID_EXPANSIONS, or null once the club
  // is already at (or somehow past) the largest defined size.
  nextExpansion() {
    return GRID_EXPANSIONS.find((tier) => tier.size > this.gridSize) || null;
  }

  // Buys the next grid-size tier, if there is one, it's unlocked, and it's
  // affordable — an instant purchase (no placement step) triggered from the
  // shop's Expand tab (see renderExpandCard()). Returns true on a
  // successful expansion so the caller can react (closing the shop, etc.).
  expandClub() {
    const tier = this.nextExpansion();
    if (!tier) return false; // already at max size
    if (this.levelInfo().level < tier.unlockLevel) { SFX.denied(); return false; }
    if (this.cash < tier.cost) { SFX.denied(); return false; }

    this.cash -= tier.cost;
    this.gridSize = tier.size;
    this.buildTiles(this.gridSize);
    this.buildWalls(this.gridSize); // extend the back walls to the newly exposed edge

    // This is a bigger, rarer purchase than any single prop — give it its
    // own sound and a celebration banner (same showToast() used for
    // leveling up) instead of the same quiet blip every $50 dance tile
    // gets, so spending $600-5000 on more floor actually feels like
    // something happened.
    SFX.expand();
    this.showToast(`🏗️ Club expanded to ${tier.size}×${tier.size}!`);
    this.updateUI();
    this.saveGame();
    return true;
  }

  // Zooms the club view to `zoom` (clamped to ZOOM_MIN..ZOOM_MAX), keeping
  // the floor point under screen position (sx, sy) fixed, the way map and
  // game views zoom toward the cursor.
  zoomTo(zoom, sx = this.scale.width / 2, sy = this.scale.height / 2) {
    const next = Phaser.Math.Clamp(zoom, ZOOM_MIN, ZOOM_MAX);
    const prev = this.world.scaleX;
    if (next === prev) return;
    const localX = (sx - this.world.x) / prev;
    const localY = (sy - this.world.y) / prev;
    this.world.setScale(next);
    this.world.x = sx - localX * next;
    this.world.y = sy - localY * next;
  }

  // Centres the whole room (floor plus back walls) in the space between the
  // top bar and the shop button.
  centerView() {
    const zoom = this.world.scaleX;
    const top = -TILE_H / 2 - WALL_HEIGHT;
    const bottom = (this.gridSize - 1) * TILE_H + TILE_H / 2;
    const areaTop = 90;
    const areaBottom = this.scale.height - 110;
    this.world.x = this.scale.width / 2;
    this.world.y = (areaTop + areaBottom) / 2 - ((top + bottom) / 2) * zoom;
  }
}
