// ClubScene methods: Throw a Party. One at a time, the player pays for a
// themed party (PARTIES in config.js). It goes in three steps:
//  1. a countdown (PARTY_COUNTDOWN_MS) while word gets out;
//  2. the party (PARTY_LENGTH_MS): a big crowd (`crowd`) turns up and lines
//     up outside the door, and
//     the bouncer lets them in a few at a time; guests tip, drink and bring
//     fans more, and the room takes the party's colour;
//  3. the end: party guests finish what they're doing and drift home, and
//     a good party earns fans (XP) for every guest it brought.
// A banner shows the countdown, then the time left.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PARTIES, PARTY_COUNTDOWN_MS, PARTY_LENGTH_MS, PATRON_POPUP_Y, XP } from '../config.js';
import { SFX } from '../sfx.js';
import { refreshTip } from '../tooltips.js';
import { randRange } from '../util.js';

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export class PartiesMixin {
  // The party that's on right now (not while it's counting down), or null.
  currentParty() {
    if (!this.party || this.partyPhase !== 'running') return null;
    return PARTIES.find((p) => p.key === this.party) || null;
  }

  // The party thrown, counting down or running.
  thrownParty() {
    return this.party ? PARTIES.find((p) => p.key === this.party) || null : null;
  }

  // One of the party's effects ('capacity', 'arrivals', 'tips', 'thirst',
  // 'fans'), or `none` when no party is running.
  partyEffect(name, none) {
    const party = this.currentParty();
    return party ? party[name] : none;
  }

  // Why a party can't be thrown right now, or null if it can.
  partyBlocker(def) {
    if (this.party) return 'One party at a time';
    if (def && this.levelInfo().level < def.unlockLevel) return `Unlocks at level ${def.unlockLevel}`;
    if (def && this.cash < def.cost) return 'Not enough cash';
    return null;
  }

  throwParty(key) {
    const def = PARTIES.find((p) => p.key === key);
    if (!def || this.partyBlocker(def)) { SFX.denied(); return false; }
    this.cash -= def.cost;
    this.party = key;
    this.partyPhase = 'countdown';
    this.partyStartsAt = this.time.now + PARTY_COUNTDOWN_MS;
    this.noteIncome('partyCost', def.cost);
    SFX.tip();
    this.showToast(`${def.emoji} ${def.label} in ${PARTY_COUNTDOWN_MS / 1000} seconds! The word is out...`);
    this.hidePartyPicker();
    this.updateUI();
    this.updatePartyButton();
    this.saveGame();
    return true;
  }

  // The countdown is over: the crowd turns up.
  startParty() {
    const def = this.thrownParty();
    if (!def) return;
    this.partyPhase = 'running';
    this.partyStartedAt = this.time.now;
    // What happens during the party, for the summary at the end (see
    // showPartySummary()). Only counted while it's running.
    this.partyStats = { guests: 0, celebs: [], drinks: 0, drinkRevenue: 0, bonuses: 0, bonusCash: 0, moodSum: 0, moodSamples: 0, fights: 0, ejections: 0 };
    this.moodColor = def.shade;
    this.drawMoodShade();
    SFX.levelUp();
    this.showToast(`${def.emoji} The ${def.label} has started! Here comes the crowd.`);
    // The crowd: everyone waits their turn in the line outside.
    this.partyCrowd = [];
    for (let i = 0; i < def.crowd; i++) this.partyCrowd.push({ partyGuest: true });
    // They arrive in a stream, filling the line.
    for (let i = 0; i < 8; i++) this.time.delayedCall(300 + i * 450, () => this.callPartyCrowd());
    this.updatePartyButton();
  }

  // Sends the next party guest up the street to the line, if there's room
  // in it (see admitFromLine(), which calls this as the line moves up).
  callPartyCrowd() {
    if (!this.partyCrowd || this.partyCrowd.length === 0) return;
    if (this.streetQueue.length >= this.streetSpots().len) return;
    this.streetArrival(false, this.partyCrowd.shift());
  }

  // Time's up: the party guests finish what they're doing and drift home
  // over the next minute, and a good party earns fans.
  endParty() {
    const def = this.thrownParty();
    const running = this.partyPhase === 'running';
    this.party = null;
    this.partyPhase = null;
    this.partyCrowd = [];
    this.moodColor = undefined;
    this.drawMoodShade();
    if (def && running) {
      const now = this.time.now;
      for (const p of this.patrons) {
        if (p.partyGuest && !p.leaving && !p.gone) p.despawnAt = Math.min(p.despawnAt, now + randRange(...def.leaveOverMs));
      }
      const stats = this.partyStats || { guests: 0 };
      const vibe = this.clubVibe() ?? 50;
      const fans = Math.round(Math.min(XP.partyMax, stats.guests * XP.partyPerGuest * (vibe / 60)));
      this.fans += fans;
      this.showPartySummary(def, stats, fans);
      this.updateUI();
    }
    this.partyStats = null;
    this.updatePartyButton();
  }

  // Samples how happy the crowd is, for the party's average (called with
  // the patron tick while a party runs).
  samplePartyMood() {
    const stats = this.partyStats;
    if (!stats || this.partyPhase !== 'running') return;
    const inside = this.patrons.filter((p) => !p.gone && !p.leaving);
    if (inside.length === 0) return;
    stats.moodSum += inside.reduce((sum, p) => sum + p.mood, 0) / inside.length;
    stats.moodSamples += 1;
  }

  // The party's wrap-up: what happened while it was on. Closing it carries
  // on with the club as normal.
  showPartySummary(def, stats, fans) {
    const box = document.getElementById('partySummary');
    if (!box) { this.showToast(`${def.emoji} The ${def.label} is over: ${stats.guests} guests came.`); return; }
    const happiness = stats.moodSamples ? Math.round(stats.moodSum / stats.moodSamples) : null;
    const face = happiness === null ? '' : happiness >= 70 ? '😍' : happiness >= 45 ? '🙂' : '😕';
    const celebs = stats.celebs || [];
    const rows = [
      ['🎟️', 'Guests admitted', `${stats.guests}`],
      ['⭐', 'Celebrities', celebs.length ? celebs.join(', ') : 'None this time'],
      ['🍹', 'Drinks served', `${stats.drinks}`],
      ['💵', 'Drink revenue', `$${Math.round(stats.drinkRevenue)}`],
      ['✋', 'Bonuses collected', `${stats.bonuses}${stats.bonusCash ? ` ($${stats.bonusCash})` : ''}`],
      [face || '🙂', 'Average happiness', happiness === null ? '-' : `${happiness}%`],
      ['💢', 'Fights / ejections', `${stats.fights} / ${stats.ejections}`],
      ['❤️', 'Fans earned', `+${fans}`],
    ];
    document.getElementById('partySummaryTitle').textContent = `${def.emoji} ${def.label} wrap-up`;
    const list = document.getElementById('partySummaryRows');
    list.innerHTML = '';
    for (const [icon, label, value] of rows) {
      const row = document.createElement('div');
      row.className = 'summaryRow';
      for (const [cls, text] of [['sIcon', icon], ['sLabel', label], ['sValue', value]]) {
        const cell = document.createElement('div');
        cell.className = cls;
        cell.textContent = text;
        row.appendChild(cell);
      }
      list.appendChild(row);
    }
    box.classList.add('open');
    SFX.levelUp();
  }

  hidePartySummary() {
    document.getElementById('partySummary')?.classList.remove('open');
  }

  // A party guest came in (see trySpawnPatron()).
  notePartyGuest(patron) {
    patron.partyGuest = true;
    if (this.partyStats) this.partyStats.guests += 1;
  }

  updatePartyButton() {
    const button = this.partyButton;
    if (!button) return;
    const now = this.time.now;
    const def = this.thrownParty();
    // Move the party along: countdown, running, over.
    if (def && this.partyPhase === 'countdown' && now >= this.partyStartsAt) this.startParty();
    if (def && this.partyPhase === 'running' && now >= this.partyStartedAt + PARTY_LENGTH_MS) {
      this.endParty();
      return;
    }
    let state = 'ready';
    let text = `Pay for a themed party: a packed club, more dancing and drinking, bigger tips and more fans, for ${PARTY_LENGTH_MS / 60000} minutes.`;
    if (def && this.partyPhase === 'countdown') {
      state = 'active';
      text = `${def.emoji} ${def.label} starts in ${clock(this.partyStartsAt - now)}!`;
    } else if (def) {
      state = 'active';
      text = `${def.emoji} ${def.label} is on! ${clock(this.partyStartedAt + PARTY_LENGTH_MS - now)} left.`;
    }
    if (button.dataset.state !== state) button.dataset.state = state;
    if (button.dataset.tipText !== text) {
      button.dataset.tipText = text;
      refreshTip(button);
    }
    this.updatePartyBanner();
  }

  // The party banner, like Nightclub City's "Party Started": a countdown
  // to the start, then the time left.
  updatePartyBanner() {
    const banner = document.getElementById('partyBanner');
    if (!banner) return;
    const def = this.thrownParty();
    banner.classList.toggle('open', !!def);
    banner.dataset.phase = this.partyPhase || '';
    if (!def) return;
    const now = this.time.now;
    const counting = this.partyPhase === 'countdown';
    const name = `${def.emoji} ${def.label}`;
    const set = (id, text) => { const el = document.getElementById(id); if (el && el.textContent !== text) el.textContent = text; };
    set('bannerName', name);
    set('bannerTitle', counting ? 'Party starts in' : 'Party started');
    if (counting) {
      set('bannerLeft', `Starts in: ${clock(this.partyStartsAt - now)}`);
      document.getElementById('bannerFill').style.width = `${(100 * (1 - (this.partyStartsAt - now) / PARTY_COUNTDOWN_MS)).toFixed(1)}%`;
    } else {
      const left = Math.max(0, this.partyStartedAt + PARTY_LENGTH_MS - now);
      set('bannerLeft', `Ends in: ${clock(left)}`);
      document.getElementById('bannerFill').style.width = `${(100 * (1 - left / PARTY_LENGTH_MS)).toFixed(1)}%`;
    }
  }

  // The list of parties, each with its price and whether it can be thrown.
  showPartyPicker() {
    const box = document.getElementById('partyPicker');
    const list = document.getElementById('partyList');
    if (!box || !list) return;
    list.innerHTML = '';
    for (const def of PARTIES) {
      const blocked = this.partyBlocker(def);
      const row = document.createElement('div');
      row.className = `partyRow${blocked ? ' blocked' : ''}`;
      row.dataset.party = def.key;
      row.innerHTML = `<div class="partyEmoji">${def.emoji}</div>
        <div class="partyText"><div class="partyName">${def.label}</div><div class="partyBlurb">${def.blurb}</div>
        <div class="partyPerks">a crowd of ${def.crowd} · tips ×${def.tips}${blocked ? ` · <span class="partyWhy">${blocked}</span>` : ''}</div></div>
        <div class="partyCost">$${def.cost}</div>`;
      row.addEventListener('click', () => this.throwParty(def.key));
      list.appendChild(row);
    }
    box.classList.add('open');
  }

  hidePartyPicker() {
    document.getElementById('partyPicker')?.classList.remove('open');
  }

  // Wires up the HUD button and the picker (see index.html).
  setupParties() {
    document.getElementById('partySummaryOk')?.addEventListener('click', () => this.hidePartySummary());
    this.partyButton = document.getElementById('partyButton');
    this.partyLabel = document.getElementById('partyLabel');
    this.partyButton?.addEventListener('click', () => {
      SFX.unlock();
      const blocked = this.partyBlocker();
      if (blocked) { SFX.denied(); this.showToast(`${this.thrownParty().emoji} ${this.thrownParty().label} is on!`); return; }
      this.showPartyPicker();
    });
    document.getElementById('partyCancel')?.addEventListener('click', () => this.hidePartyPicker());
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.updatePartyButton() });
    this.updatePartyButton();
  }
}
