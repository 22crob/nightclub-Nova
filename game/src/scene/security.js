// ClubScene methods: guests getting along, or not. Dancers side by side
// sometimes dance together. Now and then a chat goes badly: an anger icon
// (💢) pops up over both guests and the security guard, who stands inside
// by the door, walks over. Usually he calms them down; if he can't, or
// doesn't get there in time, it turns into a short cartoon fight (a dust
// cloud) and he throws one of them out. Settings are SECURITY in config.js.
// Troublemaker guests bother the people near them until a bouncer walks
// them out (TROUBLE); more bouncers can be hired (BOUNCERS, Staff panel).
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { BOUNCERS, PATRON_POPUP_Y, SECURITY, TROUBLE } from '../config.js';
import { SFX } from '../sfx.js';
import { randRange } from '../util.js';

export class SecurityMixin {
  // --- The bouncers --------------------------------------------------------------

  // Puts the club's bouncers at their posts: this.guards (this.guard is the
  // first, posted inside the door, who also breaks up arguments). How many
  // is this.bouncers (saved; hired from the Staff panel, see hireBouncer()).
  setupSecurity() {
    if (!this.hasCharacterSprites()) return;
    if (!this.guards) this.guards = [];
    const want = Math.max(1, Math.min(BOUNCERS.levels.length, this.bouncers || 1));
    while (this.guards.length > want) this.removeGuard(this.guards[this.guards.length - 1]);
    while (this.guards.length < want) this.addGuard();
    this.guard = this.guards[0];
  }

  addGuard() {
    const index = this.guards.length;
    const [gx, gy] = this.guardPost(index);
    const { sx, sy } = this.gridToScreen(gx, gy);
    const look = BOUNCERS.characters[index] ?? SECURITY.character;
    const container = this.drawPatronCharacterSprite(sx, sy, SECURITY.scale, look);
    container.staffCharacter = look;
    this.propLayer.add(container);
    const g = { gx, gy, container, scaleVariance: SECURITY.scale, moving: false, path: null, index, name: this.staffNameFor(`guard:${index}`) };
    this.guards.push(g);
    this.faceFront(g);
    this.setPatronDepth(g, gx + gy);
    return g;
  }

  removeGuard(g) {
    this.tweens.killTweensOf(g.container);
    if (g.target) g.target.targetedBy = null;
    g.container.destroy();
    this.guards = this.guards.filter((x) => x !== g);
  }

  // A bouncer's post: the first just inside the door, the others spread over
  // the room (the middle, the front corner, the back corner); the nearest
  // open tile to it that no other bouncer stands on.
  guardPost(index = 0) {
    const door = this.doorTile();
    const doorway = new Set(this.doorZone());
    const wants = [[door.gx + 1, door.gy + 1], [Math.floor(this.gridW / 2), Math.floor(this.gridH / 2)], [this.gridW - 2, this.gridH - 2], [this.gridW - 2, 1]];
    const want = wants[index % wants.length];
    const taken = new Set((this.guards || []).filter((g) => g.index !== index).map((g) => `${g.postX},${g.postY}`));
    let best = null;
    let bestD = Infinity;
    for (let x = 0; x < this.gridW; x++) {
      for (let y = 0; y < this.gridH; y++) {
        if (this.isBlockingProp(x, y) || doorway.has(`${x},${y}`) || taken.has(`${x},${y}`)) continue;
        const d = Math.abs(x - want[0]) + Math.abs(y - want[1]);
        if (d < bestD) { bestD = d; best = [x, y]; }
      }
    }
    const post = best || [door.gx, door.gy];
    const g = (this.guards || [])[index];
    if (g) { g.postX = post[0]; g.postY = post[1]; }
    return post;
  }

  // Walks a bouncer (the first unless given) to a tile, then calls `done`.
  // A new walk replaces the old one at the next step.
  guardWalkTo(gx, gy, done, g = this.guard) {
    if (!g) return;
    g.goal = { gx, gy, done };
    if (!g.moving) this.guardStep(g);
  }

  guardStep(g = this.guard) {
    if (!g || !g.container.active) return;
    const goal = g.goal;
    if (!goal) return;
    if (g.gx === goal.gx && g.gy === goal.gy) {
      g.goal = null;
      this.setPatronAnimation(g, 'idle');
      if (goal.done) goal.done();
      return;
    }
    const path = this.findPath(g.gx, g.gy, goal.gx, goal.gy);
    if (!path || path.length === 0) { // can't get there: give up where they are
      g.goal = null;
      this.setPatronAnimation(g, 'idle');
      if (goal.done) goal.done();
      return;
    }
    const [tx, ty] = path[0];
    const from = g.gx + g.gy;
    g.gx = tx;
    g.gy = ty;
    g.moving = true;
    this.setPatronDepth(g, Math.max(from, tx + ty));
    const { sx, sy } = this.gridToScreen(tx, ty);
    this.faceToward(g, sx, sy);
    this.setPatronAnimation(g, 'walk');
    this.tweens.add({
      targets: g.container, x: sx, y: sy, duration: SECURITY.stepMs, ease: 'Linear',
      onComplete: () => {
        g.moving = false;
        this.setPatronDepth(g, g.gx + g.gy);
        this.guardStep(g);
      },
    });
  }

  // Back to their post when there's nothing to deal with.
  guardGoHome(g = this.guard) {
    if (!g || g.goal || g.moving || g.target) return;
    const [px, py] = this.guardPost(g.index || 0);
    if (g.gx === px && g.gy === py) return;
    this.guardWalkTo(px, py, () => this.faceFront(g), g);
  }

  // --- Hiring bouncers ---------------------------------------------------------

  // How many bouncers your level allows, and the level that allows one more.
  bouncerAllowance() {
    const level = this.levelInfo().level;
    return BOUNCERS.levels.filter((l) => level >= l).length;
  }

  nextBouncerLevel() {
    const level = this.levelInfo().level;
    return BOUNCERS.levels.find((l) => l > level) || null;
  }

  hireBouncer() {
    const n = this.bouncers || 1;
    if (n >= this.bouncerAllowance()) { SFX.denied(); return false; }
    const cost = BOUNCERS.hireCost[n] || 0;
    if (this.cash < cost) { SFX.denied(); return false; }
    this.cash -= cost;
    this.bouncers = n + 1;
    this.setupSecurity();
    SFX.place();
    this.updateUI();
    this.saveGame();
    return true;
  }

  // Lets the newest bouncer go (the house bouncer always stays).
  fireBouncer() {
    if ((this.bouncers || 1) <= 1) return false;
    this.bouncers -= 1;
    this.setupSecurity();
    SFX.sell();
    this.updateUI();
    this.saveGame();
    return true;
  }

  // --- Troublemakers -----------------------------------------------------------

  // Runs with the patron tick: troublemakers bother the guests near them,
  // and a free bouncer close enough to one who has caused trouble walks
  // them out.
  tickTroublemakers() {
    const now = this.time.now;
    for (const p of this.patrons) {
      if (!p.troublemaker || p.celeb || p.gone || p.leaving || p.entering || p.ejected) continue;
      if (now < (p.annoyAt || 0)) continue;
      p.annoyAt = now + randRange(...TROUBLE.annoyEveryMs);
      if (p.moving || p.sitting) continue;
      const near = this.patrons.filter((q) => q !== p && !q.gone && !q.leaving && !q.troublemaker
        && Math.abs(q.gx - p.gx) + Math.abs(q.gy - p.gy) <= TROUBLE.annoyRange);
      if (near.length === 0) continue;
      p.disturbances = (p.disturbances || 0) + 1;
      this.floatText(p.container.x, p.container.y - PATRON_POPUP_Y, '😈', '#ff5a5a');
      for (const q of near) {
        q.mood = Math.max(0, q.mood - TROUBLE.annoyMood);
        this.floatText(q.container.x, q.container.y - PATRON_POPUP_Y, '😠', '#ff8a8a');
      }
    }
    for (const g of this.guards || []) {
      if (g.target || g.goal || g.moving || (g === this.guard && this.argument)) continue;
      const bad = this.patrons.find((p) => p.troublemaker && p.disturbances && !p.targetedBy && !p.gone && !p.leaving && !p.ejected
        && Math.abs(p.gx - g.gx) + Math.abs(p.gy - g.gy) <= TROUBLE.detectRange);
      if (bad) this.goGetTroublemaker(g, bad);
    }
  }

  // A bouncer heads over to a troublemaker.
  goGetTroublemaker(g, p) {
    g.target = p;
    p.targetedBy = g;
    this.floatText(g.container.x, g.container.y - PATRON_POPUP_Y, '👀', '#9fe7ff');
    const spot = this.tileNextTo(p, p, g) || [p.gx, p.gy];
    this.guardWalkTo(spot[0], spot[1], () => this.escortOut(g, p), g);
  }

  // The bouncer reaches the troublemaker and walks them out the door.
  escortOut(g, p) {
    g.target = null;
    p.targetedBy = null;
    if (p.gone || p.leaving || p.ejected) { this.guardGoHome(g); return; }
    p.ejected = true;
    p.escorted = true;
    if (p.sitting) this.standUp?.(p);
    this.faceToward(g, p.container.x, p.container.y);
    this.floatText(p.container.x, p.container.y - PATRON_POPUP_Y - 10, '🚫 Out you go!', '#ff5a5a');
    this.fans += TROUBLE.xp;
    this.bumpGoal?.('walkouts');
    SFX.whistle();
    this.floatText(g.container.x, g.container.y - PATRON_POPUP_Y, `+${TROUBLE.xp} XP`, '#ffe27a');
    this.troublemakersRemoved = (this.troublemakersRemoved || 0) + 1;
    if (this.partyStats) this.partyStats.ejections += 1;
    this.startPatronDeparture(p);
    // Walk alongside them to the door, then back to the post.
    const door = this.doorTile();
    this.guardWalkTo(door.gx + 1, door.gy, () => this.guardGoHome(g), g);
    this.updateUI();
  }

  // --- Dancing together ------------------------------------------------------

  // A guest has started dancing: if someone's dancing right next to them,
  // they may turn to each other and dance together.
  maybeDanceTogether(patron) {
    if (patron.dancePartner || Math.random() > SECURITY.danceTogetherChance) return;
    const other = this.patrons.find((p) => p !== patron && !p.gone && !p.leaving && !p.moving && !p.dancePartner
      && p.activity && p.activity.kind === 'dance' && p.activity.until
      && Math.abs(p.gx - patron.gx) + Math.abs(p.gy - patron.gy) === 1);
    if (!other) return;
    patron.dancePartner = other;
    other.dancePartner = patron;
    for (const [a, b] of [[patron, other], [other, patron]]) {
      this.faceToward(a, b.container.x, b.container.y);
      a.container.patronAnimState = null; // re-play the dance in the new facing
      this.setPatronAnimation(a, 'dance');
    }
    const until = Math.max(patron.activity.until, other.activity.until);
    patron.activity.until = other.activity.until = until;
    patron.nextMoveAt = other.nextMoveAt = until;
    const c = patron.container;
    this.floatText((c.x + other.container.x) / 2, c.y - PATRON_POPUP_Y, '💃🕺', '#ff7ae0');
    this.popReaction(patron, 'happy', randRange(800, 1800));
    this.popReaction(other, 'happy', randRange(1200, 2600));
  }

  // Splits up a dancing pair (one of them moved on).
  endDanceTogether(patron) {
    const other = patron.dancePartner;
    patron.dancePartner = null;
    if (other && other.dancePartner === patron) other.dancePartner = null;
  }

  // --- Arguments and fights --------------------------------------------------

  // Two guests have just started chatting: once in a while it goes badly.
  maybeArgue(a, b) {
    const now = this.time.now;
    if (this.argument || !this.guard || a.celeb || b.celeb) return false;
    if (now < (this.lastArgumentAt || -Infinity) + SECURITY.cooldownMs) return false;
    if (Math.random() > SECURITY.argueChance) return false;
    this.startArgument(a, b);
    return true;
  }

  startArgument(a, b) {
    const now = this.time.now;
    this.argument = { a, b, state: 'argue', fightAt: now + randRange(...SECURITY.argueMs), guardHere: false };
    for (const p of [a, b]) {
      p.chatWith = null;
      p.arguing = true;
      p.activity = { kind: 'argue' };
      p.nextMoveAt = Infinity; // stays put until it's sorted out
      p.mood = Math.max(0, p.mood - SECURITY.moodHit);
      this.addAngerIcon(p.container);
    }
    const c = a.container;
    this.floatText(c.x, c.y - PATRON_POPUP_Y - 10, 'Hey!!', '#ff5a5a');
    SFX.denied();
    // Security heads over (if busy walking someone out, it turns into a fight).
    if (this.guard.target) return;
    const spot = this.tileNextTo(a, b);
    if (spot) this.guardWalkTo(spot[0], spot[1], () => this.guardArrived());
    else this.guardArrived();
  }

  // An open tile next to either guest, nearest the guard.
  tileNextTo(a, b, g = this.guard) {
    const spots = [];
    for (const p of [a, b]) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const x = p.gx + dx;
        const y = p.gy + dy;
        if (!this.inGrid(x, y) || this.isBlockingProp(x, y)) continue;
        if ((x === a.gx && y === a.gy) || (x === b.gx && y === b.gy)) continue;
        spots.push([x, y]);
      }
    }
    spots.sort((p, q) => (Math.abs(p[0] - g.gx) + Math.abs(p[1] - g.gy)) - (Math.abs(q[0] - g.gx) + Math.abs(q[1] - g.gy)));
    return spots[0] || null;
  }

  // The guard has reached the argument: calm it down, or break up the fight.
  guardArrived() {
    const arg = this.argument;
    const g = this.guard;
    if (!arg) { this.guardGoHome(); return; }
    arg.guardHere = true;
    this.faceToward(g, arg.a.container.x, arg.a.container.y);
    g.container.patronAnimState = null;
    this.setPatronAnimation(g, 'idle');
    if (arg.state === 'argue') {
      if (Math.random() < SECURITY.settleChance) this.settleArgument();
      else this.startFight();
    }
  }

  // The guard talks them down: both go on with their night.
  settleArgument() {
    const { a, b } = this.argument;
    const g = this.guard;
    this.floatText(g.container.x, g.container.y - PATRON_POPUP_Y - 10, '✋ Break it up!', '#9fe7ff');
    this.clearArgument();
    for (const p of [a, b]) {
      p.lastActivity = 'chat';
      p.nextMoveAt = this.time.now + randRange(800, 2000);
    }
    this.guardGoHome();
  }

  // The argument turns into a cartoon fight: both disappear into a dust
  // cloud full of stars and fists for a few seconds.
  startFight() {
    const arg = this.argument;
    if (!arg || arg.state === 'fight') return;
    arg.state = 'fight';
    if (this.partyStats) this.partyStats.fights += 1;
    arg.fightEndsAt = this.time.now + SECURITY.fightMs;
    const { a, b } = arg;
    a.container.setVisible(false);
    b.container.setVisible(false);
    const x = (a.container.x + b.container.x) / 2;
    const y = (a.container.y + b.container.y) / 2;
    const cloud = this.add.container(x, y - 34);
    const g = this.add.graphics();
    const puffs = [[0, 0, 30], [-24, 6, 22], [24, 6, 22], [-14, -18, 20], [16, -18, 20], [0, 18, 20]];
    g.fillStyle(0x6b6478, 1);
    for (const [px, py, r] of puffs) g.fillCircle(px + 2, py + 3, r);
    g.fillStyle(0xe9e4f2, 1);
    for (const [px, py, r] of puffs) g.fillCircle(px, py, r);
    g.lineStyle(3, 0x2a2233, 1);
    for (const [px, py, r] of puffs) g.strokeCircle(px, py, r);
    g.fillStyle(0xe9e4f2, 1);
    for (const [px, py, r] of puffs) g.fillCircle(px, py, r - 2);
    cloud.add(g);
    for (const [ex, ey, e] of [[-26, -24, '💥'], [24, -22, '⭐'], [-6, 14, '👊'], [26, 14, '💫'], [-30, 12, '⭐']]) {
      const t = this.add.text(ex, ey, e, { fontSize: '18px' }).setOrigin(0.5);
      cloud.add(t);
      this.tweens.add({ targets: t, x: ex + randRange(-8, 8), y: ey + randRange(-8, 8), duration: 140, yoyo: true, repeat: -1 });
    }
    cloud.setDepth(Math.max(a.gx + a.gy, b.gx + b.gy) + 0.05);
    this.propLayer.add(cloud);
    this.propLayer.sort('depth');
    this.tweens.add({ targets: cloud, angle: { from: -6, to: 6 }, scaleX: 1.08, scaleY: 0.94, duration: 120, yoyo: true, repeat: -1 });
    arg.cloud = cloud;
    SFX.denied();
    // Everyone nearby is a bit put off.
    for (const p of this.patrons) {
      if (p === a || p === b || p.gone) continue;
      if (Math.abs(p.gx - a.gx) + Math.abs(p.gy - a.gy) <= 4) p.mood = Math.max(0, p.mood - 3);
    }
  }

  // The fight's over: security throws one of them out.
  endFight() {
    const { a, b } = this.argument;
    const out = Math.random() < 0.5 ? a : b;
    const stay = out === a ? b : a;
    this.clearArgument();
    out.ejected = true;
    if (this.partyStats) this.partyStats.ejections += 1;
    const c = out.container;
    this.floatText(c.x, c.y - PATRON_POPUP_Y - 10, '🚫 Ejected!', '#ff5a5a');
    this.showToast(`🚫 Security threw ${out.name} out after a fight.`);
    this.startPatronDeparture(out);
    stay.mood = Math.max(0, stay.mood - SECURITY.moodHit);
    stay.lastActivity = 'chat';
    stay.nextMoveAt = this.time.now + randRange(1000, 2500);
    // The guard walks the troublemaker to the door, then back to his post.
    const door = this.doorTile();
    this.guardWalkTo(door.gx + 1, door.gy, () => this.guardGoHome());
  }

  // Ends the argument (or fight) and tidies up both guests.
  clearArgument() {
    const arg = this.argument;
    if (!arg) return;
    this.argument = null;
    this.lastArgumentAt = this.time.now;
    if (arg.cloud) arg.cloud.destroy();
    for (const p of [arg.a, arg.b]) {
      p.arguing = false;
      if (p.activity && p.activity.kind === 'argue') p.activity = null;
      if (p.nextMoveAt === Infinity) p.nextMoveAt = this.time.now + 1000;
      if (p.container.active) {
        p.container.setVisible(true);
        this.removeAngerIcon(p.container);
      }
    }
  }

  // The 💢 that bobs over an angry guest's head.
  addAngerIcon(container) {
    if (container.angerIcon) return;
    const icon = this.add.text(0, -100 - (container.starIcon ? 18 : 0), '💢', { fontSize: '18px' }).setOrigin(0.5, 1);
    container.add(icon);
    container.angerIcon = icon;
    this.tweens.add({ targets: icon, scale: 1.25, duration: 260, yoyo: true, repeat: -1 });
  }

  removeAngerIcon(container) {
    if (!container.angerIcon) return;
    this.tweens.killTweensOf(container.angerIcon);
    container.angerIcon.destroy();
    container.angerIcon = null;
  }

  // Runs with the patron tick: moves an argument along.
  tickSecurity() {
    this.tickTroublemakers();
    for (const g of this.guards || []) if (g !== this.guard || !this.argument) this.guardGoHome(g);
    const arg = this.argument;
    if (!arg) return;
    const now = this.time.now;
    const gone = (p) => p.gone || p.leaving;
    if (gone(arg.a) || gone(arg.b)) { this.clearArgument(); this.guardGoHome(); return; }
    if (arg.state === 'argue' && now >= arg.fightAt) this.startFight();
    // The fight ends once its time is up and the guard is there to break it
    // up (or after a while anyway, if he can't get there).
    if (arg.state === 'fight' && now >= arg.fightEndsAt
      && (arg.guardHere || now >= arg.fightEndsAt + 6000)) this.endFight();
  }
}
