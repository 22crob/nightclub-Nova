// ClubScene methods: the future batch's holograms (October 2026, the owner
// asked for hologram decorations). Each projector's picture is only the
// machine (art/blender/decor_batch4.py); what it projects is drawn here so
// it moves and flickers: a dancing figure, a turning wireframe globe,
// gyroscope rings, the spinning club logo, lightning in a plasma orb, laser
// beams between two pylons. Settings per piece are HOLO in config.js (the
// emitter's point in the model's own units, colours, sizes).
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { PROP_TYPES } from '../catalog.js';
import { HOLO } from '../config.js';
import { CUTOUT_PATRONS, patronMetaOf } from '../assets.js';

const GLOBE_KEY = 'holoGlobe';
const RINGS_KEY = 'holoRings';
const LOGO_KEY = 'holoLogo';
const ARC_KEY = 'holoArc';
const LINE_KEY = 'holoLine';
const GLOW_KEY = 'holoGlow';
const CONE_KEY = 'holoCone';
const FRAMES = 32;
const SIZE = 128;

// Draws a turning thing as a strip of frames once, so the game only flips
// between pictures (no shapes redrawn every frame).
function frameStrip(scene, key, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, SIZE * FRAMES, SIZE);
  const ctx = tex.getContext();
  ctx.lineCap = 'round';
  for (let f = 0; f < FRAMES; f++) {
    ctx.save();
    ctx.translate(f * SIZE + SIZE / 2, SIZE / 2);
    draw(ctx, (f / FRAMES) * Math.PI * 2);
    ctx.restore();
    tex.add(f, 0, f * SIZE, 0, SIZE, SIZE);
  }
  tex.refresh();
  scene.anims.create({ key: `${key}_spin`, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: FRAMES - 1 }), frameRate: 10, repeat: -1 });
}

// A polyline of 3D points (x right, y up, z toward the viewer), tilted a
// little so the top shows, solid in front and faint behind.
function strokeLoop(ctx, pts, r, width) {
  const tilt = 0.35;
  const proj = pts.map(([x, y, z]) => [x * r, -(y * Math.cos(tilt) - z * Math.sin(tilt)) * r, y * Math.sin(tilt) + z * Math.cos(tilt)]);
  for (let i = 0; i < proj.length - 1; i++) {
    const [ax, ay, az] = proj[i];
    const [bx, by, bz] = proj[i + 1];
    ctx.strokeStyle = `rgba(255,255,255,${(az + bz) / 2 >= 0 ? 0.95 : 0.3})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
}

export class HoloFxMixin {
  registerHoloTextures() {
    const R = SIZE * 0.42;
    // The globe: latitude rings and turning longitude lines.
    frameStrip(this, GLOBE_KEY, (ctx, t) => {
      for (const lat of [-0.66, -0.33, 0, 0.33, 0.66]) {
        const rr = Math.sqrt(1 - lat * lat);
        const pts = [];
        for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI * 2; pts.push([rr * Math.cos(a), lat, rr * Math.sin(a)]); }
        strokeLoop(ctx, pts, R, 2);
      }
      for (let m = 0; m < 6; m++) {
        const lon = t / 2 + (m / 6) * Math.PI;
        const pts = [];
        for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI * 2; pts.push([Math.cos(a) * Math.cos(lon), Math.sin(a), Math.cos(a) * Math.sin(lon)]); }
        strokeLoop(ctx, pts, R, 2);
      }
    });
    // Three gyroscope rings, each turning on its own axis.
    frameStrip(this, RINGS_KEY, (ctx, t) => {
      [[1, 0.9], [2, 0.72], [-1, 0.55]].forEach(([speed, size], i) => {
        const a = t * speed;
        const pts = [];
        for (let k = 0; k <= 48; k++) {
          const u = (k / 48) * Math.PI * 2;
          let [x, y, z] = [Math.cos(u) * size, Math.sin(u) * size, 0];
          if (i === 0) [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
          if (i === 1) [x, z] = [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
          if (i === 2) { [y, z] = [z, y]; [x, y] = [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; }
          pts.push([x, y, z]);
        }
        strokeLoop(ctx, pts, R, 3);
      });
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    });
    if (!this.textures.exists(LOGO_KEY)) {
      // The club's star over NOVA, in white (tinted in the game).
      const c = document.createElement('canvas');
      c.width = 160; c.height = 120;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 14 : 34;
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        ctx.lineTo(80 + r * Math.cos(a), 40 + r * Math.sin(a));
      }
      ctx.closePath(); ctx.fill();
      ctx.font = '900 34px Arial Black, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NOVA', 80, 112);
      this.textures.addCanvas(LOGO_KEY, c);
    }
    // Lightning arcs, from the middle out to the edge, a few shapes.
    for (let k = 0; k < 5; k++) {
      const key = `${ARC_KEY}${k}`;
      if (this.textures.exists(key)) continue;
      const c = document.createElement('canvas');
      c.width = 128; c.height = 48;
      const ctx = c.getContext('2d');
      ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round';
      for (const [w, alpha] of [[6, 0.25], [2, 1]]) {
        ctx.globalAlpha = alpha; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(4, 24);
        let y = 24;
        for (let x = 12; x <= 124; x += 10) { y = Math.max(6, Math.min(42, y + (Math.sin(k * 7 + x) * 0.5 + (((k + x) * 37) % 11) / 11 - 0.5) * 18)); ctx.lineTo(x, y); }
        ctx.stroke();
      }
      this.textures.addCanvas(key, c);
    }
    if (!this.textures.exists(LINE_KEY)) {
      // A laser: bright core, soft edges.
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, 16);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 16);
      this.textures.addCanvas(LINE_KEY, c);
    }
    if (!this.textures.exists(GLOW_KEY)) {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
      this.textures.addCanvas(GLOW_KEY, c);
    }
    if (!this.textures.exists(CONE_KEY)) {
      // The projector's light: a soft cone widening upward from the lens.
      const c = document.createElement('canvas');
      c.width = 64; c.height = 128;
      const ctx = c.getContext('2d');
      for (let y = 0; y < 128; y++) {
        const t = 1 - y / 128;          // 0 at the top, 1 at the lens
        const half = 4 + (1 - t) * 28;
        const g = ctx.createLinearGradient(32 - half, 0, 32 + half, 0);
        const a = 0.55 * (0.25 + 0.75 * t);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(32 - half, y, half * 2, 1);
      }
      this.textures.addCanvas(CONE_KEY, c);
    }
  }

  // The hologram a placed projector shows (HOLO in config.js), or null.
  createHoloFx(rec) {
    const holo = HOLO[PROP_TYPES[rec.type].holo];
    const go = rec.gameObject;
    if (!holo || !go || !go.frame) return null;
    this.registerHoloTextures();
    const parts = [];
    const tweens = [];
    const depth = go.baseDepth + 0.004;
    const add = (obj) => {
      obj.setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
      this.propLayer.add(obj);
      parts.push(obj);
      return obj;
    };
    const [ex, ey, ez] = holo.at || [0, 0, 0];
    const lens = this.modelPoint(rec, ex, ey, ez);
    const unit = lens.y - this.modelPoint(rec, ex, ey, ez + 1).y; // screen px per model unit of height
    const flicker = (target, lo, hi) => tweens.push(this.tweens.add({
      targets: target, alpha: { from: hi, to: lo }, duration: 90, yoyo: true, repeat: -1,
      repeatDelay: 300 + Math.random() * 1400, delay: Math.random() * 800,
    }));
    const cone = (height, width) => {
      const c = add(this.add.image(lens.x, lens.y, CONE_KEY).setOrigin(0.5, 1).setTint(holo.color)
        .setDisplaySize(width * unit, height * unit).setAlpha(0.5));
      flicker(c, 0.3, 0.5);
      return c;
    };

    if (holo.kind === 'dancer') {
      // One of the guests, see-through and glowing, dancing on the disc.
      const look = CUTOUT_PATRONS[holo.look] ?? Object.values(CUTOUT_PATRONS)[0];
      if (look === undefined || !this.textures.exists(`patron_${look}`)) return null;
      cone(holo.height * 1.05, 0.9);
      const meta = patronMetaOf(look);
      const fig = add(this.add.sprite(lens.x, lens.y - holo.lift * unit, `patron_${look}`)
        .setOrigin(meta.originX, meta.originY).setScale((holo.height * unit) / meta.standingHeight)
        .setTint(holo.color).setAlpha(0.75));
      const anim = `patron_${look}_dance_front`;
      if (this.anims.exists(anim)) fig.play(anim);
      flicker(fig, 0.4, 0.75);
      // Now and then the picture glitches sideways for a moment.
      tweens.push(this.time.addEvent({ delay: 2600, loop: true, callback: () => {
        fig.x = lens.x + (Math.random() < 0.5 ? -3 : 3);
        this.time.delayedCall(70, () => { if (fig.active) fig.x = lens.x; });
        if (Math.random() < 0.3) fig.setFlipX(!fig.flipX);
      } }));
    } else if (holo.kind === 'globe' || holo.kind === 'rings') {
      cone(holo.above + holo.r, holo.r * 2.2);
      const key = holo.kind === 'globe' ? GLOBE_KEY : RINGS_KEY;
      const y = lens.y - (holo.above + holo.r) * unit;
      const glow = add(this.add.image(lens.x, y, GLOW_KEY).setTint(holo.color).setDisplaySize(holo.r * 3 * unit, holo.r * 3 * unit).setAlpha(0.35));
      const spin = add(this.add.sprite(lens.x, y, key, 0).setTint(holo.color).setDisplaySize(holo.r * 2.4 * unit, holo.r * 2.4 * unit).setAlpha(0.9));
      spin.play(`${key}_spin`);
      flicker(spin, 0.55, 0.9);
      tweens.push(this.tweens.add({ targets: [spin, glow], y: y - 3, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    } else if (holo.kind === 'logo') {
      cone(holo.above + holo.size * 0.5, holo.size * 1.6);
      const y = lens.y - (holo.above + holo.size * 0.4) * unit;
      const logo = add(this.add.image(lens.x, y, LOGO_KEY).setTint(holo.color).setAlpha(0.9));
      const sx = (holo.size * unit) / 120;
      logo.setScale(sx);
      const turn = { t: 0 };
      tweens.push(this.tweens.add({ targets: turn, t: Math.PI * 2, duration: 4200, repeat: -1, onUpdate: () => logo.setScale(sx * Math.cos(turn.t), sx) }));
      tweens.push(this.tweens.add({ targets: logo, y: y - 3, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      flicker(logo, 0.55, 0.9);
    } else if (holo.kind === 'orb') {
      // Lightning crackling from the core out to the glass, never still.
      const core = add(this.add.image(lens.x, lens.y, GLOW_KEY).setTint(holo.color).setDisplaySize(holo.r * 1.4 * unit, holo.r * 1.4 * unit));
      tweens.push(this.tweens.add({ targets: core, alpha: { from: 0.6, to: 1 }, duration: 380, yoyo: true, repeat: -1 }));
      const arcs = [];
      for (let k = 0; k < holo.arcs; k++) {
        arcs.push(add(this.add.image(lens.x, lens.y, `${ARC_KEY}0`).setOrigin(0.03, 0.5).setTint(holo.color)));
      }
      const zap = () => arcs.forEach((a) => {
        a.setTexture(`${ARC_KEY}${Math.floor(Math.random() * 5)}`).setRotation(Math.random() * Math.PI * 2)
          .setDisplaySize(holo.r * unit * (0.85 + Math.random() * 0.12), 10 + Math.random() * 6).setAlpha(0.55 + Math.random() * 0.45);
      });
      zap();
      tweens.push(this.time.addEvent({ delay: 110, loop: true, callback: zap }));
    } else if (holo.kind === 'lasers') {
      // Beams across from pylon to pylon, each changing colour, and one
      // that scans up and down.
      const beam = (z, color, width) => {
        const a = this.modelPoint(rec, holo.from[0], holo.from[1], z);
        const b = this.modelPoint(rec, holo.to[0], holo.to[1], z);
        const line = add(this.add.image(a.x, a.y, LINE_KEY).setOrigin(0, 0.5).setTint(color)
          .setRotation(Math.atan2(b.y - a.y, b.x - a.x)).setDisplaySize(Math.hypot(b.x - a.x, b.y - a.y), width));
        const ends = [a, b].map((p) => add(this.add.image(p.x, p.y, GLOW_KEY).setTint(color).setDisplaySize(14, 14)));
        return [line, ...ends];
      };
      holo.heights.forEach((z, i) => {
        const set = beam(z, holo.colors[i % holo.colors.length], 4);
        const cycle = { t: i };
        tweens.push(this.tweens.add({
          targets: cycle, t: i + holo.colors.length, duration: 900 * holo.colors.length, repeat: -1,
          onUpdate: () => set.forEach((o) => o.setTint(holo.colors[Math.floor(cycle.t) % holo.colors.length])),
        }));
        tweens.push(this.tweens.add({ targets: set, alpha: { from: 1, to: 0.45 }, duration: 260 + i * 70, yoyo: true, repeat: -1 }));
      });
      const scan = beam(holo.heights[0], 0xffffff, 3);
      const lo = this.modelPoint(rec, 0, 0, holo.heights[0]).y;
      const hi = this.modelPoint(rec, 0, 0, holo.heights[holo.heights.length - 1]).y;
      tweens.push(this.tweens.add({ targets: scan, y: `-=${lo - hi}`, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
    this.propLayer.sort('depth');
    return { parts, tweens };
  }
}
