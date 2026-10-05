// ClubScene methods: Fan rate, patron capacity and level progression.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { FLOOR_DECAL_PROPS, PROP_TYPES } from '../catalog.js';
import { BASE_GRID_SIZE, CAPACITY, LEVEL_FANS, LUXURY } from '../config.js';

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
      if (def.staff && !this.isWorked(p)) continue;
      if (FLOOR_DECAL_PROPS.has(p.type) && !music) continue;
      rate += def.fanRate;
    }
    return rate;
  }

  // How many guests fit: CAPACITY.base plus one for every row of floor
  // bought.
  patronCapacity() {
    const rows = (this.gridW - BASE_GRID_SIZE) + (this.gridH - BASE_GRID_SIZE); // expansions bought
    return CAPACITY.base + CAPACITY.perExpansion * rows;
  }

  // Guests inside the club now (staff don't count; celebrities do).
  guestCount() {
    return this.patrons.filter((p) => !p.gone).length;
  }

  // How fancy the club is, like Nightclub City's Luxury: a tenth of what
  // everything placed, every wallpapered wall section and every painted
  // floor tile cost.
  luxury() {
    let dollars = 0;
    const counted = new Set();
    for (const key in this.placed) {
      const rec = this.placed[key];
      if (counted.has(rec)) continue;
      counted.add(rec);
      dollars += PROP_TYPES[rec.type].cost || 0;
    }
    for (const type of Object.values(this.wallpaper)) dollars += (PROP_TYPES[type] && PROP_TYPES[type].cost) || 0;
    for (const type of Object.values(this.floorPaint)) dollars += (PROP_TYPES[type] && PROP_TYPES[type].cost) || 0;
    return Math.round(dollars * LUXURY.perDollar);
  }

  // Tips grow with Luxury.
  luxuryTipFactor() {
    return 1 + Math.min(LUXURY.tipMax, this.luxury() * LUXURY.tipPerPoint);
  }

  // The level and the bar toward the next one, from the fan count (the
  // game has no separate XP). Each level needs more fans than the last
  // (LEVEL_FANS): 150 for level 2, 250 more for level 3, and so on.
  levelInfo() {
    let fans = Math.floor(this.fans);
    let level = 1;
    let need = this.fansToNextLevel(1);
    while (fans >= need) {
      fans -= need;
      level += 1;
      need = this.fansToNextLevel(level);
    }
    return { level, into: fans, need, progress: fans / need };
  }

  // Fans needed to get from `level` to the next (see LEVEL_FANS).
  fansToNextLevel(level) {
    const k = level - 1;
    return LEVEL_FANS.first + LEVEL_FANS.step * k + LEVEL_FANS.curve * k * k;
  }

  // Total fans at which `level` starts.
  fansForLevel(level) {
    let total = 0;
    for (let l = 1; l < level; l++) total += this.fansToNextLevel(l);
    return total;
  }
}
