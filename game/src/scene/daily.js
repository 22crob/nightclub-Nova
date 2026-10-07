// ClubScene methods: the daily gift. The first time the game is opened each
// day (local date) a gift box pops up with a 7-day streak: coming back the
// next day moves the streak on (after day 7 it starts again at day 1),
// missing a day starts it over. Bigger gifts later in the week; day 7 also
// gives a free decoration for the inventory. Saved as `daily`: { last, streak }.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PROP_TYPES } from '../catalog.js';
import { DAILY } from '../config.js';
import { SFX } from '../sfx.js';
import { iconSvg } from '../uiIcons.js';
import { formatMoney } from '../util.js';

// A Date as "YYYY-MM-DD" in local time.
export function dayKey(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function previousDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

export class DailyMixin {
  // Which streak day today would be (1-7), given the last day collected.
  dailyStreakFor(today) {
    const st = this.daily || {};
    if (st.last === today) return st.streak || 1;
    if (st.last && st.last === previousDay(today)) return ((st.streak || 0) % DAILY.rewards.length) + 1;
    return 1;
  }

  canCollectDaily(today = dayKey(new Date())) {
    return !this.daily || this.daily.last !== today;
  }

  // What a day's gift is at the current level: cash grows a little with
  // level; XP as listed; day 7 adds a decoration.
  dailyGift(day) {
    const r = DAILY.rewards[day - 1];
    const level = this.levelInfo().level;
    return { cash: Math.round(r.cash * (1 + DAILY.cashPerLevel * (level - 1))), xp: r.xp || 0, decor: !!r.decor };
  }

  // A decoration for the day-7 gift: any unlocked one.
  dailyDecor() {
    const level = this.levelInfo().level;
    const pick = Object.keys(PROP_TYPES).filter((k) => PROP_TYPES[k].category === 'Decorations' && (PROP_TYPES[k].unlockLevel || 1) <= level);
    return pick.length ? pick[Math.floor(Math.random() * pick.length)] : null;
  }

  setupDaily() {
    document.getElementById('dailyCollect')?.addEventListener('click', () => this.collectDaily());
    // A new club names itself first; the gift comes after (see confirmClubName()).
    if (!document.getElementById('namePrompt')?.classList.contains('open')) this.showDaily();
  }

  showDaily(today = dayKey(new Date())) {
    const box = document.getElementById('dailyBox');
    if (!box || !this.canCollectDaily(today)) return false;
    const day = this.dailyStreakFor(today);
    const row = document.getElementById('dailyDays');
    row.innerHTML = '';
    for (let d = 1; d <= DAILY.rewards.length; d++) {
      const g = this.dailyGift(d);
      const tile = document.createElement('div');
      tile.className = 'dayTile' + (d < day ? ' done' : d === day ? ' today' : '');
      tile.innerHTML = `<div class="dayName"></div><div class="dayPic">${iconSvg(g.decor ? 'artGift' : 'cash')}</div><div class="dayCash"></div><div class="dayXp"></div>`;
      tile.querySelector('.dayName').textContent = `Day ${d}`;
      tile.querySelector('.dayCash').textContent = formatMoney(g.cash);
      tile.querySelector('.dayXp').textContent = [g.xp ? `+${g.xp} XP` : '', g.decor ? '+ decor' : ''].filter(Boolean).join(' ');
      row.appendChild(tile);
    }
    document.getElementById('dailySub').textContent = day > 1
      ? `Day ${day} in a row! Come back tomorrow to keep your streak going.`
      : 'Come back every day: the gifts get bigger the longer your streak.';
    box.dataset.today = today;
    box.classList.add('open');
    return true;
  }

  // Pays today's gift and moves the streak on. Returns what was given.
  collectDaily(today = document.getElementById('dailyBox')?.dataset.today || dayKey(new Date())) {
    document.getElementById('dailyBox')?.classList.remove('open');
    if (!this.canCollectDaily(today)) return null;
    const day = this.dailyStreakFor(today);
    const gift = this.dailyGift(day);
    this.daily = { last: today, streak: day };
    this.cash += gift.cash;
    this.fans += gift.xp;
    let decor = null;
    if (gift.decor) {
      decor = this.dailyDecor();
      if (decor) this.addToInventory(decor, 1);
    }
    SFX.levelUp();
    this.showBigPopup?.(`Day ${day} gift!`, `+${formatMoney(gift.cash)}${gift.xp ? ` +${gift.xp} XP` : ''}${decor ? ` + ${PROP_TYPES[decor].label}` : ''}`, 'celeb');
    this.updateUI();
    this.refreshDock?.();
    this.saveGame();
    return { day, ...gift, decor };
  }
}
