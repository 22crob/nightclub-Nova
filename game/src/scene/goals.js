// ClubScene methods: goals, like Nightclub City's. A chain of small goals
// (GOALS in config.js) gives the player something to aim for: three show
// at a time in a panel on the left, each with its progress, and finishing
// one pays its cash and XP straight away and brings in the next.
//
// Progress comes from counters (this.goalStats, saved) bumped where things
// happen (bumpGoal()), from bests seen while playing (noteGoalBest()), or
// from live values (the level, how many guests fit, the club's rating).
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { GOALS } from '../config.js';
import { SFX } from '../sfx.js';

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

  // Pays out any showing goal that's been reached, and refreshes the panel.
  checkGoals() {
    this.goalsDone = this.goalsDone || [];
    let finished = true;
    while (finished) {
      finished = false;
      for (const goal of this.activeGoals()) {
        if (this.goalProgress(goal) < goal.target) continue;
        this.completeGoal(goal);
        finished = true;
        break;
      }
    }
    this.renderGoals();
  }

  completeGoal(goal) {
    this.goalsDone.push(goal.id);
    this.cash += goal.cash;
    this.fans += goal.xp;
    this.noteIncome('goals', goal.cash);
    SFX.levelUp();
    this.showToast(`🎯 Goal complete: ${goal.text}! +$${goal.cash}${goal.xp ? ` +${goal.xp} XP` : ''}`, 4500);
    this.justDone = goal.id;
    this.updateUI();
    this.saveGame();
  }

  // The panel: each showing goal, its progress and its reward.
  renderGoals() {
    const list = document.getElementById('goalList');
    if (!list) return;
    const goals = this.activeGoals();
    const key = goals.map((g) => `${g.id}:${Math.min(g.target, this.goalProgress(g))}`).join('|');
    if (list.dataset.rendered === key) return;
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

  setupGoals() {
    const head = document.getElementById('goalsHead');
    head?.addEventListener('click', () => document.getElementById('goals')?.classList.toggle('collapsed'));
    this.checkGoals();
  }
}
