// ClubScene methods: Floor tiles, back walls, entrance, grid math, hover tracking and club expansion.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { GRID_EXPANSIONS } from '../catalog.js';
import { PATRON_SPAWN_TILE, TILE_H, TILE_W } from '../config.js';
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
          0x1b1030, 1
        );
        tile.setStrokeStyle(1, 0x4a2a70, 0.8);
        tile.gx = gx;
        tile.gy = gy;
        this.tileLayer.add(tile);
        this.tiles[key] = tile;
      }
    }
  }

  // Draws the two "back" walls that frame the floor — along the gx=0 and
  // gy=0 edges, the ones that sit furthest from this fixed camera angle —
  // leaving the (0,0) corner tile's two edges open as a one-tile doorway
  // gap (see buildDoor(), and PATRON_SPAWN_TILE which is that same tile).
  // Styled after a classic isometric-club look: a solid wall panel with a
  // row of small neon triangle "flags" strung along its top edge.
  //
  // Built with plain Graphics rather than the Polygon shape buildTiles()
  // uses: Polygon only renders correctly (see the note there) when it's
  // positioned at a small, non-negative (x,y) with non-negative local
  // points — fine for floor tiles sitting right at the world origin, but a
  // wall's top edge sits `wallHeight` px ABOVE its tile, which pushes the
  // whole shape's position well into negative Y for tiles near the front
  // of the grid and reintroduces the same mis-render. Graphics draws
  // exactly the absolute points given, so each segment is built straight
  // from its tile's real screen corners with no origin translation to get
  // wrong.
  //
  // Redraws everything from scratch every call (cheap — this only ever
  // runs from create() and on the rare expandClub() purchase, never per
  // frame) rather than tracking which segments already exist, since a
  // single Graphics object can't have individual old segments "skipped".
  buildWalls(upToSize) {
    const wallHeight = TILE_H * 3; // a solid, room-defining wall — tall relative to the floor tiles, same ballpark as a standing patron sprite plus some headroom
    const flagSpacing = 10; // px along the top edge between neon flags
    const flagSize = 6;
    if (!this.wallGraphics) {
      this.wallGraphics = this.add.graphics();
      this.wallLayer.add(this.wallGraphics);
    }
    const g = this.wallGraphics;
    g.clear();

    const drawWallQuad = (groundNear, groundFar, fillColor, flagColor) => {
      const topNear = [groundNear[0], groundNear[1] - wallHeight];
      const topFar = [groundFar[0], groundFar[1] - wallHeight];
      g.fillStyle(fillColor, 1);
      g.lineStyle(1, 0x5a3590, 0.9);
      g.beginPath();
      g.moveTo(groundNear[0], groundNear[1]);
      g.lineTo(groundFar[0], groundFar[1]);
      g.lineTo(topFar[0], topFar[1]);
      g.lineTo(topNear[0], topNear[1]);
      g.closePath();
      g.fillPath();
      g.strokePath();

      // A string of small neon triangle "flags" hanging along the wall's
      // top edge, evenly spaced — the festive trim line from the reference
      // look, built from plain triangles rather than a new art asset.
      const dx = topFar[0] - topNear[0];
      const dy = topFar[1] - topNear[1];
      const segLen = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.round(segLen / flagSpacing));
      g.fillStyle(flagColor, 0.9);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const fx = topNear[0] + dx * t;
        const fy = topNear[1] + dy * t;
        g.beginPath();
        g.moveTo(fx - flagSize / 2, fy);
        g.moveTo(fx - flagSize / 2, fy);
        g.lineTo(fx + flagSize / 2, fy);
        g.lineTo(fx, fy + flagSize);
        g.closePath();
        g.fillPath();
      }
    };

    // gridToScreen(gx,gy) is the CENTER of that tile's diamond (that's what
    // screenToGrid()'s hit-testing assumes, and what every sprite/container
    // is positioned by) — so a tile's four corners sit at that center ±half
    // a tile width/height, NOT at center+(raw offset) the way these two
    // loops used to compute them. That off-by-half-a-tile bug shifted every
    // wall panel down-and-right of the actual floor edge, which is exactly
    // why the wall looked like it was standing "in front of" the floor line
    // instead of meeting it.

    // Right-hand back wall, one segment per gx along gy=0, standing on
    // each tile's top-right edge (the edge that would otherwise border the
    // nonexistent gy=-1 neighbor). gx=0 is skipped — that's the doorway.
    for (let gx = 1; gx < upToSize; gx++) {
      const { sx, sy } = this.gridToScreen(gx, 0);
      const top = [sx, sy - TILE_H / 2];
      const right = [sx + TILE_W / 2, sy];
      drawWallQuad(top, right, 0x3a3a46, 0xff4de0);
    }

    // Left-hand back wall, one segment per gy along gx=0, standing on each
    // tile's top-left edge (the edge that would otherwise border the
    // nonexistent gx=-1 neighbor). gy=0 is skipped — the other half of the
    // doorway gap.
    for (let gy = 1; gy < upToSize; gy++) {
      const { sx, sy } = this.gridToScreen(0, gy);
      const left = [sx - TILE_W / 2, sy];
      const top = [sx, sy - TILE_H / 2];
      // A touch darker than the right wall so the two faces read as
      // distinct surfaces, not one flat color wrapping the corner.
      drawWallQuad(left, top, 0x2e2e38, 0xff4de0);
    }
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
    const wallHeight = TILE_H * 3; // matches buildWalls() so the opening's top edge lines up with the walls flanking it
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
      g.lineStyle(2, 0x5a3590, 1);
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
      fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#ff9fe8',
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
    const localX = pointer.x - this.world.x;
    const localY = pointer.y - this.world.y;
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
}
