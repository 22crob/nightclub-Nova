// ClubScene methods: bar lines and bartenders at work.
//
// Customers: a guest going for a drink takes a free service spot (the tile
// in front of a unit's counter) anywhere along a long bar. When every spot
// is taken they wait in rows behind the spots (barWaitTiles()), and step up
// to the first spot that frees. patron.queue is the unit they're at (for a
// waiter, the bar's first unit); patron.atSpot is true at a service spot.
// Nobody gives up before BAR.patienceMs; after that some walk off with an
// angry face and a fist, and the patient ones keep waiting.
//
// Bartenders: each walks side to side along the long bar to whoever is
// waiting at a spot, claims that spot (one bartender per spot; they can
// pass each other), mixes the drink for BAR.serveMs and serves it.
// rec.staff.atUnit is the unit a bartender is standing at.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { BAR, BAR_QUEUE_LENGTH, CHARACTER_DISPLAY_HEIGHT } from '../config.js';
import { randRange } from '../util.js';

export class BarsMixin {
  // --- Spots and lines --------------------------------------------------------

  // The service spot in front of a bar unit's counter, or null if blocked.
  barServiceSpot(unit) {
    return this.barQueueTiles(unit)[0] || null;
  }

  // Where waiting customers stand: rows behind the service spots, nearest
  // row first, each column stopping at anything in the way.
  barWaitTiles(group) {
    const tiles = [];
    const columns = group.map((u) => this.barQueueTiles(u));
    for (let row = 1; row < BAR_QUEUE_LENGTH; row++) {
      for (const col of columns) if (col[row]) tiles.push(col[row]);
    }
    return tiles;
  }

  // Every guest at a long bar (at a spot or waiting), spots first, then in
  // the order they joined.
  barGroupQueue(rec) {
    const group = this.barGroup(rec);
    return this.patrons
      .filter((p) => p.queue && group.includes(p.queue) && !p.gone)
      .sort((a, b) => (b.atSpot ? 1 : 0) - (a.atSpot ? 1 : 0) || a.queuedAt - b.queuedAt);
  }

  // Tiles nobody picks to stand, dance, chat or drink on, as "gx,gy" keys:
  // every worked bar's spots and lines (so they don't block the line) and
  // the doorway (so people can get in and out; see doorZone()).
  keepOffTiles() {
    const keys = new Set(this.doorZone());
    for (const rec of this.hireableRecords()) {
      if (!this.isWorked(rec)) continue;
      for (const [x, y] of this.barQueueTiles(rec)) keys.add(`${x},${y}`);
    }
    // The ends of every bar: nobody hangs about at the side of a counter.
    for (const group of this.barGroups()) {
      const first = group[0];
      const last = group[group.length - 1];
      const along = first.facing === 90 || first.facing === 270 ? [0, 1] : [1, 0];
      const lo = Math.min(...[...first.tiles, ...last.tiles].map(([x, y]) => x * along[0] + y * along[1]));
      const hi = Math.max(...[...first.tiles, ...last.tiles].map(([x, y]) => x * along[0] + y * along[1]));
      for (const unit of [first, last]) {
        for (const [x, y] of unit.tiles) {
          const pos = x * along[0] + y * along[1];
          const step = pos === lo ? -1 : pos === hi ? 1 : 0;
          if (!step) continue;
          keys.add(`${x + along[0] * step},${y + along[1] * step}`);
        }
      }
    }
    return keys;
  }

  // Every long bar (worked or not), as its list of units.
  barGroups() {
    const seen = new Set();
    const out = [];
    for (const rec of this.hireableRecords()) {
      if (seen.has(rec)) continue;
      const group = this.barGroup(rec);
      group.forEach((u) => seen.add(u));
      out.push(group);
    }
    return out;
  }

  // The first unit of each worked long bar.
  workedBars() {
    const seen = new Set();
    const out = [];
    for (const rec of this.hireableRecords()) {
      if (seen.has(rec)) continue;
      const group = this.barGroup(rec);
      group.forEach((u) => seen.add(u));
      if (group.some((u) => u.staff)) out.push(group);
    }
    return out;
  }

  // Heads for a drink at the worked bar with the shortest wait for its
  // bartenders: a free spot if there is one, otherwise a place in line.
  // False if every bar is full (or there's none).
  joinBarQueue(patron) {
    if (patron.queue) return true;
    let best = null;
    for (const group of this.workedBars()) {
      const customers = this.barGroupQueue(group[0]).length;
      const spots = group.filter((u) => this.barServiceSpot(u)).length;
      if (customers >= spots + this.barWaitTiles(group).length) continue; // full
      const score = customers / group.filter((u) => u.staff).length;
      if (!best || score < best.score) best = { group, score };
    }
    if (!best) return false;
    this.releaseSeat(patron);
    patron.queue = best.group[0];
    patron.atSpot = false;
    patron.readyToOrder = false;
    patron.queuedAt = this.time.now;
    patron.patient = Math.random() < BAR.patientShare;
    this.refreshBarLine(best.group);
    return true;
  }

  // Fills free service spots from the line (whoever has waited longest,
  // to the nearest free spot) and points everyone at their place.
  refreshBarLine(group) {
    const now = this.time.now;
    const customers = this.barGroupQueue(group[0]);
    const taken = new Set(customers.filter((p) => p.atSpot).map((p) => p.queue));
    const free = group.filter((u) => !taken.has(u) && this.barServiceSpot(u));
    for (const p of customers.filter((c) => !c.atSpot)) {
      if (free.length === 0) break;
      free.sort((a, b) => this.tileDistance(this.barServiceSpot(a), p) - this.tileDistance(this.barServiceSpot(b), p));
      p.queue = free.shift();
      p.atSpot = true;
      p.readyToOrder = false;
    }
    for (const p of customers) {
      const [tx, ty] = [p.targetGx, p.targetGy];
      this.updateQueueTarget(p);
      if (p.queue && (p.targetGx !== tx || p.targetGy !== ty) && !p.moving) p.nextMoveAt = Math.min(p.nextMoveAt, now + 300);
    }
  }

  tileDistance(tile, p) {
    return tile ? Math.abs(tile[0] - p.gx) + Math.abs(tile[1] - p.gy) : Infinity;
  }

  // Points a customer at their spot or their place in line.
  updateQueueTarget(patron) {
    const unit = patron.queue;
    if (!unit) return;
    let slot;
    if (patron.atSpot) {
      slot = this.barServiceSpot(unit);
    } else {
      const group = this.barGroup(unit);
      const waiting = this.barGroupQueue(unit).filter((p) => !p.atSpot);
      slot = this.barWaitTiles(group)[waiting.indexOf(patron)];
    }
    if (!slot) { this.leaveBarQueue(patron); return; } // the line got shorter (something placed in it)
    if (patron.targetGx !== slot[0] || patron.targetGy !== slot[1]) patron.path = null;
    [patron.targetGx, patron.targetGy] = slot;
  }

  // A customer leaves the bar (served, gave up, or off to do something
  // else): the line steps up.
  leaveBarQueue(patron) {
    const unit = patron.queue;
    if (!unit) return;
    this.releaseCustomer(patron);
    patron.queue = null;
    patron.atSpot = false;
    patron.readyToOrder = false;
    this.refreshBarLine(this.barGroup(unit));
  }

  // A bar unit was sold, turned or lost its bartender: its customers go
  // and do something else.
  clearBarQueue(rec) {
    for (const p of this.patrons) {
      if (p.queue !== rec) continue;
      this.releaseCustomer(p);
      p.queue = null;
      p.atSpot = false;
      p.readyToOrder = false;
      p.targetGx = undefined;
      p.path = null;
    }
    if (rec.claimedBy) this.releaseBartender(rec.claimedBy);
  }

  // Turns a customer to face the counter.
  faceBar(patron) {
    const { out } = this.barLayout(patron.queue);
    const [dx, dy] = out || [0, 1];
    const { sx, sy } = this.gridToScreen(patron.gx - dx, patron.gy - dy);
    this.faceToward(patron, sx, sy);
  }

  // True if a customer is standing still on their service spot: the only
  // place a drink can be handed over.
  atServiceSpot(p) {
    if (!p.queue || !p.atSpot || p.moving) return false;
    const spot = this.barServiceSpot(p.queue);
    return !!spot && spot[0] === p.gx && spot[1] === p.gy;
  }

  // A customer has reached their place: at a spot they wait to be served,
  // otherwise for a spot to free up.
  waitInLine(patron) {
    this.faceBar(patron);
    patron.container.patronAnimState = null; // re-play idle in the new facing
    this.setPatronAnimation(patron, 'idle');
    const spot = patron.atSpot && this.barServiceSpot(patron.queue);
    if (spot && spot[0] === patron.gx && spot[1] === patron.gy) {
      patron.readyToOrder = true;
      patron.nextMoveAt = this.time.now + 60000; // the bartender comes to them
    } else {
      patron.nextMoveAt = this.time.now + 500; // check again if the line has moved
    }
  }

  // --- Bartenders -------------------------------------------------------------

  // Runs with the patron tick: bartenders pick up and finish orders, and
  // customers who've waited too long may give up.
  tickBars() {
    const now = this.time.now;
    for (const group of this.workedBars()) {
      const staff = group.filter((u) => u.staff).map((u) => u.staff);
      for (const b of staff) {
        if (!b.atUnit || !group.includes(b.atUnit)) b.atUnit = group.find((u) => u.staff === b);
        const t = b.task;
        if (!t) continue;
        const p = t.patron;
        if (p.gone || p.leaving || p.queue !== t.unit || !this.atServiceSpot(p) || !group.includes(t.unit)) {
          this.releaseBartender(b);
        } else if (t.phase === 'serve' && now >= t.until) {
          this.releaseBartender(b);
          this.leaveBarQueue(p);
          this.serveDrink(t.unit, p);
          p.nextMoveAt = now + randRange(800, 1500); // take the drink and step away
        }
      }
      // Free bartenders go to the nearest customer waiting at a spot nobody
      // else is serving.
      const ready = this.barGroupQueue(group[0]).filter((p) => p.readyToOrder && this.atServiceSpot(p) && !p.servedBy && !p.leaving);
      for (const b of staff) {
        if (b.task || ready.length === 0) continue;
        const at = group.indexOf(b.atUnit);
        const options = ready.filter((p) => !p.servedBy && !p.queue.claimedBy);
        if (options.length === 0) break;
        options.sort((x, y) => Math.abs(group.indexOf(x.queue) - at) - Math.abs(group.indexOf(y.queue) - at) || x.queuedAt - y.queuedAt);
        this.startServing(b, options[0], group);
      }
      this.checkBarPatience(group);
    }
  }

  // A bartender claims a customer's spot, walks along the bar to it, then
  // mixes the drink.
  startServing(b, patron, group) {
    const unit = patron.queue;
    unit.claimedBy = b;
    patron.servedBy = b;
    b.task = { unit, patron, phase: 'walk' };
    this.bartenderWalk(b, unit, group, () => {
      if (!b.task || b.task.patron !== patron) return;
      b.task.phase = 'serve';
      // What they ordered; fancier drinks take longer to mix (drinks.js).
      patron.order = this.pickDrink(patron).key;
      b.task.until = this.time.now + BAR.serveMs * this.drinkOf(patron.order).mix / this.bartenderSpeed(b);
      const c = b.container;
      this.floatText(c.x, c.y - CHARACTER_DISPLAY_HEIGHT * 0.95, '🍸', '#ffffff');
    });
  }

  // Walks a bartender along the bar's aisle to `unit`, then calls `done`.
  bartenderWalk(b, unit, group, done) {
    const c = b.container;
    const from = group.indexOf(b.atUnit);
    const to = group.indexOf(unit);
    const { aisle, out } = this.barLayout(unit);
    const { sx, sy } = this.gridToScreen(aisle[0], aisle[1]);
    const face = (dir) => this.faceBartender(b, dir);
    if (from === to || from < 0) {
      b.atUnit = unit;
      if (from < 0) c.setPosition(sx, sy);
      face(out || [0, 1]);
      done();
      return;
    }
    const along = [Math.sign(unit.anchor[0] - b.atUnit.anchor[0]), Math.sign(unit.anchor[1] - b.atUnit.anchor[1])];
    face(along, 'walk');
    const base = Math.max(b.atUnit.gameObject.baseDepth, unit.gameObject.baseDepth);
    c.setDepth(base + 0.001);
    this.propLayer.sort('depth');
    this.tweens.killTweensOf(c);
    this.tweens.add({
      targets: c, x: sx, y: sy, duration: Math.abs(to - from) * BAR.walkMsPerUnit / this.bartenderSpeed(b), ease: 'Linear',
      onComplete: () => {
        b.atUnit = unit;
        c.setDepth(unit.gameObject.baseDepth + (unit.frontObject ? 0.001 : 0.003));
        this.propLayer.sort('depth');
        face(out || [0, 1]);
        done();
      },
    });
  }

  // Turns a bartender to face grid direction `dir`, playing `clip`.
  faceBartender(b, dir, clip = 'idle') {
    const c = b.container;
    const sprite = c.staffSprite;
    if (!sprite) return;
    const front = dir[0] > 0 || dir[1] > 0;
    c.scaleX = dir[0] !== 0 ? -1 : 1;
    sprite.play(`patron_${c.staffCharacter}_${clip}_${front ? 'front' : 'back'}`, true);
  }

  // Lets go of a bartender's order (served, or the customer left).
  releaseBartender(b) {
    const t = b && b.task;
    if (!t) return;
    if (t.unit.claimedBy === b) t.unit.claimedBy = null;
    if (t.patron.servedBy === b) t.patron.servedBy = null;
    b.task = null;
  }

  // A customer is leaving: whoever was serving them stops.
  releaseCustomer(patron) {
    if (patron.servedBy) this.releaseBartender(patron.servedBy);
    patron.servedBy = null;
  }

  // Customers who've waited longer than BAR.patienceMs, and aren't being
  // served, may give up: an angry face and a fist, and off they go. Patient
  // ones keep waiting.
  checkBarPatience(group) {
    const now = this.time.now;
    for (const p of this.barGroupQueue(group[0])) {
      if (p.patient || p.servedBy || p.leaving || now - p.queuedAt < BAR.patienceMs) continue;
      if (now < (p.patienceCheckAt || 0)) continue;
      p.patienceCheckAt = now + BAR.patienceCheckMs;
      if (Math.random() >= BAR.giveUpChance) continue;
      this.giveUpOnBar(p);
    }
  }

  giveUpOnBar(p) {
    const now = this.time.now;
    p.reactingUntil = 0;
    this.popReaction(p, 'mad', 0, BAR.angryMs);
    this.leaveBarQueue(p);
    p.mood = Math.max(0, p.mood - BAR.giveUpMood);
    p.thirstyAt = now + randRange(15000, 30000); // they'll try again later
    p.lastActivity = 'drink';
    p.activity = null;
    p.targetGx = undefined;
    p.path = null;
    p.nextMoveAt = now + 600;
  }
}
