// ClubScene methods: floor tiles, room shell (walls, door, slab, sidewalk),
// grid math, hover tracking, zoom and club expansion.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { EXPANSION } from '../catalog.js';
import { BASE_GRID_SIZE, FLOOR_COLOR, FLOOR_SLAB_DEPTH, ROOM_COLORS, TILE_H, TILE_W, WALL_BASEBOARD, WALL_HEIGHT, WALL_THICKNESS, ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from '../config.js';
import { SFX } from '../sfx.js';
import { WALL_TEX_H, WALL_TEX_W, doorCanvas } from '../walls.js';
import { bareFloorCanvas } from '../floors.js';

// How far (in steps) from the door tile guests keep clear (see doorZone()).
const DOOR_CLEAR = 2;

export class WorldMixin {
  gridToScreen(gx, gy) {
    return {
      sx: (gx - gy) * (TILE_W / 2),
      sy: (gx + gy) * (TILE_H / 2),
    };
  }

  // True if (gx, gy) is a floor tile of the club. The room is gridW tiles
  // along gx (the right wall) by gridH along gy (the left wall).
  inGrid(gx, gy) {
    return gx >= 0 && gy >= 0 && gx < this.gridW && gy < this.gridH;
  }

  // Builds any tile in [0, upToSize) x [0, upToSize) that doesn't already
  // exist in this.tiles yet. Called once for the whole starting grid in
  // create(), and again with a bigger upToSize from expandClub() — in that
  // second case every already-built tile is skipped, so this only ever
  // adds the newly exposed strip of floor rather than rebuilding anything.
  buildTiles() {
    for (let gx = 0; gx < this.gridW; gx++) {
      for (let gy = 0; gy < this.gridH; gy++) {
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
          FLOOR_COLOR, 0 // invisible: the bare floor shows through (drawBareFloor())
        );
        tile.gx = gx;
        tile.gy = gy;
        this.tileLayer.add(tile);
        this.tiles[key] = tile;
      }
    }
  }

  // The bare floor: one seamless sheet of old, worn concrete across the
  // whole room (bareFloorCanvas() in floors.js), with no lines between
  // tiles. The tiles themselves are invisible until highlighted.
  drawBareFloor() {
    const w = this.gridW;
    const h = this.gridH;
    const key = `bareFloor_${w}x${h}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, bareFloorCanvas(w, h));
    const [x] = this.gridPoint(-0.5, h - 0.5);
    const [, y] = this.gridPoint(-0.5, -0.5);
    this.bareFloor.setTexture(key).setPosition(x, y).setDisplaySize((w + h) * TILE_W / 2, (w + h) * TILE_H / 2);
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
  buildWalls() {
    if (!this.groundGraphics) {
      this.groundGraphics = this.add.graphics();
      this.tileLayer.addAt(this.groundGraphics, 0); // under the floor tiles
      this.wallGraphics = this.add.graphics();
      this.wallLayer.add(this.wallGraphics);
      // The bare brick, then wallpaper on top of it; the door and corner
      // line over both.
      this.bareWallLayer = this.add.container(0, 0);
      this.wallLayer.add(this.bareWallLayer);
      this.bareFloor = this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0);
      this.tileLayer.addAt(this.bareFloor, 1); // over the ground, under the tiles
      this.wallpaperLayer = this.add.container(0, 0);
      this.wallLayer.add(this.wallpaperLayer);
      this.wallShade = this.add.graphics(); // mood lighting (see drawMoodShade())
      this.wallLayer.add(this.wallShade);
      this.wallTrimGraphics = this.add.graphics();
      this.wallLayer.add(this.wallTrimGraphics);
    }
    const nx = this.gridW - 0.5; // far floor edges
    const ny = this.gridH - 0.5;
    const t = -0.5 - WALL_THICKNESS; // outer edge of the walls
    const P = (gx, gy, h) => this.gridPoint(gx, gy, h);
    const fill = (g, color, pts) => {
      g.fillStyle(color, 1);
      g.fillPoints(pts.map(([x, y]) => ({ x, y })), true);
    };

    // --- Ground: sidewalk around the club, then the slab's front faces ---
    const g = this.groundGraphics;
    g.clear();
    const drop = FLOOR_SLAB_DEPTH; // the sidewalk sits this far below the floor
    this.drawStreetGround(g, P, t, nx, ny, drop);
    fill(g, ROOM_COLORS.slabRight, [P(nx, t, 0), P(nx, ny, 0), P(nx, ny, -drop), P(nx, t, -drop)]);
    fill(g, ROOM_COLORS.slabLeft, [P(t, ny, 0), P(nx, ny, 0), P(nx, ny, -drop), P(t, ny, -drop)]);
    g.lineStyle(1, ROOM_COLORS.slabEdge, 1);
    g.lineBetween(...P(t, ny, 0), ...P(nx, ny, 0));
    g.lineBetween(...P(nx, ny, 0), ...P(nx, t, 0));

    // --- Walls ---
    const w = this.wallGraphics;
    w.clear();
    const H = WALL_HEIGHT;
    // Inner faces.
    fill(w, ROOM_COLORS.wallRight, [P(-0.5, -0.5, 0), P(nx, -0.5, 0), P(nx, -0.5, H), P(-0.5, -0.5, H)]);
    fill(w, ROOM_COLORS.wallLeft, [P(-0.5, -0.5, 0), P(-0.5, ny, 0), P(-0.5, ny, H), P(-0.5, -0.5, H)]);
    // Baseboards.
    const bb = WALL_BASEBOARD;
    fill(w, ROOM_COLORS.baseboard, [P(-0.5, -0.5, 0), P(nx, -0.5, 0), P(nx, -0.5, bb), P(-0.5, -0.5, bb)]);
    fill(w, ROOM_COLORS.baseboard, [P(-0.5, -0.5, 0), P(-0.5, ny, 0), P(-0.5, ny, bb), P(-0.5, -0.5, bb)]);
    // End faces at the open ends of each wall.
    fill(w, ROOM_COLORS.wallEnd, [P(nx, t, 0), P(nx, -0.5, 0), P(nx, -0.5, H), P(nx, t, H)]);
    fill(w, ROOM_COLORS.wallEnd, [P(t, ny, 0), P(-0.5, ny, 0), P(-0.5, ny, H), P(t, ny, H)]);
    // Top caps.
    fill(w, ROOM_COLORS.cap, [P(t, t, H), P(nx, t, H), P(nx, -0.5, H), P(-0.5, -0.5, H), P(-0.5, ny, H), P(t, ny, H)]);
    w.lineStyle(1, ROOM_COLORS.capEdge, 1);
    w.strokePoints([P(t, t, H), P(nx, t, H), P(nx, -0.5, H), P(-0.5, -0.5, H), P(-0.5, ny, H), P(t, ny, H)].map(([x, y]) => ({ x, y })), true);

    const trim = this.wallTrimGraphics;
    trim.clear();
    // Shading where the two walls meet.
    trim.lineStyle(2, ROOM_COLORS.corner, 1);
    trim.lineBetween(...P(-0.5, -0.5, 0), ...P(-0.5, -0.5, H));
    this.drawBareWalls();
    this.drawBareFloor();
    this.drawMoodShade();
    this.drawDoor();
    this.drawStreetProps(P, t, nx, ny, FLOOR_SLAB_DEPTH);
  }

  // The tile inside the club's front door, near the back of the left wall,
  // like Nightclub City's. The line outside leads to it (see street.js).
  doorTile() {
    return { gx: 0, gy: 1 };
  }

  // The doorway: the door tile and the tiles just inside it (as "gx,gy"
  // keys). Guests walk through it but never stop or do anything there.
  doorZone() {
    const { gx, gy } = this.doorTile();
    const keys = [];
    for (let x = 0; x < this.gridW; x++) {
      for (let y = 0; y < this.gridH; y++) {
        if (Math.abs(x - gx) + Math.abs(y - gy) <= DOOR_CLEAR) keys.push(`${x},${y}`);
      }
    }
    return keys;
  }

  // A clear tile a few steps inside the door, for someone who just came in
  // to walk to before deciding what to do.
  entrySpot() {
    const { gx, gy } = this.doorTile();
    const off = this.keepOffTiles();
    const spots = [];
    for (let x = 0; x < this.gridW; x++) {
      for (let y = 0; y < this.gridH; y++) {
        const d = Math.abs(x - gx) + Math.abs(y - gy);
        if (d <= DOOR_CLEAR || d > DOOR_CLEAR + 3 || off.has(`${x},${y}`) || this.isBlockingProp(x, y) || this.patronTileOccupied(x, y)) continue;
        spots.push([x, y]);
      }
    }
    return spots.length ? spots[Math.floor(Math.random() * spots.length)] : null;
  }

  // The club's front door (see doorCanvas() in walls.js), set into the left
  // wall at the door tile, like Nightclub City's.
  // Drawn over the wallpaper and the mood shading.
  drawDoor() {
    if (!this.textures.exists('clubDoor')) this.textures.addCanvas('clubDoor', doorCanvas('left'));
    if (this.doorImage) this.doorImage.destroy();
    const { x, y } = this.wallSectionOrigin(`L${this.doorTile().gy}`);
    this.doorImage = this.add.image(x, y, 'clubDoor').setOrigin(0, 0).setDisplaySize(WALL_TEX_W / 2, WALL_TEX_H / 2);
    this.wallLayer.add(this.doorImage);
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
    const onGrid = this.inGrid(gx, gy);
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

  // The longest a wall may be at a level (see EXPANSION in catalog.js).
  maxWallAt(level) {
    let size = BASE_GRID_SIZE;
    for (const limit of EXPANSION.limits) if (limit.level <= level) size = Math.max(size, limit.size);
    return size;
  }

  // What adding one row on a side would be: 'left' adds a row along the
  // front-left edge (the left wall gets a tile longer), 'right' one along
  // the front-right edge (the right wall gets longer). Null once that wall
  // is as long as it can ever be.
  expansionFor(side) {
    const wall = side === 'left' ? this.gridH : this.gridW; // the wall that grows
    const tiles = side === 'left' ? this.gridW : this.gridH; // tiles in the new row
    const newLen = wall + 1;
    const top = EXPANSION.limits[EXPANSION.limits.length - 1].size;
    if (newLen > top) return null;
    const unlockLevel = EXPANSION.limits.find((l) => l.size >= newLen).level;
    const perTile = EXPANSION.perTile + (newLen - BASE_GRID_SIZE - 1) * EXPANSION.perTileGrowth;
    const cost = Math.max(5, Math.round((tiles * perTile) / 5) * 5);
    return { side, tiles, newLen, cost, unlockLevel };
  }

  // The floor tiles a row on `side` would add.
  expansionTiles(side) {
    const out = [];
    if (side === 'left') for (let gx = 0; gx < this.gridW; gx++) out.push([gx, this.gridH]);
    else for (let gy = 0; gy < this.gridH; gy++) out.push([this.gridW, gy]);
    return out;
  }

  // Shows the strip of floor a row on `side` would add, glowing green
  // beyond the room's edge, so you can see it before you buy it.
  showExpandPreview(side) {
    if (!this.expandPreview) {
      this.expandPreview = this.add.graphics();
      this.ghostLayer.add(this.expandPreview);
      this.tweens.add({ targets: this.expandPreview, alpha: { from: 1, to: 0.55 }, duration: 600, yoyo: true, repeat: -1 });
    }
    const g = this.expandPreview;
    g.clear();
    this.expandPreviewSide = side;
    if (!side || !this.expansionFor(side)) return;
    const P = (gx, gy) => { const [x, y] = this.gridPoint(gx, gy); return { x, y }; };
    for (const [gx, gy] of this.expansionTiles(side)) {
      const pts = [P(gx - 0.5, gy - 0.5), P(gx + 0.5, gy - 0.5), P(gx + 0.5, gy + 0.5), P(gx - 0.5, gy + 0.5)];
      g.fillStyle(0x5dff6a, 0.38);
      g.fillPoints(pts, true);
      g.lineStyle(1, 0xd8ffd0, 0.7);
      g.strokePoints(pts, true);
    }
    // A bright outline round the whole strip.
    const [x0, y0, x1, y1] = side === 'left'
      ? [-0.5, this.gridH - 0.5, this.gridW - 0.5, this.gridH + 0.5]
      : [this.gridW - 0.5, -0.5, this.gridW + 0.5, this.gridH - 0.5];
    g.lineStyle(3, 0x9dff8a, 1);
    g.strokePoints([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], true);
  }

  clearExpandPreview() {
    this.expandPreviewSide = null;
    if (this.expandPreview) this.expandPreview.clear();
  }

  // Buys one more row of floor on `side` ('left' or 'right'), if it's
  // unlocked and affordable. Returns true if the club grew.
  expandClub(side) {
    const tier = this.expansionFor(side);
    if (!tier) return false; // that wall is as long as it gets
    if (this.levelInfo().level < tier.unlockLevel) { SFX.denied(); return false; }
    if (this.cash < tier.cost) { SFX.denied(); return false; }

    this.cash -= tier.cost;
    this.awardPurchaseXp(tier.cost);
    this.bumpGoal('expansions');
    if (side === 'left') this.gridH += 1;
    else this.gridW += 1;
    this.buildTiles();
    this.buildWalls(); // the walls, floor and street follow the new edge
    this.clearExpandPreview();
    SFX.expand();
    this.showToast(`🏗️ Club expanded: now ${this.gridW}×${this.gridH}!`);
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
    const bottom = (this.gridW + this.gridH - 1) * TILE_H / 2 + FLOOR_SLAB_DEPTH;
    const left = -(this.gridH + WALL_THICKNESS) * TILE_W / 2;
    const right = (this.gridW + WALL_THICKNESS) * TILE_W / 2;
    const areaTop = 110; // below the profile strip
    const areaBottom = this.scale.height - 150; // above the shop buttons
    const fit = Math.min((areaBottom - areaTop) / (bottom - top), (this.scale.width - 40) / (right - left));
    const zoom = Phaser.Math.Clamp(Math.min(ZOOM_DEFAULT, fit), ZOOM_MIN, ZOOM_MAX);
    this.world.setScale(zoom);
    this.world.x = this.scale.width / 2 - ((left + right) / 2) * zoom;
    this.world.y = (areaTop + areaBottom) / 2 - ((top + bottom) / 2) * zoom;
  }
}
