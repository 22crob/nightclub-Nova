// ClubScene methods: How a placed prop is drawn: real sprites, placeholder iso boxes, glow and disco lights.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { FLOOR_DECAL_PROPS, PROP_TYPES } from '../catalog.js';
import { FLOOR_STYLES, floorFrameCanvas, floorFrameFor, floorTextureKey } from '../floors.js';
import { FACINGS, FALLBACK_PROP_HEIGHT, FALLBACK_PROP_WIDTH, PROP_SCALE, TILE_H, TILE_W } from '../config.js';

// Hover name labels sit above every prop.
const LABEL_DEPTH = 100000;

export class PropVisualsMixin {
  // Returns the texture key to use for a given prop type + facing, falling
  // back to the 0° sprite if that facing's image failed to load (e.g. the
  // other 3 rotation renders haven't been dropped in yet).
  spriteKeyFor(propType, facing) {
    const def = PROP_TYPES[propType];
    const key = def.sprites[facing];
    if (this.textures.exists(key)) return key;
    return def.sprites[0];
  }

  // True only if at least one facing's texture actually loaded. Used to
  // fall back to a plain colored box instead of Phaser's broken-image
  // placeholder if the sprites failed to load for any reason.
  hasAnySprite(propType) {
    const def = PROP_TYPES[propType];
    return FACINGS.some((f) => this.textures.exists(def.sprites[f]));
  }

  drawFallbackBox(sx, sy, def) {
    const propW = FALLBACK_PROP_WIDTH;
    const propH = FALLBACK_PROP_HEIGHT;
    const box = this.add.rectangle(sx, sy - propH / 2, propW, propH, 0xff2fd0, 1)
      .setStrokeStyle(2, 0xffffff, 0.25);
    // Hidden by default — shown only while this specific prop is hovered
    // (see updateHoverFromPointer()). A floor packed with small props used
    // to have every one of their name labels visible and stacked on top of
    // each other at once; showing just the one under the cursor keeps the
    // club readable at a glance while still naming anything you point at.
    const label = this.add.text(sx, sy - propH - 10, def.label + ' (sprite missing)', {
      fontFamily: 'Arial', fontSize: '10px', color: '#ffffff',
    }).setOrigin(0.5, 1).setAlpha(0.85).setVisible(false);
    return { box, label };
  }

  // Lightens (factor > 0) or darkens (factor < 0) a 0xRRGGBB color toward
  // white/black by that fraction — cheap fake lighting so a single base
  // color per prop can still yield a bright top, mid-tone right face and
  // dark left face.
  shadeColor(color, factor) {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    const blend = (c) => (factor >= 0
      ? Math.round(c + (255 - c) * factor)
      : Math.round(c * (1 + factor)));
    return (blend(r) << 16) | (blend(g) << 8) | blend(b);
  }

  // Draws a small pseudo-3D box for sprite-less props (bar, table): a
  // bright top cap plus a mid-tone right face and dark left face meeting
  // at the tile's front corner, so they read with real depth instead of a
  // flat 2D rectangle. A thin prop (propH <= 10, i.e. the dance floor
  // decal) skips the sides entirely and is just a flat shaded diamond
  // flush with the ground, since it has no real height to show.
  drawIsoBox(sx, sy, def, propW, propH) {
    const g = this.add.graphics();
    const hw = propW / 2;
    const hh = hw * (TILE_H / TILE_W); // keep the same 2:1 diamond ratio as a tile

    const topColor = this.shadeColor(def.color, 0.35);
    const rightColor = this.shadeColor(def.color, -0.08);
    const leftColor = this.shadeColor(def.color, -0.32);

    // The footprint diamond's four corners at ground level.
    const gTop = { x: sx, y: sy - hh };
    const gRight = { x: sx + hw, y: sy };
    const gBottom = { x: sx, y: sy + hh };
    const gLeft = { x: sx - hw, y: sy };
    // Same diamond lifted straight up by the box's height — its top cap.
    const lift = (p) => ({ x: p.x, y: p.y - propH });
    const tTop = lift(gTop), tRight = lift(gRight), tBottom = lift(gBottom), tLeft = lift(gLeft);

    if (propH <= 10) {
      g.fillStyle(topColor, 1);
      g.beginPath();
      g.moveTo(gTop.x, gTop.y);
      g.lineTo(gRight.x, gRight.y);
      g.lineTo(gBottom.x, gBottom.y);
      g.lineTo(gLeft.x, gLeft.y);
      g.closePath();
      g.fillPath();
      g.lineStyle(2, 0xffffff, 0.25);
      g.strokePath();
    } else {
      // Left face, between the left and front (bottom) ground corners.
      g.fillStyle(leftColor, 1);
      g.beginPath();
      g.moveTo(gLeft.x, gLeft.y);
      g.lineTo(gBottom.x, gBottom.y);
      g.lineTo(tBottom.x, tBottom.y);
      g.lineTo(tLeft.x, tLeft.y);
      g.closePath();
      g.fillPath();

      // Right face, between the right and front (bottom) ground corners.
      g.fillStyle(rightColor, 1);
      g.beginPath();
      g.moveTo(gRight.x, gRight.y);
      g.lineTo(gBottom.x, gBottom.y);
      g.lineTo(tBottom.x, tBottom.y);
      g.lineTo(tRight.x, tRight.y);
      g.closePath();
      g.fillPath();

      // Top cap.
      g.fillStyle(topColor, 1);
      g.beginPath();
      g.moveTo(tTop.x, tTop.y);
      g.lineTo(tRight.x, tRight.y);
      g.lineTo(tBottom.x, tBottom.y);
      g.lineTo(tLeft.x, tLeft.y);
      g.closePath();
      g.fillPath();

      // Dark outline along the visible silhouette for definition.
      g.lineStyle(2, 0x000000, 0.4);
      g.beginPath();
      g.moveTo(tLeft.x, tLeft.y);
      g.lineTo(tTop.x, tTop.y);
      g.lineTo(tRight.x, tRight.y);
      g.lineTo(gRight.x, gRight.y);
      g.lineTo(gBottom.x, gBottom.y);
      g.lineTo(gLeft.x, gLeft.y);
      g.lineTo(tLeft.x, tLeft.y);
      g.moveTo(tBottom.x, tBottom.y);
      g.lineTo(gBottom.x, gBottom.y);
      g.strokePath();
    }

    // Hidden by default — see the matching note in drawFallbackBox() above;
    // both label paths use the same hover-to-reveal behavior.
    const label = this.add.text(sx, tTop.y - 10, def.label, {
      fontFamily: 'Arial', fontSize: '10px', color: '#ffffff',
    }).setOrigin(0.5, 1).setAlpha(0.85).setVisible(false);

    return { box: g, label };
  }

  // A slowly-rotating wash of colored light cast across the floor from a
  // Disco Ball's tile — three narrow, very translucent wedges spaced evenly
  // around a full circle, spinning together as one unit. Drawn onto
  // tileLayer (below props/patrons, right on the floor) rather than a new
  // top-level layer, so it reads as light falling ON the floor instead of
  // an object that could ever visually block or sort oddly against a prop
  // or patron standing in the beam's path.
  createDiscoLightRig(sx, sy) {
    const colors = [0xff4de0, 0x4de0ff, 0xfff34d];
    const radius = TILE_W * 2.4;
    const wedgeHalfAngle = Phaser.Math.DegToRad(13);
    const container = this.add.container(sx, sy);
    colors.forEach((color, i) => {
      const wedge = this.add.graphics();
      wedge.fillStyle(color, 0.1);
      wedge.beginPath();
      wedge.moveTo(0, 0);
      wedge.arc(0, 0, radius, -wedgeHalfAngle, wedgeHalfAngle, false);
      wedge.closePath();
      wedge.fillPath();
      wedge.angle = i * (360 / colors.length); // evenly spaced around the circle
      container.add(wedge);
    });
    (this.lightLayer || this.tileLayer).add(container);

    const tween = this.tweens.add({
      targets: container,
      angle: 360,
      duration: 7000,
      repeat: -1,
      ease: 'Linear',
    });

    return { container, tween };
  }

  // Builds the actual on-screen game object(s) for a prop — real sprite,
  // sprite-failed-to-load fallback box, or a plain placeholder box for
  // props with no art yet. Pulled out of placeProp() so restoreProp() (used
  // when loading a save) can create the identical visual without also
  // running placeProp's cost check, since a restored prop was already paid
  // for in a previous session.
  createPropVisual(type, facing, tiles) {
    const def = PROP_TYPES[type];
    const { sx, sy } = this.footprintCenter(tiles);

    let gameObject;
    let frontObject = null;
    let label;
    const spriteImage = (texKey) => {
      const img = this.add.image(sx, sy, texKey);
      img.setOrigin(def.originX, def.originY);
      img.setDisplaySize(def.displayWidth, def.displayWidth * (img.height / img.width));
      this.propLayer.add(img);
      return img;
    };
    if (def.rotatable && this.hasLayerSprites(type)) {
      // Two layers (back bar, front counter) so staff can stand between.
      gameObject = spriteImage(this.layerKeyFor(type, facing, 'back'));
      frontObject = spriteImage(this.layerKeyFor(type, facing, 'front'));
    } else if (def.rotatable && this.hasAnySprite(type)) {
      gameObject = spriteImage(this.spriteKeyFor(type, facing));
    } else if (def.floorStyle) {
      gameObject = this.add.image(sx, sy, floorTextureKey(def.floorStyle, 0));
      gameObject.setDisplaySize(TILE_W, TILE_H);
      gameObject.floorFrame = 0;
      this.propLayer.add(gameObject);
    } else if (def.rotatable) {
      // sprites failed to load — fall back to a labeled box rather than
      // Phaser's broken-image placeholder
      const result = this.drawFallbackBox(sx, sy, def);
      this.propLayer.add(result.box);
      this.propLayer.add(result.label);
      gameObject = result.box;
      label = result.label;
    } else {
      const propW = TILE_W * 0.7;
      const propH = FLOOR_DECAL_PROPS.has(def.key) ? 8 * PROP_SCALE : 40 * PROP_SCALE;
      const result = this.drawIsoBox(sx, sy, def, propW, propH);
      this.propLayer.add(result.box);
      this.propLayer.add(result.label);
      gameObject = result.box;
      label = result.label;
    }

    if (def.glow) {
      // Neon/disco decorations (neonFloor, discoBall, neonSign) breathe
      // gently instead of sitting as one flat static color — a cheap way to
      // make the club feel alive without needing real animated art for
      // them. Each instance's duration is jittered a bit so a row of them
      // doesn't all pulse in perfect lockstep.
      this.tweens.add({
        targets: gameObject,
        alpha: 0.55 + Math.random() * 0.1,
        duration: 900 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    let lightRig;
    if (def.lightRig) {
      lightRig = this.createDiscoLightRig(sx, sy);
    }

    const lightPool = this.createLightPool(type, sx, sy);

    if (label) label.setDepth(LABEL_DEPTH);
    this.setPropDepth(gameObject, type, tiles, frontObject, facing);

    return { gameObject, frontObject, label, lightRig, lightPool };
  }

  // Draw order for placed props: in this isometric view, a prop further
  // down-screen (higher gx + gy) is nearer the camera, so it must be drawn
  // after, and on top of, props behind it. Without this, props were drawn in
  // the order they were bought, so a tall bar bought later could cover a
  // prop standing in front of it. Floor decals always stay underneath.
  //
  // A two-layer prop (a bar) puts whichever layer is nearer the camera just
  // above the other, leaving room between them (baseDepth + 0.001) for its
  // staff: the counter is nearer at facings 0 and 90, the back bar at 180
  // and 270.
  setPropDepth(gameObject, type, allTiles, frontObject = null, facing = 0) {
    const tiles = this.deskTiles(allTiles);
    const nearness = tiles.reduce((sum, [tx, ty]) => sum + tx + ty, 0) / tiles.length;
    const tieBreak = tiles.reduce((sum, [tx]) => sum + tx, 0) / tiles.length / 1000;
    const base = (FLOOR_DECAL_PROPS.has(type) ? -1000 : 0) + nearness + tieBreak;
    gameObject.baseDepth = base;
    if (frontObject) {
      const counterNear = PROP_TYPES[type].frontAlwaysNear || facing === 0 || facing === 90;
      gameObject.setDepth(base + (counterNear ? 0 : 0.002));
      frontObject.setDepth(base + (counterNear ? 0.002 : 0));
    } else {
      gameObject.setDepth(base);
    }
    this.propLayer.sort('depth');
  }

  // Texture key for one layer of a layered prop at a facing.
  layerKeyFor(type, facing, layer) {
    return PROP_TYPES[type].layerSprites[layer][facing];
  }

  // True if every layer texture of a layered prop loaded.
  hasLayerSprites(type) {
    const def = PROP_TYPES[type];
    if (!def.layerSprites) return false;
    return Object.values(def.layerSprites).every((set) => FACINGS.every((f) => this.textures.exists(set[f])));
  }

  // --- Dance floors -------------------------------------------------------

  // Draws every frame of every floor design (src/floors.js) into a texture.
  registerFloorTextures() {
    for (const [style, st] of Object.entries(FLOOR_STYLES)) {
      for (let f = 0; f < st.frames; f++) {
        const key = floorTextureKey(style, f);
        if (!this.textures.exists(key)) this.textures.addCanvas(key, floorFrameCanvas(style, f));
      }
    }
  }

  // Steps the animated floors, every FLOOR_TICK_MS. They only move while a
  // DJ plays; otherwise they rest on frame 0. A Step Floor tile lights up
  // under a patron and splashes to the tiles beside them, then fades.
  animateFloors() {
    this.floorTick = (this.floorTick || 0) + 1;
    const music = this.musicPlaying();
    const heat = this.stepHeat || (this.stepHeat = {});
    for (const key in heat) {
      if (this.floorTick % 2 === 0) heat[key] = Math.max(0, heat[key] - 1);
    }
    if (music) {
      for (const p of this.patrons) {
        if (p.gone || !this.isStepTile(p.gx, p.gy)) continue;
        heat[`${p.gx},${p.gy}`] = 7;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${p.gx + dx},${p.gy + dy}`;
          heat[k] = Math.max(heat[k] || 0, 3);
        }
      }
    }
    const seen = new Set();
    for (const key in this.placed) {
      const rec = this.placed[key];
      if (seen.has(rec)) continue;
      seen.add(rec);
      const style = PROP_TYPES[rec.type].floorStyle;
      if (!style || FLOOR_STYLES[style].frames <= 1) continue;
      const [gx, gy] = rec.tiles[0];
      let frame = 0;
      if (FLOOR_STYLES[style].phase === 'step') frame = heat[`${gx},${gy}`] || 0;
      else if (music) frame = floorFrameFor(style, gx, gy, this.floorTick);
      if (rec.gameObject.floorFrame !== frame) {
        rec.gameObject.floorFrame = frame;
        rec.gameObject.setTexture(floorTextureKey(style, frame));
      }
    }
    this.animateWalls(music);
  }

  isStepTile(gx, gy) {
    const rec = this.placed[`${gx},${gy}`];
    return !!rec && FLOOR_STYLES[PROP_TYPES[rec.type].floorStyle]?.phase === 'step';
  }
}
