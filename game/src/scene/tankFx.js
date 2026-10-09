// ClubScene methods: live aquariums. Fish swim to and fro and bubbles rise
// inside a tank's water, drawn over its picture (which is rendered without
// them, see tank_life(live=True) in art/blender/decor_batch2.py). Settings
// per tank are TANKS in config.js: the water's box in the model's own units
// (the same numbers as the Blender script), the fish colours and counts.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { PROP_TYPES } from '../catalog.js';
import { TANKS, TILE_W, TILE_H } from '../config.js';

const FISH_KEY = 'tankFish';
const BUBBLE_KEY = 'tankBubble';
const JELLY_KEY = 'tankJelly';
const MODEL_SCALE = 64 / TILE_W;         // a model unit is this many game tiles (art/blender/iso_rig.py)
const PX_UP = (TILE_W / 2 / Math.SQRT1_2) * Math.cos(Math.PI / 6); // screen px per tile of height (30 degree camera)

export class TankFxMixin {
  // A little white fish (tinted per fish) and a bubble, drawn once.
  registerTankTextures() {
    if (this.textures.exists(FISH_KEY)) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const s = 2; // drawn at 2x, shown at half size
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(7 * s, 4 * s, 10 * s, 6 * s);                           // body
    g.fillTriangle(1 * s, 1 * s, 1 * s, 7 * s, 4 * s, 4 * s);             // tail
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(7 * s, 5.5 * s, 8 * s, 2.5 * s);                       // a darker belly
    g.fillStyle(0x101018, 1);
    g.fillCircle(10 * s, 3.4 * s, 0.9 * s);                               // eye
    g.generateTexture(FISH_KEY, 13 * s, 8 * s);
    g.clear();
    g.lineStyle(1.2, 0xffffff, 0.95);
    g.fillStyle(0xdff4ff, 0.35);
    g.fillCircle(4, 4, 3);
    g.strokeCircle(4, 4, 3);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(3, 3, 0.9);
    g.generateTexture(BUBBLE_KEY, 8, 8);
    // A jellyfish: a soft domed bell and wavy trailing tentacles.
    g.clear();
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(8, 7, 14, 12);
    g.fillStyle(0xffffff, 0.85);
    g.slice(8, 8, 6, Math.PI, 0, false);
    g.fillPath();
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(6, 5, 3, 2);
    g.lineStyle(1, 0xffffff, 0.75);
    for (const x of [4.5, 7, 9.5, 12]) {
      g.beginPath();
      g.moveTo(x, 8);
      for (let k = 1; k <= 4; k++) g.lineTo(x + (k % 2 ? 0.9 : -0.9), 8 + k * 2.2);
      g.strokePath();
    }
    g.generateTexture(JELLY_KEY, 16, 18);
    g.destroy();
  }

  // Where a point of the model (in its own units, front facing -Y) lands in
  // the world, for the piece as placed: turned to its facing, centred on
  // its sprite's origin.
  tankPoint(rec, x, y, z) {
    const go = rec.gameObject;
    const a = (rec.facing || 0) * Math.PI / 180;
    const rx = x * Math.cos(a) - y * Math.sin(a);
    const ry = x * Math.sin(a) + y * Math.cos(a);
    const gx = rx * MODEL_SCALE;
    const gy = -ry * MODEL_SCALE;
    return {
      x: go.x + (gx - gy) * TILE_W / 2,
      y: go.y + (gx + gy) * TILE_H / 2 - z * MODEL_SCALE * PX_UP,
    };
  }

  // Fish and bubbles for a placed tank. Only from the sides where its front
  // glass faces the camera (facings 0 and 90); turned away, the tank shows
  // its solid back.
  createTankFx(rec) {
    const tank = TANKS[PROP_TYPES[rec.type].tankFx];
    const go = rec.gameObject;
    if (!tank || !go || !(tank.allSides || rec.facing === 0 || rec.facing === 90)) return null;
    this.registerTankTextures();
    const parts = [];
    const tweens = [];
    const depth = go.baseDepth + 0.003;
    const add = (obj) => {
      obj.setDepth(depth);
      this.propLayer.add(obj);
      parts.push(obj);
      return obj;
    };
    const { x0, x1, y0, y1, z0, z1 } = tank.water;
    const rand = Phaser.Math.FloatBetween;
    // Fish: each at its own depth in the tank and height, swimming the
    // length of it and back, turning at the ends, bobbing a little.
    for (let i = 0; i < tank.fish; i++) {
      const color = tank.colors[i % tank.colors.length];
      const fish = add(this.add.image(0, 0, tank.jelly ? JELLY_KEY : FISH_KEY).setScale(0.5 * (tank.fishScale || 1)).setTint(color));
      if (tank.jelly) fish.setBlendMode(Phaser.BlendModes.ADD);
      const y = rand(y0, y1);
      const [zLo, zHi] = tank.swim || [z0 + (z1 - z0) * 0.25, z1 - (z1 - z0) * 0.3];
      const z = rand(zLo, zHi);
      const path = { t: Math.random(), dir: Math.random() < 0.5 ? 1 : -1, bob: Math.random() * 6 };
      const speed = rand(0.08, 0.16); // of the tank's length a second
      const place = () => {
        const x = x0 + 0.1 + (x1 - x0 - 0.2) * path.t;
        const p = this.tankPoint(rec, x, y, z + Math.sin(path.bob) * (tank.jelly ? 0.12 : 0.025));
        fish.setPosition(p.x, p.y);
        // Facing its way along the screen: down-right is +x on screen.
        const ahead = this.tankPoint(rec, x + 0.1 * path.dir, y, z);
        if (tank.jelly) fish.setScale(0.5 * (tank.fishScale || 1) * (1 + Math.sin(path.bob * 2) * 0.06), 0.5 * (tank.fishScale || 1) * (1 - Math.sin(path.bob * 2) * 0.08)); // the bell pulses
        else fish.setFlipX(ahead.x < p.x);
      };
      place();
      tweens.push(this.time.addEvent({
        delay: 50, loop: true,
        callback: () => {
          path.t += path.dir * speed * 0.05 * (tank.jelly ? 0.3 : 1); // jellies drift slowly
          path.bob += tank.jelly ? 0.05 : 0.15;
          if (path.t > 1) { path.t = 1; path.dir = -1; }
          if (path.t < 0) { path.t = 0; path.dir = 1; }
          if (Math.random() < 0.004) path.dir *= -1; // now and then a fish turns round
          place();
        },
      }));
    }
    // Bubbles: rising in a couple of streams, growing a little, popping at
    // the top, then starting again.
    for (let i = 0; i < tank.bubbles; i++) {
      const b = add(this.add.image(0, 0, BUBBLE_KEY).setAlpha(0));
      const stream = (i % (tank.streams || 2)) / Math.max(1, (tank.streams || 2) - 1);
      const state = { z: z0 };
      let bx = x0 + 0.1 + (x1 - x0 - 0.2) * stream;
      const by = y0;
      tweens.push(this.tweens.add({
        targets: state, z: { from: z0 + 0.05, to: z1 - 0.03 }, duration: rand(2200, 3200), delay: i * 420,
        repeat: -1,
        onRepeat: () => { bx = x0 + 0.1 + (x1 - x0 - 0.2) * stream + rand(-0.04, 0.04); },
        onUpdate: (tw) => {
          const k = tw.progress;
          const p = this.tankPoint(rec, bx + Math.sin(k * 9 + i) * 0.015, by, state.z);
          b.setPosition(p.x, p.y).setScale(0.35 + k * 0.4).setAlpha(k > 0.92 ? (1 - k) * 10 : 0.9);
        },
      }));
    }
    this.propLayer.sort('depth');
    return { parts, tweens };
  }
}
