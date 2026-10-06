// ClubScene methods: the drink meter, a little glass cylinder on the right
// edge (see #drinkMeter in index.html). Purple liquid fills it as drinks
// are served, tips come in and bonuses are clicked (METER in config.js,
// fed by noteIncome() in rating.js). When it's full, drinks cost double
// for METER.doubleMs while it drains, then it starts again from empty.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { METER } from '../config.js';
import { SFX } from '../sfx.js';

export class MeterMixin {
  // Something filled the meter a little (ignored while drinks are doubled).
  fillMeter(points) {
    if (this.drinksDoubled()) return;
    this.meterLevel = Math.min(METER.full, (this.meterLevel || 0) + points);
    if (this.meterLevel >= METER.full) this.startDoubleDrinks();
    this.renderMeter();
  }

  // Which money moves fill it, and by how much.
  meterIncome(kind, amount) {
    if (!(amount > 0)) return;
    if (kind === 'drinkMoney') this.fillMeter(METER.perDrink);
    else if (kind === 'tips') this.fillMeter(METER.perTip);
    else if (kind === 'bonuses') this.fillMeter(METER.perBonus);
  }

  drinksDoubled() {
    return this.time.now < (this.doubleDrinksUntil || 0);
  }

  // What a drink's price is multiplied by right now.
  drinkPriceFactor() {
    return this.drinksDoubled() ? METER.priceMultiplier : 1;
  }

  startDoubleDrinks() {
    this.doubleDrinksUntil = this.time.now + METER.doubleMs;
    this.meterLevel = METER.full;
    SFX.levelUp();
    this.showBigPopup('Double Drinks!', `Every drink costs ${METER.priceMultiplier}x for ${Math.round(METER.doubleMs / 1000)} seconds`, 'rush');
    this.highlightBars?.();
    this.renderMeter();
  }

  // Runs every second: drains the meter while drinks are doubled, and
  // empties it when that's over.
  tickMeter() {
    if (this.doubleDrinksUntil && !this.drinksDoubled()) {
      this.doubleDrinksUntil = 0;
      this.meterLevel = 0;
    }
    this.renderMeter();
  }

  renderMeter() {
    const el = this.meterEl || (this.meterEl = document.getElementById('drinkMeter'));
    if (!el) return;
    const doubled = this.drinksDoubled();
    const share = doubled
      ? Math.max(0, (this.doubleDrinksUntil - this.time.now) / METER.doubleMs)
      : (this.meterLevel || 0) / METER.full;
    el.style.setProperty('--fill', `${(share * 100).toFixed(1)}%`);
    el.classList.toggle('doubled', doubled);
    const label = doubled ? `${Math.ceil((this.doubleDrinksUntil - this.time.now) / 1000)}s` : '';
    const timer = el.querySelector('.meterTimer');
    if (timer && timer.textContent !== label) timer.textContent = label;
    el.dataset.tipText = doubled
      ? `Double Drinks! Every drink costs ${METER.priceMultiplier}x for ${label} more.`
      : `Fills up as guests buy drinks, tip and give bonuses. When it's full, drinks cost ${METER.priceMultiplier}x for ${Math.round(METER.doubleMs / 1000)} seconds. ${Math.floor(share * 100)}% full.`;
  }

  setupMeter() {
    this.meterLevel = this.meterLevel || 0;
    this.renderMeter();
  }
}
