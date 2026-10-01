// ClubScene methods: staff (bartenders, DJs), drink sales and wages.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PATRON_META, PATRON_SHEETS } from '../assets.js';
import { PROP_TYPES, STAFF_TYPES } from '../catalog.js';
import { CHARACTER_DISPLAY_HEIGHT, THIRST_INTERVAL, PATRON_POPUP_Y, PROP_SCALE } from '../config.js';
import { realSpriteIconFor } from '../icons.js';
import { SFX } from '../sfx.js';
import { randRange } from '../util.js';
import { MOOD } from './mood.js';

// How long a bar waits before showing "No bartender!" again.
const NO_STAFF_NOTICE_MS = 8000;

export class StaffMixin {
  // Every distinct placed prop that takes staff (bars, DJ booths), in a
  // stable order: by type, then position.
  staffableRecords() {
    const seen = new Set();
    const out = [];
    for (const key in this.placed) {
      const rec = this.placed[key];
      if (seen.has(rec) || !PROP_TYPES[rec.type].staff) continue;
      seen.add(rec);
      out.push(rec);
    }
    return out.sort((a, b) => a.type.localeCompare(b.type) || a.anchor[0] - b.anchor[0] || a.anchor[1] - b.anchor[1]);
  }

  // True while at least one DJ is working: the dance floor only counts,
  // and patrons only dance, while music is playing.
  musicPlaying() {
    return this.staffableRecords().some((rec) => rec.staff && PROP_TYPES[rec.type].staff === 'dj');
  }

  totalWages() {
    return this.staffableRecords()
      .filter((rec) => rec.staff)
      .reduce((sum, rec) => sum + STAFF_TYPES[PROP_TYPES[rec.type].staff].wage, 0);
  }

  // --- Bar layout ---------------------------------------------------------

  // For a bar: the counter tile customers order at and the direction its
  // customer side faces. The 1x3 bar runs back bar, aisle, counter; its
  // customer side faces +gy at facing 0 and turns with the bar. A one-tile
  // bar serves on every side.
  barLayout(rec) {
    const def = PROP_TYPES[rec.type];
    const [ax, ay] = rec.anchor;
    if (!def.footprint) return { counter: [ax, ay], out: null, aisle: [ax, ay] };
    const layouts = {
      0: { counter: [ax, ay + 2], out: [0, 1] },
      90: { counter: [ax + 2, ay], out: [1, 0] },
      180: { counter: [ax, ay], out: [0, -1] },
      270: { counter: [ax, ay], out: [-1, 0] },
    };
    return { ...layouts[rec.facing], aisle: rec.tiles[1] };
  }

  // Walkable tiles a customer can order from: in front of the counter and
  // on either side of it.
  barServiceTiles(rec) {
    const { counter, out } = this.barLayout(rec);
    const [cx, cy] = counter;
    const offsets = out ? [out, [out[1], out[0]], [-out[1], -out[0]]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    return offsets
      .map(([dx, dy]) => [cx + dx, cy + dy])
      .filter(([x, y]) => x >= 0 && y >= 0 && x < this.gridSize && y < this.gridSize && !this.isBlockingProp(x, y));
  }

  // The nearest free customer-side tile of a staffed bar, for a thirsty
  // patron at (gx, gy). Null if there's no staffed bar or no free spot.
  nearestFreeBarTile(gx, gy) {
    let best = null;
    let bestDist = Infinity;
    for (const rec of this.staffableRecords()) {
      if (!rec.staff || PROP_TYPES[rec.type].staff !== 'bartender') continue;
      for (const [x, y] of this.barServiceTiles(rec)) {
        if (this.patronTileOccupied(x, y)) continue;
        const d = Math.abs(x - gx) + Math.abs(y - gy);
        if (d < bestDist) { bestDist = d; best = [x, y]; }
      }
    }
    return best;
  }

  // The bar a customer standing on (gx, gy) would order from, if any.
  barServingTile(gx, gy) {
    for (const rec of this.staffableRecords()) {
      if (PROP_TYPES[rec.type].staff !== 'bartender') continue;
      if (this.barServiceTiles(rec).some(([x, y]) => x === gx && y === gy)) return rec;
    }
    return null;
  }

  // --- Hiring -------------------------------------------------------------

  hireStaff(rec) {
    const type = STAFF_TYPES[PROP_TYPES[rec.type].staff];
    if (rec.staff) return false;
    if (this.cash < type.hireCost) { SFX.denied(); return false; }
    this.cash -= type.hireCost;
    this.attachStaff(rec);
    SFX.place();
    this.updateUI();
    this.saveGame();
    return true;
  }

  fireStaff(rec) {
    if (!rec.staff) return;
    this.detachStaff(rec);
    SFX.sell();
    this.updateUI();
    this.saveGame();
  }

  // Puts a staff member to work at `rec` (no charge: used by hiring and by
  // loading a save).
  attachStaff(rec) {
    const kind = PROP_TYPES[rec.type].staff;
    rec.staff = { kind, container: this.createStaffSprite(STAFF_TYPES[kind]) };
    this.propLayer.add(rec.staff.container);
    this.positionStaff(rec);
  }

  detachStaff(rec) {
    if (!rec.staff) return;
    rec.staff.container.destroy();
    rec.staff = null;
  }

  createStaffSprite(type) {
    const container = this.add.container(0, 0);
    if (!this.hasCharacterSprites()) {
      container.add(this.add.ellipse(0, -12 * PROP_SCALE, 18 * PROP_SCALE, 30 * PROP_SCALE, 0xffd24d, 1));
      return container;
    }
    const character = type.character % PATRON_SHEETS.length;
    const sprite = this.add.sprite(0, 0, `patron_${character}`);
    sprite.setOrigin(PATRON_META.originX, PATRON_META.originY);
    sprite.setScale((CHARACTER_DISPLAY_HEIGHT * 0.9) / PATRON_META.standingHeight);
    container.add(sprite);
    container.staffSprite = sprite;
    container.staffCharacter = character;
    return container;
  }

  // Places a staff member for their prop's current position and facing.
  //  - A bartender stands in the bar's aisle facing the customers, drawn
  //    between the bar's back layer and its counter layer (see
  //    setPropDepth()), so the counter hides them from the right side.
  //  - A DJ stands just behind the booth facing the dance floor. When the
  //    booth faces away from the camera, the DJ is nearer and drawn on top.
  positionStaff(rec) {
    const c = rec.staff && rec.staff.container;
    if (!c) return;
    const sprite = c.staffSprite;
    const base = rec.gameObject.baseDepth !== undefined ? rec.gameObject.baseDepth : rec.gameObject.depth;
    let gx;
    let gy;
    let faceOut;
    let depth;
    if (rec.staff.kind === 'bartender') {
      const { aisle, out } = this.barLayout(rec);
      [gx, gy] = aisle;
      faceOut = out || [0, 1];
      // Between the layers; a one-piece bar without layers draws them on top.
      depth = rec.frontObject ? base + 0.001 : base + 0.003;
    } else {
      // The booth's front (crowd side) faces +gy at 0, +gx at 90, -gy at
      // 180 and -gx at 270; the DJ stands on the opposite side.
      const along = { 0: [0, -0.55], 90: [-0.55, 0], 180: [0, 0.55], 270: [0.55, 0] }[rec.facing] || [0, -0.55];
      const center = rec.tiles.reduce((acc, [x, y]) => [acc[0] + x / rec.tiles.length, acc[1] + y / rec.tiles.length], [0, 0]);
      gx = center[0] + along[0];
      gy = center[1] + along[1];
      faceOut = [-Math.sign(along[0]), -Math.sign(along[1])];
      // Behind the booth they're covered by it; on the camera side (180 and
      // 270) they're seen from behind, in front of it.
      depth = along[0] + along[1] > 0 ? base + 0.001 : base - 0.001;
    }
    const { sx, sy } = this.gridToScreen(gx, gy);
    c.setPosition(sx, sy);
    c.setDepth(depth);
    this.propLayer.sort('depth');
    if (!sprite) return;
    // Face the customers: +gy is screen down-left (front), +gx down-right
    // (front, mirrored), -gy up-right (back), -gx up-left (back, mirrored).
    const front = faceOut[0] > 0 || faceOut[1] > 0;
    const mirrored = faceOut[0] !== 0;
    c.scaleX = mirrored ? -1 : 1;
    const clip = rec.staff.kind === 'dj' ? 'dance' : 'idle';
    sprite.play(`patron_${c.staffCharacter}_${clip}_${front ? 'front' : 'back'}`);
  }

  // --- Drinks and wages ---------------------------------------------------

  // A patron standing at a bar's customer side orders a drink. A staffed bar
  // sells it (the club's main income); an unstaffed one can't. Returns true
  // if a drink was bought.
  orderDrink(patron) {
    const rec = this.barServingTile(patron.gx, patron.gy);
    if (!rec) return false;
    const now = this.time.now;
    if (!rec.staff) {
      if (!rec.lastNoStaffNotice || now - rec.lastNoStaffNotice > NO_STAFF_NOTICE_MS) {
        rec.lastNoStaffNotice = now;
        const { sx, sy } = this.footprintCenter(rec.tiles);
        this.floatText(sx, sy - PATRON_POPUP_Y * 1.2, 'No bartender!', '#ff8a8a');
      }
      patron.nextMoveAt = Math.min(patron.nextMoveAt, now + 1500); // give up and wander off
      patron.thirstyAt = now + 8000; // try again a bit later
      return false;
    }
    const price = PROP_TYPES[rec.type].drinkPrice || 10;
    this.cash += price;
    this.fans += 0.3;
    this.drinksSold = (this.drinksSold || 0) + 1;
    this.cheerPatron(patron, MOOD.drinkMood);
    patron.thirstyAt = now + randRange(...THIRST_INTERVAL);
    SFX.tip();
    this.floatText(patron.container.x, patron.container.y - PATRON_POPUP_Y, `🍹 +$${price}`, '#7dffc4');
    this.updateUI();
    return true;
  }

  // Pays every working staff member. If the club can't cover the whole bill,
  // staff quit (most expensive first) until it can.
  payWages() {
    const working = this.staffableRecords().filter((rec) => rec.staff);
    if (working.length === 0) return;
    const wageOf = (rec) => STAFF_TYPES[PROP_TYPES[rec.type].staff].wage;
    working.sort((a, b) => wageOf(b) - wageOf(a));
    const quit = [];
    while (working.length && this.totalWages() > this.cash) {
      const rec = working.shift();
      quit.push(STAFF_TYPES[PROP_TYPES[rec.type].staff].label);
      this.detachStaff(rec);
    }
    this.cash -= this.totalWages();
    for (const rec of working) {
      const { x, y } = rec.staff.container;
      this.floatText(x, y - PATRON_POPUP_Y, `-$${wageOf(rec)}`, '#ffb1b1');
    }
    if (quit.length) {
      this.showToast(`😬 Couldn't pay wages: your ${quit.join(' and ')} quit!`);
      SFX.denied();
    }
    this.updateUI();
    this.saveGame();
  }

  // A short-lived label that floats up and fades, above everything.
  floatText(x, y, text, color) {
    const label = this.add.text(x, y, text, {
      fontFamily: 'Fredoka, Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color,
      stroke: '#0a1f44', strokeThickness: 3,
    }).setOrigin(0.5, 1);
    this.patronLayer.add(label);
    this.tweens.add({
      targets: label,
      y: y - 22 * PROP_SCALE,
      alpha: 0,
      duration: 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  // --- Shop tab -----------------------------------------------------------

  // The Staff tab: one row per bar and DJ booth, with a hire / let go
  // button, and the total wage bill.
  renderStaffCard() {
    const el = this.shopItemsEl;
    el.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'staffCard';
    const records = this.staffableRecords();

    const summary = document.createElement('div');
    summary.className = 'staffSummary';
    summary.textContent = records.length
      ? `Wages: $${this.totalWages()} every 30 seconds`
      : 'Place a bar or DJ booth first, then hire someone to work it.';
    card.appendChild(summary);

    const counts = {};
    for (const rec of records) {
      const def = PROP_TYPES[rec.type];
      const type = STAFF_TYPES[def.staff];
      counts[rec.type] = (counts[rec.type] || 0) + 1;
      const row = document.createElement('div');
      row.className = 'staffRow';

      const icon = document.createElement('div');
      icon.className = 'staffIcon';
      const src = realSpriteIconFor(rec.type);
      if (src) icon.style.backgroundImage = `url(${src})`;
      row.appendChild(icon);

      const text = document.createElement('div');
      text.className = 'staffText';
      const name = document.createElement('div');
      name.className = 'staffName';
      name.textContent = `${def.label} ${counts[rec.type]}`;
      const status = document.createElement('div');
      status.className = rec.staff ? 'staffStatus working' : 'staffStatus empty';
      status.textContent = rec.staff
        ? `${type.label} working · $${type.wage} per 30s`
        : (def.staff === 'bartender' ? 'No bartender: not selling drinks' : 'No DJ: no music');
      text.appendChild(name);
      text.appendChild(status);
      row.appendChild(text);

      const button = document.createElement('div');
      if (rec.staff) {
        button.className = 'staffButton fire';
        button.textContent = 'Let go';
        button.addEventListener('click', () => { this.fireStaff(rec); this.renderStaffCard(); });
      } else {
        button.className = 'staffButton hire';
        button.classList.toggle('unaffordable', this.cash < type.hireCost);
        button.textContent = `Hire ${type.label} $${type.hireCost}`;
        button.addEventListener('click', () => { this.hireStaff(rec); this.renderStaffCard(); });
      }
      row.appendChild(button);
      card.appendChild(row);
    }
    el.appendChild(card);
  }
}
