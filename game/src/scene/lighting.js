// ClubScene methods: mood lighting. The floor and walls are dimmed so the
// club reads as a room at night, and anything that gives off light (a lava
// lamp, neon, candles, a fancy bar's shelves) casts a soft coloured glow on
// the floor around it. Props, patrons and dance floors are drawn above the
// dimming, so they stay bright against the darker room.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { PROP_TYPES } from '../catalog.js';
import { MOOD_LIGHTING, TILE_H, TILE_W, WALL_HEIGHT } from '../config.js';

const POOL_KEY = 'lightPool';
const BEAM_KEY = 'spotBeam';

// The spotlight's beam (see createSpotBeam()), in screen px: length, width
// at its open end, brightness, and how far it sways (radians).
const SPOT = { beamLength: 170, beamWidth: 80, beamAlpha: 0.75, halo: 46, sway: 0.07 };
// Per facing: where the lens is on the spotlight's sprite (px in the
// rendered image, measured from decor_spotlight_*.png) and which grid way
// the lamp points (it tilts up and back, opposite its front).
const SPOT_LENS = {
  0: { lens: [50, 13], dir: [0, -1] },
  90: { lens: [22, 13], dir: [-1, 0] },
  180: { lens: [28, 22], dir: [0, 1] },
  270: { lens: [45, 22], dir: [1, 0] },
};

export class LightingMixin {
  // A soft white disc that fades to nothing at the edge, tinted per light.
  registerLightTexture() {
    if (this.textures.exists(POOL_KEY)) return;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    this.textures.addCanvas(POOL_KEY, canvas);
  }

  // Layers for the dimming and the glows, between the floor and the walls.
  // Called once from create(), right after the floor layer is added.
  createLightingLayers() {
    this.floorShade = this.add.graphics();
    this.lightLayer = this.add.container(0, 0);
    this.world.add(this.floorShade);
    this.world.add(this.lightLayer);
    // Glows are clipped to the floor so they don't spill onto the street.
    // A mask shape isn't moved by the world container it masks, so it
    // follows the world's pan and zoom every frame (see syncLightMask()).
    this.lightMaskShape = this.make.graphics({ add: false });
    this.lightLayer.setMask(this.lightMaskShape.createGeometryMask());
    this.events.on('update', () => this.syncLightMask());
  }

  syncLightMask() {
    this.lightMaskShape.setPosition(this.world.x, this.world.y).setScale(this.world.scaleX, this.world.scaleY);
  }

  // Redraws the dimming to fit the room (on create and when it expands).
  // The wall shade goes over the wallpaper but under the door.
  drawMoodShade() {
    const nx = this.gridW - 0.5;
    const ny = this.gridH - 0.5;
    const P = (gx, gy, h = 0) => {
      const [x, y] = this.gridPoint(gx, gy, h);
      return { x, y };
    };
    const { floorAlpha, wallAlpha } = MOOD_LIGHTING;
    const color = this.moodColor ?? MOOD_LIGHTING.color; // a party tints it
    this.floorShade.clear();
    this.floorShade.fillStyle(color, floorAlpha);
    this.floorShade.fillPoints([P(-0.5, -0.5), P(nx, -0.5), P(nx, ny), P(-0.5, ny)], true);
    this.lightMaskShape.clear();
    this.lightMaskShape.fillStyle(0xffffff, 1);
    this.lightMaskShape.fillPoints([P(-0.5, -0.5), P(nx, -0.5), P(nx, ny), P(-0.5, ny)], true);
    const w = this.wallShade;
    if (!w) return;
    w.clear();
    w.fillStyle(color, wallAlpha);
    w.fillPoints([P(-0.5, -0.5), P(nx, -0.5), P(nx, -0.5, WALL_HEIGHT), P(-0.5, -0.5, WALL_HEIGHT)], true);
    w.fillPoints([P(-0.5, -0.5), P(-0.5, ny), P(-0.5, ny, WALL_HEIGHT), P(-0.5, -0.5, WALL_HEIGHT)], true);
  }

  // The glow a placed prop casts on the floor, if it gives off light.
  createLightPool(type, sx, sy) {
    const light = PROP_TYPES[type].light;
    if (!light || !MOOD_LIGHTING.glows) return null;
    const [color, radius] = light;
    const pool = this.add.image(sx, sy, POOL_KEY)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(MOOD_LIGHTING.glowAlpha)
      .setDisplaySize(radius * TILE_W * 2, radius * TILE_H * 2);
    this.lightLayer.add(pool);
    return pool;
  }

  // --- The spotlight's beam ---------------------------------------------------

  // A cone of light, bright at its tip and fading out toward its open end.
  registerBeamTexture() {
    if (this.textures.exists(BEAM_KEY)) return;
    const w = 256;
    const h = 128;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    // Layered cones, narrow and bright inside wide and faint: soft edges.
    for (const [spread, alpha] of [[1, 0.18], [0.75, 0.22], [0.5, 0.3], [0.28, 0.4]]) {
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grad.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.45})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, h / 2 - 3);
      ctx.lineTo(w, h / 2 - (h / 2) * spread);
      ctx.lineTo(w, h / 2 + (h / 2) * spread);
      ctx.lineTo(0, h / 2 + 3);
      ctx.closePath();
      ctx.fill();
    }
    this.textures.addCanvas(BEAM_KEY, canvas);
  }

  // The spotlight shines: a warm beam out of its lens, a halo round the
  // lamp and (when it faces you) a bright lens. The beam sways and
  // flickers a little. The lamp head tilts up and back, away from its
  // front, so at facings 0 and 90 it points away from the camera and the
  // glow is drawn behind the lamp, spilling round the head.
  createSpotBeam(rec) {
    const go = rec.gameObject;
    if (!go || !go.frame || typeof go.setTexture !== 'function') return null;
    this.registerLightTexture();
    this.registerBeamTexture();
    const { lens: [lx, ly], dir: [dx, dy] } = SPOT_LENS[rec.facing] || SPOT_LENS[0];
    const fw = go.frame.width;
    const fh = go.frame.height;
    const x = go.x + (lx - go.originX * fw) * go.scaleX;
    const y = go.y + (ly - go.originY * fh) * go.scaleY;
    // Where it points on screen: a grid direction, 35 degrees above level.
    const hx = ((dx - dy) * TILE_W) / 2;
    const hy = ((dx + dy) * TILE_H) / 2;
    const hl = Math.hypot(hx, hy);
    const angle = Math.atan2((hy / hl) * 0.82 - 0.62, (hx / hl) * 0.82);
    const away = rec.facing === 0 || rec.facing === 90;
    const depth = go.baseDepth + (away ? -0.0005 : 0.004);
    const color = PROP_TYPES[rec.type].light ? PROP_TYPES[rec.type].light[0] : 0xfff0c0;
    const parts = [];
    const add = (obj) => {
      obj.setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
      this.propLayer.add(obj);
      parts.push(obj);
      return obj;
    };
    const beam = add(this.add.image(x, y, BEAM_KEY).setOrigin(0, 0.5).setTint(color)
      .setDisplaySize(SPOT.beamLength, SPOT.beamWidth).setRotation(angle).setAlpha(SPOT.beamAlpha));
    const halo = add(this.add.image(x, y, POOL_KEY).setTint(color).setDisplaySize(SPOT.halo, SPOT.halo).setAlpha(0.85));
    if (!away) add(this.add.image(x, y, POOL_KEY).setTint(0xffffff).setDisplaySize(12, 9).setRotation(angle));
    this.propLayer.sort('depth');
    const tweens = [
      this.tweens.add({ targets: beam, rotation: angle + SPOT.sway, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      this.tweens.add({ targets: [beam, halo], alpha: '-=0.18', duration: 140 + Math.random() * 120, yoyo: true, repeat: -1, repeatDelay: 900 + Math.random() * 1600 }),
    ];
    return { parts, tweens };
  }

  destroySpotBeam(rec) {
    if (!rec.spotBeam) return;
    rec.spotBeam.tweens.forEach((t) => t.remove());
    rec.spotBeam.parts.forEach((p) => p.destroy());
    rec.spotBeam = null;
  }
}
