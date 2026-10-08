// ClubScene methods: achievements and the trophy wall (ACHIEVEMENTS in
// config.js, earned ones saved as `achievements`). Each is a milestone: a
// goal counter (goalStats, bumped where things happen) or a live value
// (level, popularity, luxury, the longer wall). Reaching one pays its cash
// and XP once, with a big popup. The trophy wall (#trophyBox), opened from
// the 🏅 tab on the left (#trophyTab), shows every badge: earned ones in
// gold, the rest greyed out with how far along they are.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { ACHIEVEMENTS } from '../config.js';
import { SFX } from '../sfx.js';
import { formatMoney } from '../util.js';

export class AchievementsMixin {
  setupAchievements() {
    this.achievements = this.achievements || [];
    document.getElementById('trophyTab')?.addEventListener('click', () => { SFX.unlock(); this.openTrophies(); });
    document.getElementById('trophyClose')?.addEventListener('click', () => document.getElementById('trophyBox')?.classList.remove('open'));
    this.time.addEvent({ delay: 2000, loop: true, callback: () => this.checkAchievements() });
    this.updateTrophyBadge();
  }

  achievementProgress(a) {
    if (a.stat === 'level') return this.levelInfo().level;
    if (a.stat === 'popularity') return this.popularity || 0;
    if (a.stat === 'luxury') return this.luxury();
    if (a.stat === 'wall') return Math.max(this.gridW, this.gridH);
    return (this.goalStats || {})[a.stat] || 0;
  }

  // Pays out an achievement just reached (one per check, so the popups
  // don't cover each other). An old save from before achievements gets the
  // ones it has already reached quietly, without a pile of popups.
  checkAchievements() {
    this.achievements = this.achievements || [];
    const have = new Set(this.achievements);
    if (this.achievementsQuiet) {
      this.achievementsQuiet = false;
      for (const a of ACHIEVEMENTS) if (!have.has(a.id) && this.achievementProgress(a) >= a.target) this.achievements.push(a.id);
      return;
    }
    for (const a of ACHIEVEMENTS) {
      if (have.has(a.id) || this.achievementProgress(a) < a.target) continue;
      this.achievements.push(a.id);
      this.cash += a.cash;
      this.fans += a.xp;
      this.unseenTrophies = (this.unseenTrophies || 0) + 1;
      this.showBigPopup?.(`${a.icon} ${a.name}!`, `${a.text} · +${formatMoney(a.cash)}${a.xp ? ` · +${a.xp} XP` : ''}`);
      SFX.trophy();
      this.updateTrophyBadge();
      this.updateUI();
      this.saveGame();
      if (document.getElementById('trophyBox')?.classList.contains('open')) this.renderTrophies();
      return;
    }
  }

  updateTrophyBadge() {
    const badge = document.getElementById('trophyBadge');
    if (badge) badge.textContent = this.unseenTrophies ? String(this.unseenTrophies) : '';
    document.getElementById('trophyTab')?.classList.toggle('cheer', !!this.unseenTrophies);
  }

  openTrophies() {
    this.unseenTrophies = 0;
    this.updateTrophyBadge();
    this.renderTrophies();
    document.getElementById('trophyBox')?.classList.add('open');
  }

  // The shelf: every badge, earned ones gold.
  renderTrophies() {
    const shelf = document.getElementById('trophyShelf');
    if (!shelf) return;
    const have = new Set(this.achievements || []);
    shelf.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const got = have.has(a.id);
      const now = Math.min(a.target, Math.floor(this.achievementProgress(a)));
      const el = document.createElement('div');
      el.className = `trophy${got ? ' earned' : ''}`;
      el.dataset.tipName = a.name;
      el.dataset.tipText = `${a.text}. ${got ? 'Earned!' : `${now.toLocaleString()} / ${a.target.toLocaleString()}`} Reward: ${formatMoney(a.cash)}${a.xp ? ` and ${a.xp} XP` : ''}.`;
      el.innerHTML = `<div class="trophyIcon">${a.icon}</div><div class="trophyName"></div><div class="trophyBar"><div style="width:${(now / a.target) * 100}%"></div></div>`;
      el.querySelector('.trophyName').textContent = a.name;
      shelf.appendChild(el);
    }
    const count = document.getElementById('trophyCount');
    if (count) count.textContent = `${have.size} / ${ACHIEVEMENTS.length}`;
  }
}
