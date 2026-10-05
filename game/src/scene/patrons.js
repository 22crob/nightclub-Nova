// ClubScene methods: Patrons: spawning, wandering, animation, tipping and leaving.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { PATRON_META, PATRON_SHEETS } from '../assets.js';
import { FLOOR_DECAL_PROPS, PROP_TYPES, STAFF_TYPES } from '../catalog.js';
import { BOOST, CHARACTER_DISPLAY_HEIGHT, HAIR_STYLES, PATRON_HAIR_COLORS, PATRON_MOVE_INTERVAL, PATRON_OUTFIT_COLORS, PATRON_POPUP_Y, PATRON_SKIN_TONES, PATRON_SPAWN_INTERVAL, MONEY, PATRON_TIP_INTERVAL, PATRON_Y_OFFSET, PROP_SCALE, VISIT } from '../config.js';
import { SFX } from '../sfx.js';
import { MOOD } from './mood.js';
import { randRange } from '../util.js';

export class PatronsMixin {
  // True once the chibi patron spritesheets have loaded; otherwise patrons
  // fall back to the plain primitive token instead of a broken image.
  hasCharacterSprites() {
    return PATRON_SHEETS.length > 0 && this.textures.exists('patron_0');
  }

  // Animation key for a patron's character, clip and facing.
  patronAnimKey(container, clip) {
    return `patron_${container.patronCharacter}_${clip}_${container.patronDir}`;
  }

  // ---------------------------------------------------------------------
  // Patron system
  // ---------------------------------------------------------------------

  scheduleNextPatronSpawn() {
    this.time.delayedCall(randRange(...PATRON_SPAWN_INTERVAL) * this.spawnDelayFactor(), () => {
      // Someone walks up to the line outside: now and then a celebrity.
      this.streetArrival(false, this.celebDropIn());
      this.scheduleNextPatronSpawn();
    });
  }

  // True if any current (non-departing) patron already occupies this tile
  // — checked before both spawning and choosing a wander destination so
  // two patrons never target the same tile.
  patronTileOccupied(gx, gy) {
    return this.patrons.some((p) => !p.leaving && p.gx === gx && p.gy === gy);
  }

  // Brings a patron in at the door (`character`: their look, from the line
  // outside; `info`: { partyGuest } for a party guest, { celeb } for a
  // celebrity).
  trySpawnPatron(character, info) {
    if (!this.doorsOpen()) return; // last call or closed
    if (this.patrons.length >= this.patronCapacity()) return;
    const { gx, gy } = this.doorTile();
    if (this.isBlockingProp(gx, gy)) return; // door tile has a blocking prop on it — skip this attempt
    if (this.patronTileOccupied(gx, gy)) return; // someone's already standing right there

    const { sx, sy } = this.gridToScreen(gx, gy);
    // Slight per-patron size variety (+/-5%) so a crowd doesn't read as
    // identical cutouts. Stored on the patron (not just baked into the
    // container's scale) because faceToward() below has to re-apply
    // it every time it flips the container to face left/right.
    const scaleVariance = 0.95 + Math.random() * 0.1;
    const container = this.drawPatronSprite(sx, sy, scaleVariance, character);
    // Patrons share the props' layer and draw order (see setPropDepth()), so
    // they can walk behind a bar or in front of it. Tip popups stay on
    // patronLayer, above everything.
    this.propLayer.add(container);

    const now = this.time.now;
    const patron = {
      gx, gy,
      container,
      scaleVariance,
      spawnedAt: now,
      nextMoveAt: now + randRange(...PATRON_MOVE_INTERVAL),
      nextTipAt: now + randRange(...PATRON_TIP_INTERVAL),
      thirstyAt: now + randRange(3000, 18000), // most patrons want a drink soon after arriving, not all at once
      name: this.guestName(),
      spent: 0,
      mood: MOOD.start,
      fun: MOOD.startFun,
      thirstSince: null,
      moving: false,
      leaving: false,
    };
    this.startVisit(patron); // their visit length and personality (see activities.js)
    this.patrons.push(patron);
    if (info && info.partyGuest) this.notePartyGuest(patron); // came for the party
    if (info && info.celeb) this.welcomeCelebrity(patron, info.celeb); // a celebrity dropping in
    this.chargeCover(patron);
    this.setPatronDepth(patron, gx + gy);
    this.updateUI(); // refresh the patrons-on-floor readout right away, not on the next tip/tick

    // Small idle bob so a patron standing still doesn't read as frozen —
    // only for the fallback primitive token. The real character sprite
    // already has its own walk/dance/idle motion, and bobbing its
    // container would fight with the precise floor-contact anchor the
    // sprite's origin gives us for no benefit.
    if (!this.hasCharacterSprites()) {
      this.tweens.add({
        targets: container,
        y: container.y - 4 * PROP_SCALE,
        duration: 500 + Math.random() * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // Picks the real character sprite when it loaded, else the old
  // colored-primitive token.
  drawPatronSprite(sx, sy, scaleVariance, character) {
    if (this.hasCharacterSprites()) {
      return this.drawPatronCharacterSprite(sx, sy, scaleVariance, character);
    }
    return this.drawPatronFallbackToken(sx, sy, scaleVariance);
  }

  // A random chibi character (see assets.js) with a drop shadow. The
  // sprite's origin is the point between its feet, calculated by the render
  // script, so it stands exactly on the tile's screen point. The figure is
  // scaled so a standing character is 90% of CHARACTER_DISPLAY_HEIGHT tall
  // (head to feet), the proportion the game was tuned with. Starts idle,
  // facing front.
  drawPatronCharacterSprite(sx, sy, scaleVariance, character) {
    const container = this.add.container(sx, sy);
    const shadow = this.add.ellipse(0, 2 * PROP_SCALE, 30 * PROP_SCALE, 12 * PROP_SCALE, 0x000000, 0.3);
    // Patrons never wear a staff member's character, so staff stand out.
    const staffLooks = new Set(Object.values(STAFF_TYPES).map((t) => t.character % PATRON_SHEETS.length));
    const choices = PATRON_SHEETS.map((_, i) => i).filter((i) => !staffLooks.has(i));
    container.patronCharacter = character ?? Phaser.Utils.Array.GetRandom(choices.length ? choices : [0]);
    container.patronDir = 'front';
    const sprite = this.add.sprite(0, 0, `patron_${container.patronCharacter}`);
    sprite.setOrigin(PATRON_META.originX, PATRON_META.originY);
    sprite.setScale((CHARACTER_DISPLAY_HEIGHT * 0.9) / PATRON_META.standingHeight);
    container.add([shadow, sprite]);
    container.setScale(scaleVariance);
    container.patronSprite = sprite;
    container.patronAnimState = null;
    sprite.play(this.patronAnimKey(container, 'idle'));
    container.patronAnimState = 'idle_front';
    return container;
  }

  // Builds one patron's on-screen body: a drop shadow, an oval torso (the
  // outfit), a round head (the skin tone), and optionally a hair shape on
  // top — all simple primitives, same stand-in approach as the colored-box
  // props, but each patron rolls its own skin/outfit/hair independently so
  // a full floor reads as a crowd rather than repeating color-coded tokens.
  // The face dot is the only asymmetric detail on this token — everything
  // else is left/right symmetric, so it's what actually reads as a facing
  // direction once the container gets horizontally flipped in
  // movePatronRandomly() (via faceToward(), which also re-applies
  // scaleVariance so a flip doesn't undo this patron's size roll).
  // Used only as a fallback when the real character sprites (see
  // drawPatronCharacterSprite()) failed to load.
  drawPatronFallbackToken(sx, sy, scaleVariance) {
    const skin = Phaser.Utils.Array.GetRandom(PATRON_SKIN_TONES);
    const outfit = Phaser.Utils.Array.GetRandom(PATRON_OUTFIT_COLORS);
    const hairStyle = Phaser.Utils.Array.GetRandom(HAIR_STYLES);
    const hairColor = Phaser.Utils.Array.GetRandom(PATRON_HAIR_COLORS);

    const container = this.add.container(sx, sy - PATRON_Y_OFFSET);
    const shadow = this.add.ellipse(0, 9 * PROP_SCALE, 22 * PROP_SCALE, 9 * PROP_SCALE, 0x000000, 0.35);
    const body = this.add.ellipse(0, 0, 16 * PROP_SCALE, 20 * PROP_SCALE, outfit, 1).setStrokeStyle(1.5, 0x0a0612, 0.9);
    const head = this.add.ellipse(0, -14 * PROP_SCALE, 12 * PROP_SCALE, 12 * PROP_SCALE, skin, 1).setStrokeStyle(1.5, 0x0a0612, 0.9);
    const face = this.add.ellipse(4 * PROP_SCALE, -14 * PROP_SCALE, 4 * PROP_SCALE, 4 * PROP_SCALE, 0xffffff, 0.9);
    container.add([shadow, body, head, face]);
    if (hairStyle !== 'none') {
      container.add(this.drawPatronHair(hairStyle, hairColor));
    }
    container.setScale(scaleVariance);
    return container;
  }

  // One of a few simple hair silhouettes sitting just above the head
  // ellipse, built from the same primitives as the rest of the token (no
  // new art assets) so a bald result and a full head of hair cost the same.
  drawPatronHair(style, color) {
    const headTop = -14 * PROP_SCALE;
    if (style === 'short') {
      return this.add.ellipse(0, headTop - 4 * PROP_SCALE, 12 * PROP_SCALE, 7 * PROP_SCALE, color, 1);
    }
    if (style === 'tall') {
      return this.add.ellipse(0, headTop - 7 * PROP_SCALE, 10 * PROP_SCALE, 11 * PROP_SCALE, color, 1);
    }
    // 'long' — hair that spills out past the sides of the head.
    return this.add.ellipse(0, headTop - 2 * PROP_SCALE, 16 * PROP_SCALE, 9 * PROP_SCALE, color, 1);
  }

  // Plays a patron's 'walk', 'dance' or 'idle' clip in its current facing
  // (see faceToward()). A no-op for the fallback primitive token, which has
  // no patronSprite, and when that clip and facing are already playing.
  setPatronAnimation(patron, state) {
    const container = patron.container;
    const sprite = container.patronSprite;
    if (!sprite) return;
    const key = `${state}_${container.patronDir}`;
    if (container.patronAnimState === key) return;
    container.patronAnimState = key;
    sprite.play(this.patronAnimKey(container, state));
    if (this.energize) this.energize(patron); // dancing faster during a Bass Boost
  }

  // True if the given tile has one of the actual dance-floor prop types on
  // it (same set used to render flat ground decals) — plain empty floor or
  // furniture tiles don't count, only the tiles meant for dancing.
  isDanceFloorTile(gx, gy) {
    const rec = this.placed[`${gx},${gy}`];
    return !!rec && FLOOR_DECAL_PROPS.has(rec.type);
  }

  // Runs every 400ms for every active patron: advance departures, pick a
  // new wander step when it's time, and collect tips on schedule.
  tickPatrons() {
    const now = this.time.now;
    this.tickSecurity(); // arguments and the guard (see security.js)
    this.tickBars(); // bartenders serving, impatient customers (bars.js)
    this.tickBonuses(); // high fives and fist bumps (bonuses.js)
    for (let i = this.patrons.length - 1; i >= 0; i--) {
      const patron = this.patrons[i];
      if (patron.gone) continue;
      if (patron.leaving) {
        // Normal progress toward the door is chained directly through
        // movePatronRandomly()'s own onComplete, not this tick — this only
        // catches a departure that got boxed in for a moment and needs a
        // retry (see the options.length === 0 branch there).
        if (!patron.moving && now >= patron.nextMoveAt) this.movePatronRandomly(patron);
        continue;
      }

      this.updatePatronMood(patron, (now - (patron.lastTickAt || now)) / 1000);
      patron.lastTickAt = now;
      if (patron.leaving) continue; // stormed out just now
      // Guests leave when their visit is over, once they've finished what
      // they're doing (see chooseActivity()); this only catches someone
      // stuck well past it.
      if (now >= patron.despawnAt + VISIT.overstayMs && !patron.queue) {
        this.startPatronDeparture(patron);
        continue;
      }
      this.tickActivity(patron);
      if (!patron.moving && now >= patron.nextMoveAt) {
        this.movePatronRandomly(patron);
      }
      // Dancers tip now and then; nobody else pays just for standing around.
      const dancing = typeof patron.container.patronAnimState === 'string' && patron.container.patronAnimState.startsWith('dance');
      if (!dancing) {
        patron.nextTipAt = Math.max(patron.nextTipAt, now + 4000);
      } else if (now >= patron.nextTipAt) {
        this.collectPatronTip(patron);
        patron.nextTipAt = now + randRange(...PATRON_TIP_INTERVAL) / this.boostFactor();
      }
    }
  }

  // Turns a patron toward a screen point. Every grid step is one of the
  // four diagonals: moving down-screen shows the character's front, moving
  // up-screen its back. The sprites face down-left (front) and up-right
  // (back); the container is mirrored for the other two diagonals. The
  // target is compared with the container's current position, before the
  // move's tween starts.
  faceToward(patron, targetX, targetY) {
    const c = patron.container;
    const right = targetX >= c.x;
    const front = targetY >= c.y;
    if (c.patronSprite) {
      c.patronDir = front ? 'front' : 'back';
      c.scaleX = (front === right ? -1 : 1) * patron.scaleVariance;
    } else {
      c.scaleX = (right ? 1 : -1) * patron.scaleVariance; // fallback token faces right by default
    }
    this.unflipBubble(c);
  }

  // Turns a patron to face the camera, keeping left/right as it was: for
  // dancing and standing around once they arrive somewhere.
  faceFront(patron) {
    const c = patron.container;
    if (!c.patronSprite || c.patronDir === 'front') return;
    c.patronDir = 'front';
    c.scaleX = -c.scaleX;
    this.unflipBubble(c);
  }

  // Picks a far-off open (prop-free) tile anywhere on the current grid for
  // the patron to roam toward. Tries a handful of random samples first
  // (cheap, and biased toward "somewhere else on the floor" since the grid
  // is mostly open); falls back to scanning every tile if the grid is
  // dense with props, and finally just stays put if genuinely nothing else
  // is open.
  // True only for props that physically block a tile — a bar counter, a
  // table, the DJ booth. Floor decals (dance tiles, neon floor) are placed
  // records too but are meant to be walked on, not around, so they don't
  // count as blocking.
  isBlockingProp(gx, gy) {
    const rec = this.placed[`${gx},${gy}`];
    if (!rec) return false;
    return !FLOOR_DECAL_PROPS.has(rec.type);
  }

  // Finds a walkable tile actually worth heading toward: a dance floor
  // tile, a bar's customer side (to order a drink; staffed bars are twice
  // as likely), or the open tile next to a booth. Returns null if nothing
  // like that is placed yet, so callers can fall back to plain wandering.
  pickPointOfInterestTile() {
    let danceTiles = [];
    let hangoutTiles = [];
    // Walk this.placed by KEY (one entry per occupied grid tile) rather
    // than deduping by record identity — every key already names one real
    // tile, which is exactly the granularity a dance-floor or bar/booth
    // neighbor search needs, and it works whether or not a record carries
    // its own .tiles list (test fixtures often don't).
    for (const key in this.placed) {
      const rec = this.placed[key];
      const def = PROP_TYPES[rec.type];
      if (!def) continue;
      const [tx, ty] = key.split(',').map(Number);
      if (FLOOR_DECAL_PROPS.has(rec.type)) {
        danceTiles.push([tx, ty]);
      } else if (def.category === 'DJ Booths') {
        if (rec.tiles && rec.tiles.some((t) => t.back && t[0] === tx && t[1] === ty)) continue; // not round the DJ's side
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (this.inGrid(nx, ny) && !this.isBlockingProp(nx, ny)) {
            hangoutTiles.push([nx, ny]);
          }
        }
      }
    }
    // The dance floor is the big draw while music plays (going for a drink
    // is handled by the bar lines, see pickRoamTarget()); otherwise hang out
    // by the DJ booth.
    // Nobody hangs about in a bar line unless they're queueing.
    const lines = this.barLineTiles();
    const free = (t) => !lines.has(`${t[0]},${t[1]}`);
    danceTiles = danceTiles.filter(free);
    hangoutTiles = hangoutTiles.filter(free);
    const music = this.musicPlaying();
    const pick = Phaser.Utils.Array.GetRandom;
    const roll = Math.random();
    if (this.isBoosted() && danceTiles.length > 0 && roll < BOOST.danceChance) return pick(danceTiles); // bass drop: everyone dances
    if (danceTiles.length > 0 && music && roll < 0.75) return pick(danceTiles);
    if (hangoutTiles.length > 0) return pick(hangoutTiles);
    if (danceTiles.length > 0) return pick(danceTiles);
    return null;
  }

  // Gives a patron somewhere to go: their place in a bar line, the next
  // step of what they're doing, or their next activity (see activities.js).
  pickRoamTarget(patron) {
    // In line at a bar: stay in line.
    if (patron.queue) { this.updateQueueTarget(patron); if (patron.queue) return; }
    if (!patron.sitting) this.releaseSeat(patron); // a new plan replaces any seat they were headed for
    this.nextActivityStep(patron);
  }

  // Picks an open neighboring tile (on-grid, no prop, no other patron
  // already headed there) and tweens the patron to it. Rather than a pure
  // random walk (which statistically keeps a patron clustered near its
  // spawn point — displacement only grows as sqrt(steps)), each patron
  // roams toward a standing target tile picked with pickRoamTarget(),
  // greedily choosing whichever legal neighbor cuts the Manhattan distance
  // to that target the most, re-targeting once it arrives. The target
  // tile is claimed on patron.gx/gy the moment the tween STARTS, not when
  // it finishes, so a second patron's move check the same tick can't also
  // pick it.
  movePatronRandomly(patron) {
    // A hop is already animating this patron's container — never start a
    // second tween on top of it. Every legitimate chaining call already
    // sets patron.moving = false as the first thing its tween's onComplete
    // does, before calling back in here, so this only ever actually blocks
    // a call while a hop is genuinely still in flight (e.g. a patron's
    // lifetime expiring mid-hop used to fire this via
    // startPatronDeparture() while the previous hop's tween hadn't finished
    // yet, stacking two competing tweens on the same container's x/y).
    if (patron.moving || patron.gone) return;
    if (patron.sitting) { this.standUp(patron); return; }

    // A leaving patron already has its target pinned to the door by
    // startPatronDeparture() — never let this pick it a fresh roam target
    // instead, or it would wander off rather than actually heading out.
    if (!patron.leaving && (patron.targetGx === undefined ||
        (patron.gx === patron.targetGx && patron.gy === patron.targetGy))) {
      this.pickRoamTarget(patron);
      if (patron.leaving || patron.gone || patron.moving) return;
      // The next activity is right here (a chat partner waiting, a seat
      // beside them): start it without walking.
      if (patron.gx === patron.targetGx && patron.gy === patron.targetGy) { this.arriveForActivity(patron); return; }
    }

    // Someone else already parked on this patron's target tile — a popular
    // single hangout spot (the one tile next to the club's only bar, say)
    // can easily draw more than one patron's pick at once. Without this,
    // the patron would greedily close the distance down to 1 tile away and
    // then just sit there forever: "arrived" only fires on the exact target
    // tile, which is now permanently unreachable, so pickRoamTarget() would
    // never run again. Re-target (a few tries, in case the fresh pick is
    // ALSO occupied) instead of camping next to someone else's spot.
    if (!patron.leaving && patron.targetGx !== undefined &&
        !(patron.gx === patron.targetGx && patron.gy === patron.targetGy)) {
      let guard = 0;
      while (this.patronTileOccupied(patron.targetGx, patron.targetGy) && guard < 5) {
        this.pickRoamTarget(patron);
        guard++;
      }
    }

    // Follow a route around furniture to the target (see findPath()). The
    // route is recomputed whenever the target changes or the next step is
    // blocked; another patron standing on the next step just means waiting
    // a moment.
    const targetKey = `${patron.targetGx},${patron.targetGy}`;
    if (patron.pathTarget !== targetKey || !patron.path || patron.path.length === 0) {
      patron.path = this.findPath(patron.gx, patron.gy, patron.targetGx, patron.targetGy);
      patron.pathTarget = targetKey;
    }
    let step = patron.path && patron.path[0];
    if (step && this.isBlockingProp(step[0], step[1])) {
      patron.path = this.findPath(patron.gx, patron.gy, patron.targetGx, patron.targetGy);
      step = patron.path && patron.path[0];
    }
    if (!step) {
      // Already in their place in line (nothing left to walk).
      if (patron.queue && patron.gx === patron.targetGx && patron.gy === patron.targetGy) { this.waitInLine(patron); return; }
      // No route (walled in by furniture): pick somewhere else, or leave
      // from here if heading for the door.
      if (patron.leaving) { this.finalizeDeparture(patron); return; }
      this.pickRoamTarget(patron);
      patron.path = null;
      patron.nextMoveAt = this.time.now + 400;
      return;
    }
    if (this.patronTileOccupied(step[0], step[1])) {
      // Someone's in the way: walk around them if there's another route.
      const around = this.findPath(patron.gx, patron.gy, patron.targetGx, patron.targetGy, true);
      if (around && around.length && !this.patronTileOccupied(around[0][0], around[0][1])) {
        patron.path = around;
        step = around[0];
      }
    }
    // Still blocked: after a few tries, squeeze past them, like people do in
    // a crowd. Nobody squeezes past someone in a bar line while queueing
    // themselves, though: the line keeps its order.
    const blocker = this.patrons.find((p) => p !== patron && !p.leaving && !p.gone && p.gx === step[0] && p.gy === step[1]);
    const squeezePast = blocker && (patron.waits || 0) >= 3 && !(patron.queue && blocker.queue);
    if (blocker && !squeezePast) {
      patron.nextMoveAt = this.time.now + 300 + Math.random() * 400;
      patron.waits = (patron.waits || 0) + 1;
      // Stuck behind someone: find another way, unless it's just the line
      // at the bar, which is worth waiting in.
      if (patron.waits > 6 && !patron.leaving && !patron.queue) { this.pickRoamTarget(patron); patron.path = null; patron.waits = 0; }
      // Even a line isn't worth being stuck in forever (giving up on a
      // slow bar is checkBarPatience()).
      if (patron.waits > 60 && patron.queue) { this.leaveBarQueue(patron); this.pickRoamTarget(patron); patron.waits = 0; }
      return;
    }
    patron.waits = 0;
    patron.path.shift();
    const [tx, ty] = step;
    patron.moving = true;
    const fromNearness = patron.gx + patron.gy;
    patron.gx = tx;
    patron.gy = ty;
    this.setPatronDepth(patron, Math.max(fromNearness, tx + ty));
    const { sx, sy } = this.gridToScreen(tx, ty);
    this.faceToward(patron, sx, this.patronSeatY(sy, patron.container));
    this.setPatronAnimation(patron, 'walk');
    this.tweens.add({
      targets: patron.container,
      x: sx,
      y: this.patronSeatY(sy, patron.container),
      duration: 490 + Math.random() * 190, // a tile is 48 px: about the old walking speed
      ease: 'Linear', // constant speed so back-to-back hops below read as one
                       // continuous glide across the floor, not a series of
                       // little decelerate-then-reaccelerate steps
      onComplete: () => {
        patron.moving = false;
        if (patron.gone) return;
        this.setPatronDepth(patron, patron.gx + patron.gy);
        const arrived = patron.gx === patron.targetGx && patron.gy === patron.targetGy;
        if (patron.leaving) {
          patron.departureHops = (patron.departureHops || 0) + 1;
          // The hop cap is a safety valve for the rare case where the exact
          // door tile stays occupied the whole time (rather than circling
          // forever waiting for it to clear, just leave from right there) —
          // NOT meant to cut off a legitimately long walk. It has to scale
          // with the club's current floor size: the longest possible walk
          // to the door is gridW+gridH-2 hops (opposite corner, on the
          // BASE 10x10 floor that's 18), and a maxed-out expanded club
          // (18x18) needs up to 34. A fixed cap of 20 used to make patrons
          // on the far side of an expanded club simply vanish mid-walk,
          // nowhere near the door yet — a real, visible bug, not just an
          // edge case.
          const maxDepartureHops = this.gridW + this.gridH - 2 + 10;
          if (arrived || patron.departureHops > maxDepartureHops) {
            // Actually reached the door on foot — now it can vanish.
            this.finalizeDeparture(patron);
          } else {
            // Still walking out — keep chaining toward the door exactly
            // like a normal roam journey, just without ever picking a new
            // target once it arrives.
            this.movePatronRandomly(patron);
          }
          return;
        }
        if (arrived) {
          // Reached the spot: start (or carry on with) their activity.
          this.arriveForActivity(patron);
        } else {
          // Still mid-journey toward its target — chain directly into the
          // next hop's tween right here instead of just flagging it ready
          // and waiting for tickPatrons' next 400ms pass to notice. That
          // wait was small but showed up as a visible hitch/stutter at
          // every tile boundary; calling straight through removes the gap
          // entirely so multi-tile roaming reads as one smooth walk.
          this.setPatronAnimation(patron, 'walk');
          this.movePatronRandomly(patron);
        }
      },
    });
  }

  // Shortest walkable route from (fx, fy) to (tx, ty) as a list of steps
  // (not including the start), going around blocking furniture. Plain
  // breadth-first search: the grid is at most 20x20. Null if unreachable.
  findPath(fx, fy, tx, ty, avoidPatrons = false) {
    if (fx === tx && fy === ty) return [];
    // Optionally treat tiles other patrons are standing on as blocked, to
    // find a way around a crowd (see movePatronRandomly()).
    const crowd = new Set();
    if (avoidPatrons) {
      for (const p of this.patrons) if (!p.leaving && !p.gone && !(p.gx === fx && p.gy === fy)) crowd.add(`${p.gx},${p.gy}`);
    }
    const prev = new Map();
    const key = (x, y) => y * this.gridW + x;
    const queue = [[fx, fy]];
    prev.set(key(fx, fy), null);
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.inGrid(nx, ny)) continue;
        const k = key(nx, ny);
        if (prev.has(k)) continue;
        if ((this.isBlockingProp(nx, ny) || crowd.has(`${nx},${ny}`)) && !(nx === tx && ny === ty)) continue;
        prev.set(k, [x, y]);
        if (nx === tx && ny === ty) {
          const path = [];
          let cur = [nx, ny];
          while (cur && !(cur[0] === fx && cur[1] === fy)) {
            path.unshift(cur);
            cur = prev.get(key(cur[0], cur[1]));
          }
          return this.isBlockingProp(tx, ty) ? path.slice(0, -1) : path;
        }
        queue.push([nx, ny]);
      }
    }
    return null;
  }

  // The real character sprite is anchored via its own calibrated origin
  // (see drawPatronCharacterSprite()), so its container sits right at the
  // tile's screen point; the fallback primitive token still needs the
  // hand-tuned PATRON_Y_OFFSET fudge factor. Movement/departure tweens
  // both target whichever one applies through this helper so neither
  // patron kind "sinks" or "floats" relative to its tile mid-animation.
  patronSeatY(sy, container) {
    return container.patronSprite ? sy : sy - PATRON_Y_OFFSET;
  }

  // True if the patron is somewhere lively: at a staffed bar's customer
  // side, or next to a working attraction (a DJ booth with a DJ, a dance
  // floor while music plays, or anything else that earns fans). Patrons
  // linger longer and tip more there.
  isNearRevenueProp(gx, gy) {
    const bar = this.barServingTile(gx, gy);
    if (bar && this.isWorked(bar)) return true;
    const music = this.musicPlaying();
    const cells = [[gx, gy], [gx + 1, gy], [gx - 1, gy], [gx, gy + 1], [gx, gy - 1]];
    return cells.some(([tx, ty]) => {
      const rec = this.placed[`${tx},${ty}`];
      if (!rec) return false;
      const def = PROP_TYPES[rec.type];
      if (!def.fanRate) return false;
      if (def.staff && !this.isWorked(rec)) return false;
      if (FLOOR_DECAL_PROPS.has(rec.type) && !music) return false;
      return true;
    });
  }

  // How much a tip of `base` dollars becomes: happier guests, a boost, a
  // party, a fancier club and VIPs all tip more.
  tipAmount(patron, base) {
    const moodFactor = 0.5 + patron.mood / 100; // unhappy guests tip half, happy ones up to 1.5x
    const boost = this.isBoosted() ? BOOST.tipMultiplier : 1;
    return Math.max(1, Math.round(base * moodFactor * boost * this.partyEffect('tips', 1) * this.luxuryTipFactor() * this.celebTipFactor(patron)));
  }

  // A dancer's tip, now and then (see tickPatrons()).
  collectPatronTip(patron) {
    const amount = this.tipAmount(patron, randRange(...MONEY.danceTip));
    this.cash += amount;
    this.noteIncome('tips', amount);
    patron.spent = (patron.spent || 0) + amount;
    this.fans += 0.3;
    SFX.tip();
    this.updateUI();
    this.floatText(patron.container.x, patron.container.y - PATRON_POPUP_Y, `$${amount} Tip`, '#ffe27a');
  }

  // The cover charge, once, as a guest comes in.
  chargeCover(patron) {
    const amount = MONEY.cover;
    this.cash += amount;
    this.noteIncome('cover', amount);
    patron.spent = (patron.spent || 0) + amount;
    this.updateUI();
    this.floatText(patron.container.x, patron.container.y - PATRON_POPUP_Y, `$${amount} Cover`, '#7dffc4');
  }

  // Sends a patron walking back to the door tile, on foot, tile by tile,
  // the same way it walks anywhere else on the floor — not a single
  // straight-line dash across the room. Pins its roam target to the door
  // and hands it to the normal movePatronRandomly() chain; that function's
  // onComplete checks patron.leaving and routes the final arrival to
  // finalizeDeparture() below instead of picking a fresh destination.
  startPatronDeparture(patron) {
    if (patron.leaving) return; // already on its way out
    patron.leaving = true;
    this.endChat(patron);
    this.leaveBarQueue(patron);
    patron.targetGx = this.doorTile().gx;
    patron.targetGy = this.doorTile().gy;
    patron.path = null;
    if (patron.sitting) {
      // Get up first; standUp() carries on toward the door.
      if (!patron.moving) this.standUp(patron);
      return;
    }
    this.releaseSeat(patron);
    // A patron's lifetime (despawnAt) is checked on a plain wall-clock timer
    // (see tickPatrons()), completely independent of whatever hop it might
    // already be mid-animation on — so this can fire while patron.moving is
    // still true. It used to force patron.moving back to false right here
    // and immediately start walking toward the door, which stacked a SECOND
    // tween on the same container's x/y right on top of the one already
    // running — a real Phaser footgun (both tweens then fight over the
    // container's position, and the earlier one's onComplete firing later
    // could even trigger a duplicate finalizeDeparture()). Leaving
    // patron.moving untouched and only acting immediately when nothing is
    // actually in flight avoids that: if a hop IS in flight, its own
    // onComplete (which checks patron.leaving fresh every time) picks up
    // the now-correct door target the moment that hop genuinely finishes.
    if (patron.moving) return;
    if (patron.gx === patron.targetGx && patron.gy === patron.targetGy) {
      this.finalizeDeparture(patron); // already standing right on the door
      return;
    }
    this.movePatronRandomly(patron);
  }

  // The patron has actually walked to the door tile — fade it out in place
  // and drop it from the active list.
  // Puts a patron in the shared prop draw order at the given tile nearness
  // (gx + gy). While walking, the caller passes the nearer of the two tiles,
  // so a patron stepping toward the camera doesn't pass under props in front
  // of its old tile. The small bias draws a patron over a prop of equal
  // nearness, such as the bar tile they are standing beside.
  setPatronDepth(patron, nearness) {
    patron.container.setDepth(nearness + 0.01);
    this.propLayer.sort('depth');
  }

  finalizeDeparture(patron) {
    if (patron.gone) return;
    this.endChat(patron);
    this.endDanceTogether(patron);
    this.releaseSeat(patron);
    this.leaveBarQueue(patron);
    this.patronLeaves(patron);
    this.streetLeaver(patron.container.patronCharacter); // walks off down the street outside
    // From here the patron is fading out at the door: nothing may move or
    // animate it again (its container is destroyed when the fade ends).
    patron.gone = true;
    this.tweens.add({
      targets: patron.container,
      alpha: 0,
      duration: 400,
      ease: 'Sine.easeIn',
      onComplete: () => {
        patron.container.destroy();
        const idx = this.patrons.indexOf(patron);
        if (idx !== -1) this.patrons.splice(idx, 1);
        this.updateUI(); // refresh the patrons-on-floor readout right away
      },
    });
  }
}
