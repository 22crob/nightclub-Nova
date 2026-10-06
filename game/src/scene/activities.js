// ClubScene methods: what guests do during a visit. A guest stays for a
// visit of VISIT.visitMs and moves through activities: get a drink, dance,
// sit, chat with someone, wander, then maybe dance again. Each guest has a
// type (GUEST_TYPES) that weights which activity they pick next, so they
// don't all follow the same routine. They leave when their visit time is
// up, once they've finished what they're doing.
//
// patron.activity is { kind, until, ... }: kind is 'drink', 'dance',
// 'sit', 'chat' or 'wander'; `until` is set when the activity actually
// starts (on arriving), so walking there doesn't eat into it.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { FLOOR_DECAL_PROPS } from '../catalog.js';
import { ADMIRE, GUEST_TYPES, PATRON_MOVE_INTERVAL, PATRON_POPUP_Y, VISIT } from '../config.js';
import { PROP_TYPES } from '../catalog.js';
import { randRange } from '../util.js';

const KINDS = ['drink', 'dance', 'sit', 'chat', 'wander', 'admire'];

export class ActivitiesMixin {
  // A new guest's visit length and personality.
  startVisit(patron) {
    const now = this.time.now;
    patron.type = Phaser.Utils.Array.GetRandom(GUEST_TYPES);
    patron.despawnAt = now + randRange(...VISIT.visitMs);
    patron.activity = null;
  }

  // How much a guest fancies each activity right now: their type's taste,
  // less of what they just did, more dancing during Bass Boost and more
  // drinking during Drink Rush, and nothing that isn't in the club.
  activityWeights(patron) {
    const w = { ...patron.type.weights };
    w.admire = this.admireSpot(patron) ? ADMIRE.weight : 0; // a decoration to look at
    if (patron.lastActivity) w[patron.lastActivity] *= 0.25;
    w.dance *= this.boostDanceFactor ? this.boostDanceFactor() : 1;
    w.drink *= this.rushDrinkFactor ? this.rushDrinkFactor() : 1;
    if (!this.musicPlaying()) w.dance = 0;
    return w;
  }

  // Picks and starts the guest's next activity, or sends them home when
  // their visit is over. A thirsty guest goes for a drink first.
  chooseActivity(patron) {
    const now = this.time.now;
    if (now >= patron.despawnAt) { this.startPatronDeparture(patron); return; }
    const order = [];
    // Answering the Bass Boost or Drink Rush (see rallyGuests()).
    if (patron.wantActivity) { order.push(patron.wantActivity); patron.wantActivity = null; }
    if (now >= patron.thirstyAt) order.push('drink');
    const w = this.activityWeights(patron);
    const total = KINDS.reduce((s, k) => s + w[k], 0);
    let r = Math.random() * total;
    for (const k of KINDS) {
      r -= w[k];
      if (r <= 0) { order.push(k); break; }
    }
    order.push('wander');
    for (const kind of order) if (this.beginActivity(patron, kind)) return;
  }

  // Starts heading for an activity. False if it isn't possible right now
  // (no free bar, dance floor space, seat or anyone to talk to).
  beginActivity(patron, kind) {
    const now = this.time.now;
    if (kind === 'drink') {
      if (!this.joinBarQueue(patron)) return false;
      patron.activity = { kind, phase: 'queue' };
      return true;
    }
    if (kind === 'dance') {
      const tile = this.freeDanceTile(patron);
      if (!tile) return false;
      patron.activity = { kind };
      [patron.targetGx, patron.targetGy] = tile;
      return true;
    }
    if (kind === 'sit') {
      if (!this.claimSeat(patron)) return false;
      patron.activity = { kind };
      return true;
    }
    if (kind === 'chat') return this.startChat(patron);
    if (kind === 'admire') {
      const spot = this.admireSpot(patron);
      if (!spot) return false;
      patron.activity = { kind, rec: spot.rec };
      [patron.targetGx, patron.targetGy] = spot.tile;
      patron.path = null;
      return true;
    }
    patron.activity = { kind: 'wander', until: now + randRange(...VISIT.wanderMs) };
    this.pickWanderTile(patron);
    return true;
  }

  // Called when a guest has nowhere to go (see pickRoamTarget()): carries
  // on with an activity still running, or picks the next one.
  nextActivityStep(patron) {
    const now = this.time.now;
    const a = patron.activity;
    if (a && a.until && now < a.until) {
      if (a.kind === 'wander') { this.pickWanderTile(patron); return; }
      if (a.kind === 'drink' && a.phase === 'drinking') { this.pickDrinkingSpot(patron, a.bar); return; }
      if (a.kind === 'dance') {
        const tile = this.freeDanceTile(patron);
        if (tile) { [patron.targetGx, patron.targetGy] = tile; return; }
      }
    }
    if (a) patron.lastActivity = a.kind;
    this.endChat(patron);
    this.endDanceTogether(patron);
    patron.activity = null;
    this.chooseActivity(patron);
  }

  // A guest has reached the spot for their activity: start it.
  arriveForActivity(patron) {
    const now = this.time.now;
    patron.entering = false; // in from the door (see trySpawnPatron())
    if (patron.seat && !patron.sitting) { this.sitDown(patron); return; }
    if (patron.queue) { this.waitInLine(patron); return; }
    const a = patron.activity;
    const kind = a && a.kind;
    if (kind === 'dance' && this.isDanceFloorTile(patron.gx, patron.gy) && this.musicPlaying()) {
      if (!a.until) a.until = now + randRange(...VISIT.danceMs);
      this.faceFront(patron);
      this.setPatronAnimation(patron, 'dance');
      patron.nextMoveAt = a.until;
      this.maybeDanceTogether(patron); // someone dancing next to them? (security.js)
      return;
    }
    if (kind === 'drink' && a.phase === 'drinking') {
      this.faceFront(patron);
      this.setPatronAnimation(patron, 'drink'); // sipping (drawn guests just stand)
      patron.nextMoveAt = a.until;
      return;
    }
    if (kind === 'chat' && this.chatArrive(patron)) return;
    if (kind === 'admire' && !a.until) {
      // Look at it for a few seconds (the WOW! comes in tickActivity()).
      const { sx, sy } = this.footprintCenter(a.rec.tiles);
      this.faceToward(patron, sx, sy);
      patron.container.patronAnimState = null;
      this.setPatronAnimation(patron, 'idle');
      a.until = now + ADMIRE.lookMs;
      patron.nextMoveAt = a.until + 1500; // and a moment to react
      return;
    }
    // Wandering, or the plan fell through: stand a moment, then go on.
    this.faceFront(patron);
    this.setPatronAnimation(patron, 'idle');
    patron.nextMoveAt = now + randRange(...PATRON_MOVE_INTERVAL);
    if (kind !== 'wander') patron.activity = null;
  }

  // Served a drink (at the bar, by Bottoms Up! or on the house): the guest
  // drinks it for a while, stepping away from the counter so the next
  // customer can order (or staying put if they're sitting).
  startDrinking(patron, bar) {
    patron.activity = { kind: 'drink', phase: 'drinking', until: this.time.now + randRange(...VISIT.drinkMs), bar };
    if (patron.sitting) {
      patron.nextMoveAt = patron.activity.until;
      return;
    }
    this.pickDrinkingSpot(patron, bar);
  }

  // How many other guests are on, or headed for, the tiles around (x, y):
  // spot pickers prefer quiet spots so the crowd spreads out.
  crowdAt(x, y, patron) {
    let n = 0;
    for (const p of this.patrons) {
      if (p === patron || p.gone || p.leaving) continue;
      if (Math.max(Math.abs(p.gx - x), Math.abs(p.gy - y)) <= 1) n += 1;
      if (p.targetGx !== undefined && Math.max(Math.abs(p.targetGx - x), Math.abs(p.targetGy - y)) <= 1) n += 1;
    }
    return n;
  }

  // The least crowded of some tiles (ties broken at random), or null.
  leastCrowded(tiles, patron) {
    let best = null;
    let bestScore = Infinity;
    for (const t of tiles) {
      const score = this.crowdAt(t[0], t[1], patron) + Math.random() * 0.9;
      if (score < bestScore) { bestScore = score; best = t; }
    }
    return best;
  }

  // A free tile a little way from the bar (not in anyone's line, not where
  // the crowd already is) to stand and drink at.
  pickDrinkingSpot(patron, bar) {
    const lines = this.keepOffTiles();
    const near = bar ? this.barLayout(bar).counter : [patron.gx, patron.gy];
    const spots = [];
    for (let dx = -6; dx <= 6; dx++) {
      for (let dy = -6; dy <= 6; dy++) {
        const x = near[0] + dx;
        const y = near[1] + dy;
        if (!this.inGrid(x, y)) continue;
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < 2 || d > 6 || this.isBlockingProp(x, y) || lines.has(`${x},${y}`)) continue;
        if (this.patronTileOccupied(x, y) && !(x === patron.gx && y === patron.gy)) continue;
        spots.push([x, y]);
      }
    }
    const spot = this.leastCrowded(Phaser.Utils.Array.Shuffle(spots).slice(0, 14), patron);
    if (!spot) { this.pickWanderTile(patron); return; }
    [patron.targetGx, patron.targetGy] = spot;
    patron.path = null;
  }

  // A dance floor tile nobody's on (or headed for), or null.
  freeDanceTile(patron) {
    const lines = this.keepOffTiles();
    const taken = new Set();
    for (const p of this.patrons) {
      if (p === patron || p.gone) continue;
      taken.add(`${p.gx},${p.gy}`);
      if (p.targetGx !== undefined) taken.add(`${p.targetGx},${p.targetGy}`);
    }
    const tiles = [];
    for (const key in this.placed) {
      if (!FLOOR_DECAL_PROPS.has(this.placed[key].type) || taken.has(key) || lines.has(key)) continue;
      tiles.push(key.split(',').map(Number));
    }
    return tiles.length ? Phaser.Utils.Array.GetRandom(tiles) : null;
  }

  // Somewhere to wander to: now and then by the DJ booth, otherwise the
  // quietest of a few open tiles around the club, so the crowd spreads out
  // instead of bunching up.
  pickWanderTile(patron) {
    const lines = this.keepOffTiles();
    const poi = this.pickPointOfInterestTile();
    if (poi && Math.random() < 0.15 && this.crowdAt(poi[0], poi[1], patron) < 2) {
      [patron.targetGx, patron.targetGy] = poi;
      patron.path = null;
      return;
    }
    const options = [];
    for (let i = 0; i < 30 && options.length < 8; i++) {
      const tx = Phaser.Math.Between(0, this.gridW - 1);
      const ty = Phaser.Math.Between(0, this.gridH - 1);
      if (!this.isBlockingProp(tx, ty) && !lines.has(`${tx},${ty}`) && !this.patronTileOccupied(tx, ty)) options.push([tx, ty]);
    }
    const spot = this.leastCrowded(options, patron);
    if (spot) {
      [patron.targetGx, patron.targetGy] = spot;
      patron.path = null;
      return;
    }
    patron.targetGx = patron.gx;
    patron.targetGy = patron.gy;
  }

  // --- Chatting -------------------------------------------------------------

  // Finds someone nearby who's free (wandering or standing about), and
  // walks over to talk to them; they wait for you.
  startChat(patron) {
    const doorway = new Set(this.doorZone());
    const free = (p) => p !== patron && !p.gone && !p.leaving && !p.queue && !p.sitting && !p.moving
      && (!p.activity || p.activity.kind === 'wander') && !p.chatWith;
    const near = this.patrons.filter((p) => free(p) && Math.abs(p.gx - patron.gx) + Math.abs(p.gy - patron.gy) <= 7);
    for (const other of near.sort((a, b) => (Math.abs(a.gx - patron.gx) + Math.abs(a.gy - patron.gy)) - (Math.abs(b.gx - patron.gx) + Math.abs(b.gy - patron.gy)))) {
      const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([dx, dy]) => [other.gx + dx, other.gy + dy])
        .find(([x, y]) => this.inGrid(x, y) && !this.isBlockingProp(x, y) && !doorway.has(`${x},${y}`)
          && (!this.patronTileOccupied(x, y) || (x === patron.gx && y === patron.gy)));
      if (!spot) continue;
      patron.activity = { kind: 'chat' };
      patron.chatWith = other;
      other.chatWith = patron;
      other.activity = { kind: 'chat', waiting: true };
      other.targetGx = other.gx;
      other.targetGy = other.gy;
      other.nextMoveAt = this.time.now + 20000; // waits for you (gives up after a while)
      this.setPatronAnimation(other, 'idle');
      [patron.targetGx, patron.targetGy] = spot;
      patron.path = null;
      return true;
    }
    return false;
  }

  // Arrived next to the person you came to talk to: both chat for a while,
  // facing each other. False if they've gone.
  chatArrive(patron) {
    const other = patron.chatWith;
    if (!other || other.gone || other.leaving || other.chatWith !== patron
      || Math.abs(other.gx - patron.gx) + Math.abs(other.gy - patron.gy) !== 1) {
      this.endChat(patron);
      return false;
    }
    const until = this.time.now + randRange(...VISIT.chatMs);
    for (const [a, b] of [[patron, other]]) {
      const pa = this.gridToScreen(a.gx, a.gy);
      const pb = this.gridToScreen(b.gx, b.gy);
      this.faceToward(a, pb.sx, pb.sy);
      this.faceToward(b, pa.sx, pa.sy);
    }
    for (const p of [patron, other]) {
      p.activity = { kind: 'chat', until, chatting: true };
      p.nextMoveAt = until;
      p.targetGx = p.gx;
      p.targetGy = p.gy;
      p.patronAnimState = null; // re-play idle in the new facing
      this.setPatronAnimation(p, 'idle');
    }
    if (this.maybeArgue(patron, other)) return true; // once in a while it goes badly (security.js)
    this.chatBubble(patron);
    this.popReaction(patron, 'happy', randRange(1500, 4000)); // a good chat
    this.popReaction(other, 'happy', randRange(2500, 6000));
    return true;
  }

  // A 💬 over a chatting pair now and then (see tickPatrons()).
  chatBubble(patron) {
    const now = this.time.now;
    if (now < (patron.chatBubbleAt || 0)) return;
    patron.chatBubbleAt = now + randRange(4000, 7000);
    const c = patron.container;
    this.floatText(c.x, c.y - PATRON_POPUP_Y, '💬', '#ffffff');
  }

  // Ends a chat for both people.
  endChat(patron) {
    const other = patron.chatWith;
    patron.chatWith = null;
    if (other && other.chatWith === patron) {
      other.chatWith = null;
      if (other.activity && other.activity.kind === 'chat') {
        other.activity = null;
        other.nextMoveAt = Math.min(other.nextMoveAt, this.time.now + 800);
      }
    }
  }

  // --- Admiring decorations ------------------------------------------------

  // A decoration this guest hasn't admired lately, and a free spot beside
  // it they can reach (not in the doorway or a bar line), or null.
  admireSpot(patron) {
    const now = this.time.now;
    const seen = new Set();
    const decor = [];
    for (const key in this.placed) {
      const rec = this.placed[key];
      if (seen.has(rec)) continue;
      seen.add(rec);
      if (PROP_TYPES[rec.type].category !== 'Decorations') continue;
      const last = patron.admired && patron.admired.get(rec);
      if (last !== undefined && now - last < ADMIRE.cooldownMs) continue;
      decor.push(rec);
    }
    if (decor.length === 0) return null;
    const off = this.keepOffTiles();
    const rec = decor[Math.floor(Math.random() * decor.length)];
    const own = new Set(rec.tiles.map(([x, y]) => `${x},${y}`));
    const tiles = [];
    for (const [tx, ty] of rec.tiles) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const x = tx + dx;
        const y = ty + dy;
        const k = `${x},${y}`;
        if (own.has(k) || !this.inGrid(x, y) || this.isBlockingProp(x, y) || off.has(k)) continue;
        if (this.patronTileOccupied(x, y) && !(x === patron.gx && y === patron.gy)) continue;
        tiles.push([x, y]);
      }
    }
    tiles.sort((p, q) => (Math.abs(p[0] - patron.gx) + Math.abs(p[1] - patron.gy)) - (Math.abs(q[0] - patron.gx) + Math.abs(q[1] - patron.gy)));
    for (const tile of tiles.slice(0, 4)) {
      const here = tile[0] === patron.gx && tile[1] === patron.gy;
      if (here || this.findPath(patron.gx, patron.gy, tile[0], tile[1])) return { rec, tile };
    }
    return null;
  }

  // Done looking: WOW! or OUU!, and a tip to click.
  admireReaction(patron, rec) {
    const now = this.time.now;
    patron.admired = patron.admired || new Map();
    patron.admired.set(rec, now);
    if (!rec.tiles || this.placed[`${rec.tiles[0][0]},${rec.tiles[0][1]}`] !== rec) return; // it's gone
    const c = patron.container;
    const word = Math.random() < 0.5 ? 'WOW!' : 'OUU!';
    const label = this.add.text(c.x, c.y - PATRON_POPUP_Y - 6, word, {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '18px', color: word === 'WOW!' ? '#ffe45c' : '#ff9ae0', stroke: '#10233d', strokeThickness: 5,
    }).setOrigin(0.5, 1).setScale(0.4);
    this.patronLayer.add(label);
    this.tweens.add({ targets: label, scale: 1.1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: label, y: label.y - 26, alpha: 0, delay: 700, duration: 700, onComplete: () => label.destroy() });
    patron.mood = Math.min(100, patron.mood + 4);
    const cost = PROP_TYPES[rec.type].cost || 0;
    const tip = Math.round(Math.max(ADMIRE.tipMin, Math.min(ADMIRE.tipMax, cost * ADMIRE.tipPerDollar)));
    this.offerBonus(patron, 'tip', tip);
  }

  // Runs every patron tick: chat bubbles for chatters.
  tickActivity(patron) {
    const a = patron.activity;
    if (a && a.kind === 'admire' && a.until && !a.reacted && this.time.now >= a.until && !patron.moving) {
      a.reacted = true;
      this.admireReaction(patron, a.rec);
    }
    if (a && a.kind === 'chat' && a.chatting && !patron.moving) this.chatBubble(patron);
    // Thirsty for a while: wrap up what they're doing and go for a drink.
    const now = this.time.now;
    if (a && a.kind !== 'drink' && !patron.queue && !patron.arguing && !patron.leaving
      && now >= patron.thirstyAt + VISIT.thirstGraceMs && now >= (patron.drinkTryAt || 0)) {
      patron.drinkTryAt = now + 8000; // the bars may be full: try again in a bit
      patron.wantActivity = 'drink';
      a.until = Math.min(a.until || now, now);
      patron.nextMoveAt = Math.min(patron.nextMoveAt, now + randRange(300, 1500));
    }
    // Dancers enjoying themselves show it now and then (reactions.js).
    const anim = patron.container.patronAnimState;
    if (!patron.moving && typeof anim === 'string' && anim.startsWith('dance')) this.tickDanceJoy(patron);
    else patron.nextDanceJoyAt = undefined;
  }
}
