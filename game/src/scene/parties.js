// ClubScene methods: Throw a Party. One at a time, the player can pay for a
// themed party (PARTIES in config.js) that lasts PARTY_LENGTH_MS: more
// guests allowed in, arriving faster, tipping more, drinking more and
// bringing more fans. The room's mood lighting takes the party's colour,
// and a banner counts down to the end.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PARTIES, PARTY_LENGTH_MS } from '../config.js';
import { SFX } from '../sfx.js';
import { refreshTip } from '../tooltips.js';

export class PartiesMixin {
  // Tonight's party, or null.
  currentParty() {
    return this.party ? PARTIES.find((p) => p.key === this.party) || null : null;
  }

  // One of tonight's party effects ('capacity', 'arrivals', 'tips',
  // 'thirst', 'fans'), or `none` without a party.
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
    this.partyStartedAt = this.time.now;
    this.noteIncome('partyCost', def.cost);
    this.moodColor = def.shade;
    this.drawMoodShade(this.gridSize);
    SFX.levelUp();
    this.showToast(`${def.emoji} ${def.label}! The word is out: more guests are on their way.`);
    this.hidePartyPicker();
    // The line outside fills up straight away.
    for (let i = 0; i < 3; i++) this.time.delayedCall(400 + i * 700, () => this.streetArrival());
    this.updateUI();
    this.updatePartyButton();
    this.saveGame();
    return true;
  }

  // The party is over when its time is up.
  endParty() {
    this.party = null;
    this.moodColor = undefined;
    this.drawMoodShade(this.gridSize);
    this.updatePartyButton();
  }

  updatePartyButton() {
    const button = this.partyButton;
    if (!button) return;
    const party = this.currentParty();
    // Icon only; the state is in the hover tip.
    // A party ends when its time is up.
    if (party && this.time.now >= this.partyStartedAt + PARTY_LENGTH_MS) {
      this.endParty();
      this.showToast(`${party.emoji} The ${party.label} is over. Throw another whenever you like!`);
      return;
    }
    let state = 'ready';
    let text = 'Pay for a themed party: more guests, bigger tips, more fans, for 3 minutes.';
    if (party) {
      state = 'active';
      text = `${party.emoji} ${party.label} is on!`;
    }
    if (button.dataset.state !== state) button.dataset.state = state;
    if (button.dataset.tipText !== text) {
      button.dataset.tipText = text;
      refreshTip(button);
    }
    this.updatePartyBanner();
  }

  // While a party is on, a banner takes the button's place: the party's
  // name and how long until it ends (at closing time), like Nightclub
  // City's "Party Started" banner.
  updatePartyBanner() {
    const banner = document.getElementById('partyBanner');
    if (!banner) return;
    const party = this.currentParty();
    const on = !!party;
    banner.classList.toggle('open', on);
    if (!on) return;
    const end = this.partyStartedAt + PARTY_LENGTH_MS;
    const left = Math.max(0, end - this.time.now);
    const s = Math.ceil(left / 1000);
    const name = `${party.emoji} ${party.label}`;
    const el = document.getElementById('bannerName');
    if (el.textContent !== name) el.textContent = name;
    document.getElementById('bannerLeft').textContent = `Ends in: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const span = Math.max(1, end - this.partyStartedAt);
    document.getElementById('bannerFill').style.width = `${(100 * (1 - left / span)).toFixed(1)}%`;
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
      if (blocked) { SFX.denied(); this.showToast(`${this.currentParty().emoji} ${this.currentParty().label} is on!`); return; }
      this.showPartyPicker();
    });
    document.getElementById('partyCancel')?.addEventListener('click', () => this.hidePartyPicker());
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.updatePartyButton() });
    this.updatePartyButton();
  }
}
