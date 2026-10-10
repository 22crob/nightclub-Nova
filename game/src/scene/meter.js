// ClubScene methods: the stock meter, a little glass cylinder on the right
// edge (see #drinkMeter in index.html). It shows how much drink the bars
// have left (drinkStockLeft() / maxDrinkStock(), upgrades.js): full when
// they're fully stocked, going down a step with every drink served. Click
// it to restock (restockBar()): the liquid rises to the top, then drains
// again as drinks are bought. It glows red when stock runs low.
// (It used to fill with income and double drink prices; the owner turned
// it into the refill meter in October 2026.)
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { DRINK_STOCK } from '../config.js';
import { SFX } from '../sfx.js';
import { formatMoney } from '../util.js';

export class MeterMixin {
  // Drink prices aren't changed by the meter any more (kept for serveDrink()).
  drinkPriceFactor() {
    return 1;
  }

  // A click on the meter: restock the bars, with the liquid rising to the top.
  clickMeter() {
    SFX.unlock();
    if (this.restockCost() <= 0) { this.showToast('🍾 The bars are already fully stocked.'); return false; }
    if (this.cash < this.restockCost()) {
      SFX.denied();
      this.showToast(`🍾 Restocking costs ${formatMoney(this.restockCost())}: not enough cash yet.`);
      return false;
    }
    const el = this.meterEl || document.getElementById('drinkMeter');
    el?.classList.add('refilling');
    clearTimeout(this.refillTimer);
    this.refillTimer = setTimeout(() => el?.classList.remove('refilling'), 1700);
    const done = this.restockBar();
    this.renderMeter();
    return done;
  }

  // Runs every second, and after every drink and restock.
  tickMeter() {
    this.renderMeter();
  }

  renderMeter() {
    const el = this.meterEl || (this.meterEl = document.getElementById('drinkMeter'));
    if (!el || !this.maxDrinkStock) return;
    const max = this.maxDrinkStock();
    const left = this.drinkStockLeft();
    const share = max > 0 ? left / max : 0;
    el.style.setProperty('--fill', `${(share * 100).toFixed(1)}%`);
    el.classList.toggle('low', share <= DRINK_STOCK.lowShare);
    el.classList.toggle('empty', left <= 0);
    const cost = this.restockCost();
    el.dataset.tipText = cost > 0
      ? `${left} of ${max} drinks left. Click to restock for ${formatMoney(cost)}.`
      : `Fully stocked: ${max} drinks. It goes down as guests buy drinks; click it to restock.`;
  }

  setupMeter() {
    const el = document.getElementById('drinkMeter');
    el?.addEventListener('click', () => this.clickMeter());
    this.renderMeter();
  }
}
