// ClubScene methods: Top bar readouts, mute button, level-up celebration and toasts.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PROP_TYPES } from '../catalog.js';
import { SFX } from '../sfx.js';

export class HudMixin {
  updateUI() {
    this.cashText.textContent = Math.floor(this.cash);
    this.fansText.textContent = Math.floor(this.fans);
    // Repurposed as a "patrons on the floor / capacity" readout rather than
    // a raw placed-prop count, since capacity (see patronCapacity()) is the
    // number that actually matters for how much the club can earn.
    if (this.placedText) this.placedText.textContent = `${this.patrons.length}/${this.patronCapacity()}`;

    const { level, progress } = this.levelInfo();
    if (this.levelText) this.levelText.textContent = level;
    if (this.xpBarFill) this.xpBarFill.style.width = `${progress}%`;
    if (this.xpText) this.xpText.textContent = `Level ${level}  ·  ${progress} / 100 fans`;
    // this.currentLevel starts out set (in create(), right after loadGame())
    // to whatever level the game actually opened at, so this only fires
    // for a level actually crossed during THIS play session — never once
    // on load, and never for time that passed while the game was closed.
    if (level > this.currentLevel) this.onLevelUp(level);
    this.currentLevel = level;

    this.updateShopUI();
  }

  updateMuteButton() {
    if (!this.muteButton) return;
    this.muteButton.textContent = SFX.muted ? '🔇' : '🔊';
    this.muteButton.classList.toggle('muted', SFX.muted);
  }

  // Celebrates hitting a new level: a fanfare plus a banner naming
  // anything that just became buyable at this level (see PROP_TYPES'
  // unlockLevel), since that's the actual payoff of leveling up and is
  // otherwise easy to miss — the shop icon just quietly stops being greyed
  // out.
  onLevelUp(level) {
    SFX.levelUp();
    const newlyUnlocked = Object.values(PROP_TYPES)
      .filter((def) => def.unlockLevel === level)
      .map((def) => def.label);
    const message = newlyUnlocked.length
      ? `🎉 Level ${level}! ${newlyUnlocked.join(', ')} unlocked!`
      : `🎉 Level ${level}!`;
    this.showToast(message);
  }

  // Shows a brief DOM banner (see #toast in index.html) — plain HTML/CSS,
  // not a Phaser object, so no game-canvas layer is needed for it to work.
  showToast(message, durationMs = 4000) {
    const el = document.getElementById('toast');
    if (!el) return; // older/debug HTML without the toast element — skip silently
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), durationMs);
  }
}
