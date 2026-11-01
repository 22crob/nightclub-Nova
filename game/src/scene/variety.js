// ClubScene methods: every guest repainted in their own colours (skin,
// clothes, hair), so the crowd never repeats. Mixed into ClubScene (see
// ClubScene.js); `this` is the scene.
//
// Each guest look has a colour map (art/characters/cutout/color_map.py,
// PATRON_COLOR_MAPS in assets.js): a grey picture in the sheet's layout
// saying which pixels are skin, clothes or hair, and the colours they were
// drawn in. A repaint copies the look's frames into a small picture of its
// own (only the frames, not the sheet's empty columns), recolours the
// mapped pixels (skin and clothes keep their shading: pixel / drawn colour
// x new colour; hair takes a shadow-to-highlight ramp at each pixel's
// lightness) and gets its own animations, `<key>_<clip>_<facing>`. It's
// thrown away once nobody wears it (released a moment later, so someone
// walking in from the line keeps theirs), so new ones keep coming.
import Phaser from 'phaser';
import { PATRON_COLOR_MAPS, patronMetaOf } from '../assets.js';
import { VARIETY } from '../config.js';

const CODE = { skin: 1, cloth: 2, cloth2: 3, hair: 4 };
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const lightness = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;

export class VarietyMixin {
  // The look's frames and colour map, packed tight, read once.
  varietyBase(character) {
    this.varietyBases = this.varietyBases || {};
    if (character in this.varietyBases) return this.varietyBases[character];
    let base = null;
    const map = PATRON_COLOR_MAPS[character];
    const key = `patron_${character}`;
    if (map && this.textures.exists(key) && this.textures.exists(`${key}_colors`)) {
      const meta = patronMetaOf(character);
      const W = meta.frameWidth, H = meta.frameHeight;
      const rows = Object.entries(meta.starts).map(([row, first], r) => ({ row, first, n: meta.frames[row.split('_')[0]], r }));
      const cols = Math.max(...rows.map((x) => x.n));
      const pack = (img) => {
        const c = document.createElement('canvas');
        c.width = cols * W; c.height = rows.length * H;
        const g = c.getContext('2d', { willReadFrequently: true });
        for (const { first, n, r } of rows) {
          for (let k = 0; k < n; k++) {
            const f = first + k;
            g.drawImage(img, (f % meta.columns) * W, Math.floor(f / meta.columns) * H, W, H, k * W, r * H, W, H);
          }
        }
        return g.getImageData(0, 0, c.width, c.height);
      };
      const pixels = pack(this.textures.get(key).getSourceImage());
      const grey = pack(this.textures.get(`${key}_colors`).getSourceImage()).data;
      const codes = new Uint8Array(pixels.width * pixels.height);
      const step = map.info.step || 50;
      for (let i = 0; i < codes.length; i++) codes[i] = Math.round(grey[i * 4] / step);
      base = { pixels, codes, rows, cols, W, H, info: map.info, meta };
    }
    this.varietyBases[character] = base;
    return base;
  }

  // New colours for a look: a skin tone, a colour per garment, a hair ramp
  // (each part left as drawn now and then); null for the drawn colours.
  pickGuestColours(info) {
    const keep = () => Math.random() < VARIETY.keep;
    const drawnLight = (rgb) => lightness(...rgb) > 140;
    const skin = info.skin && !keep() ? pick(VARIETY.skins) : null;
    const cloth = (info.cloth || []).map((drawn) => (keep() ? null
      : pick(drawnLight(drawn) ? [...VARIETY.clothes.any, ...VARIETY.clothes.light] : VARIETY.clothes.any)));
    const hair = info.hair && !keep() ? pick(info.hair[1] > 150 ? VARIETY.hair.light : VARIETY.hair.dark) : null;
    if (!skin && !hair && !cloth.some(Boolean)) return null;
    return { skin, cloth, hair };
  }

  // The picture a guest of this look is drawn from: a fresh repaint, a live
  // one shared once there are `maxLive`, or the plain sheet.
  guestTexture(character) {
    const plain = `patron_${character}`;
    const base = this.varietyBase(character);
    if (!base || Math.random() < VARIETY.plain) return plain;
    this.varietyLive = this.varietyLive || {};
    const live = Object.keys(this.varietyLive);
    if (live.length >= VARIETY.maxLive) {
      const same = live.filter((k) => this.varietyLive[k].character === character);
      return same.length ? pick(same) : plain;
    }
    const colours = this.pickGuestColours(base.info);
    return colours ? this.makeRepaint(character, base, colours) : plain;
  }

  makeRepaint(character, base, { skin, cloth, hair }) {
    this.varietyCount = (this.varietyCount || 0) + 1;
    const key = `patron_${character}v${this.varietyCount}`;
    const { pixels, codes, info } = base;
    const out = new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
    const d = out.data;
    const ratio = (drawn, now) => drawn.map((v, j) => now[j] / Math.max(v, 5));
    const skinK = skin && ratio(info.skin, skin);
    const clothK = (cloth || []).map((c, i) => c && info.cloth[i] && ratio(info.cloth[i], c));
    const [lo, hi] = info.hair || [0, 255];
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (!code) continue;
      const p = i * 4;
      const k = code === CODE.skin ? skinK : code === CODE.cloth ? clothK[0] : code === CODE.cloth2 ? clothK[1] : null;
      if (k) {
        d[p] = d[p] * k[0]; d[p + 1] = d[p + 1] * k[1]; d[p + 2] = d[p + 2] * k[2];
      } else if (code === CODE.hair && hair) {
        const t = Math.min(1, Math.max(0, (lightness(d[p], d[p + 1], d[p + 2]) - lo) / Math.max(hi - lo, 1)));
        const [a, b] = t < 0.5 ? [hair[0], hair[1]] : [hair[1], hair[2]];
        const u = t < 0.5 ? t * 2 : t * 2 - 1;
        d[p] = a[0] + (b[0] - a[0]) * u; d[p + 1] = a[1] + (b[1] - a[1]) * u; d[p + 2] = a[2] + (b[2] - a[2]) * u;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = out.width; canvas.height = out.height;
    canvas.getContext('2d').putImageData(out, 0, 0);
    const tex = this.textures.addCanvas(key, canvas);
    const { rows, cols, W, H, meta } = base;
    for (const { n, r } of rows) for (let k = 0; k < n; k++) tex.add(r * cols + k, 0, k * W, r * H, W, H);
    for (const { row, n, r } of rows) {
      this.anims.create({
        key: `${key}_${row}`,
        frames: this.anims.generateFrameNumbers(key, { start: r * cols, end: r * cols + n - 1 }),
        frameRate: meta.fps[row.split('_')[0]],
        repeat: -1,
      });
    }
    this.varietyLive[key] = { character, users: 0, canvas, rows, cols, W, H, meta };
    return key;
  }

  // Counts who wears a repaint; a container's destroy lets go of it.
  wearRepaint(container, key) {
    const rec = this.varietyLive && this.varietyLive[key];
    if (!rec) return;
    rec.users++;
    container.once(Phaser.GameObjects.Events.DESTROY, () => {
      rec.users--;
      // A moment later, so the same guest walking in from the line keeps it.
      this.time.delayedCall(1500, () => { if (rec.users <= 0) this.dropRepaint(key); });
    });
  }

  dropRepaint(key) {
    const rec = this.varietyLive && this.varietyLive[key];
    if (!rec || rec.users > 0) return;
    delete this.varietyLive[key];
    for (const { row } of rec.rows) this.anims.remove(`${key}_${row}`);
    if (this.textures.exists(key)) this.textures.remove(key);
    if (this.repaintPortraits) delete this.repaintPortraits[key];
  }

  // A repainted guest's first front standing frame, for their card.
  repaintPortrait(key) {
    const rec = this.varietyLive && this.varietyLive[key];
    if (!rec) return null;
    this.repaintPortraits = this.repaintPortraits || {};
    if (!this.repaintPortraits[key]) {
      const r = rec.rows.find((x) => x.row === 'idle_front').r;
      const c = document.createElement('canvas');
      c.width = rec.W; c.height = rec.H;
      c.getContext('2d').drawImage(rec.canvas, 0, r * rec.H, rec.W, rec.H, 0, 0, rec.W, rec.H);
      this.repaintPortraits[key] = c.toDataURL();
    }
    return this.repaintPortraits[key];
  }
}
