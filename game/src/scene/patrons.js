// ClubScene methods: Patrons: spawning, wandering, animation, tipping and leaving.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { CHARACTER_ANIM_INFO } from '../assets.js';
import { FLOOR_DECAL_PROPS, PROP_TYPES } from '../catalog.js';
import { CHARACTER_DISPLAY_HEIGHT, HAIR_STYLES, PATRON_HAIR_COLORS, PATRON_LIFETIME, PATRON_MOVE_INTERVAL, PATRON_OUTFIT_COLORS, PATRON_POI_LINGER, PATRON_POPUP_Y, PATRON_SKIN_TONES, PATRON_SPAWN_INTERVAL, PATRON_SPAWN_TILE, PATRON_TIP_INTERVAL, PATRON_Y_OFFSET, PROP_SCALE } from '../config.js';
import { SFX } from '../sfx.js';
import { randRange } from '../util.js';

export class PatronsMixin {
  // True only if both patron animation spritesheets actually loaded —
  // same fallback reasoning as hasAnySprite() above, so a failed load
  // drops back to the plain colored-primitive patron token instead of a
  // broken-image sprite.
  hasCharacterSprites() {
    return this.textures.exists('patron_walk') && this.textures.exists('patron_dance');
  }

  // ---------------------------------------------------------------------
  // Patron system
  // ---------------------------------------------------------------------

  scheduleNextPatronSpawn() {
    this.time.delayedCall(randRange(...PATRON_SPAWN_INTERVAL), () => {
      this.trySpawnPatron();
      this.scheduleNextPatronSpawn();
    });
  }

  // True if any current (non-departing) patron already occupies this tile
  // — checked before both spawning and choosing a wander destination so
  // two patrons never target the same tile.
  patronTileOccupied(gx, gy) {
    return this.patrons.some((p) => !p.leaving && p.gx === gx && p.gy === gy);
  }

  trySpawnPatron() {
    if (this.patrons.length >= this.patronCapacity()) return;
    const { gx, gy } = PATRON_SPAWN_TILE;
    if (this.isBlockingProp(gx, gy)) return; // door tile has a blocking prop on it — skip this attempt
    if (this.patronTileOccupied(gx, gy)) return; // someone's already standing right there

    const { sx, sy } = this.gridToScreen(gx, gy);
    // Small per-patron size variety (+/-15%) so bodies don't all read as
    // identical cutouts. Stored on the patron (not just baked into the
    // container's scale) because faceTowardScreenX() below has to re-apply
    // it every time it flips the container to face left/right.
    const scaleVariance = 0.9 + Math.random() * 0.25;
    const container = this.drawPatronSprite(sx, sy, scaleVariance);
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
      despawnAt: now + randRange(...PATRON_LIFETIME),
      nextMoveAt: now + randRange(...PATRON_MOVE_INTERVAL),
      nextTipAt: now + randRange(...PATRON_TIP_INTERVAL),
      moving: false,
      leaving: false,
    };
    this.patrons.push(patron);
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
  drawPatronSprite(sx, sy, scaleVariance) {
    if (this.hasCharacterSprites()) {
      return this.drawPatronCharacterSprite(sx, sy, scaleVariance);
    }
    return this.drawPatronFallbackToken(sx, sy, scaleVariance);
  }

  // Real character sprite (see assets.js / the Character
  // Art Pipeline doc) — a drop shadow plus one animated sprite. The sprite
  // uses the walk clip's own calibrated floor-contact origin (originX/Y),
  // so its feet land exactly on the tile's screen point with no manual
  // offset needed — unlike the fallback token below, which needs
  // PATRON_Y_OFFSET as a hand-tuned fudge factor. Starts in the 'idle'
  // state (see setPatronAnimation()); the first wander move kicks off
  // walking.
  drawPatronCharacterSprite(sx, sy, scaleVariance) {
    const container = this.add.container(sx, sy);
    const shadow = this.add.ellipse(0, 2 * PROP_SCALE, 22 * PROP_SCALE, 9 * PROP_SCALE, 0x000000, 0.35);
    const info = CHARACTER_ANIM_INFO.walk;
    const sprite = this.add.sprite(0, 0, 'patron_walk', 0);
    sprite.setOrigin(info.originX, info.originY);
    sprite.setScale(CHARACTER_DISPLAY_HEIGHT / info.frameHeight);
    container.add([shadow, sprite]);
    container.setScale(scaleVariance);
    container.patronSprite = sprite;
    container.patronAnimState = 'idle';
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
  // movePatronRandomly() (via faceTowardScreenX(), which also re-applies
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

  // Switches a patron's character sprite between its three visual states:
  // 'walk' (wandering between tiles), 'dance' (parked on a dance-floor
  // tile), and 'idle' (parked anywhere else) — a no-op for the fallback
  // primitive token, which has no patronSprite. Guards on the state
  // actually changing so this can be called every tick without
  // restarting an already-playing animation.
  setPatronAnimation(patron, state) {
    const container = patron.container;
    const sprite = container.patronSprite;
    if (!sprite || container.patronAnimState === state) return;
    container.patronAnimState = state;
    if (state === 'idle') {
      const info = CHARACTER_ANIM_INFO.walk;
      if (sprite.texture.key !== 'patron_walk') sprite.setTexture('patron_walk');
      sprite.setOrigin(info.originX, info.originY);
      sprite.anims.stop();
      sprite.setFrame(0);
      return;
    }
    const info = CHARACTER_ANIM_INFO[state];
    sprite.setTexture(`patron_${state}`);
    sprite.setOrigin(info.originX, info.originY);
    sprite.play(`patron-${state}`);
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
    for (let i = this.patrons.length - 1; i >= 0; i--) {
      const patron = this.patrons[i];
      if (patron.leaving) {
        // Normal progress toward the door is chained directly through
        // movePatronRandomly()'s own onComplete, not this tick — this only
        // catches a departure that got boxed in for a moment and needs a
        // retry (see the options.length === 0 branch there).
        if (!patron.moving && now >= patron.nextMoveAt) this.movePatronRandomly(patron);
        continue;
      }

      if (now >= patron.despawnAt) {
        this.startPatronDeparture(patron);
        continue;
      }
      if (!patron.moving && now >= patron.nextMoveAt) {
        this.movePatronRandomly(patron);
      }
      if (now >= patron.nextTipAt) {
        this.collectPatronTip(patron);
        patron.nextTipAt = now + randRange(...PATRON_TIP_INTERVAL);
      }
    }
  }

  // Isometric movement never has a purely "up" or "down" screen direction
  // — every one of the 4 grid-neighbor moves has a nonzero horizontal
  // screen component (see gridToScreen's math) — so left/right is the one
  // cheap, always-meaningful cue: flip the container horizontally to face
  // whichever way its screen x is actually headed. targetScreenX is
  // compared against the container's CURRENT x, i.e. before this move's
  // tween starts moving it.
  faceTowardScreenX(patron, targetScreenX) {
    const facingRight = targetScreenX >= patron.container.x;
    patron.container.scaleX = (facingRight ? 1 : -1) * patron.scaleVariance;
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

  // Finds a walkable tile actually worth heading toward: right on a dance
  // floor tile if the club has one, or the open tile next to a bar/booth so
  // a patron can hang out by it (which also happens to be where tips pay
  // best — see isNearRevenueProp()). Returns null if nothing like that is
  // placed yet, so callers can fall back to plain wandering.
  pickPointOfInterestTile() {
    const danceTiles = [];
    const hangoutTiles = [];
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
      } else if (def.category === 'Bars' || def.category === 'Booths') {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize && !this.isBlockingProp(nx, ny)) {
            hangoutTiles.push([nx, ny]);
          }
        }
      }
    }
    // Dance floors are the main draw when there's one on the floor; bar/
    // booth-adjacent spots are the fallback attraction; ties go random.
    if (danceTiles.length > 0 && Math.random() < 0.55) return Phaser.Utils.Array.GetRandom(danceTiles);
    if (hangoutTiles.length > 0) return Phaser.Utils.Array.GetRandom(hangoutTiles);
    if (danceTiles.length > 0) return Phaser.Utils.Array.GetRandom(danceTiles);
    return null;
  }

  // Gives a patron somewhere purposeful to walk to, rather than any random
  // spot on the floor: most of the time a real point of interest (dance
  // floor, bar/booth hangout spot — see pickPointOfInterestTile()), so the
  // crowd visibly gathers around the club's attractions instead of just
  // drifting; the rest of the time (or once nothing new is worth visiting)
  // a plain open tile so patrons still spread out across the whole floor.
  pickRoamTarget(patron) {
    const poi = this.pickPointOfInterestTile();
    if (poi && Math.random() < 0.7) {
      [patron.targetGx, patron.targetGy] = poi;
      return;
    }
    for (let i = 0; i < 12; i++) {
      const tx = Phaser.Math.Between(0, this.gridSize - 1);
      const ty = Phaser.Math.Between(0, this.gridSize - 1);
      if (!this.isBlockingProp(tx, ty)) {
        patron.targetGx = tx;
        patron.targetGy = ty;
        return;
      }
    }
    const open = [];
    for (let gx = 0; gx < this.gridSize; gx++) {
      for (let gy = 0; gy < this.gridSize; gy++) {
        if (!this.isBlockingProp(gx, gy)) open.push([gx, gy]);
      }
    }
    if (open.length > 0) {
      const [tx, ty] = Phaser.Utils.Array.GetRandom(open);
      patron.targetGx = tx;
      patron.targetGy = ty;
    } else if (poi) {
      [patron.targetGx, patron.targetGy] = poi;
    } else {
      patron.targetGx = patron.gx;
      patron.targetGy = patron.gy;
    }
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
    if (patron.moving) return;

    // A leaving patron already has its target pinned to the door by
    // startPatronDeparture() — never let this pick it a fresh roam target
    // instead, or it would wander off rather than actually heading out.
    if (!patron.leaving && (patron.targetGx === undefined ||
        (patron.gx === patron.targetGx && patron.gy === patron.targetGy))) {
      this.pickRoamTarget(patron);
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

    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => [patron.gx + dx, patron.gy + dy])
      .filter(([tx, ty]) => (
        tx >= 0 && tx < this.gridSize && ty >= 0 && ty < this.gridSize &&
        !this.isBlockingProp(tx, ty) &&
        !this.patronTileOccupied(tx, ty)
      ));
    if (options.length === 0) {
      // Boxed in for the moment — try again shortly rather than getting
      // permanently stuck waiting on nextMoveAt from before.
      patron.nextMoveAt = this.time.now + 800;
      return;
    }

    let best = options[0];
    let bestDist = Infinity;
    const ties = [];
    for (const opt of options) {
      const dist = Math.abs(opt[0] - patron.targetGx) + Math.abs(opt[1] - patron.targetGy);
      if (dist < bestDist) {
        bestDist = dist;
        ties.length = 0;
        ties.push(opt);
      } else if (dist === bestDist) {
        ties.push(opt);
      }
    }
    best = Phaser.Utils.Array.GetRandom(ties);
    const [tx, ty] = best;
    patron.moving = true;
    const fromNearness = patron.gx + patron.gy;
    patron.gx = tx;
    patron.gy = ty;
    this.setPatronDepth(patron, Math.max(fromNearness, tx + ty));
    const { sx, sy } = this.gridToScreen(tx, ty);
    this.faceTowardScreenX(patron, sx);
    this.setPatronAnimation(patron, 'walk');
    this.tweens.add({
      targets: patron.container,
      x: sx,
      y: this.patronSeatY(sy, patron.container),
      duration: 650 + Math.random() * 250,
      ease: 'Linear', // constant speed so back-to-back hops below read as one
                       // continuous glide across the floor, not a series of
                       // little decelerate-then-reaccelerate steps
      onComplete: () => {
        patron.moving = false;
        this.setPatronDepth(patron, patron.gx + patron.gy);
        const arrived = patron.gx === patron.targetGx && patron.gy === patron.targetGy;
        if (patron.leaving) {
          patron.departureHops = (patron.departureHops || 0) + 1;
          // The hop cap is a safety valve for the rare case where the exact
          // door tile stays occupied the whole time (rather than circling
          // forever waiting for it to clear, just leave from right there) —
          // NOT meant to cut off a legitimately long walk. It has to scale
          // with the club's current floor size: the longest possible walk
          // to the door is (gridSize-1)*2 hops (opposite corner, on the
          // BASE 10x10 floor that's 18), and a maxed-out expanded club
          // (18x18) needs up to 34. A fixed cap of 20 used to make patrons
          // on the far side of an expanded club simply vanish mid-walk,
          // nowhere near the door yet — a real, visible bug, not just an
          // edge case.
          const maxDepartureHops = (this.gridSize - 1) * 2 + 10;
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
          // Reached the spot it was roaming toward — stand/mingle here for a
          // bit before picking a fresh target. A genuine point of interest
          // (dancing, or parked next to a bar/DJ/etc.) earns a much longer
          // dwell than a random empty tile, so patrons visibly linger at
          // the good spots instead of drifting off on the same short timer
          // everywhere.
          const atPOI = this.isDanceFloorTile(tx, ty) || this.isNearRevenueProp(tx, ty);
          patron.nextMoveAt = this.time.now + randRange(...(atPOI ? PATRON_POI_LINGER : PATRON_MOVE_INTERVAL));
          this.setPatronAnimation(patron, this.isDanceFloorTile(tx, ty) ? 'dance' : 'idle');
          // Landed right next to an actual bar — play the "walked up and
          // ordered a drink" beat (see showDrinkOrderPopup()) once, right as
          // they arrive, rather than only ever seeing a silent "+$X" appear
          // out of nowhere sometime later on their own tip timer.
          if (this.isBarAdjacent(tx, ty)) this.showDrinkOrderPopup(patron);
        } else if (this.time.now >= patron.despawnAt) {
          // Time's up mid-journey — head for the door instead of
          // continuing to roam toward the old target.
          this.startPatronDeparture(patron);
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

  // The real character sprite is anchored via its own calibrated origin
  // (see drawPatronCharacterSprite()), so its container sits right at the
  // tile's screen point; the fallback primitive token still needs the
  // hand-tuned PATRON_Y_OFFSET fudge factor. Movement/departure tweens
  // both target whichever one applies through this helper so neither
  // patron kind "sinks" or "floats" relative to its tile mid-animation.
  patronSeatY(sy, container) {
    return container.patronSprite ? sy : sy - PATRON_Y_OFFSET;
  }

  // True if the patron's own tile or one of its 4 neighbors has a
  // revenue-generating prop on it (the bar, or anything with a fanRate —
  // the DJ booth and dance tiles) — being near the action pays better.
  isNearRevenueProp(gx, gy) {
    const cells = [[gx, gy], [gx + 1, gy], [gx - 1, gy], [gx, gy + 1], [gx, gy - 1]];
    return cells.some(([tx, ty]) => {
      const rec = this.placed[`${tx},${ty}`];
      if (!rec) return false;
      const def = PROP_TYPES[rec.type];
      return !!(def.fanRate || def.key === 'bar');
    });
  }

  // Narrower than isNearRevenueProp() (which also counts the DJ booth and
  // dance floors) — true only next to an actual Bar/Premium Bar. Used just
  // to decide when a patron's arrival plays the "walked up and ordered a
  // drink" beat (showDrinkOrderPopup()) and when a later tip pop-up gets a
  // drink icon instead of a plain $ — doesn't affect the tip's economy math
  // at all, isNearRevenueProp() still owns that.
  isBarAdjacent(gx, gy) {
    const cells = [[gx, gy], [gx + 1, gy], [gx - 1, gy], [gx, gy + 1], [gx, gy - 1]];
    return cells.some(([tx, ty]) => {
      const rec = this.placed[`${tx},${ty}`];
      return !!rec && PROP_TYPES[rec.type].category === 'Bars';
    });
  }

  collectPatronTip(patron) {
    const nearRevenue = this.isNearRevenueProp(patron.gx, patron.gy);
    const base = 4 + Math.random() * 6; // $4-10 base tip
    const amount = Math.round(nearRevenue ? base * 2.2 : base);
    this.cash += amount;
    this.fans += nearRevenue ? 0.4 : 0.1;
    SFX.tip();
    this.updateUI();
    this.showTipPopup(patron, amount, this.isBarAdjacent(patron.gx, patron.gy));
  }

  showTipPopup(patron, amount, atBar) {
    const { x, y } = patron.container;
    // Right next to an actual bar, this doubles as "paying for the drink"
    // rather than a generic tip — a little 🍹 alongside the amount instead
    // of just the $ text sells that without changing the amount itself.
    const text = this.add.text(x, y - PATRON_POPUP_Y, atBar ? `🍹 +$${amount}` : `+$${amount}`, {
      fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#7dffc4',
    }).setOrigin(0.5, 1);
    this.patronLayer.add(text);
    this.tweens.add({
      targets: text,
      y: y - PATRON_POPUP_Y - 22 * PROP_SCALE,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  // The moment a patron settles in right next to an actual bar (see
  // isBarAdjacent()) — a quick "🍹" the instant they arrive, separate from
  // showTipPopup()'s "+$X"/"🍹 +$X" which fires later on the patron's own
  // independent tip timer (collectPatronTip()). Together they read as
  // "walked up to the bar, ordered a drink, then paid for it" without the
  // two moments needing to be the same event under the hood.
  showDrinkOrderPopup(patron) {
    const { x, y } = patron.container;
    const icon = this.add.text(x, y - PATRON_POPUP_Y, '🍹', {
      fontSize: '16px',
    }).setOrigin(0.5, 1);
    this.patronLayer.add(icon);
    this.tweens.add({
      targets: icon,
      y: y - PATRON_POPUP_Y - 20 * PROP_SCALE,
      alpha: 0,
      duration: 1100,
      delay: 250,
      ease: 'Cubic.easeOut',
      onComplete: () => icon.destroy(),
    });
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
    patron.targetGx = PATRON_SPAWN_TILE.gx;
    patron.targetGy = PATRON_SPAWN_TILE.gy;
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
