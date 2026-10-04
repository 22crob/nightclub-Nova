// ClubScene methods: Throw a Party. Once a night, while the doors are open,
// the player can pay for a themed party (PARTIES in config.js) that lasts
// the rest of the night: more guests allowed in, arriving faster, tipping
// more, drinking more and bringing more fans. The room's mood lighting
// takes the party's colour, the night clock shows it, and the night's
// summary counts its cost.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { NIGHT, PARTIES } from '../config.js';
import { SFX } from '../sfx.js';

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
    if (!this.doorsOpen()) return 'The doors are closed';
    if (this.party) return 'One party a night';
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
    this.updateNightClock();
    this.saveGame();
    return true;
  }

  // The party is over when the night is.
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
    let state = 'ready';
    let text = 'Throw a Party';
    if (party) {
      state = 'active';
      text = `${party.label} tonight`;
    } else if (!this.doorsOpen()) {
      state = 'off';
      text = this.clubOpen() ? 'Party: too late tonight' : 'Party: club closed';
    }
    if (button.dataset.state !== state) button.dataset.state = state;
    if (this.partyLabel.textContent !== text) this.partyLabel.textContent = text;
    this.updatePartyBanner();
  }

  // While a party is on, a banner takes the button's place: the party's
  // name and how long until it ends (at closing time), like Nightclub
  // City's "Party Started" banner.
  updatePartyBanner() {
    const banner = document.getElementById('partyBanner');
    if (!banner) return;
    const party = this.currentParty();
    const on = !!party && (this.nightPhase === 'open' || this.nightPhase === 'lastCall');
    banner.classList.toggle('open', on);
    if (this.partyButton) this.partyButton.style.display = on ? 'none' : '';
    if (!on) return;
    const end = this.nightStartedAt + NIGHT.lengthMs;
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
      if (blocked) { SFX.denied(); this.showToast(this.party ? `${this.currentParty().emoji} ${this.currentParty().label} is on tonight!` : `🎉 ${blocked}: throw a party while the doors are open.`); return; }
      this.showPartyPicker();
    });
    document.getElementById('partyCancel')?.addEventListener('click', () => this.hidePartyPicker());
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.updatePartyButton() });
    this.updatePartyButton();
  }
}
