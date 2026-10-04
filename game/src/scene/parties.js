// ClubScene methods: Throw a Party. One at a time, the player pays for a
// themed party (PARTIES in config.js). It goes in three steps:
//  1. a countdown (PARTY_COUNTDOWN_MS) while word gets out;
//  2. the party (PARTY_LENGTH_MS): a big crowd (`crowd`) turns up and lines
//     up outside the door, with a few celebrities among them (`celebs`), and
//     the bouncer lets them in a few at a time; guests tip, drink and bring
//     fans more, and the room takes the party's colour;
//  3. the end: party guests finish what they're doing and drift home, and
//     a good party earns fans (XP) for every guest it brought.
// A banner shows the countdown, then the time left.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { CELEBRITIES, PARTIES, PARTY_COUNTDOWN_MS, PARTY_LENGTH_MS, PATRON_POPUP_Y, XP } from '../config.js';
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
    this.partyStats = { guests: 0, celebs: 0 };
    this.moodColor = def.shade;
    this.drawMoodShade(this.gridSize);
    SFX.levelUp();
    this.showToast(`${def.emoji} The ${def.label} has started! Here comes the crowd.`);
    // The crowd: everyone waits their turn in the line outside, and the
    // celebrities are mixed in among them.
    const celebs = Math.max(0, Math.round(randRange(def.celebs[0], def.celebs[1] + 0.99) - 0.49));
    const names = [...CELEBRITIES].sort(() => Math.random() - 0.5);
    this.partyCrowd = [];
    for (let i = 0; i < def.crowd; i++) this.partyCrowd.push({ partyGuest: true });
    for (let i = 0; i < celebs; i++) {
      const at = Math.floor(Math.random() * (this.partyCrowd.length + 1));
      this.partyCrowd.splice(at, 0, { partyGuest: true, celeb: names[i % names.length] });
    }
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
    this.drawMoodShade(this.gridSize);
    if (def && running) {
      const now = this.time.now;
      for (const p of this.patrons) {
        if (p.partyGuest && !p.leaving && !p.gone) p.despawnAt = Math.min(p.despawnAt, now + randRange(...def.leaveOverMs));
      }
      const stats = this.partyStats || { guests: 0 };
      const vibe = this.clubVibe() ?? 50;
      const fans = Math.round(Math.min(XP.partyMax, stats.guests * XP.partyPerGuest * (vibe / 60)));
      this.fans += fans;
      this.showToast(`${def.emoji} The ${def.label} is over: ${stats.guests} guests came${fans > 0 ? `, +${fans} fans!` : '.'} Guests will head home soon.`, 6000);
      this.updateUI();
    }
    this.updatePartyButton();
  }

  // A party guest came in (see trySpawnPatron()).
  notePartyGuest(patron, info) {
    patron.partyGuest = true;
    if (this.partyStats) this.partyStats.guests += 1;
    if (info.celeb) this.welcomeCelebrity(patron, info.celeb);
  }

  // A celebrity: a star over their head, a gold glow, a fanfare as they
  // come in, big tips, and lots of fans when they leave happy.
  welcomeCelebrity(patron, name) {
    patron.celeb = true;
    patron.name = name;
    if (this.partyStats) this.partyStats.celebs += 1;
    const c = patron.container;
    this.addStarIcon(c);
    const shadow = c.list[0];
    if (shadow && shadow.setFillStyle) shadow.setFillStyle(0xffd24d, 0.8);
    this.floatText(c.x, c.y - PATRON_POPUP_Y - 16, `⭐ ${name}!`, '#ffd24d');
    this.showToast(`⭐ Celebrity alert: ${name} just walked in!`);
    SFX.levelUp();
  }

  // The little star that marks a celebrity, in line outside or inside.
  addStarIcon(container) {
    if (container.starIcon) return;
    const star = this.add.text(0, -96, '⭐', { fontSize: '16px' }).setOrigin(0.5, 1);
    container.add(star);
    container.starIcon = star;
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
    let text = `Pay for a themed party: a crowd, celebrities, bigger tips and more fans, for ${PARTY_LENGTH_MS / 60000} minutes.`;
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
        <div class="partyPerks">+${def.capacity} guests · tips ×${def.tips}${blocked ? ` · <span class="partyWhy">${blocked}</span>` : ''}</div></div>
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
