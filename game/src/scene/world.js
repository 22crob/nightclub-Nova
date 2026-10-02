// ClubScene methods: floor tiles, room shell (walls, door, slab, sidewalk),
// grid math, hover tracking, zoom and club expansion.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { GRID_EXPANSIONS } from '../catalog.js';
import { DOOR_HEIGHT, FLOOR_COLOR, FLOOR_SEAM, FLOOR_SLAB_DEPTH, PATRON_SPAWN_TILE, ROOM_COLORS, SIDEWALK, TILE_H, TILE_W, WALL_BASEBOARD, WALL_HEIGHT, WALL_THICKNESS, ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from '../config.js';
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

  // Screen position of a point in grid space (tile centres are whole
  // numbers, tile edges sit at .5), lifted `h` pixels straight up.
  gridPoint(gx, gy, h = 0) {
    const { sx, sy } = this.gridToScreen(gx, gy);
    return [sx, sy - h];
  }

  // Draws the room shell in the style of the reference game: the sidewalk
  // outside, the raised floor slab's front edges, and two thick back walls
  // with light top caps and a door. Everything is plain Graphics, redrawn
  // from scratch on create() and whenever the club expands.
  //
  // Grid space: the floor covers gx, gy in [-0.5, size - 0.5]. The walls
  // stand outside that along the gy = -0.5 edge (right wall) and the
  // gx = -0.5 edge (left wall), WALL_THICKNESS tiles thick, so they never
  // take up floor tiles.
  buildWalls(upToSize) {
    if (!this.groundGraphics) {
      this.groundGraphics = this.add.graphics();
      this.tileLayer.addAt(this.groundGraphics, 0); // under the floor tiles
      this.wallGraphics = this.add.graphics();
      this.wallLayer.add(this.wallGraphics);
      // Wallpaper sits on the plain wall; the door and corner line on top.
      this.wallpaperLayer = this.add.container(0, 0);
      this.wallLayer.add(this.wallpaperLayer);
      this.wallShade = this.add.graphics(); // mood lighting (see drawMoodShade())
      this.wallLayer.add(this.wallShade);
      this.wallTrimGraphics = this.add.graphics();
      this.wallLayer.add(this.wallTrimGraphics);
    }
    const n = upToSize - 0.5; // far floor edge
    const t = -0.5 - WALL_THICKNESS; // outer edge of the walls
    const P = (gx, gy, h) => this.gridPoint(gx, gy, h);
    const fill = (g, color, pts) => {
      g.fillStyle(color, 1);
      g.fillPoints(pts.map(([x, y]) => ({ x, y })), true);
    };

    // --- Ground: sidewalk around the club, then the slab's front faces ---
    const g = this.groundGraphics;
    g.clear();
    const m = SIDEWALK.margin;
    const drop = FLOOR_SLAB_DEPTH; // the sidewalk sits this far below the floor
    fill(g, SIDEWALK.color, [P(t - m, t - m, -drop), P(n + m, t - m, -drop), P(n + m, n + m, -drop), P(t - m, n + m, -drop)]);
    g.lineStyle(1, SIDEWALK.grout, 1);
    for (let k = Math.ceil(t - m); k <= n + m; k += SIDEWALK.slabTiles) {
      g.lineBetween(...P(k, t - m, -drop), ...P(k, n + m, -drop));
      g.lineBetween(...P(t - m, k, -drop), ...P(n + m, k, -drop));
    }
    // Slab front faces, down from floor level to the sidewalk.
    fill(g, ROOM_COLORS.slabRight, [P(n, t, 0), P(n, n, 0), P(n, n, -drop), P(n, t, -drop)]);
    fill(g, ROOM_COLORS.slabLeft, [P(t, n, 0), P(n, n, 0), P(n, n, -drop), P(t, n, -drop)]);
    g.lineStyle(1, ROOM_COLORS.slabEdge, 1);
    g.lineBetween(...P(t, n, 0), ...P(n, n, 0));
    g.lineBetween(...P(n, n, 0), ...P(n, t, 0));

    // --- Walls ---
    const w = this.wallGraphics;
    w.clear();
    const H = WALL_HEIGHT;
    // Inner faces.
    fill(w, ROOM_COLORS.wallRight, [P(-0.5, -0.5, 0), P(n, -0.5, 0), P(n, -0.5, H), P(-0.5, -0.5, H)]);
    fill(w, ROOM_COLORS.wallLeft, [P(-0.5, -0.5, 0), P(-0.5, n, 0), P(-0.5, n, H), P(-0.5, -0.5, H)]);
    // Baseboards.
    const bb = WALL_BASEBOARD;
    fill(w, ROOM_COLORS.baseboard, [P(-0.5, -0.5, 0), P(n, -0.5, 0), P(n, -0.5, bb), P(-0.5, -0.5, bb)]);
    fill(w, ROOM_COLORS.baseboard, [P(-0.5, -0.5, 0), P(-0.5, n, 0), P(-0.5, n, bb), P(-0.5, -0.5, bb)]);
    // End faces at the open ends of each wall.
    fill(w, ROOM_COLORS.wallEnd, [P(n, t, 0), P(n, -0.5, 0), P(n, -0.5, H), P(n, t, H)]);
    fill(w, ROOM_COLORS.wallEnd, [P(t, n, 0), P(-0.5, n, 0), P(-0.5, n, H), P(t, n, H)]);
    // Top caps.
    fill(w, ROOM_COLORS.cap, [P(t, t, H), P(n, t, H), P(n, -0.5, H), P(-0.5, -0.5, H), P(-0.5, n, H), P(t, n, H)]);
    w.lineStyle(1, ROOM_COLORS.capEdge, 1);
    w.strokePoints([P(t, t, H), P(n, t, H), P(n, -0.5, H), P(-0.5, -0.5, H), P(-0.5, n, H), P(t, n, H)].map(([x, y]) => ({ x, y })), true);

    const trim = this.wallTrimGraphics;
    trim.clear();
    // Shading where the two walls meet.
    trim.lineStyle(2, ROOM_COLORS.corner, 1);
    trim.lineBetween(...P(-0.5, -0.5, 0), ...P(-0.5, -0.5, H));
    this.drawDoor(trim);
    this.drawMoodShade(upToSize);
  }

  // The club's front door, set into the right-hand wall at the entrance tile
  // (PATRON_SPAWN_TILE), where patrons walk in and out.
  drawDoor(w) {
    const gx = PATRON_SPAWN_TILE.gx;
    const P = (x, h) => this.gridPoint(x, -0.5, h);
    const a = gx - 0.46, b = gx + 0.46, mid = gx;
    const top = DOOR_HEIGHT;
    const quad = (color, x0, x1, h0, h1) => {
      w.fillStyle(color, 1);
      w.fillPoints([P(x0, h0), P(x1, h0), P(x1, h1), P(x0, h1)].map(([x, y]) => ({ x, y })), true);
    };
    quad(ROOM_COLORS.doorFrame, a - 0.06, b + 0.06, 0, top + 5);
    quad(ROOM_COLORS.door, a, mid - 0.01, 0, top);
    quad(ROOM_COLORS.door, mid + 0.01, b, 0, top);
    // Small windows and push bars.
    quad(ROOM_COLORS.doorWindow, a + 0.1, mid - 0.1, top * 0.62, top * 0.85);
    quad(ROOM_COLORS.doorWindow, mid + 0.1, b - 0.1, top * 0.62, top * 0.85);
    quad(ROOM_COLORS.doorBar, a + 0.06, mid - 0.05, top * 0.44, top * 0.48);
    quad(ROOM_COLORS.doorBar, mid + 0.05, b - 0.06, top * 0.44, top * 0.48);
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
    const wall = this.wallSectionAt(localX, localY);
    if (wall !== this.hoverWall) {
      this.hoverWall = wall;
      this.updateWallGhost();
    }

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
  // Zooms out from ZOOM_DEFAULT if needed so the whole room fits.
  centerView() {
    const top = -TILE_H / 2 - WALL_HEIGHT - WALL_THICKNESS * TILE_H;
    const bottom = (this.gridSize - 1) * TILE_H + TILE_H / 2 + FLOOR_SLAB_DEPTH;
    const halfWidth = (this.gridSize + WALL_THICKNESS) * TILE_W / 2;
    const areaTop = 110; // below the profile and cash
    const areaBottom = this.scale.height - 100; // above the toolbar
    const fit = Math.min((areaBottom - areaTop) / (bottom - top), (this.scale.width - 40) / (2 * halfWidth));
    const zoom = Phaser.Math.Clamp(Math.min(ZOOM_DEFAULT, fit), ZOOM_MIN, ZOOM_MAX);
    this.world.setScale(zoom);
    this.world.x = this.scale.width / 2;
    this.world.y = (areaTop + areaBottom) / 2 - ((top + bottom) / 2) * zoom;
  }
}
