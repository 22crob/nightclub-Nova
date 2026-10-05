// ClubScene methods: speakers that move to the music. Each visible speaker
// cone gets a drawn cone on top that bumps out on the beat (the kick drum
// for the big cones, the clap for the small ones and tweeters), with a ring
// of light rippling off it. Beats come from the music itself (Music.onStep
// in music.js); with no sound yet they follow the song's tempo instead.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import Phaser from 'phaser';
import { PROP_TYPES } from '../catalog.js';
import { Music } from '../music.js';

// Sprite px per Blender unit in the rendered decor images (measured on the
// speaker tower's cones): along the floor (x, y) and straight up.
const PX_ALONG = [69.7, 34.8];
const PX_UP = 78.5;
// Each speaker model's cones (from build_decor.py): how far forward the
// front is, and for each cone its height, radius, ring colour and whether
// it's a big cone (kick) or a small one (clap).
const CONES = {
  speaker: { front: 0.335, cones: [[0.66, 0.3, 0x30e8ff, true], [1.45, 0.215, 0x30e8ff, false], [1.92, 0.085, 0x30e8ff, false]] },
  neonSpeaker: { front: 0.345, cones: [[0.66, 0.31, 0xff2a90, true], [1.45, 0.225, 0x30e8ff, false], [1.92, 0.085, 0xff2a90, false]] },
  woodSpeaker: { front: 0.3, cones: [[0.45, 0.2, 0xc9b48a, true], [0.95, 0.12, 0xc9b48a, false]] },
};

export class SpeakersMixin {
  // Cones for a placed speaker. Only facings 0 and 90 show the front.
  createSpeakerFx(rec) {
    const go = rec.gameObject;
    const model = CONES[PROP_TYPES[rec.type].speakerCones];
    if (!model || !go || !go.frame || typeof go.setTexture !== 'function') return null;
    if (rec.facing !== 0 && rec.facing !== 90) return { parts: [], tweens: [], cones: [] };
    const side = rec.facing === 0 ? -1 : 1; // the front faces down-left at 0, down-right at 90
    const k = go.scaleX;
    const ox = go.originX * go.frame.width;
    const oy = go.originY * go.frame.height;
    // Model point (0, front, z) on the sprite, and the disc's two axes.
    const u = [side * -PX_ALONG[0] * k, PX_ALONG[1] * k];
    const v = [0, -PX_UP * k];
    const parts = [];
    const cones = [];
    for (const [z, r, color, big] of model.cones) {
      const cx = go.x + (ox + side * PX_ALONG[0] * model.front - ox) * k;
      const cy = go.y + (oy + PX_ALONG[1] * model.front - PX_UP * z - oy) * k;
      const ring = (g, scale) => {
        const pts = [];
        for (let i = 0; i < 28; i++) {
          const t = (i / 28) * Math.PI * 2;
          pts.push({ x: (Math.cos(t) * u[0] + Math.sin(t) * v[0]) * r * scale, y: (Math.cos(t) * u[1] + Math.sin(t) * v[1]) * r * scale });
        }
        return pts;
      };
      // The cone: dark, with a lighter dust cap and its coloured ring.
      const cone = this.add.graphics({ x: cx, y: cy });
      cone.fillStyle(0x0d0d12, 0.9);
      cone.fillPoints(ring(cone, 0.92), true);
      cone.fillStyle(0x464852, 1);
      cone.fillPoints(ring(cone, 0.32), true);
      cone.lineStyle(1.5, color, 0.9);
      cone.strokePoints(ring(cone, 0.95), true);
      cone.setDepth(go.baseDepth + 0.0004);
      this.propLayer.add(cone);
      // A ring of light that ripples out on the beat.
      const wave = this.add.graphics({ x: cx, y: cy });
      wave.lineStyle(2, color, 1);
      wave.strokePoints(ring(wave, 1), true);
      wave.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(go.baseDepth + 0.0005);
      this.propLayer.add(wave);
      parts.push(cone, wave);
      cones.push({ cone, wave, big });
    }
    this.propLayer.sort('depth');
    return { parts, tweens: [], cones };
  }

  // One beat: the big cones bump on the kick, the small ones on the clap.
  pulseSpeakers(kind) {
    for (const rec of this.speakerRecords()) {
      for (const c of rec.speakerFx.cones) {
        if ((kind === 'kick') !== c.big) continue;
        const punch = c.big ? 1.16 : 1.1;
        this.tweens.killTweensOf(c.cone);
        c.cone.setScale(1);
        this.tweens.add({ targets: c.cone, scale: punch, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
        this.tweens.killTweensOf(c.wave);
        c.wave.setScale(1).setAlpha(c.big ? 0.8 : 0.55);
        this.tweens.add({ targets: c.wave, scale: c.big ? 1.7 : 1.5, alpha: 0, duration: 380, ease: 'Quad.easeOut' });
      }
    }
  }

  // Every placed speaker with cones showing.
  speakerRecords() {
    const seen = new Set();
    const out = [];
    for (const key in this.placed) {
      const rec = this.placed[key];
      if (seen.has(rec)) continue;
      seen.add(rec);
      if (rec.speakerFx && rec.speakerFx.cones.length) out.push(rec);
    }
    return out;
  }

  // Hooks the speakers to the beat: the music tells us each kick and clap
  // as it schedules them; with no sound, a clock at the song's tempo.
  setupSpeakers() {
    Music.onStep = (step, delaySec) => {
      const tr = Music.track;
      const kind = tr.kick.includes(step) ? 'kick' : tr.clap.includes(step) ? 'clap' : null;
      if (kind) setTimeout(() => this.pulseSpeakers(kind), Math.max(0, delaySec * 1000));
    };
    this.silentStepAt = 0;
    this.silentStep = 0;
    this.events.on('update', () => {
      if (Music.playing || !this.musicPlaying()) return;
      const now = this.time.now;
      const stepMs = 60000 / Music.track.bpm / 4;
      if (now < this.silentStepAt) return;
      this.silentStepAt = Math.max(this.silentStepAt + stepMs, now - stepMs);
      const s = this.silentStep;
      this.silentStep = (s + 1) % 16;
      const tr = Music.track;
      if (tr.kick.includes(s)) this.pulseSpeakers('kick');
      else if (tr.clap.includes(s)) this.pulseSpeakers('clap');
    });
  }
}
