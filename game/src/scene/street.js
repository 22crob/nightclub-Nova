// ClubScene methods: the street outside, like Nightclub City's. The club
// sits on a city block at night: a sidewalk all round, roads beyond it and
// dark buildings across the back roads. Like Nightclub City's, people line
// up on the sidewalk outside the left wall, from the door (doorTile() in
// world.js, near the back of that wall) toward the front of the block, on a
// red carpet behind a velvet rope, with a bouncer by the door; they go in
// one at a time while the club has room. Others walk round the block, and
// patrons who leave come out by the door and walk off.
//
// The line stands well out on the sidewalk (STREET.lineOut tiles from the
// wall) so the wall doesn't hide it, and it's drawn on streetLayer, over
// the walls, like everyone on the front and right sidewalks. Walkers on the
// back sidewalk, just behind the right wall, are on streetBackLayer, under
// the walls. Street people aren't in this.patrons until they go in.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { FLOOR_SLAB_DEPTH as DROP, STREET, WALL_HEIGHT, WALL_THICKNESS } from '../config.js';
import { BUILDING_META } from '../assets.js';

const randRange = (min, max) => min + Math.random() * (max - min);

export class StreetMixin {
  // Where things go outside, in grid coordinates. The room's front-left
  // edge is at gy = n; the walls' outer face is at t. The line runs along
  // the left sidewalk from the door (at gy = door) toward the front.
  streetSpots() {
    const nx = this.gridW - 0.5; // the room's far edges
    const ny = this.gridH - 0.5;
    const t = -0.5 - WALL_THICKNESS; // the walls' outer face
    const door = this.doorTile().gy;
    const lineX = t - STREET.lineOut;
    const len = Math.max(2, Math.min(STREET.lineLength, Math.floor(ny - door)));
    return {
      nx,
      ny,
      t,
      door,
      lineX,
      len,
      ropeX: lineX - 0.6, // the rope, on the street side of the line
      leftX: lineX - 0.95, // the walking lane past the line
      slot: (k) => ({ gx: lineX, gy: door + 0.2 + k }),
      tail: { gx: lineX, gy: door + 0.2 + len + 0.5 },
      enterTo: { gx: t - 0.6, gy: door }, // to the door, where they slip in
      exitFrom: { gx: lineX - 0.95, gy: door - 0.9 },
      bouncer: { gx: lineX + 0.35, gy: door - 0.85 },
      laneY: ny + STREET.sidewalk - 1.6, // walking lanes round the block
      frontY: ny + STREET.sidewalk - 0.8,
      rightX: nx + STREET.sidewalk - 1.2,
      backY: t - STREET.sidewalk + 1.2,
      laneEnds: [t - STREET.sidewalk - 1, ny + STREET.sidewalk + 1],
    };
  }

  createStreetLayers() {
    this.streetQueue = []; // people in line (or walking to it), front first
    this.streetWalkers = []; // passers-by and people leaving
    this.streetLayer = this.add.container(0, 0);
    this.streetQueueLayer = this.add.container(0, 0);
    this.streetRope = this.add.graphics();
    this.streetPassLayer = this.add.container(0, 0);
    this.streetLamps = this.add.graphics();
    this.streetLayer.add([this.streetPassLayer, this.streetLamps]);
    // The left and back sidewalks are behind the walls: drawn under them,
    // so the wall hides people's legs, like Nightclub City's line.
    this.streetBackLayer = this.add.container(0, 0);
    this.streetBackPassLayer = this.add.container(0, 0);
    this.streetBackLayer.add([this.streetRope, this.streetQueueLayer, this.streetBackPassLayer]);
  }

  // Ground: road, sidewalk, curb, lane markings, the red carpet, pools of
  // lamplight and the buildings across the back roads. Drawn into the
  // floor's ground graphics, under everything.
  drawStreetGround(g, P, t, nx, ny, drop) {
    const fill = (color, pts, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillPoints(pts.map(([x, y]) => ({ x, y })), true);
    };
    const quad = (color, x0, y0, x1, y1, alpha = 1) =>
      fill(color, [P(x0, y0, -drop), P(x1, y0, -drop), P(x1, y1, -drop), P(x0, y1, -drop)], alpha);
    const R = STREET.road + STREET.sidewalk; // road's outer edge, from the walls
    const S = STREET.sidewalk;

    if (!this.placeStreetBuildings(t, nx, ny, drop, R)) this.drawStreetBuildings(g, P, t, nx, ny, drop, R);
    this.drawStringLights(t, nx, ny, drop, R);
    quad(STREET.asphalt, t - R, t - R, nx + R, ny + R);
    quad(STREET.curb, t - S - 0.25, t - S - 0.25, nx + S + 0.25, ny + S + 0.25);
    quad(STREET.pavement, t - S, t - S, nx + S, ny + S);
    g.lineStyle(1, STREET.grout, 1);
    for (let k = Math.ceil(t - S); k <= nx + S; k += 2) g.lineBetween(...P(k, t - S, -drop), ...P(k, ny + S, -drop));
    for (let k = Math.ceil(t - S); k <= ny + S; k += 2) g.lineBetween(...P(t - S, k, -drop), ...P(nx + S, k, -drop));
    // Dashed centre lines down the middle of each road.
    const mid = S + STREET.road / 2;
    for (let k = t - R; k < nx + R; k += 2) {
      quad(STREET.laneLine, k, ny + mid - 0.08, k + 1, ny + mid + 0.08);
      quad(STREET.laneLine, k, t - mid - 0.08, k + 1, t - mid + 0.08);
    }
    for (let k = t - R; k < ny + R; k += 2) {
      quad(STREET.laneLine, nx + mid - 0.08, k, nx + mid + 0.08, k + 1);
      quad(STREET.laneLine, t - mid - 0.08, k, t - mid + 0.08, k + 1);
    }
    // Red carpet under the line, from the door toward the front, with gold
    // edging.
    const sp = this.streetSpots();
    const cx0 = sp.ropeX - 0.05, cx1 = sp.lineX + 0.7;
    const cy0 = sp.door - 1.4, cy1 = sp.door + sp.len + 0.5;
    quad(STREET.carpet, cx0, cy0, cx1, cy1);
    g.lineStyle(1.5, STREET.carpetEdge, 1);
    g.lineBetween(...P(cx0, cy0, -drop), ...P(cx0, cy1, -drop));
    g.lineBetween(...P(cx1, cy0, -drop), ...P(cx1, cy1, -drop));
    g.lineBetween(...P(cx0, cy1, -drop), ...P(cx1, cy1, -drop));
    g.lineBetween(...P(cx0, cy0, -drop), ...P(cx1, cy0, -drop));
    // Warm pools of light under the street lamps.
    for (const [lx, ly] of this.streetLampSpots(t, nx, ny)) {
      const [cx, cy] = P(lx, ly, -drop);
      g.fillStyle(STREET.lampGlow, 0.04);
      g.fillEllipse(cx, cy, 150, 75);
      g.fillStyle(STREET.lampGlow, 0.04);
      g.fillEllipse(cx, cy, 90, 45);
    }
  }

  // Lamp posts along the front curbs, in grid coordinates.
  streetLampSpots(t, nx, ny) {
    const spots = [];
    for (let k = t + 1; k <= nx + 2; k += STREET.lampEvery) spots.push([k, ny + STREET.sidewalk - 0.4]);
    for (let k = t + 1; k <= ny + 2; k += STREET.lampEvery) spots.push([nx + STREET.sidewalk - 0.4, k]);
    return spots;
  }

  // The modelled buildings along each back road (BUILDING_META, from
  // art/blender/build_buildings.py): facing 0 behind the right wall,
  // facing 90 behind the left wall, in STREET.buildingRow order (the left
  // road starts a few along so the corners differ), far ones drawn first.
  // False if the pictures aren't there (then the plain blocks are drawn).
  placeStreetBuildings(t, nx, ny, drop, R) {
    const row = STREET.buildingRow.filter((n) => BUILDING_META[n] && this.textures.exists(`bldg_${n}_0`));
    if (!row.length || !this.buildingLayer) return false;
    this.buildingLayer.removeAll(true);
    const far = t - R;
    const items = [];
    for (const [facing, end, start] of [[0, nx + R, 0], [90, ny + R, 3]]) {
      let i = start;
      for (let k = far; k < end; i++) {
        const name = row[i % row.length];
        const meta = BUILDING_META[name];
        const c = k + meta.width / 2, d = far - meta.depth / 2;
        items.push(facing === 0 ? { name, facing, gx: c, gy: d } : { name, facing, gx: d, gy: c });
        k += meta.width;
      }
    }
    items.sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
    for (const it of items) {
      const f = BUILDING_META[it.name].facings[it.facing];
      const [x, y] = this.gridPoint(it.gx, it.gy, -drop);
      const img = this.add.image(x, y, `bldg_${it.name}_${it.facing}`).setOrigin(f.ox / f.w, f.oy / f.h);
      this.buildingLayer.add(img);
    }
    return true;
  }

  // Strings of round bulbs hung across both back roads, zigzagging from the
  // top of the club's wall to the buildings opposite, like the reference
  // street. Drawn over the buildings, under the walls and the people.
  drawStringLights(t, nx, ny, drop, R) {
    if (!this.buildingLayer) return;
    const L = STREET.stringLights;
    this.streetStrings?.destroy();
    const g = this.add.graphics();
    this.buildingLayer.add(g);
    this.streetStrings = g;
    const far = t - R + 0.05; // the buildings' fronts
    const wallTop = WALL_HEIGHT + 2;
    const strands = [];
    // Along each back road, the club end and the building end of each
    // strand step along by `every`, so they zigzag over the road.
    for (const [along, end] of [['gx', nx], ['gy', ny]]) {
      const ends = [];
      for (let k = t + 0.6; k <= end - 0.3; k += L.every) ends.push(k);
      for (let i = 0; i < ends.length - 1; i++) {
        const club = ends[i + (i % 2)];
        const bldg = ends[i + 1 - (i % 2)];
        const a = along === 'gx' ? [club, t + 0.05] : [t + 0.05, club];
        const b = along === 'gx' ? [bldg, far] : [far, bldg];
        strands.push([[...a, wallTop - drop], [...b, L.height - drop]]);
      }
    }
    const bulbs = [];
    for (const [[ax, ay, ah], [bx, by, bh]] of strands) {
      const len = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(2, Math.round(len / L.spacing));
      const pts = [];
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        const h = ah + (bh - ah) * f - L.sag * 4 * f * (1 - f);
        pts.push(this.gridPoint(ax + (bx - ax) * f, ay + (by - ay) * f, h));
      }
      g.lineStyle(1, L.wire, 0.9);
      g.beginPath();
      g.moveTo(...pts[0]);
      for (const p of pts.slice(1)) g.lineTo(...p);
      g.strokePath();
      bulbs.push(...pts.slice(1, -1));
    }
    for (const [x, y] of bulbs) {
      g.fillStyle(L.glow, 0.06);
      g.fillCircle(x, y + 3, 15);
      g.fillStyle(L.glow, 0.1);
      g.fillCircle(x, y + 3, 9);
      g.fillStyle(L.glow, 0.22);
      g.fillCircle(x, y + 3, 5);
    }
    for (const [x, y] of bulbs) {
      g.fillStyle(L.wire, 1);
      g.fillRect(x - 0.8, y - 0.5, 1.6, 2);
      g.fillStyle(L.glow, 1);
      g.fillCircle(x, y + 3, 2.8);
      g.fillStyle(L.bulb, 1);
      g.fillCircle(x - 0.5, y + 2.5, 1.6);
    }
  }

  // A row of dark buildings with lit windows across each back road. Only
  // the two faces turned to the camera are drawn, far ones first.
  drawStreetBuildings(g, P, t, nx, ny, drop, R) {
    const fill = (color, pts) => {
      g.fillStyle(color, 1);
      g.fillPoints(pts.map(([x, y]) => ({ x, y })), true);
    };
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const blocks = [];
    const far = t - R;
    for (const [side, end] of [['right', nx + R], ['left', ny + R]]) {
      for (let k = far; k < end; ) {
        const w = 3 + Math.floor(rand() * 4);
        const h = 120 + Math.floor(rand() * 160);
        const shade = STREET.buildings[Math.floor(rand() * STREET.buildings.length)];
        if (side === 'right') blocks.push({ x0: k, x1: Math.min(k + w, end), y0: far - 5, y1: far, h, shade, seed: rand() }); // behind the right wall
        else blocks.push({ x0: far - 5, x1: far, y0: k, y1: Math.min(k + w, end), h, shade, seed: rand() }); // behind the left wall
        k += w;
      }
    }
    blocks.sort((a, b) => (a.x1 + a.y1) - (b.x1 + b.y1));
    for (const b of blocks) {
      const z = -drop;
      // Right-facing (+gx) face, left-facing (+gy) face, then the roof.
      fill(b.shade, [P(b.x1, b.y0, z), P(b.x1, b.y1, z), P(b.x1, b.y1, z + b.h), P(b.x1, b.y0, z + b.h)]);
      fill(darken(b.shade, 0.75), [P(b.x0, b.y1, z), P(b.x1, b.y1, z), P(b.x1, b.y1, z + b.h), P(b.x0, b.y1, z + b.h)]);
      fill(darken(b.shade, 1.25), [P(b.x0, b.y0, z + b.h), P(b.x1, b.y0, z + b.h), P(b.x1, b.y1, z + b.h), P(b.x0, b.y1, z + b.h)]);
      let s = Math.floor(b.seed * 1e6) || 1;
      const lit = () => { s = (s * 16807) % 2147483647; return s / 2147483647 < 0.35; };
      for (let h = z + 18; h < z + b.h - 14; h += 22) {
        for (let k = b.y0 + 0.4; k < b.y1 - 0.4; k += 0.8) {
          g.fillStyle(lit() ? STREET.windowLit : STREET.windowDark, 1);
          g.fillPoints([P(b.x1, k, h), P(b.x1, k + 0.4, h), P(b.x1, k + 0.4, h + 10), P(b.x1, k, h + 10)].map(([x, y]) => ({ x, y })), true);
        }
        for (let k = b.x0 + 0.4; k < b.x1 - 0.4; k += 0.8) {
          g.fillStyle(lit() ? darken(STREET.windowLit, 0.85) : STREET.windowDark, 1);
          g.fillPoints([P(k, b.y1, h), P(k + 0.4, b.y1, h), P(k + 0.4, b.y1, h + 10), P(k, b.y1, h + 10)].map(([x, y]) => ({ x, y })), true);
        }
      }
    }
  }

  // Velvet rope, street lamps and the bouncer. Called from buildWalls(), so
  // it follows the club when it expands.
  drawStreetProps(P, t, nx, ny, drop) {
    const sp = this.streetSpots();
    const rope = this.streetRope;
    rope.clear();
    const postH = 22;
    const posts = [];
    for (let k = 0; k <= sp.len; k++) posts.push(P(sp.ropeX, sp.door - 0.3 + k, -drop));
    for (let i = 0; i < posts.length - 1; i++) {
      const [ax, ay] = posts[i];
      const [bx, by] = posts[i + 1];
      rope.lineStyle(3, STREET.rope, 1);
      rope.beginPath();
      rope.moveTo(ax, ay - postH + 3);
      for (let s = 1; s <= 8; s++) {
        const f = s / 8;
        rope.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f - postH + 3 + Math.sin(f * Math.PI) * 6);
      }
      rope.strokePath();
    }
    for (const [x, y] of posts) {
      rope.fillStyle(0x000000, 0.35);
      rope.fillEllipse(x, y, 12, 5);
      rope.fillStyle(STREET.brass, 1);
      rope.fillRect(x - 1.5, y - postH, 3, postH);
      rope.fillEllipse(x, y - 1, 9, 4);
      rope.fillCircle(x, y - postH - 1, 3);
      rope.lineStyle(1, 0x3a2a0a, 1);
      rope.strokeRect(x - 1.5, y - postH, 3, postH);
    }

    const lamps = this.streetLamps;
    lamps.clear();
    for (const [lx, ly] of this.streetLampSpots(t, nx, ny)) {
      const [x, y] = P(lx, ly, -drop);
      const top = y - 78;
      lamps.fillStyle(0x000000, 0.35);
      lamps.fillEllipse(x, y, 14, 6);
      lamps.fillStyle(STREET.lampPost, 1);
      lamps.fillRect(x - 2, top, 4, 78);
      lamps.fillRect(x - 4, y - 8, 8, 8);
      lamps.lineStyle(1, 0x0a0a10, 1);
      lamps.strokeRect(x - 2, top, 4, 78);
      for (let r = 3; r >= 1; r--) {
        lamps.fillStyle(STREET.lampGlow, 0.12);
        lamps.fillCircle(x, top - 2, 6 + r * 6);
      }
      lamps.fillStyle(STREET.lampPost, 1);
      lamps.fillRect(x - 6, top - 8, 12, 5);
      lamps.fillStyle(0xfff3c4, 1);
      lamps.fillEllipse(x, top - 1, 10, 6);
    }

    // The bouncer, at the front of the line.
    if (this.streetBouncer) this.streetBouncer.container.destroy();
    if (this.hasCharacterSprites()) {
      const { sx, sy } = this.gridToScreen(sp.bouncer.gx, sp.bouncer.gy);
      const container = this.drawPatronCharacterSprite(sx, sy + drop, 1.08, STREET.bouncerCharacter);
      this.streetBouncer = { container, scaleVariance: 1.08 };
      this.faceToward(this.streetBouncer, sx - 10, sy + 5); // watching the line
      container.setDepth(sp.bouncer.gx + sp.bouncer.gy);
      this.streetQueueLayer.add(container);
    }
    for (const person of this.streetQueue) if (person.arrived) this.walkStreetQueue(person, true);
  }

  // Starts the street: a few people already waiting, then passers-by.
  startStreet() {
    for (let i = 0; i < STREET.startInLine; i++) this.streetArrival(true);
    this.time.addEvent({ delay: STREET.admitEveryMs, loop: true, callback: () => this.admitFromLine() });
    const passBy = () => {
      this.spawnPasserBy();
      this.time.delayedCall(randRange(...STREET.passerEveryMs), passBy);
    };
    this.time.delayedCall(randRange(...STREET.passerEveryMs), passBy);
    this.startHangouts();
  }

  // Who's out on the street: an ordinary guest look (undefined picks one).
  streetCharacter() {
    return undefined;
  }

  // Spots on the club's own sidewalks (front and right, clear of the line
  // and the lamps) where friends stand around chatting.
  hangoutSpots() {
    const sp = this.streetSpots();
    const y = sp.ny + STREET.sidewalk / 2 + 0.2;
    const x = sp.nx + STREET.sidewalk / 2 + 0.2;
    const spots = [];
    for (let k = sp.t + 2.5; k < sp.nx - 1; k += 4.5) spots.push({ gx: k, gy: y });
    for (let k = sp.t + 2.5; k < sp.ny - 1; k += 4.5) spots.push({ gx: x, gy: k });
    return spots;
  }

  // Keeps a few groups standing about; now and then one breaks up and
  // walks off, and a new one gathers somewhere else.
  startHangouts() {
    this.hangouts = [];
    for (let i = 0; i < STREET.hangouts; i++) this.formHangout(true);
    const cycle = () => {
      const g = Phaser.Utils.Array.GetRandom(this.hangouts);
      if (g) this.breakHangout(g);
      this.time.delayedCall(2500, () => this.formHangout(false));
      this.time.delayedCall(randRange(...STREET.hangoutMs), cycle);
    };
    this.time.delayedCall(randRange(...STREET.hangoutMs), cycle);
  }

  formHangout(already) {
    if (!this.hasCharacterSprites()) return;
    const taken = new Set(this.hangouts.map((g) => g.spotKey));
    const free = this.hangoutSpots().filter((s) => !taken.has(`${s.gx},${s.gy}`));
    if (!free.length) return;
    const spot = Phaser.Utils.Array.GetRandom(free);
    const n = 2 + Math.floor(Math.random() * 2);
    const g = { spotKey: `${spot.gx},${spot.gy}`, people: [] };
    const sp = this.streetSpots();
    const onFront = spot.gy > sp.ny;
    const { sx: cx, sy: cy } = this.gridToScreen(spot.gx, spot.gy);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const at = { gx: spot.gx + Math.cos(a) * 0.55, gy: spot.gy + Math.sin(a) * 0.55 };
      const from = onFront ? { gx: Math.random() < 0.5 ? sp.laneEnds[0] : sp.nx + STREET.sidewalk + 1, gy: at.gy }
        : { gx: at.gx, gy: Math.random() < 0.5 ? sp.laneEnds[0] : sp.ny + STREET.sidewalk + 1 };
      const person = this.makeStreetPerson(already ? at : from, this.streetPassLayer, this.streetCharacter());
      person.hangout = g;
      g.people.push(person);
      this.streetWalkers.push(person);
      const settle = () => this.faceToward(person, cx, cy + DROP);
      if (already) settle();
      else {
        person.container.setAlpha(0);
        this.tweens.add({ targets: person.container, alpha: 1, duration: 500 });
        this.streetWalkTo(person, [at], settle);
      }
    }
    this.hangouts.push(g);
  }

  breakHangout(g) {
    this.hangouts = this.hangouts.filter((h) => h !== g);
    const sp = this.streetSpots();
    g.people.forEach((person, i) => {
      if (!person.container.active) return;
      this.time.delayedCall(i * 600, () => {
        if (!person.container.active) return;
        const onFront = person.gy > sp.ny;
        const end = onFront ? { gx: Math.random() < 0.5 ? sp.laneEnds[0] : sp.nx + STREET.sidewalk + 1, gy: person.gy }
          : { gx: person.gx, gy: Math.random() < 0.5 ? sp.laneEnds[0] : sp.ny + STREET.sidewalk + 1 };
        this.walkAndVanish(person, [end]);
      });
    });
  }

  // Someone walks up the street to join the line, if it isn't full. With
  // `already`, they're standing in line from the start.
  // `info` marks a party guest ({ partyGuest }, see parties.js) or a
  // celebrity ({ celeb }, see celebrities.js).
  streetArrival(already = false, info = null) {
    if (!this.hasCharacterSprites() || this.streetQueue.length >= this.streetSpots().len) {
      if (!this.hasCharacterSprites()) this.trySpawnPatron();
      return;
    }
    const sp = this.streetSpots();
    const k = this.streetQueue.length;
    // New arrivals walk up the left sidewalk from the front of the block.
    const start = already ? sp.slot(k) : { gx: sp.leftX, gy: sp.laneEnds[1] };
    const celeb = info && info.celeb ? this.celebDef(info.celeb) : null; // a celebrity has their own look
    const person = this.makeStreetPerson(start, this.streetQueueLayer, celeb ? celeb.character : undefined);
    person.info = info;
    if (info && info.celeb) this.addStarIcon(person.container); // a celebrity in the line
    person.slot = k;
    this.streetQueue.push(person);
    if (already) {
      person.arrived = true;
      this.faceDoor(person);
      return;
    }
    person.container.setAlpha(0);
    this.tweens.add({ targets: person.container, alpha: 1, duration: 500 });
    this.streetWalkTo(person, [{ gx: sp.leftX, gy: sp.tail.gy }, sp.tail], () => { person.arrived = true; this.walkStreetQueue(person); });
  }

  // Turns someone in line toward the door, up the line.
  faceDoor(person) {
    const sp = this.streetSpots();
    const { sx, sy } = this.gridToScreen(sp.lineX, sp.door - 3);
    this.faceToward(person, sx, sy + DROP);
    this.setPatronAnimation(person, 'idle'); // show the back-facing pose
  }

  makeStreetPerson(at, layer, character) {
    const { sx, sy } = this.gridToScreen(at.gx, at.gy);
    const scaleVariance = 0.95 + Math.random() * 0.1;
    const container = this.drawPatronCharacterSprite(sx, sy + DROP, scaleVariance, character);
    container.setDepth(at.gx + at.gy);
    layer.add(container);
    return { container, scaleVariance, gx: at.gx, gy: at.gy };
  }

  // Walks a street person through grid points (straight lines, at street
  // pace), then calls done.
  streetWalkTo(person, points, done) {
    const c = person.container;
    if (person.moveTween) person.moveTween.stop();
    const step = (i) => {
      if (!c.active) return;
      if (i >= points.length) {
        this.setPatronAnimation(person, 'idle');
        person.walking = false;
        if (done) done();
        return;
      }
      const p = points[i];
      const { sx, sy } = this.gridToScreen(p.gx, p.gy);
      const dist = Math.hypot(p.gx - person.gx, p.gy - person.gy);
      person.walking = true;
      this.faceToward(person, sx, sy + DROP);
      this.setPatronAnimation(person, 'walk');
      person.moveTween = this.tweens.add({
        targets: c,
        x: sx,
        y: sy + DROP,
        duration: Math.max(1, dist * STREET.msPerTile),
        onComplete: () => {
          person.gx = p.gx;
          person.gy = p.gy;
          c.setDepth(p.gx + p.gy);
          c.parentContainer?.sort('depth');
          step(i + 1);
        },
      });
    };
    step(0);
  }

  // Moves someone in line up to their slot (the line shuffles forward).
  walkStreetQueue(person, snap = false) {
    const target = this.streetSpots().slot(this.streetQueue.indexOf(person));
    person.slot = this.streetQueue.indexOf(person);
    if (snap) {
      if (person.moveTween) person.moveTween.stop();
      const { sx, sy } = this.gridToScreen(target.gx, target.gy);
      person.container.setPosition(sx, sy + DROP);
      person.gx = target.gx;
      person.gy = target.gy;
      person.walking = false;
      this.setPatronAnimation(person, 'idle');
      this.faceDoor(person);
      return;
    }
    this.streetWalkTo(person, [target], () => this.faceDoor(person));
  }

  // Runs every couple of seconds: lets the person at the front in if the
  // club has room, and tops up the line now and then.
  admitFromLine() {
    if (!this.doorsOpen()) return; // the line waits for the doors to open
    this.callPartyCrowd(); // party guests keep coming while there's room in the line
    // At a party the bouncer lets people in a few at a time.
    const now = this.time.now;
    if (this.currentParty() && now < (this.lastAdmitAt || 0) + STREET.partyAdmitMs) return;
    const front = this.streetQueue[0];
    const { gx, gy } = this.doorTile();
    const roomInside = this.guestCount() < this.patronCapacity() && !this.isBlockingProp(gx, gy) && !this.patronTileOccupied(gx, gy);
    if (!front || !front.arrived || front.walking || front.slot !== 0 || !roomInside) return;
    this.streetQueue.shift();
    this.lastAdmitAt = now;
    if (this.streetBouncer) {
      const b = this.streetBouncer.container;
      this.floatText(b.x, b.y - 92, '👍', '#ffffff');
    }
    this.streetQueue.forEach((p) => { if (p.arrived) this.walkStreetQueue(p); });
    const sp = this.streetSpots();
    // Up past the bouncer and in at the door.
    this.tweens.add({ targets: front.container, alpha: 0, delay: 600, duration: 500 });
    this.streetWalkTo(front, [{ gx: sp.lineX, gy: sp.door }, sp.enterTo], () => {
      const character = front.container.patronCharacter;
      front.container.destroy();
      this.trySpawnPatron(character, front.info);
    });
  }

  // A patron has left through the door: they step out by the bouncer and
  // walk off along the left sidewalk.
  streetLeaver(character) {
    if (!this.hasCharacterSprites() || !this.streetPassLayer) return;
    const sp = this.streetSpots();
    const person = this.makeStreetPerson(sp.exitFrom, this.streetBackPassLayer, character);
    this.streetWalkers.push(person);
    person.container.setAlpha(0);
    this.tweens.add({ targets: person.container, alpha: 1, duration: 500 });
    const end = sp.laneEnds[Math.random() < 0.5 ? 0 : 1];
    this.walkAndVanish(person, [{ gx: sp.leftX, gy: end }]);
  }

  // Someone walking round the block, never going in: along one of the four
  // sidewalks, either way. The left and back ones are behind the walls.
  spawnPasserBy() {
    if (!this.hasCharacterSprites()) return;
    const sp = this.streetSpots();
    const lo = sp.t - STREET.sidewalk - 1;
    const hiX = sp.nx + STREET.sidewalk + 1;
    const hiY = sp.ny + STREET.sidewalk + 1;
    const routes = [
      { front: true, from: [lo, sp.laneY], to: [hiX, sp.laneY] }, // past the line
      { front: true, from: [lo, sp.frontY], to: [hiX, sp.frontY] }, // front curb
      { front: true, from: [sp.rightX, lo], to: [sp.rightX, hiY] }, // right sidewalk
      { front: false, from: [sp.leftX, lo], to: [sp.leftX, hiY] }, // left sidewalk, past the line
      { front: false, from: [lo, sp.backY], to: [hiX, sp.backY] }, // back sidewalk
    ];
    const r = routes[Math.floor(Math.random() * routes.length)];
    const [a, b] = Math.random() < 0.5 ? [r.from, r.to] : [r.to, r.from];
    const wobble = randRange(-0.3, 0.3);
    const off = a[0] === b[0] ? [wobble, 0] : [0, wobble];
    // Some walk in twos or threes, side by side, a step apart.
    const n = Math.random() < STREET.groupChance ? 2 + (Math.random() < 0.3 ? 1 : 0) : 1;
    const along = a[0] === b[0] ? [0, Math.sign(b[1] - a[1])] : [Math.sign(b[0] - a[0]), 0];
    const side = a[0] === b[0] ? [1, 0] : [0, 1];
    for (let i = 0; i < n; i++) {
      const lag = i * 0.35, sideOff = (i - (n - 1) / 2) * 0.55;
      const o = [off[0] + side[0] * sideOff - along[0] * lag, off[1] + side[1] * sideOff - along[1] * lag];
      const person = this.makeStreetPerson({ gx: a[0] + o[0], gy: a[1] + o[1] }, r.front ? this.streetPassLayer : this.streetBackPassLayer, this.streetCharacter());
      this.streetWalkers.push(person);
      person.container.setAlpha(0);
      this.tweens.add({ targets: person.container, alpha: 1, duration: 600 });
      this.walkAndVanish(person, [{ gx: b[0] + o[0], gy: b[1] + o[1] }]);
    }
  }

  // Walks a street person along `points`, fading them out as they reach
  // the end, then removes them.
  walkAndVanish(person, points) {
    let tiles = 0;
    let at = person;
    for (const p of points) { tiles += Math.hypot(p.gx - at.gx, p.gy - at.gy); at = p; }
    this.time.delayedCall(Math.max(0, tiles * STREET.msPerTile - 500), () => {
      if (person.container.active) this.tweens.add({ targets: person.container, alpha: 0, duration: 450 });
    });
    this.streetWalkTo(person, points, () => this.removeStreetWalker(person));
  }

  removeStreetWalker(person) {
    person.container.destroy();
    const i = this.streetWalkers.indexOf(person);
    if (i !== -1) this.streetWalkers.splice(i, 1);
  }
}

function darken(color, f) {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * f));
  const b = Math.min(255, Math.round((color & 255) * f));
  return (r << 16) | (g << 8) | b;
}
