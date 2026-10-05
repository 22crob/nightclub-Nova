// ClubScene methods: the two crowd buttons, each with a cooldown.
//  - Bass Boost: for BOOST.durationMs the bass is turned way up, more
//    guests want to dance (and dancers tip a bit more), and a share of the
//    crowd heads for free dance floor spots over the next few seconds.
//  - Drink Rush: for RUSH.durationMs more guests want a drink, and a share
//    of the crowd heads for the bars and bar stools over a few seconds.
// Guests respond one by one (staggered by a few seconds), finishing a
// step first, so the movement feels natural rather than everyone jumping
// at once. Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { BOOST, RUSH } from '../config.js';
import { Music } from '../music.js';
import { SFX } from '../sfx.js';
import { refreshTip } from '../tooltips.js';

const randRange = (min, max) => min + Math.random() * (max - min);
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
    this.showToast('🔊 BASS BOOST! Everybody to the dance floor!');
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
    this.showToast('🍹 DRINK RUSH! Who wants a drink?');
    this.rallyGuests('drink', RUSH);
    this.updateBoostButton();
    return true;
  }

  // Sends a share of the crowd off to `kind` ('dance' or 'drink'), one at a
  // time over the next few seconds. Guests already doing it, in a line,
  // on a bar stool or leaving are left alone.
  rallyGuests(kind, settings) {
    const now = this.time.now;
    const busy = (p) => p.leaving || p.gone || p.arguing || p.queue || (p.activity && p.activity.kind === kind);
    for (const p of this.patrons) {
      if (busy(p) || Math.random() > settings.joinShare) continue;
      this.time.delayedCall(randRange(...settings.staggerMs), () => {
        if (busy(p) || this.time.now > now + settings.durationMs) return;
        if (kind === 'drink') p.thirstyAt = Math.min(p.thirstyAt, this.time.now);
        this.endChat(p);
        p.lastActivity = null;
        p.activity = null; // their next pick is now (most likely) `kind`
        if (!p.sitting) { p.targetGx = undefined; p.path = null; }
        p.nextMoveAt = Math.min(p.nextMoveAt, this.time.now);
      });
    }
  }

  // Runs a few times a second: ends the boost on time and keeps the button
  // (ready / countdown / cooldown) current.
  tickBoost() {
    if (this.boostUntil !== undefined && !this.isBoosted() && Music.boosted) {
      Music.setBoost(false);
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
      `More guests want a drink for ${RUSH.durationMs / 1000} seconds and head for the bars and bar stools. Ready now!`,
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
