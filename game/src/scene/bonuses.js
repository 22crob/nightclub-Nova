// ClubScene methods: clickable guest bonuses. Now and then (BONUS.everyMs)
// a happy guest holds up a gold $ coin over their head, different from the quick reactions (reactions.js). Click it within
// BONUS.lifeMs to collect BONUS.amount; otherwise it fades away. Guests who
// admire a decoration offer a tip coin the same way (this.bonuses holds
// every badge showing). A click on
// a badge always comes first (see the pointer handlers in ClubScene.js), so
// it never opens a card or moves anything underneath.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { BONUS, CHARACTER_DISPLAY_HEIGHT, TOUCH } from '../config.js';
import { SFX } from '../sfx.js';
import { randRange } from '../util.js';

const SIZE = 64;
const SKIN = 0xffc98a;
const INK = 0x3a2200;

export class BonusesMixin {
  // Draws the two badges once: a gold coin with an open hand or a fist.
  makeBonusTextures() {
    if (this.textures.exists('bonus_cash')) return;
    const r = SIZE / 2;
    const badge = (g) => {
      g.fillStyle(0xb87400, 1);
      g.fillCircle(r, r + 2, r - 2);
      g.fillStyle(0xffcf2a, 1);
      g.fillCircle(r, r, r - 2);
      g.fillStyle(0xffef9a, 1);
      g.fillCircle(r, r, r - 8);
      g.fillStyle(0xffffff, 0.6);
      g.fillEllipse(r - 10, r - 16, 20, 8);
      g.lineStyle(3, 0x7a4a00, 1);
      g.strokeCircle(r, r, r - 2);
    };
    const make = (key, draw) => {
      const g = this.add.graphics();
      badge(g);
      draw(g);
      g.generateTexture(key, SIZE, SIZE);
      g.destroy();
    };
    // A cash bonus and a tip are both a plain gold coin with a big $ on it
    // (see offerBonus()); the owner swapped the high five / fist bump
    // badges for a bigger $ (October 2026).
    make('bonus_cash', () => {});
    make('bonus_tip', () => {});
  }

  // Runs with the patron tick: offers a high five now and then, and lets
  // unclaimed badges fade away.
  tickBonuses() {
    const now = this.time.now;
    this.bonuses = this.bonuses || [];
    for (const b of [...this.bonuses]) if (now >= b.expiresAt) this.removeBonus(b, true);
    if (this.nextBonusAt === undefined) this.nextBonusAt = now + randRange(...BONUS.everyMs);
    if (this.bonuses.some((b) => b.kind !== 'tip') || now < this.nextBonusAt) return;
    if (this.guestsHidden) return; // nobody holds up a badge while the club is being edited
    const happy = this.patrons.filter((p) => !p.gone && !p.leaving && !p.arguing && p.mood >= BONUS.minMood && p.container.visible);
    if (happy.length === 0) { this.nextBonusAt = now + 3000; return; } // try again soon
    this.offerBonus(happy[Math.floor(Math.random() * happy.length)]);
  }

  // A badge over a guest's head: a gold $ coin (BONUS.amount),
  // or with `kind` 'tip' a gold coin worth `amount` (see admiring
  // decorations in activities.js). Returns the badge.
  offerBonus(patron, kind = 'cash', amount = BONUS.amount) {
    this.makeBonusTextures();
    this.bonuses = this.bonuses || [];
    const size = kind === 'tip' ? BONUS.tipSize : BONUS.size;
    const icon = this.add.image(0, 0, `bonus_${kind}`).setDisplaySize(size, size);
    const glow = this.add.image(0, 0, 'lightPool').setTint(0xffd84a).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(size * 2, size * 2).setAlpha(0.6);
    const parts = [glow, icon];
    parts.push(this.add.text(0, 0, '$', {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: `${Math.round(size * 0.66)}px`, color: '#2f9b2a', stroke: '#fff7c0', strokeThickness: 3,
    }).setOrigin(0.5, 0.52));
    const holder = this.add.container(0, 0, parts);
    this.patronLayer.add(holder);
    const full = holder.scale;
    holder.setScale(0.2);
    const tweens = [
      this.tweens.add({ targets: holder, scale: full, duration: 260, ease: 'Back.easeOut' }),
      this.tweens.add({ targets: parts.slice(1), y: -5, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      this.tweens.add({ targets: glow, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 }),
    ];
    const b = { patron, kind, amount, size, holder, tweens, expiresAt: this.time.now + BONUS.lifeMs };
    this.bonuses.push(b);
    this.followBonus();
    SFX.tip();
    return b;
  }

  // Keeps each badge over its guest's head (called every frame).
  followBonus() {
    for (const b of [...(this.bonuses || [])]) {
      const c = b.patron.container;
      if (b.patron.gone || !c.active) { this.removeBonus(b, true); continue; }
      b.holder.setPosition(c.x, c.y - CHARACTER_DISPLAY_HEIGHT * 1.02 - b.size / 2); // just above the head
    }
  }

  // The badge under a screen point, or null.
  bonusAt(screenX, screenY, touch = false) {
    const x = (screenX - this.world.x) / this.world.scaleX;
    const y = (screenY - this.world.y) / this.world.scaleY;
    const reach = touch ? TOUCH.bonusReach : 0.7; // a finger is less exact than a mouse
    return (this.bonuses || []).find((b) => !b.collected && Math.hypot(x - b.holder.x, y - b.holder.y) <= b.size * reach) || null;
  }

  // A click on a badge collects it. True if it did.
  clickBonus(pointer) {
    const b = this.bonusAt(pointer.x, pointer.y, pointer.wasTouch);
    if (!b) return false;
    b.collected = true;
    this.noteTutorial?.('bonus');
    this.bumpGoal(b.kind === 'tip' ? 'admired' : 'bonuses');
    this.cash += b.amount;
    this.noteIncome('bonuses', b.amount);
    if (this.partyStats) {
      this.partyStats.bonuses = (this.partyStats.bonuses || 0) + 1;
      this.partyStats.bonusCash = (this.partyStats.bonusCash || 0) + b.amount;
    }
    SFX.tip();
    this.floatMoney(b.holder.x, b.holder.y, `+$${b.amount}`, false);
    b.patron.reactingUntil = 0;
    this.popReaction(b.patron, 'excited', 150);
    this.removeBonus(b, false);
    this.updateUI();
    return true;
  }

  // Takes a badge away (fading if it ran out); after a high five, the next
  // one is a while off.
  removeBonus(b, fade) {
    const i = (this.bonuses || []).indexOf(b);
    if (i < 0) return;
    this.bonuses.splice(i, 1);
    if (b.kind !== 'tip') this.nextBonusAt = this.time.now + randRange(...BONUS.everyMs);
    b.tweens.forEach((t) => t.remove());
    if (fade) {
      this.tweens.add({ targets: b.holder, alpha: 0, scale: 0.4, duration: 300, onComplete: () => b.holder.destroy() });
    } else {
      b.holder.destroy();
    }
  }

  setupBonuses() {
    this.bonuses = [];
    this.events.on('update', () => this.followBonus());
  }
}
