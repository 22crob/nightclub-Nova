// ClubScene methods: the two crowd buttons, each with a cooldown.
//  - Bass Boost: a pulse of light across the dance floor, a flash and a
//    "Bass Boost!" popup; for BOOST.durationMs the bass is turned way up,
//    more guests want to dance (and dancers tip more), dancers get more
//    energetic and dance longer, and a share of the crowd heads for free
//    dance floor spots.
//  - Drink Rush: a "Drink Rush!" popup and the bars light up; for
//    RUSH.durationMs more guests want a drink, and a share of the crowd
//    heads for the bar lines.
// The guests who answer react straight away (reactions.js), then set off
// one by one a moment later, so it looks like a crowd responding. Guests
// leaving, arguing or in line at a bar carry on with that. Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { BOOST, CHARACTER_DISPLAY_HEIGHT, RUSH } from '../config.js';
import { Music } from '../music.js';
import { SFX } from '../sfx.js';
import { refreshTip } from '../tooltips.js';

const randRange = (min, max) => min + Math.random() * (max - min);
const CHEERS = ['Woo!', 'Yeah!', 'Let\'s go!', 'Whoo!'];
const clock = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export class BoostMixin {
  isBoosted() {
    return this.boostUntil !== undefined && this.time.now < this.boostUntil;
  }

  // Dancers tip this many times faster during a Bass Boost.
  boostFactor() {
    return this.isBoosted() ? BOOST.speedUp : 1;
  }

  // How much more guests fancy dancing / a drink right now (see
  // activityWeights() in activities.js).
  boostDanceFactor() {
    return this.isBoosted() ? BOOST.danceWeight : 1;
  }

  isRushing() {
    return this.rushUntil !== undefined && this.time.now < this.rushUntil;
  }

  rushDrinkFactor() {
    return this.isRushing() ? RUSH.drinkWeight : 1;
  }

  canBoost() {
    return !this.isBoosted() && this.time.now >= (this.boostReadyAt || 0) && this.musicPlaying();
  }

  canRush() {
    return !this.isRushing() && this.time.now >= (this.rushReadyAt || 0);
  }

  startBoost() {
    if (!this.canBoost()) { SFX.denied(); return false; }
    const now = this.time.now;
    this.boostUntil = now + BOOST.durationMs;
    this.boostReadyAt = this.boostUntil + BOOST.cooldownMs;
    Music.setBoost(true);
    SFX.levelUp();
    this.showBigPopup('Bass Boost!', 'Everybody to the dance floor!', 'boost');
    this.flashScreen(0xb070ff);
    this.pulseDanceFloor();
    // Everyone on the dance floor goes wild for a few seconds and keeps
    // dancing longer.
    for (const p of this.patrons) {
      if (!this.isDancing(p) || p.leaving || p.gone) continue;
      const a = p.activity;
      if (a && a.kind === 'dance' && a.until) {
        a.until += randRange(...BOOST.danceExtendMs);
        p.nextMoveAt = Math.max(p.nextMoveAt, a.until);
      }
      this.exciteDancer(p);
    }
    this.rallyGuests('dance', BOOST);
    this.updateBoostButton();
    return true;
  }

  startRush() {
    if (!this.canRush()) { SFX.denied(); return false; }
    const now = this.time.now;
    this.rushUntil = now + RUSH.durationMs;
    this.rushReadyAt = this.rushUntil + RUSH.cooldownMs;
    SFX.levelUp();
    this.showBigPopup('Drink Rush!', 'Who wants a drink?', 'rush');
    this.highlightBars();
    this.rallyGuests('drink', RUSH);
    this.updateBoostButton();
    return true;
  }

  // True if the guest is dancing right now.
  isDancing(p) {
    const anim = p.container.patronAnimState;
    return typeof anim === 'string' && anim.startsWith('dance');
  }

  // A dancer's moves go faster during a Bass Boost, and much faster while
  // they're excited by it (see setPatronAnimation()).
  energize(p) {
    const sprite = p.container.patronSprite;
    if (!sprite || !sprite.anims) return;
    const dancing = this.isDancing(p);
    let speed = 1;
    if (dancing && this.time.now < (p.excitedUntil || 0)) speed = BOOST.excitedEnergy;
    else if (dancing && this.isBoosted()) speed = BOOST.energy;
    sprite.anims.timeScale = speed;
  }

  // A dancer hit by the Bass Boost: wilder moves for BOOST.exciteMs, with
  // heart eyes or an exclamation mark popping up now and then.
  exciteDancer(p) {
    const now = this.time.now;
    p.excitedUntil = now + BOOST.exciteMs;
    this.energize(p);
    const pops = Math.round(randRange(BOOST.excitePops[0], BOOST.excitePops[1] + 0.49));
    for (let i = 0; i < pops; i++) {
      // Spread over the ten seconds, each at its own moment.
      const at = ((i + Math.random()) / pops) * (BOOST.exciteMs - 1500);
      this.time.delayedCall(at, () => {
        if (p.gone || p.leaving || !this.isDancing(p)) return;
        p.reactingUntil = 0;
        this.popReaction(p, Math.random() < 0.5 ? 'hearts' : 'exclaim', 0, randRange(900, 1300));
      });
    }
    this.time.delayedCall(BOOST.exciteMs + 50, () => { if (!p.gone) this.energize(p); });
  }

  // Who can answer the call: not leaving, arguing, in line at a bar (being
  // served), or already doing it (a drink on order or in hand counts).
  canRally(p, kind) {
    if (p.leaving || p.gone || p.arguing || p.queue) return false;
    if (p.activity && p.activity.kind === kind) return false;
    if (kind === 'dance' && this.isDancing(p)) return false;
    return true;
  }

  // A share of the crowd (settings.joinShare) answers the call: each reacts
  // straight away (an excited face, a note or a drink over their head, and
  // a cheer from some), then sets off a moment later, one after another,
  // for a free dance floor spot or a bar line.
  rallyGuests(kind, settings) {
    const now = this.time.now;
    let count = 0;
    for (const p of this.patrons) {
      if (!this.canRally(p, kind) || Math.random() > settings.joinShare) continue;
      count += 1;
      const icon = kind === 'drink' ? (Math.random() < 0.6 ? 'drink' : 'excited') : (Math.random() < 0.6 ? 'excited' : 'note');
      this.popReaction(p, icon, randRange(0, 250));
      if (Math.random() < 0.35) {
        const c = p.container;
        this.floatText(c.x, c.y - CHARACTER_DISPLAY_HEIGHT * 0.6, CHEERS[Math.floor(Math.random() * CHEERS.length)], kind === 'drink' ? '#7dffc4' : '#e9d4ff');
      }
      this.time.delayedCall(randRange(...settings.staggerMs), () => {
        if (!this.canRally(p, kind) || this.time.now > now + settings.durationMs) return;
        if (kind === 'drink') p.thirstyAt = Math.min(p.thirstyAt, this.time.now);
        this.endChat(p);
        this.endDanceTogether(p);
        p.lastActivity = null;
        p.activity = null;
        p.wantActivity = kind; // their next pick (see chooseActivity())
        if (!p.sitting) { this.releaseSeat(p); p.targetGx = undefined; p.path = null; }
        p.nextMoveAt = Math.min(p.nextMoveAt, this.time.now);
      });
    }
    return count;
  }

  // --- Effects --------------------------------------------------------------

  // A quick coloured flash over the whole club.
  flashScreen(color) {
    const { width, height } = this.scale;
    const flash = this.add.rectangle(0, 0, width, height, color).setOrigin(0, 0)
      .setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(10000);
    this.tweens.add({ targets: flash, alpha: 0.35, duration: 90, yoyo: true, hold: 60, onComplete: () => flash.destroy() });
  }

  // Waves of light rolling out across every dance floor from its middle.
  pulseDanceFloor() {
    const tiles = Object.keys(this.placed).map((k) => k.split(',').map(Number)).filter(([x, y]) => this.isDanceFloorTile(x, y));
    if (tiles.length === 0) return 0;
    const cx = tiles.reduce((s, [x]) => s + x, 0) / tiles.length;
    const cy = tiles.reduce((s, [, y]) => s + y, 0) / tiles.length;
    for (let wave = 0; wave < 3; wave++) {
      for (const [x, y] of tiles) {
        const g = this.add.graphics();
        const pts = [[x - 0.5, y - 0.5], [x + 0.5, y - 0.5], [x + 0.5, y + 0.5], [x - 0.5, y + 0.5]]
          .map(([gx, gy]) => { const { sx, sy } = this.gridToScreen(gx, gy); return { x: sx, y: sy }; });
        g.fillStyle(wave === 1 ? 0x5fe3ff : 0xd9a8ff, 1);
        g.fillPoints(pts, true);
        g.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(-500); // over the floor, under people and props
        this.propLayer.add(g);
        const dist = Math.hypot(x - cx, y - cy);
        this.tweens.add({
          targets: g, alpha: 0.75, duration: 140, yoyo: true, delay: wave * 420 + dist * 70,
          onComplete: () => g.destroy(),
        });
      }
    }
    this.propLayer.sort('depth');
    return tiles.length;
  }

  // The bars someone's working glow for a moment, with a drink over each.
  highlightBars() {
    const bars = this.hireableRecords().filter((r) => this.isWorked(r));
    const g = this.add.graphics();
    this.ghostLayer.add(g);
    for (const rec of bars) {
      for (const [x, y] of rec.tiles) {
        const pts = [[x - 0.5, y - 0.5], [x + 0.5, y - 0.5], [x + 0.5, y + 0.5], [x - 0.5, y + 0.5]]
          .map(([gx, gy]) => { const { sx, sy } = this.gridToScreen(gx, gy); return { x: sx, y: sy }; });
        g.fillStyle(0x3fe0c8, 0.35);
        g.fillPoints(pts, true);
        g.lineStyle(2, 0xb8fff2, 0.9);
        g.strokePoints(pts, true);
      }
      const mid = rec.tiles[Math.floor(rec.tiles.length / 2)];
      const { sx, sy } = this.gridToScreen(mid[0], mid[1]);
      this.floatText(sx, sy - CHARACTER_DISPLAY_HEIGHT * 0.9, '🍹', '#ffffff');
    }
    g.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.tweens.add({ targets: g, alpha: 1, duration: 220, yoyo: true, repeat: 2, onComplete: () => g.destroy() });
    return bars.length;
  }

  // Runs a few times a second: ends the boost on time and keeps the button
  // (ready / countdown / cooldown) current.
  tickBoost() {
    if (this.boostUntil !== undefined && !this.isBoosted() && Music.boosted) {
      Music.setBoost(false);
      for (const p of this.patrons) this.energize(p); // back to normal speed
      this.showToast('The Bass Boost is over. Ready again in a few minutes!');
    }
    if (this.rushUntil !== undefined && !this.isRushing() && this.rushOn) this.showToast('The Drink Rush is over.');
    this.rushOn = this.isRushing();
    this.updateBoostButton();
  }

  // Keeps both buttons current: ready, running (with a timer) or
  // recharging (with a timer). What they do is in their hover tips.
  updateBoostButton() {
    const now = this.time.now;
    this.updateCrowdButton(this.boostButton, this.boostLabel, this.isBoosted(), this.boostUntil, this.boostReadyAt,
      `More guests want to dance for ${BOOST.durationMs / 1000} seconds, with heavy bass and bigger dance tips. Ready now!`,
      (t) => `Bass Boost! ${t} left.`, now);
    this.updateCrowdButton(this.rushButton, this.rushLabel, this.isRushing(), this.rushUntil, this.rushReadyAt,
      `More guests want a drink for ${RUSH.durationMs / 1000} seconds and head for the bars. Ready now!`,
      (t) => `Drink Rush! ${t} left.`, now);
  }

  updateCrowdButton(button, label, active, until, readyAt, readyTip, activeTip, now) {
    if (!button) return;
    let state = 'ready';
    let timer = '';
    let tip = readyTip;
    if (active) {
      state = 'active';
      timer = clock(until - now);
      tip = activeTip(timer);
    } else if (now < (readyAt || 0)) {
      state = 'cooldown';
      timer = clock(readyAt - now);
      tip = `Recharging. Ready again in ${timer}.`;
    }
    if (button.dataset.state !== state) button.dataset.state = state;
    if (label.textContent !== timer) label.textContent = timer;
    if (button.dataset.tipText !== tip) {
      button.dataset.tipText = tip;
      refreshTip(button);
    }
  }

  // Wires up the HUD buttons (see index.html) and the music.
  setupBoost() {
    this.boostButton = document.getElementById('boostButton');
    this.boostLabel = document.getElementById('boostLabel');
    this.rushButton = document.getElementById('rushButton');
    this.rushLabel = document.getElementById('rushLabel');
    if (this.boostButton) this.boostButton.addEventListener('click', () => { SFX.unlock(); this.syncMusic(); this.startBoost(); });
    if (this.rushButton) this.rushButton.addEventListener('click', () => { SFX.unlock(); this.startRush(); });
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.tickBoost() });
    this.updateBoostButton();
    // Browsers only allow sound after the player clicks or taps something.
    document.addEventListener('pointerdown', () => { SFX.unlock(); this.syncMusic(); });
  }

  // The beat plays whenever the DJ does.
  syncMusic() {
    if (this.musicPlaying()) Music.start();
    else Music.stop();
    Music.applyLevels();
  }
}
