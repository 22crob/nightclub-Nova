// ClubScene methods: staff (bartenders, DJs), drink sales and wages.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PATRON_META, PATRON_SHEETS } from '../assets.js';
import { PROP_TYPES, STAFF_TYPES } from '../catalog.js';
import { BAR_QUEUE_LENGTH, BARTENDERS, XP, CHARACTER_DISPLAY_HEIGHT, MONEY, THIRST_INTERVAL, PATRON_POPUP_Y, PROP_SCALE, SELL_REFUND_RATIO } from '../config.js';
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

  // Bars that need a bartender: the ones the Staff tab lists. (The DJ is
  // permanent, see ensureClubBooth().)
  hireableRecords() {
    return this.staffableRecords().filter((rec) => !STAFF_TYPES[PROP_TYPES[rec.type].staff].permanent);
  }

  // True while the DJ is playing, which is always once the club has its
  // booth: the dance floor only counts, and patrons only dance, with music.
  musicPlaying() {
    if (!this.clubOpen()) return false; // quiet between nights
    return this.staffableRecords().some((rec) => rec.staff && PROP_TYPES[rec.type].staff === 'dj');
  }

  totalWages() {
    return this.staffableRecords()
      .filter((rec) => rec.staff)
      .reduce((sum, rec) => sum + STAFF_TYPES[PROP_TYPES[rec.type].staff].wage, 0);
  }

  // --- Long bars ----------------------------------------------------------
  // Bar units placed side by side, the same way round, join into one long
  // bar, like Nightclub City's: one bartender works the whole counter.

  // Every bar unit joined to `rec` (including it), in order along the bar.
  barGroup(rec) {
    if (PROP_TYPES[rec.type].staff !== 'bartender') return [rec];
    const along = rec.facing === 90 || rec.facing === 270 ? [0, 1] : [1, 0];
    const at = (x, y) => {
      const other = this.placed[`${x},${y}`];
      return other && other.anchor[0] === x && other.anchor[1] === y && other.facing === rec.facing
        && PROP_TYPES[other.type].staff === 'bartender' ? other : null;
    };
    const group = [rec];
    for (const dir of [-1, 1]) {
      let [x, y] = rec.anchor;
      for (;;) {
        x += along[0] * dir;
        y += along[1] * dir;
        const next = at(x, y);
        if (!next) break;
        if (dir < 0) group.unshift(next); else group.push(next);
      }
    }
    return group;
  }

  // True if someone works this prop: its own staff, or for a bar unit, the
  // bartender of the long bar it's part of.
  isWorked(rec) {
    if (rec.staff) return true;
    if (PROP_TYPES[rec.type].staff !== 'bartender') return false;
    return this.barGroup(rec).some((r) => r.staff);
  }

  // Everyone waiting anywhere along a long bar.
  barGroupQueue(rec) {
    return this.barGroup(rec).flatMap((r) => r.queue || []);
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
    // The 1x3 bar runs back bar, aisle, counter: the bartender stands on the
    // middle tile, and customers order in front of the counter.
    const layouts = {
      0: { counter: [ax, ay + 2], out: [0, 1] },
      90: { counter: [ax + 2, ay], out: [1, 0] },
      180: { counter: [ax, ay], out: [0, -1] },
      270: { counter: [ax, ay], out: [-1, 0] },
    };
    return { ...layouts[rec.facing], aisle: rec.tiles[1] };
  }

  // Where customers line up at a bar: the ordering spot right in front of
  // the counter, then a straight line back from it, stopping at anything in
  // the way (at most BAR_QUEUE_LENGTH tiles).
  barQueueTiles(rec) {
    const { counter, out } = this.barLayout(rec);
    const [dx, dy] = out || [0, 1];
    const tiles = [];
    for (let k = 1; k <= BAR_QUEUE_LENGTH; k++) {
      const x = counter[0] + dx * k;
      const y = counter[1] + dy * k;
      if (x < 0 || y < 0 || x >= this.gridSize || y >= this.gridSize || this.isBlockingProp(x, y)) break;
      tiles.push([x, y]);
    }
    return tiles;
  }

  // The bar whose ordering spot is (gx, gy), if any.
  barServingTile(gx, gy) {
    for (const rec of this.staffableRecords()) {
      if (PROP_TYPES[rec.type].staff !== 'bartender') continue;
      const spot = this.barQueueTiles(rec)[0];
      if (spot && spot[0] === gx && spot[1] === gy) return rec;
    }
    return null;
  }

  // --- Bar queues ---------------------------------------------------------
  // rec.queue lists the patrons lined up at a bar, front first; each one's
  // walk target is their place in the line, and everyone steps up when the
  // front customer is served or someone leaves the line.

  // Every tile of every staffed bar's line, as "gx,gy" keys: wanderers keep
  // off them so they don't block the queue.
  barLineTiles() {
    const keys = new Set();
    for (const rec of this.staffableRecords()) {
      if (!this.isWorked(rec) || PROP_TYPES[rec.type].staff !== 'bartender') continue;
      for (const [x, y] of this.barQueueTiles(rec)) keys.add(`${x},${y}`);
    }
    return keys;
  }

  // Joins the shortest line at a staffed bar with room. False if none.
  joinBarQueue(patron) {
    if (patron.queue) return true;
    let best = null;
    for (const rec of this.staffableRecords()) {
      if (!this.isWorked(rec) || PROP_TYPES[rec.type].staff !== 'bartender') continue;
      rec.queue = (rec.queue || []).filter((p) => p.queue === rec && !p.gone && !p.leaving);
      if (rec.queue.length >= this.barQueueTiles(rec).length) continue; // line's full
      if (!best || rec.queue.length < best.queue.length) best = rec;
    }
    if (!best) return false;
    this.releaseSeat(patron);
    best.queue.push(patron);
    patron.queue = best;
    this.updateQueueTarget(patron);
    return true;
  }

  // Points a queued patron at their current place in line.
  updateQueueTarget(patron) {
    const rec = patron.queue;
    const slot = this.barQueueTiles(rec)[rec.queue.indexOf(patron)];
    if (!slot) { this.leaveBarQueue(patron); return; } // the line got shorter (something placed in it)
    [patron.targetGx, patron.targetGy] = slot;
    patron.path = null;
  }

  leaveBarQueue(patron) {
    const rec = patron.queue;
    if (!rec) return;
    patron.queue = null;
    rec.queue = (rec.queue || []).filter((p) => p !== patron);
    for (const p of rec.queue) {
      this.updateQueueTarget(p);
      if (!p.moving) p.nextMoveAt = Math.min(p.nextMoveAt, this.time.now + 300); // step up
    }
  }

  // A bar was sold, turned or lost its bartender: everyone in its line
  // goes and does something else.
  clearBarQueue(rec) {
    for (const p of rec.queue || []) {
      p.queue = null;
      p.targetGx = undefined;
      p.path = null;
    }
    rec.queue = [];
  }

  // Turns a queued patron to face the bar's counter.
  faceBar(patron) {
    const { counter } = this.barLayout(patron.queue);
    const { sx, sy } = this.gridToScreen(counter[0], counter[1]);
    this.faceToward(patron, sx, sy);
  }

  // --- Hiring -------------------------------------------------------------

  // How many bartenders your level lets you hire, how many work now, and
  // the level that allows one more (null at the top).
  bartenderAllowance() {
    const level = this.levelInfo().level;
    return BARTENDERS.levels.filter((l) => level >= l).length;
  }

  bartenderCount() {
    return this.hireableRecords().filter((rec) => rec.staff).length;
  }

  nextBartenderLevel() {
    const level = this.levelInfo().level;
    return BARTENDERS.levels.find((l) => l > level) || null;
  }

  // Puts `k` bartenders along a long bar, spread evenly over its units
  // (one in the middle, two at the quarter points, ...), moving the ones
  // already there as needed.
  staffBarGroup(group, k) {
    const want = new Set();
    for (let i = 0; i < k; i++) want.add(group[Math.min(group.length - 1, Math.floor(((i + 0.5) * group.length) / k))]);
    for (const r of group) if (r.staff && !want.has(r)) this.detachStaff(r);
    for (const r of group) if (!r.staff && want.has(r)) this.attachStaff(r);
  }

  // Hires a bartender for the long bar `rec` is part of: its first, or one
  // more beside the ones already there (one per bar unit at most), up to
  // what your level allows.
  hireStaff(rec) {
    const type = STAFF_TYPES[PROP_TYPES[rec.type].staff];
    if (type.permanent) return false;
    const group = this.barGroup(rec);
    const working = group.filter((r) => r.staff).length;
    if (working >= group.length) { SFX.denied(); return false; }
    if (this.bartenderCount() >= this.bartenderAllowance()) {
      SFX.denied();
      const next = this.nextBartenderLevel();
      this.showToast(next ? `🍸 You can have ${this.bartenderAllowance()} bartender${this.bartenderAllowance() > 1 ? 's' : ''} for now. Another at level ${next}!` : '🍸 You have every bartender you can hire!');
      return false;
    }
    if (this.cash < type.hireCost) { SFX.denied(); return false; }
    this.cash -= type.hireCost;
    this.staffBarGroup(group, working + 1);
    SFX.place();
    this.updateUI();
    this.saveGame();
    return true;
  }

  // Lets one bartender go from the long bar `rec` is part of.
  fireStaff(rec) {
    if (rec.staff && rec.staff.kind === 'dj') return; // the DJ never leaves
    const group = this.barGroup(rec);
    const working = group.filter((r) => r.staff).length;
    if (working === 0) return;
    this.staffBarGroup(group, working - 1);
    SFX.sell();
    this.updateUI();
    this.saveGame();
  }

  // Puts a staff member to work at `rec` (no charge: used by hiring and by
  // loading a save).
  attachStaff(rec) {
    const kind = PROP_TYPES[rec.type].staff;
    // Each extra bartender looks different from the ones already working.
    const others = kind === 'bartender' ? this.bartenderCount() : 0;
    const type = { ...STAFF_TYPES[kind], character: STAFF_TYPES[kind].character + others * 3 };
    rec.staff = { kind, container: this.createStaffSprite(type) };
    this.propLayer.add(rec.staff.container);
    this.positionStaff(rec);
  }

  detachStaff(rec) {
    if (!rec.staff) return;
    rec.staff.container.destroy();
    rec.staff = null;
    if (!this.isWorked(rec)) this.clearBarQueue(rec); // the line stays while a mate still works the bar
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
      // The DJ stands on the booth's own tiles behind the desk.
      const along = { 0: [0, -1], 90: [-1, 0], 180: [0, 1], 270: [1, 0] }[rec.facing] || [0, -1];
      const desk = this.deskTiles(rec.tiles);
      const center = desk.reduce((acc, [x, y]) => [acc[0] + x / desk.length, acc[1] + y / desk.length], [0, 0]);
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
    if (!this.isWorked(rec)) {
      this.clearBarQueue(rec);
      if (!rec.lastNoStaffNotice || now - rec.lastNoStaffNotice > NO_STAFF_NOTICE_MS) {
        rec.lastNoStaffNotice = now;
        const { sx, sy } = this.footprintCenter(rec.tiles);
        this.floatText(sx, sy - PATRON_POPUP_Y * 1.2, 'No bartender!', '#ff8a8a');
      }
      patron.nextMoveAt = Math.min(patron.nextMoveAt, now + 1500); // give up and wander off
      patron.thirstyAt = now + 8000; // try again a bit later
      return false;
    }
    this.leaveBarQueue(patron); // served: the line steps up
    this.serveDrink(rec, patron);
    return true;
  }

  // A patron gets a drink from a staffed bar and pays for it.
  serveDrink(rec, patron) {
    const now = this.time.now;
    const price = PROP_TYPES[rec.type].drinkPrice || 10;
    const tip = this.tipAmount(patron, price * randRange(...MONEY.drinkTip));
    this.cash += price + tip;
    this.noteIncome('drinkMoney', price);
    this.noteIncome('tips', tip);
    patron.spent = (patron.spent || 0) + price + tip;
    patron.drinks = (patron.drinks || 0) + 1;
    this.fans += XP.drinkServed; // XP for good service
    this.drinksSold = (this.drinksSold || 0) + 1;
    this.cheerPatron(patron, MOOD.drinkMood);
    patron.thirstyAt = now + randRange(...THIRST_INTERVAL) / this.boostFactor() / this.partyEffect('thirst', 1);
    this.startDrinking(patron, rec); // they drink it for a while (see activities.js)
    SFX.tip();
    this.floatText(patron.container.x, patron.container.y - PATRON_POPUP_Y, `🍹 $${price} Drink + $${tip} Tip`, '#7dffc4');
    this.updateUI();
    return price;
  }

  // Pays every working staff member. If the club can't cover the whole bill,
  // staff quit (most expensive first) until it can.
  payWages() {
    if (!this.clubOpen()) return; // nobody works between nights
    const working = this.hireableRecords().filter((rec) => rec.staff);
    if (working.length === 0) return;
    const wageOf = (rec) => STAFF_TYPES[PROP_TYPES[rec.type].staff].wage;
    working.sort((a, b) => wageOf(b) - wageOf(a));
    const quit = [];
    while (working.length && this.totalWages() > this.cash) {
      const rec = working.shift();
      quit.push(STAFF_TYPES[PROP_TYPES[rec.type].staff].label);
      this.detachStaff(rec);
    }
    this.noteIncome('wages', this.totalWages());
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
      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', fontStyle: 'bold', color,
      stroke: '#000000', strokeThickness: 3,
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

  // --- The club's DJ booth -------------------------------------------------

  // The club's one DJ booth.
  clubBooth() {
    return this.staffableRecords().find((rec) => PROP_TYPES[rec.type].staff === 'dj') || null;
  }

  // Makes sure the club has exactly one DJ booth with its DJ playing. A new
  // club gets a free Wood Booth against the back wall; a save with no
  // booth gets one too, and a save from before this rule with several
  // keeps the first and is refunded the rest in full.
  ensureClubBooth() {
    const booths = this.staffableRecords().filter((rec) => PROP_TYPES[rec.type].staff === 'dj');
    for (const extra of booths.slice(1)) {
      const before = this.cash;
      this.removeProp(extra);
      this.cash = before + PROP_TYPES[extra.type].cost;
    }
    let booth = booths[0];
    if (!booth) {
      const mid = Math.floor((this.gridSize - 3) / 2);
      const spots = [];
      for (let gy = 0; gy < this.gridSize; gy++) {
        for (let d = 0; d < this.gridSize; d++) {
          for (const gx of [mid + d, mid - d]) if (gx >= 0 && gx < this.gridSize - 1) spots.push([gx, gy]);
        }
      }
      for (const [gx, gy] of spots) {
        booth = this.restoreProp('woodBooth', 0, [gx, gy]);
        if (booth) break;
      }
    }
    if (booth && !booth.staff) this.attachStaff(booth);
  }

  // A brand-new club opens like Nightclub City's starter room: the DJ booth
  // against the left wall, toward the front, facing into the room, with a
  // small 3x3 Basic Floor in front of it, and a long bar of four Starter
  // Bar units with one bartender against the right wall, toward the front,
  // serving into the room. (ensureClubBooth() then gives the booth its DJ.)
  placeStarterLayout() {
    const n = this.gridSize;
    const booth = this.restoreProp('woodBooth', 90, [1, n - 5]); // the DJ's tiles are against the wall
    if (!booth) this.ensureClubBooth();
    for (let gx = 2; gx <= 4; gx++) {
      for (let gy = n - 5; gy <= n - 3; gy++) this.restoreProp('basicFloor', 0, [gx, gy]);
    }
    const units = [];
    for (let gx = n - 4; gx < n; gx++) {
      const bar = this.restoreProp('starterBar', 0, [gx, 0]);
      if (bar) units.push(bar);
    }
    if (units.length) this.attachStaff(units[Math.floor(units.length / 2)]);
  }

  // Swaps the club's booth for another tier, in the same spot and facing.
  // Costs the new booth's price, less half the old one's (like selling it).
  upgradeClubBooth(type) {
    const old = this.clubBooth();
    const def = PROP_TYPES[type];
    if (!old || old.type === type) { SFX.denied(); return false; }
    if (!this.isUnlocked(type)) { SFX.denied(); return false; }
    const refund = Math.round(PROP_TYPES[old.type].cost * SELL_REFUND_RATIO);
    if (this.cash + refund < def.cost) { SFX.denied(); return false; }
    const { facing, anchor } = old;
    this.removeProp(old);
    const rec = this.restoreProp(type, facing, anchor);
    this.attachStaff(rec);
    this.cash += refund - def.cost;
    SFX.levelUp();
    this.showToast(`🎧 Your DJ moved into the ${def.label}!`);
    this.updateUI();
    this.saveGame();
    return true;
  }

  // --- Shop tab -----------------------------------------------------------

  // The dock's Staff tab: a card per long bar with how many
  // bartenders work it; click to hire one more (up to what your level
  // allows), ✕ to let one go. Details are in the hover tip.
  renderStaffCard() {
    const el = this.shopItemsEl;
    const records = this.hireableRecords();
    const type = STAFF_TYPES.bartender;
    const allowed = this.bartenderAllowance();
    const hired = this.bartenderCount();
    const next = this.nextBartenderLevel();
    // Only rebuild when something on the cards changed (this runs often).
    const key = 'staff:' + records.map((r) => `${r.anchor}:${!!r.staff}:${this.barGroup(r).length}`).join('|') + `:${this.cash >= type.hireCost}:${allowed}`;
    if (el.dataset.rendered === key) return;
    el.innerHTML = '';
    el.dataset.rendered = key;
    const limit = `You have ${hired} of the ${allowed} bartender${allowed > 1 ? 's' : ''} your level allows${next ? `; one more at level ${next}` : ''}.`;
    if (records.length === 0) {
      const { slot, cost } = this.makeCard('No bars yet', `Place a bar first, then hire a bartender to work it. ${limit}`, null);
      slot.classList.add('emptySlot');
      cost.textContent = '–';
      el.appendChild(slot);
      return;
    }
    const counts = {};
    const seen = new Set();
    for (const rec of records) {
      if (seen.has(rec)) continue;
      const group = this.barGroup(rec);
      group.forEach((r) => seen.add(r));
      const def = PROP_TYPES[rec.type];
      counts[rec.type] = (counts[rec.type] || 0) + 1;
      const working = group.filter((r) => r.staff).length;
      const name = group.length > 1 ? `${def.label} ${counts[rec.type]} (${group.length} long)` : `${def.label} ${counts[rec.type]}`;
      const full = working >= group.length;
      const atLimit = hired >= allowed;
      let status = working
        ? `${working} bartender${working > 1 ? 's' : ''} working · $${type.wage} each every 30 seconds.`
        : 'No bartender: not selling drinks.';
      if (full) status += ' Every spot behind this bar is taken.';
      else if (atLimit) status += ` ${limit}`;
      else status += ` Click to hire ${working ? 'another' : 'one'} for $${type.hireCost}. ${limit}`;
      const { slot, button, cost } = this.makeCard(name, status, realSpriteIconFor(rec.type));
      slot.classList.add('staffSlot');
      slot.classList.toggle('staffed', working > 0);
      const badge = working ? `🍸×${working}` : '';
      if (full || atLimit) {
        cost.textContent = badge || (next ? `🔒 Lv ${next}` : '–');
        if (!working) button.classList.add('locked');
      } else {
        button.classList.toggle('unaffordable', this.cash < type.hireCost);
        cost.textContent = `${badge ? badge + ' ' : ''}+$${type.hireCost}`;
        slot.addEventListener('click', () => { this.hireStaff(rec); this.renderStaffCard(); });
      }
      if (working) {
        const fire = document.createElement('div');
        fire.className = 'staffFire';
        fire.textContent = '✕';
        fire.dataset.tipName = 'Let one go';
        fire.dataset.tipText = working > 1 ? 'Let one of this bar\'s bartenders go.' : 'Let this bartender go. The bar stops selling drinks.';
        fire.addEventListener('click', (e) => { e.stopPropagation(); this.fireStaff(rec); this.renderStaffCard(); });
        slot.appendChild(fire);
      }
      el.appendChild(slot);
    }
  }
}
