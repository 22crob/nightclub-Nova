// ClubScene methods: goals, like Nightclub City's. A chain of small goals
// (GOALS in config.js) gives the player something to aim for: three show
// at a time in the Goals panel, each with its progress. A goal reached
// shows a Claim button (the owner wanted goals claimed, not paid
// automatically); claiming pays its cash and XP and brings in the next.
//
// Progress comes from counters (this.goalStats, saved) bumped where things
// happen (bumpGoal()), from bests seen while playing (noteGoalBest()), or
// from live values (the level, how many guests fit, the club's rating).
// The panel drops down from the Goals tab on the left side (#goalSide)
// and closes with its x or the tab again; a goal finishing makes the tab
// cheer and puts a ! on it until it's opened.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { GOALS } from '../config.js';
import { SFX } from '../sfx.js';
import { hideTip } from '../tooltips.js';

export class GoalsMixin {
  // How far along a goal is right now.
  goalProgress(goal) {
    const stats = this.goalStats || {};
    if (goal.stat === 'level') return this.levelInfo().level;
    if (goal.stat === 'capacity') return this.patronCapacity();
    if (goal.stat === 'rating') return this.clubRating() || 0;
    return stats[goal.stat] || 0;
  }

  // The goals showing: the first few not yet done.
  activeGoals() {
    const done = new Set(this.goalsDone || []);
    return GOALS.filter((g) => !done.has(g.id)).slice(0, 3);
  }

  // Something counted happened (a drink served, a party thrown, ...).
  bumpGoal(stat, n = 1) {
    this.goalStats = this.goalStats || {};
    this.goalStats[stat] = (this.goalStats[stat] || 0) + n;
    this.checkGoals();
  }

  // A best-so-far (most guests dancing at once, ...).
  noteGoalBest(stat, value) {
    this.goalStats = this.goalStats || {};
    if (value <= (this.goalStats[stat] || 0)) return;
    this.goalStats[stat] = value;
    this.checkGoals();
  }

  // A showing goal reached: ready to claim.
  goalReady(goal) {
    return this.goalProgress(goal) >= goal.target;
  }

  // Refreshes the panel, and cheers when a goal is newly ready to claim.
  checkGoals() {
    this.goalsDone = this.goalsDone || [];
    this.goalsAnnounced = this.goalsAnnounced || new Set();
    for (const goal of this.activeGoals()) {
      if (!this.goalReady(goal) || this.goalsAnnounced.has(goal.id)) continue;
      this.goalsAnnounced.add(goal.id);
      if (!this.goalsLoaded) continue; // ready since last time: no fanfare on load
      SFX.unlock();
      this.showToast(`🎯 Goal reached: ${goal.text}! Claim it in Goals.`, 4000);
      const button = document.getElementById('goalTab');
      if (button) {
        button.classList.remove('cheer');
        void button.offsetWidth; // restart the animation
        button.classList.add('cheer');
      }
    }
    const ready = this.activeGoals().filter((g) => this.goalReady(g)).length;
    const badge = document.getElementById('goalsBadge');
    if (badge) badge.textContent = ready ? String(ready) : '';
    this.renderGoals();
  }

  // The Claim button: pays the goal and brings in the next.
  claimGoal(id) {
    const goal = this.activeGoals().find((g) => g.id === id);
    if (!goal || !this.goalReady(goal)) { SFX.denied(); return false; }
    this.completeGoal(goal);
    this.checkGoals();
    return true;
  }

  completeGoal(goal) {
    this.goalsDone.push(goal.id);
    this.cash += goal.cash;
    this.fans += goal.xp;
    this.noteIncome('goals', goal.cash);
    SFX.trophy();
    this.showToast(`🎯 Goal claimed: +$${goal.cash}${goal.xp ? ` +${goal.xp} XP` : ''}`, 3500);
    this.updateUI();
    this.saveGame();
  }

  // The panel: each showing goal, its progress and its reward.
  renderGoals(force = false) {
    const list = document.getElementById('goalList');
    if (!list) return;
    const goals = this.activeGoals();
    const key = goals.map((g) => `${g.id}:${Math.min(g.target, Math.floor(this.goalProgress(g)))}`).join('|');
    if (list.dataset.rendered === key && !force) return;
    list.dataset.rendered = key;
    list.innerHTML = '';
    if (goals.length === 0) {
      const row = document.createElement('div');
      row.className = 'goalRow done';
      row.textContent = 'Every goal done. Legend!';
      list.appendChild(row);
      return;
    }
    for (const goal of goals) {
      const have = Math.min(goal.target, Math.floor(this.goalProgress(goal)));
      const row = document.createElement('div');
      row.className = 'goalRow';
      row.dataset.goal = goal.id;
      row.innerHTML = `<div class="goalText"></div><div class="goalBar"><div class="goalFill"></div></div>
        <div class="goalMeta"><span class="goalCount"></span><span class="goalReward"></span></div>`;
      row.querySelector('.goalText').textContent = goal.text;
      row.querySelector('.goalFill').style.width = `${(have / goal.target) * 100}%`;
      row.querySelector('.goalCount').textContent = `${have}/${goal.target}`;
      row.querySelector('.goalReward').textContent = `$${goal.cash}${goal.xp ? ` · ${goal.xp} XP` : ''}`;
      if (this.goalReady(goal)) {
        row.classList.add('ready');
        const claim = document.createElement('div');
        claim.className = 'goalClaim summaryButton';
        claim.textContent = 'Claim';
        claim.addEventListener('click', () => this.claimGoal(goal.id));
        row.appendChild(claim);
      }
      list.appendChild(row);
    }
  }

  // Runs every patron tick: bests seen while playing, and live goals.
  tickGoals() {
    const dancing = this.patrons.filter((p) => !p.gone && typeof p.container.patronAnimState === 'string' && p.container.patronAnimState.startsWith('dance')).length;
    this.noteGoalBest('dancersAtOnce', dancing);
    if (this.guestCount() >= this.patronCapacity()) this.noteGoalBest('fullClub', 1);
    this.checkGoals();
  }

  goalsOpen() {
    return !!document.getElementById('goalSide')?.classList.contains('open');
  }

  // Drops the Goals panel down from its side tab (or closes it).
  toggleGoals(open) {
    const side = document.getElementById('goalSide');
    if (!side) return;
    const show = open ?? !this.goalsOpen();
    side.classList.toggle('open', show);
    if (show) { this.renderGoals(true); this.seenGoals(); }
    hideTip();
  }

  // The Goals panel was opened (the badge counts goals to claim, so it
  // stays until they're claimed).
  seenGoals() {
    document.getElementById('goalTab')?.classList.remove('cheer');
  }

  setupGoals() {
    document.getElementById('goalTab')?.addEventListener('click', () => { SFX.unlock(); this.toggleGoals(); });
    document.getElementById('goalsClose')?.addEventListener('click', () => { SFX.unlock(); this.toggleGoals(false); });
    this.checkGoals();
    this.goalsLoaded = true;
  }
}
