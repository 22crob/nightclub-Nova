// ClubScene methods: the DJ, bar and seating upgrades (settings DJ,
// BAR_TRICKS, BAR_TRAINING, DRINK_STOCK and VIP_BOOTH in config.js).
//   - A better DJ booth entertains more (djQuality(), used in mood.js).
//   - Song Dedication: the DJ plays one for a guest (their card).
//   - Bar Tricks: a bartender shows off; bigger tips at that bar for a while.
//   - Bartender training: every bartender works faster (Staff panel).
//   - Drink stock: drinks run out and the bars need restocking (Staff panel).
//   - VIP booths: big spenders and celebrities pay a reservation to sit there.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PROP_TYPES, VIP_BOOTHS } from '../catalog.js';
import { BAR_TRAINING, BAR_TRICKS, CHARACTER_DISPLAY_HEIGHT, DJ, DRINK_STOCK, PATRON_POPUP_Y, VIP_BOOTH } from '../config.js';
import { SFX } from '../sfx.js';
import { randRange } from '../util.js';

export class UpgradesMixin {
  // --- The DJ ---------------------------------------------------------------

  // How entertaining the club's DJ booth is: qualityMin for the cheapest
  // booth up to qualityMax for the priciest.
  djQuality() {
    const booth = this.clubBooth && this.clubBooth();
    if (!booth) return 1;
    const costs = Object.values(PROP_TYPES).filter((d) => d.staff === 'dj').map((d) => d.cost || 0);
    const lo = Math.min(...costs), hi = Math.max(...costs);
    const t = hi > lo ? ((PROP_TYPES[booth.type].cost || 0) - lo) / (hi - lo) : 0;
    return DJ.qualityMin + (DJ.qualityMax - DJ.qualityMin) * t;
  }

  dedicationReady() {
    return this.time.now >= (this.dedicationAt || 0);
  }

  // The DJ plays a song for this guest: a big cheer for them.
  dedicateSong(patron) {
    if (!patron || patron.gone || patron.leaving || !this.dedicationReady() || !this.musicPlaying()) { SFX.denied(); return false; }
    this.dedicationAt = this.time.now + DJ.dedicationCooldownMs;
    patron.mood = Math.min(100, patron.mood + DJ.dedicationMood);
    patron.fun = Math.min(100, patron.fun + DJ.dedicationFun);
    const booth = this.clubBooth && this.clubBooth();
    if (booth && booth.staff) this.staffSay(booth.staff, `🎵 This one's for ${patron.name}!`);
    this.popReaction(patron, 'excited', 300);
    this.floatText(patron.container.x, patron.container.y - PATRON_POPUP_Y - 10, '🎵💖', '#ff9ae0');
    SFX.levelUp();
    this.refreshInfoCard();
    return true;
  }

  // --- Bartenders ------------------------------------------------------------

  // Training: every bartender works this much faster.
  trainingSpeed() {
    return 1 + (this.barTraining || 0) * BAR_TRAINING.speedPer;
  }

  nextTraining() {
    const n = this.barTraining || 0;
    if (n >= BAR_TRAINING.costs.length) return null;
    return { level: n + 1, cost: BAR_TRAINING.costs[n], unlockLevel: BAR_TRAINING.levels[n] };
  }

  trainBartenders() {
    const next = this.nextTraining();
    if (!next || this.levelInfo().level < next.unlockLevel || this.cash < next.cost) { SFX.denied(); return false; }
    this.cash -= next.cost;
    this.barTraining = next.level;
    this.awardPurchaseXp(next.cost, undefined, undefined, `training:${next.level}`, true);
    this.showToast(`🎓 Your bartenders are trained up: they work ${Math.round((this.trainingSpeed() - 1) * 100)}% faster!`);
    SFX.levelUp();
    this.updateUI();
    this.saveGame();
    return true;
  }

  barTricksReady(rec) {
    return !!rec.staff && this.time.now >= (rec.staff.tricksAt || 0);
  }

  // A bartender shows off: guests nearby cheer up, and tips at that bar are
  // bigger for a while.
  barTricks(rec) {
    if (!rec || !rec.staff || !this.barTricksReady(rec)) { SFX.denied(); return false; }
    const b = rec.staff;
    const now = this.time.now;
    b.tricksUntil = now + BAR_TRICKS.durationMs;
    b.tricksAt = now + BAR_TRICKS.durationMs + BAR_TRICKS.cooldownMs;
    const { x, y } = b.container;
    this.floatText(x, y - CHARACTER_DISPLAY_HEIGHT * 1.1, '🎩 Bar Tricks!', '#7dffc4');
    // The bottles fly: a few spinning across the bar.
    for (let k = 0; k < 3; k++) {
      const bottle = this.add.text(x, y - CHARACTER_DISPLAY_HEIGHT * 0.7, '🍾', { fontSize: '16px' }).setOrigin(0.5);
      this.world.add(bottle);
      bottle.setDepth(1e6);
      this.tweens.add({ targets: bottle, y: bottle.y - 40 - k * 12, angle: 360 * (k % 2 ? -1 : 1), duration: 420, yoyo: true, delay: k * 160, ease: 'Sine.easeOut', onComplete: () => bottle.destroy() });
    }
    for (const p of this.patrons) {
      if (p.gone || p.leaving) continue;
      if (Math.abs(p.gx - rec.anchor[0]) + Math.abs(p.gy - rec.anchor[1]) > BAR_TRICKS.range) continue;
      p.mood = Math.min(100, p.mood + BAR_TRICKS.cheerMood);
      this.popReaction(p, 'excited', randRange(200, 900));
    }
    SFX.levelUp();
    this.refreshInfoCard();
    return true;
  }

  // Tips at this bar are bigger while one of its bartenders is doing tricks.
  barTricksFactor(rec) {
    const now = this.time.now;
    return this.barGroup(rec).some((u) => u.staff && now < (u.staff.tricksUntil || 0)) ? BAR_TRICKS.tipMultiplier : 1;
  }

  // --- Drink stock -----------------------------------------------------------

  maxDrinkStock() {
    return DRINK_STOCK.base + DRINK_STOCK.perGuest * this.patronCapacity();
  }

  // Drinks left (a new club, or a save from before stock, starts full).
  drinkStockLeft() {
    if (this.drinkStock == null) this.drinkStock = this.maxDrinkStock();
    return Math.min(this.drinkStock, this.maxDrinkStock());
  }

  useDrinkStock() {
    this.drinkStock = Math.max(0, this.drinkStockLeft() - 1);
    this.warnDrinkStock();
  }

  restockCost() {
    return (this.maxDrinkStock() - this.drinkStockLeft()) * DRINK_STOCK.costPerDrink;
  }

  restockBar() {
    const cost = this.restockCost();
    if (cost <= 0 || this.cash < cost) { SFX.denied(); return false; }
    this.cash -= cost;
    this.noteIncome('restock', cost);
    this.drinkStock = this.maxDrinkStock();
    SFX.place();
    this.showToast('📦 The bars are fully stocked!');
    this.updateUI();
    this.saveGame();
    return true;
  }

  // A bartender says so when the drinks are running low or have run out.
  warnDrinkStock() {
    const left = this.drinkStockLeft();
    if (left > this.maxDrinkStock() * DRINK_STOCK.lowShare) return;
    const now = this.time.now;
    if (now < (this.stockWarnAt || 0)) return;
    this.stockWarnAt = now + DRINK_STOCK.warnEveryMs;
    const rec = this.hireableRecords().find((r) => r.staff);
    if (rec) this.staffSay(rec.staff, left === 0 ? "We're out of drinks! Restock in Staff." : 'Running low on drinks! Restock in Staff.');
  }

  // --- VIP booths ------------------------------------------------------------

  // A big spender, VIP guest or celebrity sits at a VIP booth: they pay for it.
  vipBoothFee(patron, rec) {
    if (!VIP_BOOTHS.has(rec.type) || patron.paidBooth) return 0;
    if (!patron.celeb && !(patron.type && patron.type.vipSeats)) return 0;
    patron.paidBooth = true;
    const fee = Math.max(VIP_BOOTH.feeMin, Math.round((PROP_TYPES[rec.type].cost || 0) * VIP_BOOTH.feeShare));
    this.cash += fee;
    this.noteIncome('tips', fee);
    patron.spent = (patron.spent || 0) + fee;
    this.floatMoney(patron.container.x, patron.container.y - PATRON_POPUP_Y, `+$${fee} VIP`);
    this.updateUI();
    return fee;
  }
}
