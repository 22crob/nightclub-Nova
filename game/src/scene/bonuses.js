// ClubScene methods: clickable guest bonuses. Now and then (BONUS.everyMs)
// a happy guest holds up a high five or a fist bump: a gold badge over their
// head, different from the quick reactions (reactions.js). Click it within
// BONUS.lifeMs to collect BONUS.amount; otherwise it fades away. Guests who
// admire a decoration offer a tip coin the same way (this.bonuses holds
// every badge showing). A click on
// a badge always comes first (see the pointer handlers in ClubScene.js), so
// it never opens a card or moves anything underneath.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { BONUS, CHARACTER_DISPLAY_HEIGHT } from '../config.js';
import { SFX } from '../sfx.js';
import { randRange } from '../util.js';

const SIZE = 64;
const SKIN = 0xffc98a;
const INK = 0x3a2200;

export class BonusesMixin {
  // Draws the two badges once: a gold coin with an open hand or a fist.
  makeBonusTextures() {
    if (this.textures.exists('bonus_highfive')) return;
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
    // An open hand, fingers up.
    make('bonus_highfive', (g) => {
      g.fillStyle(SKIN, 1);
      g.lineStyle(2.5, INK, 1);
      const fingers = [[-11, -10, 13], [-4, -15, 17], [3, -15, 17], [10, -12, 14]];
      for (const [x, top, h] of fingers) {
        g.fillRoundedRect(r + x - 3, r + top, 6.5, h, 3);
        g.strokeRoundedRect(r + x - 3, r + top, 6.5, h, 3);
      }
      g.fillRoundedRect(r - 14, r - 1, 28, 19, 7);
      g.strokeRoundedRect(r - 14, r - 1, 28, 19, 7);
      g.fillStyle(SKIN, 1);
      g.fillRect(r - 12.5, r - 1, 25, 5); // hide the seam under the fingers
      g.fillRoundedRect(r - 22, r + 2, 10, 7, 3.5); // thumb
      g.strokeRoundedRect(r - 22, r + 2, 10, 7, 3.5);
      g.fillRect(r - 14.5, r + 3, 4, 5);
    });
    // A tip: a plain coin (the $ is a label on top, see offerBonus()).
    make('bonus_tip', () => {});
    // A fist, knuckles forward, with motion lines.
    make('bonus_fist', (g) => {
      g.fillStyle(SKIN, 1);
      g.lineStyle(2.5, INK, 1);
      g.fillRoundedRect(r - 13, r - 12, 26, 24, 8);
      g.strokeRoundedRect(r - 13, r - 12, 26, 24, 8);
      g.lineBetween(r - 13, r - 3, r + 13, r - 3);
      for (const x of [-6.5, 0, 6.5]) g.lineBetween(r + x, r - 12, r + x, r - 3);
      g.fillRoundedRect(r - 13, r + 1, 16, 7, 3.5); // thumb across
      g.strokeRoundedRect(r - 13, r + 1, 16, 7, 3.5);
      g.lineStyle(2.5, 0xb87400, 1);
      for (const y of [-8, 0, 8]) g.lineBetween(r + 17, r + y, r + 23, r + y);
    });
  }

  // Runs with the patron tick: offers a high five now and then, and lets
  // unclaimed badges fade away.
  tickBonuses() {
    const now = this.time.now;
    this.bonuses = this.bonuses || [];
    for (const b of [...this.bonuses]) if (now >= b.expiresAt) this.removeBonus(b, true);
    if (this.nextBonusAt === undefined) this.nextBonusAt = now + randRange(...BONUS.everyMs);
    if (this.bonuses.some((b) => b.kind !== 'tip') || now < this.nextBonusAt) return;
    const happy = this.patrons.filter((p) => !p.gone && !p.leaving && !p.arguing && p.mood >= BONUS.minMood && p.container.visible);
    if (happy.length === 0) { this.nextBonusAt = now + 3000; return; } // try again soon
    this.offerBonus(happy[Math.floor(Math.random() * happy.length)]);
  }

  // A badge over a guest's head: a high five or fist bump (BONUS.amount),
  // or with `kind` 'tip' a gold coin worth `amount` (see admiring
  // decorations in activities.js). Returns the badge.
  offerBonus(patron, kind = Math.random() < 0.5 ? 'highfive' : 'fist', amount = BONUS.amount) {
    this.makeBonusTextures();
    this.bonuses = this.bonuses || [];
    const size = kind === 'tip' ? BONUS.tipSize : BONUS.size;
    const icon = this.add.image(0, 0, `bonus_${kind}`).setDisplaySize(size, size);
    const glow = this.add.image(0, 0, 'lightPool').setTint(0xffd84a).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(size * 2, size * 2).setAlpha(0.6);
    const parts = [glow, icon];
    if (kind === 'tip') {
      parts.push(this.add.text(0, 0, '$', {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: `${Math.round(size * 0.62)}px`, color: '#2f9b2a', stroke: '#fff7c0', strokeThickness: 2,
      }).setOrigin(0.5, 0.52));
    }
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
  bonusAt(screenX, screenY) {
    const x = (screenX - this.world.x) / this.world.scaleX;
    const y = (screenY - this.world.y) / this.world.scaleY;
    return (this.bonuses || []).find((b) => !b.collected && Math.hypot(x - b.holder.x, y - b.holder.y) <= b.size * 0.7) || null;
  }

  // A click on a badge collects it. True if it did.
  clickBonus(pointer) {
    const b = this.bonusAt(pointer.x, pointer.y);
    if (!b) return false;
    b.collected = true;
    this.cash += b.amount;
    this.noteIncome('bonuses', b.amount);
    if (this.partyStats) {
      this.partyStats.bonuses = (this.partyStats.bonuses || 0) + 1;
      this.partyStats.bonusCash = (this.partyStats.bonusCash || 0) + b.amount;
    }
    SFX.tip();
    const { x, y } = b.holder;
    const label = this.add.text(x, y, `+$${b.amount}`, {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '20px', color: '#7dff6a', stroke: '#0b2a0b', strokeThickness: 5,
    }).setOrigin(0.5, 1).setScale(0.5);
    this.patronLayer.add(label);
    this.tweens.add({ targets: label, scale: 1.15, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: label, y: y - 40, alpha: 0, delay: 500, duration: 700, ease: 'Quad.easeIn', onComplete: () => label.destroy() });
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
