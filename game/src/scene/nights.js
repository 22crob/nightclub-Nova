// ClubScene methods: club nights. The club opens for a night on a clock
// (9 PM to 3 AM, a few real minutes, see NIGHT in config.js). Near the end
// it's last call: nobody new comes in. At closing time everyone heads home,
// the music stops and the lights come up, and a summary card shows how the
// night went, with a star rating and a fan bonus. The player opens the
// doors for the next night when they're ready, so between nights is the
// time to build and redecorate.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { NIGHT } from '../config.js';
import { SFX } from '../sfx.js';

export class NightsMixin {
  // True while new guests may come in.
  doorsOpen() {
    return this.nightPhase === 'open';
  }

  // True while the club is running (anything but closed between nights).
  clubOpen() {
    return this.nightPhase !== 'closed';
  }

  // Opens the doors for night `number`.
  startNight(number) {
    this.night = number;
    this.nightPhase = 'open';
    this.nightStartedAt = this.time.now;
    this.nightStats = {
      cash: this.cash,
      fans: this.fans,
      drinks: this.drinksSold || 0,
      guests: this.guestsServed || 0,
      stormed: 0,
      drinkMoney: 0,
      tips: 0,
      wages: 0,
      vibeSum: 0,
      vibeCount: 0,
      peakCrowd: 0,
    };
    this.hideNightSummary();
    this.setLightsUp(false);
    this.syncMusic();
    this.updateNightClock();
    this.saveGame();
  }

  // Money in and out, for tonight's summary.
  noteIncome(kind, amount) {
    if (!this.nightStats) return;
    this.nightStats[kind] += amount;
  }

  noteStormOut() {
    if (this.nightStats) this.nightStats.stormed += 1;
  }

  // Runs every second: moves the clock on, samples the vibe, and moves the
  // night from open to last call to closing to closed.
  tickNight() {
    if (!this.nightStats) return;
    const elapsed = this.time.now - this.nightStartedAt;
    const s = this.nightStats;
    if (this.nightPhase !== 'closed') {
      const vibe = this.clubVibe();
      if (vibe != null) {
        s.vibeSum += vibe;
        s.vibeCount += 1;
      }
      s.peakCrowd = Math.max(s.peakCrowd, this.patrons.filter((p) => !p.leaving && !p.gone).length);
    }
    if (this.nightPhase === 'open' && elapsed >= NIGHT.lengthMs - NIGHT.lastCallMs) {
      this.nightPhase = 'lastCall';
      SFX.levelUp();
      this.showToast('🔔 Last call! No new guests tonight.');
    }
    if (this.nightPhase === 'lastCall' && elapsed >= NIGHT.lengthMs) this.closeForTheNight();
    if (this.nightPhase === 'closing') {
      const empty = this.patrons.length === 0;
      if (empty || this.time.now - this.closingAt > NIGHT.closeWaitMs) this.endNight();
    }
    this.updateNightClock();
  }

  // Closing time: everyone heads for the door.
  closeForTheNight() {
    this.nightPhase = 'closing';
    this.closingAt = this.time.now;
    this.showToast('🌙 Closing time! Everyone heads home.');
    for (const p of this.patrons) {
      if (!p.leaving && !p.gone) this.startPatronDeparture(p);
    }
  }

  // The last guest is out: lights up, music off, and the night's summary.
  endNight() {
    for (const p of [...this.patrons]) if (!p.gone) this.finalizeDeparture(p); // stragglers
    this.nightPhase = 'closed';
    const s = this.nightStats;
    const avgVibe = s.vibeCount ? s.vibeSum / s.vibeCount : 0;
    const stars = NIGHT.starVibes.filter((v) => avgVibe >= v).length + 1;
    const bonus = NIGHT.starFans[stars - 1];
    this.fans += bonus;
    const result = {
      night: this.night,
      guests: (this.guestsServed || 0) - s.guests,
      stormed: s.stormed,
      drinks: (this.drinksSold || 0) - s.drinks,
      drinkMoney: s.drinkMoney,
      tips: s.tips,
      wages: s.wages,
      profit: s.drinkMoney + s.tips - s.wages,
      fans: Math.round(this.fans - s.fans),
      bonus,
      avgVibe: Math.round(avgVibe),
      peakCrowd: s.peakCrowd,
      stars,
    };
    result.best = result.profit > (this.bestNightProfit ?? -Infinity) && result.guests > 0;
    if (result.best) this.bestNightProfit = result.profit;
    this.lastNight = result;
    this.setLightsUp(true);
    this.syncMusic();
    SFX.levelUp();
    this.updateUI();
    this.updateNightClock();
    this.showNightSummary(result);
    this.saveGame();
  }

  // The room's mood shading lifts between nights.
  setLightsUp(up) {
    const alpha = up ? NIGHT.closedShade : 1;
    const shades = [this.floorShade, this.wallShade].filter(Boolean);
    this.tweens.add({ targets: shades, alpha, duration: 1200 });
  }

  // "9:40 PM" on the night's clock.
  nightTimeLabel() {
    const elapsed = Math.min(this.time.now - this.nightStartedAt, NIGHT.lengthMs);
    const minutes = NIGHT.startHour * 60 + Math.floor((elapsed / NIGHT.lengthMs) * NIGHT.hours * 6) * 10;
    const h24 = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
  }

  // The clock under the cash: night number, time, and a bar for the night.
  updateNightClock() {
    const el = this.nightClock;
    if (!el) return;
    const phase = this.nightPhase;
    let text;
    if (phase === 'closed') text = `Night ${this.night} is over`;
    else if (phase === 'closing') text = `Closing time · Night ${this.night}`;
    else text = `Night ${this.night} · ${this.nightTimeLabel()}${phase === 'lastCall' ? ' · Last call!' : ''}`;
    if (this.nightClockText.textContent !== text) this.nightClockText.textContent = text;
    if (el.dataset.phase !== phase) el.dataset.phase = phase;
    const done = phase === 'closed' ? 1 : Math.min(1, (this.time.now - this.nightStartedAt) / NIGHT.lengthMs);
    this.nightClockFill.style.width = `${(done * 100).toFixed(1)}%`;
    if (this.openButton) this.openButton.style.display = phase === 'closed' && !this.summaryShown ? '' : 'none';
  }

  showNightSummary(r) {
    const card = document.getElementById('nightSummary');
    if (!card) return;
    const money = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n))}`;
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('summaryTitle', `Night ${r.night} is over!`);
    set('summaryStars', '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars));
    set('summaryVerdict', NIGHT.verdicts[r.stars - 1] + (r.best ? ' Your best night yet!' : ''));
    set('summaryGuests', `${r.guests}${r.stormed ? ` (${r.stormed} stormed out)` : ''}`);
    set('summaryCrowd', `${r.peakCrowd}`);
    set('summaryVibe', `${r.avgVibe}%`);
    set('summaryDrinks', `${r.drinks} · ${money(r.drinkMoney)}`);
    set('summaryTips', money(r.tips));
    set('summaryWages', money(-r.wages));
    set('summaryProfit', money(r.profit));
    set('summaryFans', `${r.fans >= 0 ? '+' : ''}${r.fans} ★ (incl. +${r.bonus} rating bonus)`);
    set('summaryOpen', `Open the doors for Night ${r.night + 1}`);
    document.getElementById('summaryProfit')?.classList.toggle('loss', r.profit < 0);
    card.classList.add('open');
    this.summaryShown = true;
    this.updateNightClock();
  }

  hideNightSummary() {
    const card = document.getElementById('nightSummary');
    if (card) card.classList.remove('open');
    this.summaryShown = false;
  }

  // Wires up the clock and the summary card's buttons (see index.html), and
  // opens the doors for the first night of this session.
  setupNights(savedNight) {
    this.nightClock = document.getElementById('nightClock');
    this.nightClockText = document.getElementById('nightClockText');
    this.nightClockFill = document.getElementById('nightClockFill');
    this.openButton = document.getElementById('openButton');
    const open = () => { SFX.unlock(); this.startNight(this.night + 1); };
    document.getElementById('summaryOpen')?.addEventListener('click', open);
    this.openButton?.addEventListener('click', open);
    document.getElementById('summaryLater')?.addEventListener('click', () => {
      this.hideNightSummary();
      this.updateNightClock();
    });
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickNight() });
    // A reload mid-night starts that night over; a club closed for the
    // night opens the next one.
    this.startNight(savedNight || 1);
  }
}
