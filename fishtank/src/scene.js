// The tank you're looking at: the room, the water, decorations, fish
// swimming, food flakes, bubbles and eggs. All drawn in code.
import Phaser from 'phaser';
import { SPECIES, DECOR, WATER } from './config.js';
import {
  onEvent, tick, currentTank, tankDef, fishIn, canPlaceDecor, placeDecor,
} from './state.js';
import { fishTextures, tailOffset, TAIL_JX, TAIL_W, BODY_CX, BODY_CY, BODY_W, BODY_H } from './fishArt.js';
import { decorTexture } from './decorArt.js';
import { seededRand } from './genetics.js';
import { UI } from './ui.js';

const TOP_SPACE = 92; // the HUD across the top
const BOTTOM_SPACE = 132; // the dock
const TICK_MS = 250;

export class TankScene extends Phaser.Scene {
  constructor() {
    super('tank');
    this.fishObjs = new Map(); // fish id -> its sprites and swimming state
    this.flakes = [];
    this.bubbles = [];
    this.holding = null; // decoration being placed
    this.acc = 0;
  }

  create() {
    this.layers = {};
    onEvent((e) => this.onGameEvent(e));
    this.scale.on('resize', () => this.build());
    this.input.on('pointerdown', (p, over) => this.onPointerDown(p, over));
    this.input.on('pointermove', (p) => this.updateGhost(p));
    this.input.keyboard?.on('keydown-ESC', () => this.stopHolding());
    this.build();
    UI.bind(this);
  }

  // --- layout ---
  layout() {
    const W = this.scale.width, H = this.scale.height;
    const def = tankDef(currentTank());
    const availW = Math.max(300, W - 60);
    const availH = Math.max(240, H - TOP_SPACE - BOTTOM_SPACE - 50);
    const w = Math.max(300, availW * def.width);
    const h = Math.min(availH, w * 0.62, 560);
    const x = (W - w) / 2;
    const y = TOP_SPACE + Math.max(10, (H - TOP_SPACE - BOTTOM_SPACE - h - 40) / 2) + 10;
    const frame = 10;
    const inner = { x: x + frame, y: y + 16, w: w - frame * 2, h: h - 16 - frame };
    const surface = inner.y + 14;
    const sandH = inner.h * 0.15;
    const sandTop = inner.y + inner.h - sandH;
    const art = h / 420;
    return { W, H, x, y, w, h, inner, surface, sandTop, sandH, art,
      swim: { x0: inner.x + 24 * art, x1: inner.x + inner.w - 24 * art, y0: surface + 26 * art, y1: sandTop - 6 * art } };
  }

  // Rebuilds everything for the current tank (after switching, resizing or
  // a decoration changing). Fish keep their places.
  build() {
    const keep = new Map();
    for (const [id, o] of this.fishObjs) keep.set(id, { nx: (o.x - this.L.swim.x0) / (this.L.swim.x1 - this.L.swim.x0), ny: (o.y - this.L.swim.y0) / (this.L.swim.y1 - this.L.swim.y0), tankId: o.tankId });
    this.children.removeAll(true);
    this.tweens.killAll();
    this.fishObjs.clear();
    this.flakes = [];
    this.bubbles = [];
    this.ghost = null;
    const t = currentTank();
    this.tank = t;
    this.L = this.layout();
    const L = this.L;

    this.add.image(0, 0, this.roomTexture(L)).setOrigin(0, 0);
    this.add.image(L.inner.x, L.inner.y, this.waterTexture(t, L)).setOrigin(0, 0);
    this.addRays(L);

    this.decorLayer = this.add.container(0, 0);
    this.decorSprites = [];
    t.decor.forEach((d, i) => this.addDecor(d, i));
    this.eggGfx = this.add.graphics();
    this.eggState = null;
    this.fishLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    for (const f of fishIn(t.id)) {
      const k = keep.get(f.id);
      this.addFish(f, k && k.tankId === t.id ? k : null);
    }

    this.dirt = this.add.rectangle(L.inner.x, L.inner.y, L.inner.w, L.inner.h, Phaser.Display.Color.HexStringToColor(t.type.startsWith('salt') ? '#4d6b3a' : '#5c6b2a').color, 1).setOrigin(0, 0);
    this.algae = this.add.graphics();
    this.drawAlgae(t, L);
    this.add.image(L.x, L.y, this.frameTexture(L)).setOrigin(0, 0);
    this.updateDirt();
  }

  // --- static pictures ---
  replaceTexture(key, canvas) {
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, canvas);
    return key;
  }

  roomTexture(L) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(L.W);
    c.height = Math.ceil(L.H);
    const ctx = c.getContext('2d');
    const wall = ctx.createLinearGradient(0, 0, 0, L.H);
    wall.addColorStop(0, '#24163f');
    wall.addColorStop(0.7, '#3a2457');
    wall.addColorStop(1, '#2a1a40');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, L.W, L.H);
    // Wallpaper stripes.
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let x = 0; x < L.W; x += 46) ctx.fillRect(x, 0, 18, L.H);
    // A warm glow from the tank light.
    const glow = ctx.createRadialGradient(L.W / 2, L.y + L.h * 0.4, 20, L.W / 2, L.y + L.h * 0.4, L.w * 0.75);
    glow.addColorStop(0, 'rgba(120,220,255,0.28)');
    glow.addColorStop(1, 'rgba(120,220,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, L.W, L.H);
    // Floor.
    const fy = L.y + L.h + 30;
    ctx.fillStyle = '#4a2f22';
    ctx.fillRect(0, fy, L.W, L.H - fy);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = 0; x < L.W; x += 90) ctx.fillRect(x, fy, 3, L.H - fy);
    // The cabinet the tank stands on.
    const cx = L.x - 14, cw = L.w + 28;
    ctx.fillStyle = '#6b4128';
    ctx.fillRect(cx, L.y + L.h - 4, cw, L.H - (L.y + L.h) + 4);
    ctx.fillStyle = '#7d4d2f';
    ctx.fillRect(cx, L.y + L.h - 4, cw, 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    const doors = Math.max(2, Math.round(cw / 220));
    for (let i = 0; i < doors; i++) {
      const dx = cx + 12 + (i * (cw - 24)) / doors;
      ctx.strokeRect(dx + 4, L.y + L.h + 16, (cw - 24) / doors - 8, L.H - (L.y + L.h) - 10);
      ctx.fillStyle = '#d9b26a';
      ctx.beginPath();
      ctx.arc(dx + (cw - 24) / doors / 2, L.y + L.h + 34, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    return this.replaceTexture('room', c);
  }

  waterTexture(t, L) {
    const water = WATER[tankDef(t).water];
    const { w, h } = L.inner;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    const ctx = c.getContext('2d');
    // Air gap above the water line.
    ctx.fillStyle = 'rgba(200,240,255,0.18)';
    ctx.fillRect(0, 0, w, 14);
    const g = ctx.createLinearGradient(0, 14, 0, h);
    g.addColorStop(0, water.top);
    g.addColorStop(0.45, water.mid);
    g.addColorStop(1, water.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 14, w, h - 14);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, 13, w, 2);
    const r = seededRand(t.id * 31 + 7);
    const sandTop = h - L.sandH;
    // Faint shapes far back in the water.
    ctx.fillStyle = tankDef(t).water === 'salt' ? 'rgba(20,60,120,0.35)' : 'rgba(10,70,60,0.35)';
    for (let i = 0; i < 9; i++) {
      const x = r() * w, ht = (40 + r() * 90) * L.art;
      ctx.beginPath();
      if (tankDef(t).water === 'salt') {
        ctx.ellipse(x, sandTop + 4, (20 + r() * 40) * L.art, ht * 0.6, 0, Math.PI, 0);
      } else {
        ctx.moveTo(x - 8 * L.art, sandTop + 4);
        ctx.quadraticCurveTo(x - 14 * L.art, sandTop - ht * 0.6, x + (r() - 0.5) * 20, sandTop - ht);
        ctx.quadraticCurveTo(x + 10 * L.art, sandTop - ht * 0.6, x + 8 * L.art, sandTop + 4);
      }
      ctx.fill();
    }
    // Sand or gravel, with a curved top.
    ctx.beginPath();
    ctx.moveTo(0, sandTop + 6);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, sandTop + Math.sin(x * 0.013 + t.id) * 5 * L.art);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = water.sand[0];
    ctx.fill();
    ctx.save();
    ctx.clip();
    const dots = Math.floor(w * L.sandH / 25);
    for (let i = 0; i < dots; i++) {
      ctx.fillStyle = water.sand[i % water.sand.length];
      ctx.beginPath();
      const big = tankDef(t).water === 'fresh';
      ctx.ellipse(r() * w, sandTop + r() * L.sandH, (big ? 2.5 + r() * 3 : 1 + r() * 1.5) * L.art, (big ? 2 + r() * 2 : 1 + r()) * L.art, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const shade = ctx.createLinearGradient(0, sandTop, 0, h);
    shade.addColorStop(0, 'rgba(255,255,255,0.15)');
    shade.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, sandTop - 10, w, L.sandH + 10);
    ctx.restore();
    return this.replaceTexture('water', c);
  }

  frameTexture(L) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(L.w);
    c.height = Math.ceil(L.h + 4);
    const ctx = c.getContext('2d');
    const w = L.w, h = L.h;
    // Glass shine.
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(w * 0.08, 16);
    ctx.lineTo(w * 0.2, 16);
    ctx.lineTo(w * 0.08, h - 10);
    ctx.lineTo(10, h - 10);
    ctx.lineTo(10, h * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.moveTo(w * 0.24, 16);
    ctx.lineTo(w * 0.28, 16);
    ctx.lineTo(w * 0.14, h - 10);
    ctx.lineTo(w * 0.1, h - 10);
    ctx.closePath();
    ctx.fill();
    // Frame: black plastic rim on top, sides and base.
    ctx.strokeStyle = 'rgba(200,240,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(9, 15, w - 18, h - 24);
    ctx.fillStyle = '#15151c';
    ctx.fillRect(0, 0, w, 16);
    ctx.fillRect(0, h - 10, w, 14);
    ctx.fillRect(0, 0, 10, h);
    ctx.fillRect(w - 10, 0, 10, h);
    ctx.fillStyle = '#2c2c38';
    ctx.fillRect(0, 0, w, 5);
    ctx.fillRect(0, h - 10, w, 3);
    // The light on the lid.
    ctx.fillStyle = 'rgba(190,240,255,0.85)';
    ctx.fillRect(w * 0.2, 12, w * 0.6, 4);
    return this.replaceTexture('frame', c);
  }

  addRays(L) {
    const g = this.add.graphics();
    g.setBlendMode(Phaser.BlendModes.ADD);
    const r = seededRand(5);
    for (let i = 0; i < 4; i++) {
      const x = L.inner.x + L.inner.w * (0.15 + i * 0.22 + r() * 0.05);
      const top = L.surface, bot = L.sandTop;
      g.fillStyle(0xffffff, 0.05);
      g.fillPoints([{ x, y: top }, { x: x + 40 * L.art, y: top }, { x: x + 110 * L.art, y: bot }, { x: x + 30 * L.art, y: bot }], true);
    }
    this.tweens.add({ targets: g, alpha: { from: 0.6, to: 1 }, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  drawAlgae(t, L) {
    this.algae.clear();
    if (t.dirt < 0.45) return;
    const r = seededRand(t.id * 13);
    const n = Math.floor((t.dirt - 0.45) * 40);
    for (let i = 0; i < n; i++) {
      this.algae.fillStyle(0x4f7a2a, 0.35 + r() * 0.2);
      const x = L.inner.x + r() * L.inner.w, y = L.inner.y + 20 + r() * (L.inner.h - 30);
      this.algae.fillEllipse(x, y, (8 + r() * 22) * L.art, (6 + r() * 14) * L.art);
    }
    this.algaeLevel = n;
  }

  updateDirt() {
    if (!this.tank || !this.dirt) return;
    this.dirt.setAlpha(Math.max(0, this.tank.dirt - 0.2) * 0.45);
    const n = this.tank.dirt < 0.45 ? 0 : Math.floor((this.tank.dirt - 0.45) * 40);
    if (n !== (this.algaeLevel || 0)) this.drawAlgae(this.tank, this.L);
  }

  // --- decorations ---
  decorPos(x) {
    const L = this.L;
    return { x: L.inner.x + x * L.inner.w, y: L.sandTop + L.sandH * 0.5 };
  }

  addDecor(d, index) {
    const def = DECOR[d.key];
    const p = this.decorPos(d.x);
    const img = this.add.image(p.x, p.y, decorTexture(this, d.key)).setOrigin(0.5, 1).setScale(this.L.art * 0.9);
    img.setInteractive({ pixelPerfect: true, useHandCursor: true });
    img.setData('decorIndex', index);
    this.decorLayer.add(img);
    this.decorSprites.push(img);
    if (def.sway) this.tweens.add({ targets: img, angle: { from: -2.5, to: 2.5 }, duration: 2200 + index * 170, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    if (def.bubbles) img.setData('bubbles', true);
  }

  startHolding(key) {
    this.holding = { key };
    this.ghost = this.add.image(-999, -999, decorTexture(this, key)).setOrigin(0.5, 1).setScale(this.L.art * 0.9).setAlpha(0.6);
    UI.showHolding(key);
  }

  stopHolding() {
    this.holding = null;
    if (this.ghost) this.ghost.destroy();
    this.ghost = null;
    UI.showHolding(null);
  }

  holdX(p) {
    const L = this.L;
    return Phaser.Math.Clamp((p.x - L.inner.x) / L.inner.w, 0.05, 0.95);
  }

  updateGhost(p) {
    if (!this.holding || !this.ghost) return;
    const pos = this.decorPos(this.holdX(p));
    this.ghost.setPosition(pos.x, pos.y);
    const ok = canPlaceDecor(this.tank.id, this.holding.key).ok;
    this.ghost.setTint(ok ? 0xffffff : 0xff5555);
  }

  // --- input ---
  onPointerDown(p, over) {
    if (this.holding) {
      if (p.rightButtonDown()) return this.stopHolding();
      const res = placeDecor(this.tank.id, this.holding.key, this.holdX(p));
      if (!res.ok) UI.toast(res.msg, 'bad');
      else UI.toast(res.msg);
      const key = this.holding.key;
      this.stopHolding();
      if (res.ok && canPlaceDecor(this.tank.id, key).ok && p.event.shiftKey) this.startHolding(key);
      return;
    }
    const top = over && over[0];
    if (!top) return UI.closeCard();
    if (top.getData('fishId')) return UI.openFishCard(top.getData('fishId'));
    if (top.getData('decorIndex') !== undefined) return UI.openDecorCard(this.tank.id, top.getData('decorIndex'));
  }

  // --- fish ---
  addFish(f, keep) {
    const L = this.L;
    const tex = fishTextures(this, f.g);
    const tail = this.add.image(tailOffset(f.g.species), 0, tex.tail).setOrigin(TAIL_JX / TAIL_W, 0.5);
    const body = this.add.image(0, 0, tex.body).setOrigin(BODY_CX / BODY_W, BODY_CY / BODY_H);
    body.setInteractive({ pixelPerfect: true, useHandCursor: true });
    body.setData('fishId', f.id);
    const c = this.add.container(0, 0, [tail, body]);
    this.fishLayer.add(c);
    const s = L.swim;
    const x = keep ? s.x0 + keep.nx * (s.x1 - s.x0) : Phaser.Math.Between(s.x0, s.x1);
    const y = keep ? s.y0 + keep.ny * (s.y1 - s.y0) : Phaser.Math.Between(s.y0, s.y1);
    const o = { f, c, tail, body, tankId: f.tankId, x, y, vx: 0, vy: 0, tx: x, ty: y, face: Math.random() < 0.5 ? 1 : -1, faceT: 1, phase: Math.random() * 10, pause: Math.random() * 1.5 };
    o.faceT = o.face;
    this.fishObjs.set(f.id, o);
    if (f.g.glow) this.addSparkles(o);
    this.placeFish(o, 0);
    return o;
  }

  addSparkles(o) {
    o.sparkle = this.time.addEvent({ delay: 450, loop: true, callback: () => {
      if (!o.c.active) return;
      const s = this.add.star(o.x + Phaser.Math.Between(-20, 20) * this.L.art, o.y + Phaser.Math.Between(-12, 12) * this.L.art, 4, 1.5, 5, 0xffffff, 0.9);
      s.setBlendMode(Phaser.BlendModes.ADD);
      this.fxLayer.add(s);
      this.tweens.add({ targets: s, alpha: 0, scale: 0.2, angle: 90, duration: 700, onComplete: () => s.destroy() });
    } });
  }

  fishScale(o) {
    const sp = SPECIES[o.f.g.species];
    const grow = 0.35 + 0.65 * Math.min(1, o.f.growth);
    return sp.size * o.f.g.size * this.L.art * grow * 1.2;
  }

  pickTarget(o) {
    const s = this.L.swim;
    o.tx = Phaser.Math.Between(s.x0, s.x1);
    const span = (s.y1 - s.y0) * 0.45;
    o.ty = Phaser.Math.Clamp(o.y + Phaser.Math.FloatBetween(-span, span), s.y0, s.y1);
  }

  swim(o, dt, time) {
    const sp = SPECIES[o.f.g.species];
    const L = this.L;
    const speed = 55 * sp.speed * L.art * (o.f.growth < 1 ? 0.85 : 1) * (this.tank.food < 0.15 ? 0.6 : 1);
    // Food first.
    let chasing = null;
    if (this.flakes.length) {
      let best = 1e9;
      for (const fl of this.flakes) {
        const d = (fl.x - o.x) ** 2 + (fl.y - o.y) ** 2;
        if (d < best) { best = d; chasing = fl; }
      }
    }
    if (chasing) {
      o.tx = chasing.x;
      o.ty = chasing.y;
      o.pause = 0;
      if (Math.hypot(chasing.x - o.x, chasing.y - o.y) < 14 * L.art) this.eatFlake(chasing);
    } else if (o.pause > 0) {
      o.pause -= dt;
    } else if (Math.hypot(o.tx - o.x, o.ty - o.y) < 10 * L.art) {
      if (Math.random() < 0.35) o.pause = Phaser.Math.FloatBetween(0.4, 1.8);
      this.pickTarget(o);
    }
    const dx = o.tx - o.x, dy = o.ty - o.y;
    const dist = Math.hypot(dx, dy) || 1;
    const want = o.pause > 0 ? 0 : Math.min(1, dist / (40 * L.art)) * speed * (chasing ? 1.8 : 1);
    const ease = Math.min(1, dt * 2.2);
    o.vx += ((dx / dist) * want - o.vx) * ease;
    o.vy += ((dy / dist) * want * 0.7 - o.vy) * ease;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    // Keep the whole fish inside the glass, however big it is.
    const s = L.swim, sc = this.fishScale(o);
    const mx = Math.min(80 * sc, (s.x1 - s.x0) / 2 - 1), my = Math.min(55 * sc, (s.y1 - s.y0) / 2 - 1);
    o.x = Phaser.Math.Clamp(o.x, s.x0 + mx, s.x1 - mx);
    o.y = Phaser.Math.Clamp(o.y, s.y0 + my, s.y1 - my);
    o.tx = Phaser.Math.Clamp(o.tx, s.x0 + mx, s.x1 - mx);
    o.ty = Phaser.Math.Clamp(o.ty, s.y0 + my, s.y1 - my);
    if (Math.abs(o.vx) > 4) o.faceT = Math.sign(o.vx);
    o.face += (o.faceT - o.face) * Math.min(1, dt * 7);
    this.placeFish(o, time, speed);
  }

  placeFish(o, time, speed = 1) {
    const sc = this.fishScale(o);
    const f = Math.abs(o.face) < 0.12 ? 0.12 * Math.sign(o.face || 1) : o.face;
    o.c.setScale(sc * f, sc);
    o.c.setPosition(o.x, o.y + Math.sin(time / 600 + o.phase) * 2 * this.L.art);
    const pitch = Math.atan2(o.vy, Math.abs(o.vx) + 20) * 0.6;
    o.c.setRotation(pitch * Math.sign(f));
    const pace = Math.hypot(o.vx, o.vy) / (speed || 1);
    o.tail.setRotation(Math.sin(time / (110 - pace * 50) + o.phase) * (0.12 + pace * 0.2));
  }

  syncFish() {
    const want = fishIn(this.tank.id);
    const ids = new Set(want.map((f) => f.id));
    for (const [id, o] of this.fishObjs) {
      if (!ids.has(id)) {
        if (o.sparkle) o.sparkle.remove();
        o.c.destroy();
        this.fishObjs.delete(id);
      }
    }
    for (const f of want) {
      const o = this.fishObjs.get(f.id);
      if (!o) this.addFish(f, null);
      else o.f = f;
    }
  }

  // --- food, bubbles, eggs ---
  spawnFlakes() {
    const L = this.L;
    const colors = [0xd9733f, 0xf2c14e, 0x9c4f2e, 0x6fbf4a];
    const cx = L.inner.x + L.inner.w * Phaser.Math.FloatBetween(0.3, 0.7);
    for (let i = 0; i < 12; i++) {
      const x = cx + Phaser.Math.Between(-90, 90) * L.art;
      const r = this.add.rectangle(x, L.surface, 5 * L.art, 4 * L.art, colors[i % 4]).setAngle(Phaser.Math.Between(0, 90));
      this.fxLayer.add(r);
      this.flakes.push({ obj: r, x, y: L.surface + Phaser.Math.Between(0, 8), vy: Phaser.Math.Between(18, 30) * L.art, wob: Math.random() * 6, ttl: 2 });
    }
  }

  eatFlake(fl) {
    fl.obj.destroy();
    this.flakes.splice(this.flakes.indexOf(fl), 1);
  }

  tickFlakes(dt, time) {
    for (const fl of [...this.flakes]) {
      if (fl.y < this.L.sandTop) {
        fl.y += fl.vy * dt;
        fl.x += Math.sin(time / 400 + fl.wob) * 0.3;
      } else {
        fl.ttl -= dt;
        fl.obj.setAlpha(Math.max(0, fl.ttl / 2));
        if (fl.ttl <= 0) { this.eatFlake(fl); continue; }
      }
      fl.obj.setPosition(fl.x, fl.y);
    }
  }

  addBubble(x, y, size) {
    if (this.bubbles.length > 90) return;
    const b = this.add.circle(x, y, size, 0xffffff, 0.18).setStrokeStyle(1.5, 0xffffff, 0.7);
    this.fxLayer.add(b);
    this.bubbles.push({ obj: b, x, y, vy: Phaser.Math.Between(45, 80) * this.L.art, wob: Math.random() * 6 });
  }

  tickBubbles(dt, time) {
    const L = this.L;
    this.bubbleClock = (this.bubbleClock || 0) + dt;
    if (this.bubbleClock > 0.14) {
      this.bubbleClock = 0;
      for (const img of this.decorSprites) {
        if (img.getData('bubbles') && Math.random() < 0.7) this.addBubble(img.x + Phaser.Math.Between(-6, 6) * L.art, img.y - img.displayHeight * 0.75, Phaser.Math.FloatBetween(2, 5) * L.art);
      }
      if (Math.random() < 0.06) this.addBubble(L.inner.x + Math.random() * L.inner.w, L.sandTop, Phaser.Math.FloatBetween(2, 4) * L.art);
    }
    for (const b of [...this.bubbles]) {
      b.y -= b.vy * dt;
      b.obj.setPosition(b.x + Math.sin(time / 250 + b.wob) * 2.5 * L.art, b.y);
      if (b.y < L.surface + 2) {
        b.obj.destroy();
        this.bubbles.splice(this.bubbles.indexOf(b), 1);
      }
    }
  }

  drawEggs(time) {
    const g = this.eggGfx;
    const eggs = this.tank.eggs;
    if (!eggs) {
      if (this.eggState) { g.clear(); this.eggState = null; }
      return;
    }
    const L = this.L;
    const cx = L.inner.x + L.inner.w * 0.5, cy = L.sandTop + 4 * L.art;
    const r = seededRand(this.tank.id);
    const pulse = 1 + Math.sin(time / 300) * 0.08;
    g.clear();
    for (let i = 0; i < 14; i++) {
      const x = cx + (r() - 0.5) * 60 * L.art, y = cy + (r() - 0.5) * 12 * L.art;
      g.fillStyle(0xfff1c2, 0.95);
      g.fillCircle(x, y, 4.5 * L.art * pulse);
      g.fillStyle(0xff9a3c, 1);
      g.fillCircle(x + 1, y + 1, 1.6 * L.art);
    }
    this.eggState = true;
  }

  floatText(x, y, text, color = '#7dff8a') {
    const t = this.add.text(x, y, text, { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: `${Math.round(20 * Math.max(0.8, this.L.art))}px`, color, stroke: '#08304a', strokeThickness: 5 }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 50, alpha: { from: 1, to: 0 }, duration: 1500, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  // --- events from the game ---
  onGameEvent(e) {
    if (!this.tank) return;
    if (e.type === 'change' && e.rebuild) return this.build();
    if (e.type === 'change') return this.syncFish();
    const here = e.tankId === this.tank.id;
    if (e.type === 'fed' && here) this.spawnFlakes();
    if (e.type === 'cleaned' && here) {
      this.updateDirt();
      for (let i = 0; i < 25; i++) this.addBubble(this.L.inner.x + Math.random() * this.L.inner.w, this.L.sandTop - Math.random() * this.L.inner.h * 0.6, Phaser.Math.FloatBetween(3, 7) * this.L.art);
    }
    if (e.type === 'tip' && here) {
      const L = this.L;
      this.floatText(L.inner.x + L.inner.w * Phaser.Math.FloatBetween(0.25, 0.75), L.surface + 40 * L.art, `+$${e.amount}`);
    }
    if (e.type === 'hatch' && here) {
      this.syncFish();
      const L = this.L;
      for (const f of e.babies) {
        const o = this.fishObjs.get(f.id);
        if (o) { o.x = L.inner.x + L.inner.w * 0.5 + Phaser.Math.Between(-30, 30); o.y = L.sandTop - 10; }
      }
      this.floatText(L.inner.x + L.inner.w / 2, L.sandTop - 40 * L.art, 'Babies!', '#ffe36b');
    }
    if (e.type === 'grown' && here) {
      const o = this.fishObjs.get(e.fishId);
      if (o) this.floatText(o.x, o.y - 30 * this.L.art, 'Grown up!', '#ffe36b');
    }
  }

  update(time, delta) {
    if (!this.tank) return;
    this.acc += Math.min(delta, 1000);
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      tick(TICK_MS);
    }
    const dt = Math.min(delta, 100) / 1000;
    for (const o of this.fishObjs.values()) this.swim(o, dt, time);
    this.tickFlakes(dt, time);
    this.tickBubbles(dt, time);
    this.drawEggs(time);
    this.updateDirt();
  }
}

