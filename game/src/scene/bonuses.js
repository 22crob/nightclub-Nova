// ClubScene methods: clickable guest bonuses. Now and then (BONUS.everyMs)
// a happy guest holds up a high five or a fist bump: a gold badge over their
// head, different from the quick reactions (reactions.js). Click it within
// BONUS.lifeMs to collect BONUS.amount; otherwise it fades away. A click on
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

  // Runs with the patron tick: offers a bonus now and then, and lets an
  // unclaimed one fade away.
  tickBonuses() {
    const now = this.time.now;
    if (this.bonus && now >= this.bonus.expiresAt) this.removeBonus(true);
    if (this.nextBonusAt === undefined) this.nextBonusAt = now + randRange(...BONUS.everyMs);
    if (this.bonus || now < this.nextBonusAt) return;
    const happy = this.patrons.filter((p) => !p.gone && !p.leaving && !p.arguing && p.mood >= BONUS.minMood && p.container.visible);
    if (happy.length === 0) { this.nextBonusAt = now + 3000; return; } // try again soon
    this.offerBonus(happy[Math.floor(Math.random() * happy.length)]);
  }

  // A guest holds up a high five or a fist bump.
  offerBonus(patron) {
    this.makeBonusTextures();
    const kind = Math.random() < 0.5 ? 'highfive' : 'fist';
    const icon = this.add.image(0, 0, `bonus_${kind}`).setDisplaySize(BONUS.size, BONUS.size);
    const glow = this.add.image(0, 0, 'lightPool').setTint(0xffd84a).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(BONUS.size * 2, BONUS.size * 2).setAlpha(0.6);
    const holder = this.add.container(0, 0, [glow, icon]);
    this.patronLayer.add(holder);
    const full = holder.scale;
    holder.setScale(0.2);
    const tweens = [
      this.tweens.add({ targets: holder, scale: full, duration: 260, ease: 'Back.easeOut' }),
      this.tweens.add({ targets: icon, y: -5, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      this.tweens.add({ targets: glow, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 }),
    ];
    this.bonus = { patron, kind, holder, tweens, expiresAt: this.time.now + BONUS.lifeMs };
    this.followBonus();
    SFX.tip();
  }

  // Keeps the badge over its guest's head (called every frame).
  followBonus() {
    const b = this.bonus;
    if (!b) return;
    const c = b.patron.container;
    if (b.patron.gone || !c.active) { this.removeBonus(true); return; }
    b.holder.setPosition(c.x, c.y - CHARACTER_DISPLAY_HEIGHT * 1.12);
  }

  // The bonus badge under a screen point, or null.
  bonusAt(screenX, screenY) {
    const b = this.bonus;
    if (!b || b.collected) return null;
    const x = (screenX - this.world.x) / this.world.scaleX;
    const y = (screenY - this.world.y) / this.world.scaleY;
    return Math.hypot(x - b.holder.x, y - b.holder.y) <= BONUS.size * 0.7 ? b : null;
  }

  // A click on the badge collects it. True if it did.
  clickBonus(pointer) {
    const b = this.bonusAt(pointer.x, pointer.y);
    if (!b) return false;
    b.collected = true;
    this.cash += BONUS.amount;
    this.noteIncome('bonuses', BONUS.amount);
    if (this.partyStats) {
      this.partyStats.bonuses = (this.partyStats.bonuses || 0) + 1;
      this.partyStats.bonusCash = (this.partyStats.bonusCash || 0) + BONUS.amount;
    }
    SFX.tip();
    const { x, y } = b.holder;
    const label = this.add.text(x, y, `+$${BONUS.amount}`, {
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '20px', color: '#7dff6a', stroke: '#0b2a0b', strokeThickness: 5,
    }).setOrigin(0.5, 1).setScale(0.5);
    this.patronLayer.add(label);
    this.tweens.add({ targets: label, scale: 1.15, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: label, y: y - 40, alpha: 0, delay: 500, duration: 700, ease: 'Quad.easeIn', onComplete: () => label.destroy() });
    b.patron.reactingUntil = 0;
    this.popReaction(b.patron, 'excited', 150);
    this.removeBonus(false);
    this.updateUI();
    return true;
  }

  // Takes the badge away (fading if it ran out) and sets the next one.
  removeBonus(fade) {
    const b = this.bonus;
    if (!b) return;
    this.bonus = null;
    this.nextBonusAt = this.time.now + randRange(...BONUS.everyMs);
    b.tweens.forEach((t) => t.remove());
    if (fade) {
      this.tweens.add({ targets: b.holder, alpha: 0, scale: 0.4, duration: 300, onComplete: () => b.holder.destroy() });
    } else {
      b.holder.destroy();
    }
  }

  setupBonuses() {
    this.events.on('update', () => this.followBonus());
  }
}
