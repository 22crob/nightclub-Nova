// ClubScene methods: quick reactions over guests' heads. A little drawn icon
// (a happy face, an excited face, a drink, a music note) pops up above a
// guest, floats up and fades away in a second or two. Guests react when
// they enjoy dancing, get a drink or have a good chat or dance together,
// and to the Bass Boost and Drink Rush buttons (see boost.js). Each one
// starts after a small random delay, so a crowd doesn't react in unison.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { CHARACTER_DISPLAY_HEIGHT, REACTIONS } from '../config.js';
import { randRange } from '../util.js';

const SIZE = 64; // texture size; shown at REACTIONS.size px

export class ReactionsMixin {
  // Draws the reaction icons once, as textures.
  makeReactionTextures() {
    if (this.textures.exists('react_happy')) return;
    const r = SIZE / 2;
    const ink = 0x3a2200;
    const face = (g) => {
      g.fillStyle(0xe8a200, 1);
      g.fillCircle(r, r + 2, r - 4);
      g.fillStyle(0xffd23a, 1);
      g.fillCircle(r, r, r - 4);
      g.fillStyle(0xffffff, 0.55);
      g.fillEllipse(r - 10, r - 14, 18, 10);
      g.lineStyle(3, ink, 1);
      g.strokeCircle(r, r, r - 4);
      g.fillStyle(0xff7a8a, 0.75); // rosy cheeks
      g.fillEllipse(r - 16, r + 7, 10, 6);
      g.fillEllipse(r + 16, r + 7, 10, 6);
    };
    const happyEyes = (g) => {
      g.lineStyle(3.5, ink, 1);
      for (const x of [r - 10, r + 10]) {
        g.beginPath();
        g.arc(x, r - 2, 5, Math.PI * 1.1, Math.PI * 1.9);
        g.strokePath();
      }
    };
    const make = (key, draw) => {
      const g = this.add.graphics();
      draw(g);
      g.generateTexture(key, SIZE, SIZE);
      g.destroy();
    };

    // A happy face: closed smiling eyes and a big smile.
    make('react_happy', (g) => {
      face(g);
      happyEyes(g);
      g.lineStyle(3.5, ink, 1);
      g.beginPath();
      g.arc(r, r + 2, 13, Math.PI * 0.15, Math.PI * 0.85);
      g.strokePath();
    });

    // Excited: the same face with a wide-open grin.
    make('react_excited', (g) => {
      face(g);
      happyEyes(g);
      g.fillStyle(0x5a1a10, 1);
      g.slice(r, r + 4, 14, 0, Math.PI, false);
      g.fillPath();
      g.fillStyle(0xff6f7d, 1);
      g.fillEllipse(r, r + 13, 13, 6);
      g.lineStyle(3, ink, 1);
      g.slice(r, r + 4, 14, 0, Math.PI, false);
      g.strokePath();
    });

    // A cocktail on a white badge.
    make('react_drink', (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(r, r, r - 4);
      g.lineStyle(3, 0x10233d, 1);
      g.strokeCircle(r, r, r - 4);
      g.lineStyle(3, 0x2fae2a, 1);
      g.lineBetween(r + 4, r - 4, r + 14, r - 20); // straw
      g.fillStyle(0xff4fa3, 1);
      g.fillTriangle(r - 15, r - 9, r + 15, r - 9, r, r + 7);
      g.lineStyle(2.5, 0x10233d, 1);
      g.strokeTriangle(r - 15, r - 9, r + 15, r - 9, r, r + 7);
      g.lineBetween(r, r + 7, r, r + 17);
      g.lineBetween(r - 8, r + 18, r + 8, r + 18);
      g.fillStyle(0xe0102f, 1);
      g.fillCircle(r - 8, r - 12, 4); // cherry
    });

    // A music note on a purple badge.
    make('react_note', (g) => {
      g.fillStyle(0x8a3cf0, 1);
      g.fillCircle(r, r, r - 4);
      g.fillStyle(0xffffff, 0.3);
      g.fillEllipse(r - 8, r - 14, 20, 9);
      g.lineStyle(3, 0x10233d, 1);
      g.strokeCircle(r, r, r - 4);
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(r - 8, r + 10, 13, 10);
      g.fillEllipse(r + 10, r + 6, 13, 10);
      g.fillRect(r - 3, r - 14, 4, 24);
      g.fillRect(r + 15, r - 18, 4, 24);
      g.fillRect(r - 3, r - 18, 22, 6);
    });
  }

  // Pops a reaction icon over a guest's head after a short random delay:
  // it springs up, floats and fades within a second or two. A guest only
  // shows one at a time.
  popReaction(patron, kind = 'happy', delay = randRange(...REACTIONS.delayMs)) {
    if (!patron || patron.gone || !this.textures.exists(`react_${kind}`)) return false;
    const now = this.time.now;
    if (now < (patron.reactingUntil || 0)) return false;
    const life = randRange(...REACTIONS.lifeMs);
    patron.reactingUntil = now + delay + life;
    this.time.delayedCall(delay, () => {
      const c = patron.container;
      if (patron.gone || !c.active || !c.visible) return;
      const y = c.y - CHARACTER_DISPLAY_HEIGHT * 1.04; // just above the head
      const icon = this.add.image(c.x + randRange(-6, 6), y, `react_${kind}`)
        .setDisplaySize(REACTIONS.size, REACTIONS.size).setOrigin(0.5, 1);
      const full = icon.scaleX;
      icon.setScale(full * 0.3);
      this.patronLayer.add(icon);
      this.tweens.add({ targets: icon, scaleX: full, scaleY: full, duration: 180, ease: 'Back.easeOut' });
      this.tweens.add({
        targets: icon,
        y: y - REACTIONS.rise,
        alpha: { from: 1, to: 0 },
        duration: life,
        ease: 'Quad.easeIn',
        onComplete: () => icon.destroy(),
      });
    });
    return true;
  }

  // Dancers show they're having fun now and then (see tickActivity()).
  tickDanceJoy(patron) {
    const now = this.time.now;
    if (patron.nextDanceJoyAt === undefined) {
      patron.nextDanceJoyAt = now + randRange(1500, 6000);
      return;
    }
    if (now < patron.nextDanceJoyAt) return;
    const boosted = this.isBoosted && this.isBoosted();
    patron.nextDanceJoyAt = now + randRange(...(boosted ? REACTIONS.danceEveryBoostMs : REACTIONS.danceEveryMs));
    if (patron.mood >= REACTIONS.danceMinMood) this.popReaction(patron, boosted && Math.random() < 0.5 ? 'note' : 'happy');
  }
}
