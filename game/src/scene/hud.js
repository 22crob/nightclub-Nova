// ClubScene methods: Top bar readouts, mute button, level-up celebration and toasts.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { EXPANSION, FLOOR_DECAL_PROPS, PROP_TYPES } from '../catalog.js';
import { BARTENDERS, CELEBRITIES, PARTIES } from '../config.js';
import { realSpriteIconFor, renderIsoIcon } from '../icons.js';
import { SFX } from '../sfx.js';
import { hideTip } from '../tooltips.js';
import { iconSvg } from '../uiIcons.js';

// What kind of thing each shop category is, for the level-up menu's tips.
const KIND = {
  Bars: 'New bar', Seating: 'New seating', 'Dance Floors': 'New dance floor', Floors: 'New regular floor',
  Wallpaper: 'New wallpaper', Decorations: 'New decoration', 'DJ Booths': 'New DJ booth',
};

export class HudMixin {
  updateUI() {
    this.cashText.textContent = Math.floor(this.cash);
    this.fansText.textContent = Math.floor(this.fans);
    if (this.luxuryText) this.luxuryText.textContent = this.luxury();
    const rating = this.clubRating();
    const ratingEl = document.getElementById('ratingVal');
    if (ratingEl) ratingEl.textContent = rating == null ? '–' : String(rating);
    // Repurposed as a "patrons on the floor / capacity" readout rather than
    // a raw placed-prop count, since capacity (see patronCapacity()) is the
    // number that actually matters for how much the club can earn.
    if (this.placedText) this.placedText.textContent = `${this.patrons.length}/${this.patronCapacity()}`;

    const { level, into, need, progress } = this.levelInfo();
    if (this.levelText) this.levelText.textContent = level;
    if (this.xpBarFill) this.xpBarFill.style.width = `${(progress * 100).toFixed(1)}%`;
    if (this.xpText) this.xpText.textContent = `Level ${level}  ·  ${into} / ${need} fans`;
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
    this.showLevelUp(level);
  }

  // Everything that unlocks at `level`: shop items, parties and a bigger
  // club. Each is { name, kind, picture (an image URL) or art (a drawn
  // icon name) or emoji }.
  unlocksAt(level) {
    const out = [];
    for (const [key, def] of Object.entries(PROP_TYPES)) {
      if ((def.unlockLevel || 1) !== level) continue;
      out.push({ name: def.label, kind: KIND[def.category] || 'New item',
        picture: realSpriteIconFor(key) || renderIsoIcon(def.color, FLOOR_DECAL_PROPS.has(key)) });
    }
    for (const party of PARTIES) {
      if (party.unlockLevel === level) out.push({ name: party.label, kind: 'New party', emoji: party.emoji });
    }
    if (level > 1 && BARTENDERS.levels.includes(level)) {
      out.push({ name: '+1 Bartender', kind: 'You can hire one more bartender in the Staff tab', art: 'catStaff' });
    }
    for (const celeb of CELEBRITIES) {
      if (celeb.level === level) out.push({ name: celeb.name, kind: `New celebrity (${'★'.repeat(celeb.fame)}): they can now come to your parties`, portrait: celeb.character });
    }
    for (const limit of EXPANSION.limits) {
      if (limit.level === level && level > 1) out.push({ name: `Walls up to ${limit.size} tiles`, kind: 'Expand your club a row at a time in the Expand tab', art: 'tabExpand' });
    }
    return out;
  }

  // The level-up menu, like Nightclub City's: the new level and a card for
  // everything it unlocked, with its picture; hover a card for what it is.
  showLevelUp(level) {
    const box = document.getElementById('levelUp');
    const grid = document.getElementById('levelUnlocks');
    if (!box || !grid) { this.showToast(`🎉 Level ${level}!`); return; }
    const unlocks = this.unlocksAt(level);
    document.getElementById('levelUpTitle').textContent = `Level ${level}!`;
    document.getElementById('levelUpSub').textContent = unlocks.length ? 'You unlocked:' : 'Keep it up: more unlocks at the next level!';
    grid.innerHTML = '';
    for (const u of unlocks) {
      const tile = document.createElement('div');
      tile.className = 'unlockTile';
      tile.dataset.tipName = u.name;
      tile.dataset.tipText = u.kind;
      const pic = document.createElement('div');
      pic.className = 'unlockPic';
      if (u.portrait !== undefined) {
        const face = document.createElement('div');
        face.className = 'unlockFace';
        this.celebPortrait(face, u.portrait);
        pic.appendChild(face);
      }
      else if (u.picture) pic.style.backgroundImage = `url(${u.picture})`;
      else if (u.art) pic.innerHTML = iconSvg(u.art);
      else pic.textContent = u.emoji || '';
      const name = document.createElement('div');
      name.className = 'unlockName';
      name.textContent = u.name;
      tile.append(pic, name);
      grid.appendChild(tile);
    }
    box.classList.add('open');
  }

  hideLevelUp() {
    document.getElementById('levelUp')?.classList.remove('open');
    hideTip();
  }

  // Wires up the level-up menu's buttons (see index.html).
  setupLevelUp() {
    const box = document.getElementById('levelUp');
    if (!box || box.dataset.wired) return;
    box.dataset.wired = '1';
    document.getElementById('levelOk')?.addEventListener('click', () => this.hideLevelUp());
    document.getElementById('levelShop')?.addEventListener('click', () => { this.hideLevelUp(); this.setDockTab('decor'); });
  }

  // Shows a brief DOM banner (see #toast in index.html) — plain HTML/CSS,
  // not a Phaser object, so no game-canvas layer is needed for it to work.
  // A big popup in the middle of the screen for a moment: `theme` is
  // 'boost', 'rush' or 'celeb' (colours in style.css).
  showBigPopup(title, sub = '', theme = 'boost', durationMs = 1800) {
    const el = document.getElementById('bigPopup');
    if (!el) { this.showToast(`${title} ${sub}`); return; }
    el.querySelector('.bpTitle').textContent = title;
    el.querySelector('.bpSub').textContent = sub;
    el.dataset.theme = theme;
    el.style.setProperty('--bp-ms', `${durationMs}ms`);
    el.classList.remove('show');
    void el.offsetWidth; // restart the animation
    el.classList.add('show');
  }

  showToast(message, durationMs = 4000) {
    const el = document.getElementById('toast');
    if (!el) return; // older/debug HTML without the toast element — skip silently
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), durationMs);
  }
}
