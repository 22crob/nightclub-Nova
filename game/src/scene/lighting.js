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
}
