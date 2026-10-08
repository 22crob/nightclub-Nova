// ClubScene methods: patrons sitting on seating (couches, stools, booths).
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
//
// A patron who fancies a sit (see activities.js) reserves a free seat
// and walks to the open tile in front of it (its access tile). There they
// hop onto the seat: the sprite moves to the seat's spot and is drawn
// between the piece's back and front layers, so the seat hides their legs.
// While seated, patron.gx/gy is the seat's own tile, which frees the access
// tile for others. Sitting slowly cheers them up (see updatePatronMood());
// after a while, or when thirsty, they hop back down.
import { PROP_TYPES, VIP_BOOTHS } from '../catalog.js';
import { HAPPINESS, TILE_W, VISIT } from '../config.js';

// Screen pixels per Blender unit of height, for sitLift.
const UNIT_HEIGHT_PX = (TILE_W / Math.SQRT2) * Math.cos(Math.PI / 6);
const randRange = (min, max) => min + Math.random() * (max - min);
// How often a seated guest chats rather than just sits.
const SIT_TALK_CHANCE = 0.5;

export class SeatingMixin {
  // Where seat i of a placed piece is, in (fractional) grid coordinates,
  // and which way a patron sitting there faces (the piece's front, turned by
  // the seat's own third number if it has one).
  seatSpot(rec, i) {
    const [bx, by, turn = 0] = PROP_TYPES[rec.type].seats[i];
    const f = (rec.facing * Math.PI) / 180;
    const look = ((rec.facing + turn) * Math.PI) / 180; // a seat may face its own way
    const x = bx * Math.cos(f) - by * Math.sin(f);
    const y = bx * Math.sin(f) + by * Math.cos(f);
    const cx = rec.tiles.reduce((s, [tx]) => s + tx, 0) / rec.tiles.length;
    const cy = rec.tiles.reduce((s, [, ty]) => s + ty, 0) / rec.tiles.length;
    // Blender +X is game +gx and Blender +Y is game -gy; the front (-Y at
    // rest) turns with the piece.
    return { gx: cx + x, gy: cy - y, front: [Math.round(Math.sin(look)), Math.round(Math.cos(look))] };
  }

  // The walkable tile next to the piece that is closest to just in front
  // of seat i, or null if the piece is boxed in.
  seatAccessTile(rec, i) {
    const spot = this.seatSpot(rec, i);
    const aimX = spot.gx + spot.front[0] * 0.9;
    const aimY = spot.gy + spot.front[1] * 0.9;
    let best = null;
    let bestDist = Infinity;
    for (const [tx, ty] of rec.tiles) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (!this.inGrid(nx, ny) || this.isBlockingProp(nx, ny)) continue;
        const d = (nx - aimX) ** 2 + (ny - aimY) ** 2;
        if (d < bestDist) { bestDist = d; best = [nx, ny]; }
      }
    }
    return best;
  }

  // Reserves a random free seat for the patron and sends them toward it.
  // Returns false if there's nowhere to sit.
  // `types`, if given, limits it to those seating types.
  claimSeat(patron, types) {
    let free = this.freeSeats(types);
    if (free.length === 0) return false;
    // High rollers and VIP guests take a VIP booth if one's free; everyone
    // else leans toward the comfier seats.
    if (!types && patron.type && patron.type.vipSeats) {
      const vip = free.filter((f) => VIP_BOOTHS.has(f.rec.type));
      if (vip.length) free = vip;
    }
    const weights = free.map((f) => this.seatComfort(f.rec.type));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    let seat = free[free.length - 1];
    for (let k = 0; k < free.length; k++) { r -= weights[k]; if (r <= 0) { seat = free[k]; break; } }
    seat.rec.seatTaken = seat.rec.seatTaken || [];
    seat.rec.seatTaken[seat.i] = patron;
    patron.seat = seat;
    [patron.targetGx, patron.targetGy] = seat.access;
    patron.path = null;
    return true;
  }

  // A seat's comfort, 1-5 stars: pricier seats are comfier, VIP booths most.
  seatComfort(type) {
    const def = PROP_TYPES[type];
    if (!def || !def.seats) return 0;
    let stars = HAPPINESS.comfortCosts.filter((c) => (def.cost || 0) >= c).length;
    if (VIP_BOOTHS.has(type)) stars += 1;
    return Math.max(1, Math.min(5, stars));
  }

  // How much faster a seated guest cheers up (and how much longer they sit).
  comfortFactor(patron) {
    return patron.seat ? HAPPINESS.comfortFactor[this.seatComfort(patron.seat.rec.type)] || 1 : 1;
  }

  // Every free, reachable seat ({ rec, i, access }), of `types` if given.
  freeSeats(types) {
    const free = [];
    const seen = new Set();
    for (const key in this.placed) {
      const rec = this.placed[key];
      if (seen.has(rec)) continue;
      seen.add(rec);
      const seats = PROP_TYPES[rec.type].seats;
      if (!seats || (types && !types.has(rec.type))) continue;
      seats.forEach((_, i) => {
        if (rec.seatTaken && rec.seatTaken[i]) return;
        const access = this.seatAccessTile(rec, i);
        if (access && !this.patronTileOccupied(access[0], access[1])) free.push({ rec, i, access });
      });
    }
    return free;
  }

  // Reserves one particular free seat ({ rec, i, access }).
  claimSpecificSeat(patron, seat) {
    seat.rec.seatTaken = seat.rec.seatTaken || [];
    seat.rec.seatTaken[seat.i] = patron;
    patron.seat = seat;
    [patron.targetGx, patron.targetGy] = seat.access;
    patron.path = null;
  }

  // Drops a patron's seat reservation (not while seated).
  releaseSeat(patron) {
    const seat = patron.seat;
    if (!seat) return;
    if (seat.rec.seatTaken && seat.rec.seatTaken[seat.i] === patron) seat.rec.seatTaken[seat.i] = null;
    patron.seat = null;
  }

  // The patron has reached their seat's access tile: hop onto the seat.
  sitDown(patron) {
    const { rec, i } = patron.seat;
    const def = PROP_TYPES[rec.type];
    const spot = this.seatSpot(rec, i);
    const { sx, sy } = this.gridToScreen(spot.gx, spot.gy);
    const c = patron.container;
    patron.sitting = true;
    patron.moving = true;
    if (VIP_BOOTHS.has(rec.type)) patron.vipSeated = true; // a celebrity likes that (see celebVisitOver())
    patron.gx = Math.round(spot.gx);
    patron.gy = Math.round(spot.gy);
    // Facing the camera, they sit on top of the cushions (in front of the
    // whole piece); facing away, between its layers so the backrest, which
    // is then the nearer layer (see setPropDepth()), hides them.
    let facingCamera = true;
    if (c.patronSprite) {
      const [fx, fy] = spot.front;
      facingCamera = fx > 0 || fy > 0;
      c.patronDir = facingCamera ? 'front' : 'back';
      c.scaleX = (fx !== 0 ? -1 : 1) * patron.scaleVariance;
    }
    if (def.occluders) {
      // Guests sit on top of the piece, nearer ones over farther ones, and
      // the part of the piece that's in front of their seat (its cut-out,
      // from the piece's depth map) goes over them: a backrest or bench
      // between them and the camera hides them as it naturally would, and
      // nothing behind them does.
      c.setDepth(rec.gameObject.baseDepth + 0.003 + (spot.gx + spot.gy - rec.anchor[0] - rec.anchor[1]) * 0.0001);
      this.addSeatOccluder(patron, rec, i);
    } else {
      // (Pieces rendered before the cut-outs: facing the camera on top,
      // facing away between the layers, behind the backrest.)
      c.setDepth(rec.gameObject.baseDepth + (facingCamera ? 0.003 : 0.001));
    }
    this.propLayer.sort('depth');
    // Some sit and chat (the 3D guests' sittalk; drawn guests just sit).
    this.setPatronAnimation(patron, Math.random() < SIT_TALK_CHANCE ? 'sittalk' : 'sit');
    this.tweens.add({
      targets: c,
      x: sx,
      y: this.patronSeatY(sy, c) - (def.sitLift || 0) * UNIT_HEIGHT_PX,
      duration: 350,
      ease: 'Sine.easeOut',
      onComplete: () => {
        patron.moving = false;
        // Sat down with a drink: stay for the drink; otherwise a while.
        const a = patron.activity;
        patron.nextMoveAt = a && a.kind === 'drink' && a.phase === 'drinking' && a.until > this.time.now
          ? a.until
          : this.time.now + randRange(...VISIT.sitMs) * this.comfortFactor(patron);
      },
    });
  }

  // The cut-out of the piece that's in front of seat i at its facing (see
  // occluders in catalog.js), laid exactly over the piece's picture just
  // above the seated patron.
  addSeatOccluder(patron, rec, i) {
    this.removeSeatOccluder(patron);
    const def = PROP_TYPES[rec.type];
    const off = def.occluders[String(rec.facing)]?.[i];
    const go = rec.gameObject;
    const key = `${def.sprites[0].replace(/_0$/, '')}_occ${i}_${rec.facing}`;
    if (!off || !go || !this.textures.exists(key)) return;
    const k = go.scaleX;
    const left = go.x - go.originX * go.frame.width * k;
    const top = go.y - go.originY * go.frame.height * k;
    const occ = this.add.image(left + off[0] * k, top + off[1] * k, key).setOrigin(0, 0).setScale(k);
    occ.setDepth(patron.container.depth + 0.00001);
    this.propLayer.add(occ);
    patron.seatOccluder = occ;
  }

  removeSeatOccluder(patron) {
    if (patron.seatOccluder) { patron.seatOccluder.destroy(); patron.seatOccluder = null; }
  }

  // Hops a seated patron back down to the access tile (or another open tile
  // beside the piece), then carries on with whatever they do next.
  standUp(patron) {
    const { rec, i } = patron.seat;
    let access = this.seatAccessTile(rec, i);
    if (access && this.patronTileOccupied(access[0], access[1])) access = null;
    if (!access) {
      patron.nextMoveAt = this.time.now + 600; // someone's in the way; try again shortly
      return;
    }
    this.releaseSeat(patron);
    this.removeSeatOccluder(patron);
    patron.sitting = false;
    patron.moving = true;
    patron.gx = access[0];
    patron.gy = access[1];
    const { sx, sy } = this.gridToScreen(access[0], access[1]);
    this.tweens.add({
      targets: patron.container,
      x: sx,
      y: this.patronSeatY(sy, patron.container),
      duration: 350,
      ease: 'Sine.easeIn',
      onComplete: () => {
        patron.moving = false;
        if (patron.gone) return;
        this.setPatronDepth(patron, patron.gx + patron.gy);
        this.movePatronRandomly(patron);
      },
    });
  }

  // A piece is being sold or turned: everyone on it or headed for it gets
  // up (instantly) and finds something else to do.
  releaseSeats(rec) {
    for (const patron of this.patrons) {
      if (!patron.seat || patron.seat.rec !== rec) continue;
      if (patron.sitting) {
        const access = this.seatAccessTile(rec, patron.seat.i) || patron.seat.access;
        this.removeSeatOccluder(patron);
        patron.sitting = false;
        patron.gx = access[0];
        patron.gy = access[1];
        const { sx, sy } = this.gridToScreen(access[0], access[1]);
        this.tweens.killTweensOf(patron.container);
        patron.moving = false;
        patron.container.setPosition(sx, this.patronSeatY(sy, patron.container));
        this.setPatronDepth(patron, patron.gx + patron.gy);
      }
      this.releaseSeat(patron);
      patron.targetGx = undefined;
      patron.path = null;
    }
    rec.seatTaken = [];
  }
}
