// ClubScene methods: the street outside, like Nightclub City's. The club
// sits on a city block at night: a sidewalk all round, roads beyond it and
// dark buildings across the back roads. On the front-left sidewalk, by the
// corner nearest the door, people line up behind a velvet rope with a
// bouncer at the front; they go in one at a time while the club has room.
// Others just walk past, and patrons who leave walk off down the street.
//
// Street people are drawn on streetLayer (above the room, since they're
// nearer the camera than anything inside) and aren't in this.patrons until
// they go in. Going in, they fade out at the corner and fade in at the door
// (the walk along the outside of the left wall would be hidden anyway).
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { FLOOR_SLAB_DEPTH as DROP, PATRON_SPAWN_TILE, STREET } from '../config.js';

const randRange = (min, max) => min + Math.random() * (max - min);

export class StreetMixin {
  // Where things go on the front-left sidewalk, in grid coordinates. The
  // room's front-left edge is at gy = n.
  streetSpots() {
    const n = this.gridSize - 0.5;
    const lineY = n + 1.2;
    return {
      n,
      lineY,
      ropeY: n + 2,
      laneY: n + 3,
      slot: (k) => ({ gx: STREET.lineStartGx + k, gy: lineY }),
      tailGx: STREET.lineStartGx + STREET.lineLength + 0.6,
      enterTo: { gx: STREET.lineStartGx, gy: n + 0.2 },
      exitFrom: { gx: STREET.lineStartGx - 1.8, gy: n + 0.4 },
      bouncer: { gx: STREET.lineStartGx - 1, gy: n + 1.5 },
      laneEnds: [STREET.lineStartGx - 8, this.gridSize + 4],
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
    this.streetLayer.add([this.streetQueueLayer, this.streetRope, this.streetPassLayer, this.streetLamps]);
  }

  // Ground: road, sidewalk, curb, lane markings, the red carpet, pools of
  // lamplight and the buildings across the back roads. Drawn into the
  // floor's ground graphics, under everything.
  drawStreetGround(g, P, t, n, drop) {
    const fill = (color, pts, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillPoints(pts.map(([x, y]) => ({ x, y })), true);
    };
    const quad = (color, x0, y0, x1, y1, alpha = 1) =>
      fill(color, [P(x0, y0, -drop), P(x1, y0, -drop), P(x1, y1, -drop), P(x0, y1, -drop)], alpha);
    const R = STREET.road + STREET.sidewalk; // road's outer edge, from the walls
    const S = STREET.sidewalk;

    this.drawStreetBuildings(g, P, t, n, drop, R);
    quad(STREET.asphalt, t - R, t - R, n + R, n + R);
    quad(STREET.curb, t - S - 0.25, t - S - 0.25, n + S + 0.25, n + S + 0.25);
    quad(STREET.pavement, t - S, t - S, n + S, n + S);
    g.lineStyle(1, STREET.grout, 1);
    for (let k = Math.ceil(t - S); k <= n + S; k += 2) {
      g.lineBetween(...P(k, t - S, -drop), ...P(k, n + S, -drop));
      g.lineBetween(...P(t - S, k, -drop), ...P(n + S, k, -drop));
    }
    // Dashed centre lines down the middle of each road.
    const mid = S + STREET.road / 2;
    for (let k = t - R; k < n + R; k += 2) {
      quad(STREET.laneLine, k, n + mid - 0.08, k + 1, n + mid + 0.08);
      quad(STREET.laneLine, n + mid - 0.08, k, n + mid + 0.08, k + 1);
      quad(STREET.laneLine, k, t - mid - 0.08, k + 1, t - mid + 0.08);
      quad(STREET.laneLine, t - mid - 0.08, k, t - mid + 0.08, k + 1);
    }
    // Red carpet under the line, with gold edging.
    const x0 = STREET.lineStartGx - 1.6;
    const x1 = STREET.lineStartGx + STREET.lineLength;
    quad(STREET.carpet, x0, n + 0.5, x1, n + 1.85);
    g.lineStyle(1.5, STREET.carpetEdge, 1);
    g.lineBetween(...P(x0, n + 0.5, -drop), ...P(x1, n + 0.5, -drop));
    g.lineBetween(...P(x0, n + 1.85, -drop), ...P(x1, n + 1.85, -drop));
    g.lineBetween(...P(x1, n + 0.5, -drop), ...P(x1, n + 1.85, -drop));
    // Warm pools of light under the street lamps.
    for (const [lx, ly] of this.streetLampSpots(t, n)) {
      const [cx, cy] = P(lx, ly, -drop);
      g.fillStyle(STREET.lampGlow, 0.04);
      g.fillEllipse(cx, cy, 150, 75);
      g.fillStyle(STREET.lampGlow, 0.04);
      g.fillEllipse(cx, cy, 90, 45);
    }
  }

  // Lamp posts along the front curbs, in grid coordinates.
  streetLampSpots(t, n) {
    const curb = n + STREET.sidewalk - 0.4;
    const spots = [];
    // Kept clear of the line at the rope.
    const lineFrom = STREET.lineStartGx - 3;
    const lineTo = STREET.lineStartGx + STREET.lineLength + 1;
    for (let k = t + 1; k <= n + 2; k += STREET.lampEvery) {
      if (k < lineFrom || k > lineTo) spots.push([k, curb]);
      spots.push([curb, k]);
    }
    return spots;
  }

  // A row of dark buildings with lit windows across each back road. Only
  // the two faces turned to the camera are drawn, far ones first.
  drawStreetBuildings(g, P, t, n, drop, R) {
    const fill = (color, pts) => {
      g.fillStyle(color, 1);
      g.fillPoints(pts.map(([x, y]) => ({ x, y })), true);
    };
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const blocks = [];
    const far = t - R;
    for (let k = far; k < n + R; ) {
      const w = 3 + Math.floor(rand() * 4);
      const h = 120 + Math.floor(rand() * 160);
      const shade = STREET.buildings[Math.floor(rand() * STREET.buildings.length)];
      blocks.push({ x0: k, x1: Math.min(k + w, n + R), y0: far - 5, y1: far, h, shade, seed: rand() }); // behind the right wall
      blocks.push({ x0: far - 5, x1: far, y0: k, y1: Math.min(k + w, n + R), h, shade, seed: rand() }); // behind the left wall
      k += w;
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
  drawStreetProps(P, t, n, drop) {
    const sp = this.streetSpots();
    const rope = this.streetRope;
    rope.clear();
    const postH = 22;
    const posts = [];
    for (let k = 0; k <= STREET.lineLength; k++) posts.push(P(STREET.lineStartGx - 0.5 + k, sp.ropeY, -drop));
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
    for (const [lx, ly] of this.streetLampSpots(t, n)) {
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
      this.faceToward(this.streetBouncer, sx + 10, sy + 5);
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
  }

  // Someone walks up the street to join the line, if it isn't full. With
  // `already`, they're standing in line from the start.
  streetArrival(already = false) {
    if (!this.hasCharacterSprites() || this.streetQueue.length >= STREET.lineLength) {
      if (!this.hasCharacterSprites()) this.trySpawnPatron();
      return;
    }
    const sp = this.streetSpots();
    const k = this.streetQueue.length;
    const start = already ? sp.slot(k) : { gx: sp.laneEnds[1], gy: sp.laneY };
    const person = this.makeStreetPerson(start, this.streetQueueLayer);
    person.slot = k;
    this.streetQueue.push(person);
    if (already) {
      person.arrived = true;
      this.faceToward(person, -1e6, -1e6);
      return;
    }
    person.container.setAlpha(0);
    this.tweens.add({ targets: person.container, alpha: 1, duration: 500 });
    this.streetWalkTo(person, [{ gx: sp.tailGx, gy: sp.laneY }, { gx: sp.tailGx, gy: sp.lineY }], () => { person.arrived = true; this.walkStreetQueue(person); });
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
      this.faceToward(person, -1e6, -1e6);
      return;
    }
    this.streetWalkTo(person, [target], () => {
      this.faceToward(person, -1e6, -1e6); // facing the door
    });
  }

  // Runs every couple of seconds: lets the person at the front in if the
  // club has room, and tops up the line now and then.
  admitFromLine() {
    if (!this.doorsOpen()) return; // the line waits for the doors to open
    const front = this.streetQueue[0];
    const { gx, gy } = PATRON_SPAWN_TILE;
    const roomInside = this.patrons.length < this.patronCapacity() && !this.isBlockingProp(gx, gy) && !this.patronTileOccupied(gx, gy);
    if (!front || !front.arrived || front.walking || front.slot !== 0 || !roomInside) return;
    this.streetQueue.shift();
    this.streetQueue.forEach((p) => { if (p.arrived) this.walkStreetQueue(p); });
    const sp = this.streetSpots();
    this.tweens.add({ targets: front.container, alpha: 0, duration: 700 });
    this.streetWalkTo(front, [sp.enterTo], () => {
      const character = front.container.patronCharacter;
      front.container.destroy();
      this.trySpawnPatron(character);
    });
  }

  // A patron has left through the door: they reappear round the corner
  // and walk off down the street.
  streetLeaver(character) {
    if (!this.hasCharacterSprites() || !this.streetPassLayer) return;
    const sp = this.streetSpots();
    const person = this.makeStreetPerson(sp.exitFrom, this.streetPassLayer, character);
    this.streetWalkers.push(person);
    person.container.setAlpha(0);
    this.tweens.add({ targets: person.container, alpha: 1, duration: 500 });
    const end = sp.laneEnds[Math.random() < 0.5 ? 0 : 1];
    this.streetWalkTo(person, [{ gx: sp.exitFrom.gx, gy: sp.laneY }, { gx: end, gy: sp.laneY }], () => this.removeStreetWalker(person));
    this.fadeOutNearEnd(person, end);
  }

  // Someone who just walks past the club.
  spawnPasserBy() {
    if (!this.hasCharacterSprites()) return;
    const sp = this.streetSpots();
    const [a, b] = Math.random() < 0.5 ? sp.laneEnds : [...sp.laneEnds].reverse();
    const lane = sp.laneY + randRange(-0.2, 0.3);
    const person = this.makeStreetPerson({ gx: a, gy: lane }, this.streetPassLayer);
    this.streetWalkers.push(person);
    person.container.setAlpha(0);
    this.tweens.add({ targets: person.container, alpha: 1, duration: 600 });
    this.streetWalkTo(person, [{ gx: b, gy: lane }], () => this.removeStreetWalker(person));
    this.fadeOutNearEnd(person, b);
  }

  fadeOutNearEnd(person, endGx) {
    const timer = this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        if (!person.container.active) { timer.remove(); return; }
        const { sx } = this.gridToScreen(endGx, person.gy);
        if (Math.abs(person.container.x - sx) < 40) {
          timer.remove();
          this.tweens.add({ targets: person.container, alpha: 0, duration: 400 });
        }
      },
    });
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
