// ClubScene methods: what each party looks like while it runs. Guests
// dress for it (a costume piece drawn on them, dressGuest()) and the room
// gets its own effect (ambient bits floating about, partyAmbient()):
//   House Party   party hats, confetti and balloons
//   Hip Hop Night snapback caps and gold chains, gold music notes
//   Neon Night    neon glasses, neon lights flying round the room
//   VIP Gala      gold crowns, gold sparkles
//   Foam Party    dark sunglasses, big soap bubbles floating up and popping
//                 (it was the Glow Party, too like Neon Night; the save key stays 'glow')
//   Masquerade    masks over the eyes, feathers drifting down
//   Neon Rave     neon glasses and glow necklaces, sweeping lasers and lights
// Nothing pulses to the beat (the owner asked for no beat-pulsing lights).
// Started and stopped by startParty() / endParty() in parties.js.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { WALL_HEIGHT } from '../config.js';
import { randRange } from '../util.js';

// Where things sit on a guest (container units, feet at 0): measured on the
// guest sheets. The eye line, the top of the head and the neck.
const EYES = -53;
const HEAD_TOP = -77;
const NECK = -42;

// The box costume textures are drawn in (container units: x from -x, y
// from -y), at `res` times the size for zooming in, `variants` per costume.
const COSTUME_BOX = { x: 32, y: 108, w: 64, h: 84, res: 2, variants: 4 };

const NEON = [0xff3dd2, 0x3de0ff, 0xb45cff, 0x7dff5a, 0xffe14a];

// The costume piece each party gives its guests, and whether it only shows
// from the front (masks and glasses are on the face).
const COSTUME = {
  house: { draw: 'partyHat' }, hiphop: { draw: 'snapback' }, neon: { draw: 'neonGlasses', front: true },
  gala: { draw: 'crown' }, glow: { draw: 'shades', front: true }, masquerade: { draw: 'mask', front: true }, rave: { draw: 'raveGear', front: true },
};

export class PartyFxMixin {
  startPartyFx(def) {
    this.stopPartyFx();
    const fx = { key: def.key, objects: [], events: [] };
    this.partyFx = fx;
    for (const p of this.patrons) if (!p.gone) this.dressGuest(p);
    const every = (ms, fn) => fx.events.push(this.time.addEvent({ delay: ms, loop: true, callback: fn }));
    const k = def.key;
    if (k === 'house') { every(140, () => this.fxConfetti()); every(2600, () => this.fxBalloon()); }
    else if (k === 'hiphop') every(500, () => this.fxNote(0xffd23d, '♪'));
    else if (k === 'neon') for (let i = 0; i < 7; i++) this.fxNeonLight(NEON[i % NEON.length], i);
    else if (k === 'gala') every(160, () => this.fxSparkle(0xffd76a));
    else if (k === 'glow') every(160, () => this.fxFoamBubble());
    else if (k === 'masquerade') { every(700, () => this.fxFeather()); every(260, () => this.fxSparkle(0xd6a8ff)); }
    else if (k === 'rave') { this.fxLasers(); for (let i = 0; i < 5; i++) this.fxNeonLight(NEON[i % NEON.length], i); }
    // Front-only costume pieces hide when a guest turns their back.
    fx.onUpdate = () => {
      for (const p of this.patrons) {
        const acc = p.container && p.container.partyCostume;
        if (acc && acc.frontOnly) acc.setVisible(p.container.patronDir !== 'back');
      }
    };
    this.events.on('update', fx.onUpdate);
  }

  stopPartyFx() {
    const fx = this.partyFx;
    if (!fx) return;
    this.partyFx = null;
    for (const e of fx.events) e.remove();
    for (const o of fx.objects) if (o.active) { this.tweens.killTweensOf(o); o.destroy(); }
    this.events.off('update', fx.onUpdate);
    for (const p of this.patrons) this.undressGuest(p);
  }

  // --- Costumes ----------------------------------------------------------------

  dressGuest(p) {
    const fx = this.partyFx;
    const c = p.container;
    if (!fx || !c || !c.active || c.partyCostume || p.celeb) return;
    const costume = COSTUME[fx.key];
    if (!costume) return;
    const g = this.add.image(-COSTUME_BOX.x, -COSTUME_BOX.y, this.costumeTexture(costume.draw)).setOrigin(0, 0).setScale(1 / COSTUME_BOX.res);
    g.frontOnly = !!costume.front;
    c.add(g);
    c.partyCostume = g;
  }

  // Each costume is drawn once into a few textures (its colours vary) and
  // worn as a plain image: shapes redrawn on every guest every frame were
  // slow on phones.
  costumeTexture(draw) {
    const key = `costume_${draw}_${Math.floor(Math.random() * COSTUME_BOX.variants)}`;
    if (!this.textures.exists(key)) {
      const { x, y, w, h, res } = COSTUME_BOX;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.scaleCanvas(res, res);
      g.translateCanvas(x, y);
      this[`draw_${draw}`](g);
      g.generateTexture(key, w * res, h * res);
      g.destroy();
    }
    return key;
  }

  undressGuest(p) {
    const c = p.container;
    if (c && c.partyCostume) { c.partyCostume.destroy(); c.partyCostume = null; }
  }

  draw_partyHat(g) {
    const colors = [0xff4fd8, 0x3de0ff, 0xffe14a, 0x7dff5a];
    const col = Phaser.Utils.Array.GetRandom(colors);
    g.fillStyle(col, 1).lineStyle(1.5, 0x2a1440, 1);
    g.fillTriangle(-9, HEAD_TOP + 6, 9, HEAD_TOP + 6, 2, HEAD_TOP - 18);
    g.strokeTriangle(-9, HEAD_TOP + 6, 9, HEAD_TOP + 6, 2, HEAD_TOP - 18);
    g.fillStyle(0xffffff, 0.9).fillRect(-6, HEAD_TOP - 1, 12, 2).fillRect(-3, HEAD_TOP - 8, 8, 2);
    g.fillStyle(0xffe14a, 1).fillCircle(2, HEAD_TOP - 19, 3.2).lineStyle(1, 0x2a1440, 1).strokeCircle(2, HEAD_TOP - 19, 3.2);
  }

  draw_snapback(g) {
    const col = Phaser.Utils.Array.GetRandom([0xd02a2a, 0x2a2a30, 0x2a6ad0, 0xffffff]);
    g.fillStyle(col, 1).lineStyle(1.5, 0x10101a, 1);
    g.slice(1, HEAD_TOP + 9, 15, Math.PI, 0, false).fillPath();
    g.beginPath(); g.arc(1, HEAD_TOP + 9, 15, Math.PI, 0, false); g.strokePath();
    g.fillRect(-15, HEAD_TOP + 7, 31, 4).strokeRect(-15, HEAD_TOP + 7, 31, 4);
    g.fillStyle(0xffd23d, 1).fillRect(-3, HEAD_TOP - 2, 8, 3);
    // A gold chain round the neck.
    g.lineStyle(2.4, 0xffcf2a, 1);
    g.beginPath(); g.arc(1, NECK - 4, 9, 0.15 * Math.PI, 0.85 * Math.PI, false); g.strokePath();
    g.fillStyle(0xffcf2a, 1).fillCircle(1, NECK + 5, 3);
  }

  draw_neonGlasses(g) {
    const col = Phaser.Utils.Array.GetRandom(NEON);
    g.lineStyle(5, col, 0.35).strokeRoundedRect(-14, EYES - 5, 13, 9, 3).strokeRoundedRect(2, EYES - 5, 13, 9, 3);
    g.fillStyle(0x0a0a14, 0.92).fillRoundedRect(-14, EYES - 5, 13, 9, 3).fillRoundedRect(2, EYES - 5, 13, 9, 3);
    g.lineStyle(2, col, 1).strokeRoundedRect(-14, EYES - 5, 13, 9, 3).strokeRoundedRect(2, EYES - 5, 13, 9, 3);
    g.lineBetween(-1, EYES - 2, 2, EYES - 2);
  }

  // Dark sunglasses (the Foam Party).
  draw_shades(g) {
    g.fillStyle(0x0a0a10, 0.95).fillRoundedRect(-14, EYES - 5, 13, 8, 3).fillRoundedRect(2, EYES - 5, 13, 8, 3);
    g.lineStyle(1.5, 0x3a3a46, 1).strokeRoundedRect(-14, EYES - 5, 13, 8, 3).strokeRoundedRect(2, EYES - 5, 13, 8, 3);
    g.lineBetween(-1, EYES - 3, 2, EYES - 3);
    g.fillStyle(0xffffff, 0.55).fillRect(-11, EYES - 3, 3, 1.5).fillRect(5, EYES - 3, 3, 1.5);
  }

  draw_crown(g) {
    g.fillStyle(0xffcf2a, 1).lineStyle(1.5, 0x7a4a00, 1);
    const y = HEAD_TOP + 2;
    const pts = [-11, y, -11, y - 10, -6, y - 4, 0, y - 13, 6, y - 4, 11, y - 10, 11, y];
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); g.fillPath(); g.strokePath();
    g.fillStyle(0xff3d7f, 1).fillCircle(0, y - 5, 2.2);
    g.fillStyle(0x3de0ff, 1).fillCircle(-6, y - 3, 1.6).fillCircle(6, y - 3, 1.6);
  }

  draw_glowNecklace(g) {
    const col = Phaser.Utils.Array.GetRandom(NEON);
    g.lineStyle(6, col, 0.3);
    g.beginPath(); g.arc(1, NECK - 5, 10, 0.1 * Math.PI, 0.9 * Math.PI, false); g.strokePath();
    g.lineStyle(2.5, col, 1);
    g.beginPath(); g.arc(1, NECK - 5, 10, 0.1 * Math.PI, 0.9 * Math.PI, false); g.strokePath();
  }

  draw_mask(g) {
    const col = Phaser.Utils.Array.GetRandom([0xffcf2a, 0xb45cff, 0xff3d7f, 0x2a2a30, 0x3de0ff]);
    const y = EYES;
    g.fillStyle(col, 1).lineStyle(1.5, 0x1a0b30, 1);
    // The mask: two rounded wings over the eyes, a dip at the nose.
    g.beginPath();
    g.moveTo(-17, y - 3); g.lineTo(-11, y - 7); g.lineTo(-2, y - 5); g.lineTo(1, y - 2);
    g.lineTo(4, y - 5); g.lineTo(13, y - 7); g.lineTo(19, y - 3); g.lineTo(15, y + 5);
    g.lineTo(5, y + 5); g.lineTo(1, y + 2); g.lineTo(-3, y + 5); g.lineTo(-13, y + 5);
    g.closePath(); g.fillPath(); g.strokePath();
    g.fillStyle(0x10081c, 1).fillEllipse(-7, y, 7, 4.5).fillEllipse(9, y, 7, 4.5);
    // A feather on one side.
    g.fillStyle(0xffffff, 0.9).fillEllipse(18, y - 10, 4, 12);
    g.lineStyle(1, col, 1).lineBetween(17, y - 3, 19, y - 15);
  }

  draw_raveGear(g, p) {
    this.draw_glowNecklace(g, p);
    this.draw_neonGlasses(g, p);
  }

  // --- The room's effects ------------------------------------------------------

  // A random point over the floor, lifted `up` px.
  fxPoint(up = 0) {
    const { sx, sy } = this.gridToScreen(Math.random() * this.gridW, Math.random() * this.gridH);
    return { x: sx, y: sy - up };
  }

  fxAdd(obj, blend = false) {
    if (blend) obj.setBlendMode(Phaser.BlendModes.ADD);
    obj.setDepth(9e5);
    this.world.add(obj);
    this.partyFx.objects.push(obj);
    if (this.partyFx.objects.length > 400) this.partyFx.objects = this.partyFx.objects.filter((o) => o.active);
    return obj;
  }

  fxConfetti() {
    const { x, y } = this.fxPoint(WALL_HEIGHT * 1.4);
    const piece = this.fxAdd(this.add.rectangle(x, y, 4, 7, Phaser.Utils.Array.GetRandom(NEON)));
    piece.angle = randRange(0, 360);
    this.tweens.add({ targets: piece, y: y + WALL_HEIGHT * 1.3, x: x + randRange(-30, 30), angle: piece.angle + randRange(-540, 540), alpha: 0, duration: randRange(2400, 3600), ease: 'Sine.easeIn', onComplete: () => piece.destroy() });
  }

  fxBalloon() {
    const { x, y } = this.fxPoint(0);
    const col = Phaser.Utils.Array.GetRandom(NEON);
    const g = this.add.graphics();
    g.lineStyle(1, 0xffffff, 0.7).lineBetween(0, 10, 0, 26);
    g.fillStyle(col, 1).fillEllipse(0, 0, 16, 20).fillTriangle(-3, 11, 3, 11, 0, 7);
    g.fillStyle(0xffffff, 0.5).fillEllipse(-4, -4, 4, 6);
    g.setPosition(x, y);
    this.fxAdd(g);
    this.tweens.add({ targets: g, y: y - WALL_HEIGHT * 2.2, x: x + randRange(-20, 20), duration: randRange(6000, 8000), ease: 'Sine.easeInOut', onComplete: () => g.destroy() });
    this.tweens.add({ targets: g, alpha: 0, delay: 5000, duration: 2000 });
  }

  fxNote(color, char) {
    const { x, y } = this.fxPoint(20);
    const t = this.fxAdd(this.add.text(x, y, char, { fontFamily: 'Arial Black, Arial', fontSize: '18px', color: Phaser.Display.Color.IntegerToColor(color).rgba, stroke: '#2a1440', strokeThickness: 3 }).setOrigin(0.5));
    this.tweens.add({ targets: t, y: y - 70, x: x + randRange(-14, 14), alpha: 0, duration: randRange(2200, 3000), onComplete: () => t.destroy() });
  }

  fxSparkle(color) {
    const { x, y } = this.fxPoint(randRange(10, WALL_HEIGHT * 1.2));
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillTriangle(0, -6, 1.5, 0, -1.5, 0).fillTriangle(0, 6, 1.5, 0, -1.5, 0).fillTriangle(-6, 0, 0, 1.5, 0, -1.5).fillTriangle(6, 0, 0, 1.5, 0, -1.5);
    g.setPosition(x, y).setScale(0.2);
    this.fxAdd(g, true);
    this.tweens.add({ targets: g, scale: 1.2, angle: 90, duration: 500, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => g.destroy() });
  }

  // A soap bubble from the floor: drifts up, wobbling, then pops.
  fxFoamBubble() {
    const { x, y } = this.fxPoint(5);
    if (!this.textures.exists('foamBubble')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xe8f6ff, 0.18).fillCircle(24, 24, 22);
      g.lineStyle(2.5, 0xffffff, 0.75).strokeCircle(24, 24, 21);
      g.lineStyle(2, 0xff9ae0, 0.4).beginPath(); g.arc(24, 24, 18, 3.6, 5.2); g.strokePath();
      g.lineStyle(2, 0x8ae4ff, 0.45).beginPath(); g.arc(24, 24, 18, 0.4, 1.6); g.strokePath();
      g.fillStyle(0xffffff, 0.9).fillEllipse(16, 15, 8, 5);
      g.generateTexture('foamBubble', 48, 48);
      g.destroy();
    }
    const b = this.add.image(x, y, 'foamBubble').setScale(randRange(0.25, 0.6));
    this.fxAdd(b, true);
    const rise = randRange(70, 140);
    this.tweens.add({ targets: b, y: y - rise, duration: randRange(2600, 4000), ease: 'Sine.easeOut',
      onComplete: () => this.tweens.add({ targets: b, scale: b.scale * 1.5, alpha: 0, duration: 160, onComplete: () => b.destroy() }) });
    this.tweens.add({ targets: b, x: x + randRange(-18, 18), duration: 900, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
  }

  fxFeather() {
    const { x, y } = this.fxPoint(WALL_HEIGHT * 1.4);
    const col = Phaser.Utils.Array.GetRandom([0xd6a8ff, 0xffffff, 0xff9ae0, 0xffd76a]);
    const g = this.add.graphics();
    g.fillStyle(col, 0.95).fillEllipse(0, 0, 5, 16).lineStyle(1, 0x5a3a7a, 0.8).lineBetween(0, 8, 0, -8);
    g.setPosition(x, y);
    this.fxAdd(g);
    this.tweens.add({ targets: g, y: y + WALL_HEIGHT * 1.3, duration: 5200, ease: 'Sine.easeIn', onComplete: () => g.destroy() });
    this.tweens.add({ targets: g, x: x + 26, angle: 40, duration: 900, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: g, alpha: 0, delay: 4200, duration: 1000 });
  }

  // A neon light that flies round the room on a smooth loop, with a soft glow.
  fxNeonLight(color, i) {
    // Drawn once into a texture per colour: a plain image is far cheaper to
    // draw every frame than shapes (this mattered on phones).
    const key = `fxNeon_${color.toString(16)}`;
    if (!this.textures.exists(key)) {
      const d = this.make.graphics({ x: 0, y: 0 }, false);
      d.fillStyle(color, 0.12).fillCircle(22, 22, 22).fillStyle(color, 0.3).fillCircle(22, 22, 11).fillStyle(0xffffff, 0.95).fillCircle(22, 22, 3.5).fillStyle(color, 1).fillCircle(22, 22, 2.5);
      d.generateTexture(key, 44, 44);
      d.destroy();
    }
    const g = this.add.image(0, 0, key);
    this.fxAdd(g, true);
    const phase = i * 1.7;
    const speed = 0.00035 + (i % 3) * 0.0001;
    const fly = () => {
      const t = this.time.now * speed + phase;
      const gx = (0.5 + 0.42 * Math.sin(t * 1.3 + i)) * this.gridW;
      const gy = (0.5 + 0.42 * Math.sin(t * 0.9 + i * 2)) * this.gridH;
      const { sx, sy } = this.gridToScreen(gx, gy);
      g.setPosition(sx, sy - WALL_HEIGHT * (0.6 + 0.35 * Math.sin(t * 1.7 + i)));
    };
    fly();
    this.partyFx.events.push(this.time.addEvent({ delay: 33, loop: true, callback: fly }));
  }

  // Laser beams from the two back corners, slowly sweeping across the floor.
  fxLasers() {
    const g = this.add.graphics();
    this.fxAdd(g, true);
    const draw = () => {
      g.clear();
      const t = this.time.now * 0.0006;
      const corners = [this.gridToScreen(0, 0), this.gridToScreen(this.gridW, 0), this.gridToScreen(0, this.gridH)];
      corners.forEach((c, k) => {
        for (let b = 0; b < 3; b++) {
          const s = 0.5 + 0.45 * Math.sin(t + k * 2.1 + b * 0.6);
          const s2 = 0.5 + 0.45 * Math.cos(t * 0.8 + k + b);
          const { sx, sy } = this.gridToScreen(s * this.gridW, s2 * this.gridH);
          const col = NEON[(k + b) % NEON.length];
          g.lineStyle(5, col, 0.18).lineBetween(c.sx, c.sy - WALL_HEIGHT, sx, sy);
          g.lineStyle(1.5, col, 0.8).lineBetween(c.sx, c.sy - WALL_HEIGHT, sx, sy);
        }
      });
    };
    draw();
    this.partyFx.events.push(this.time.addEvent({ delay: 33, loop: true, callback: draw }));
  }
}
