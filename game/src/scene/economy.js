// ClubScene methods: Fan rate, patron capacity and level progression.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { FLOOR_DECAL_PROPS, PROP_TYPES } from '../catalog.js';
import { PATRON_ABSOLUTE_MAX, PATRON_BASE_CAPACITY } from '../config.js';

export class EconomyMixin {
  // Sums every placed prop's fanRate (dance tiles, DJ booth, neon floor —
  // anything with one), deduped by record identity so a multi-tile prop
  // only counts once. Used by the once-a-second passive growth timer.
  // (There's deliberately no offline-progress catch-up in loadGame() — see
  // the test/comment near "no offline progress" in the save/load tests —
  // fans only grow while the game is actually open and running.)
  totalFanRate() {
    const music = this.musicPlaying();
    let rate = 0;
    const counted = new Set();
    for (const key in this.placed) {
      const p = this.placed[key];
      if (counted.has(p)) continue;
      counted.add(p);
      const def = PROP_TYPES[p.type];
      if (!def.fanRate) continue;
      // Staffed props only earn fans while someone works them, and the dance
      // floor only while a DJ is playing music.
      if (def.staff && !p.staff) continue;
      if (FLOOR_DECAL_PROPS.has(p.type) && !music) continue;
      rate += def.fanRate;
    }
    return rate;
  }

  // How many patrons the club can currently hold: a small base draw plus
  // each placed FLOOR's capacity contribution. Capacity is strictly a
  // flooring thing, not a furniture thing — a Bar, DJ Booth, Table, VIP
  // Lounge, or Disco Ball makes the club more fun/profitable (fan rate,
  // better tips) but doesn't let it hold more people; only actual floor
  // space (the Floors category — dance tiles, neon floor, and eventually
  // expanding the club's physical size) does that. Gating on `category`
  // here rather than trusting every item's own `capacity` field to be
  // zeroed correctly means a future non-Floors item can't accidentally
  // grant capacity just by having that field set. Deduped by record
  // identity so a multi-tile prop (the DJ booth) only counts once — same
  // dedup pattern as placedCount() and the fan-rate timer.
  patronCapacity() {
    let capacity = PATRON_BASE_CAPACITY;
    const counted = new Set();
    for (const key in this.placed) {
      const rec = this.placed[key];
      if (counted.has(rec)) continue;
      counted.add(rec);
      const def = PROP_TYPES[rec.type];
      if (def.category === 'Dance Floors') capacity += def.capacity || 0;
    }
    return Math.min(capacity + this.partyEffect('capacity', 0), PATRON_ABSOLUTE_MAX);
  }

  // Derives a lightweight level + progress bar from the fan count, since
  // the game doesn't track a separate XP stat. Every 100 fans is one level;
  // the remainder within the current level drives the XP bar fill.
  levelInfo() {
    const fansFloor = Math.floor(this.fans);
    const level = Math.floor(fansFloor / 100) + 1;
    const progress = fansFloor % 100;
    return { level, progress };
  }
}
