// ClubScene methods: Drop the Bass, a free 90-second party boost with a
// cooldown. While it runs, tips come twice as often and are twice as big,
// patrons get thirsty sooner and head for the dance floor more, and the
// music's bass is turned way up (see music.js).
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { BOOST } from '../config.js';
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

  // Tips and thirst run this many times faster during a boost.
  boostFactor() {
    return this.isBoosted() ? BOOST.speedUp : 1;
  }

  canBoost() {
    return !this.isBoosted() && this.time.now >= (this.boostReadyAt || 0) && this.musicPlaying();
  }

  startBoost() {
    if (!this.canBoost()) { SFX.denied(); return false; }
    const now = this.time.now;
    this.boostUntil = now + BOOST.durationMs;
    this.boostReadyAt = this.boostUntil + BOOST.cooldownMs;
    Music.setBoost(true);
    SFX.levelUp();
    this.showToast('🔊 BASS DROP! 90 seconds of party!');
    // Get the party going: thirst comes sooner, seated patrons get up, and
    // everyone picks a new spot (most likely the dance floor).
    for (const p of this.patrons) {
      if (p.leaving || p.gone) continue;
      p.thirstyAt = Math.min(p.thirstyAt, now + randRange(2000, 12000));
      p.nextTipAt = Math.min(p.nextTipAt, now + randRange(500, 3000));
      p.nextMoveAt = now + randRange(0, 1500);
      if (!p.sitting) p.targetGx = undefined;
    }
    this.updateBoostButton();
    return true;
  }

  // Runs a few times a second: ends the boost on time and keeps the button
  // (ready / countdown / cooldown) current.
  tickBoost() {
    if (this.boostUntil !== undefined && !this.isBoosted() && Music.boosted) {
      Music.setBoost(false);
      this.showToast('The bass drop is over. Ready again in a few minutes!');
    }
    this.updateBoostButton();
  }

  updateBoostButton() {
    const button = this.boostButton;
    if (!button) return;
    const now = this.time.now;
    // The button shows only its icon and a small timer; what it's doing
    // is in its hover tip.
    let state = 'ready';
    let timer = '';
    let tip = 'A free 90-second party: bigger, faster tips, more drinks and dancing, and heavy bass. Ready now!';
    if (!this.clubOpen()) {
      state = 'cooldown';
      tip = 'Club closed. Open the doors for the next night first.';
    } else if (this.isBoosted()) {
      state = 'active';
      timer = clock(this.boostUntil - now);
      tip = `The bass is dropping! ${timer} left.`;
    } else if (now < (this.boostReadyAt || 0)) {
      state = 'cooldown';
      timer = clock(this.boostReadyAt - now);
      tip = `Recharging. Ready again in ${timer}.`;
    }
    if (button.dataset.state !== state) button.dataset.state = state;
    if (this.boostLabel.textContent !== timer) this.boostLabel.textContent = timer;
    if (button.dataset.tipText !== tip) {
      button.dataset.tipText = tip;
      refreshTip(button);
    }
  }

  // Wires up the HUD button (see index.html) and the music.
  setupBoost() {
    this.boostButton = document.getElementById('boostButton');
    this.boostLabel = document.getElementById('boostLabel');
    if (this.boostButton) this.boostButton.addEventListener('click', () => { SFX.unlock(); this.syncMusic(); this.startBoost(); });
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
