// ClubScene methods: staff (bartenders, DJs), drink sales and wages.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PATRON_META, PATRON_SHEETS, patronMetaOf } from '../assets.js';
import { PROP_TYPES, STAFF_TYPES } from '../catalog.js';
import { BAR_QUEUE_LENGTH, BARTENDERS, BOOST, DRINK_FUN_MOOD, XP, CHARACTER_DISPLAY_HEIGHT, MONEY, THIRST_INTERVAL, PATRON_POPUP_Y, PROP_SCALE, BOUNCERS, BAR_TRAINING, DRINK_STOCK } from '../config.js';
import { SFX } from '../sfx.js';
import { randRange } from '../util.js';
import { MOOD } from './mood.js';
import { drinkIconSvg } from './drinks.js';

// Money popping up over guests is always green (the owner asked for no red).
const MONEY_GREEN = '#1fc94a';

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
      .reduce((sum, rec) => sum + STAFF_TYPES[PROP_TYPES[rec.type].staff].wage, 0)
      + ((this.bouncers || 1) - 1) * BOUNCERS.wage; // the house bouncer is free
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
      if (!this.inGrid(x, y) || this.isBlockingProp(x, y)) break;
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
    if (this.bartenderCount() >= 2) this.noteGoalBest('hired', 1);
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
    this.releaseBartender(rec.staff);
    this.tweens.killTweensOf(rec.staff.container);
    rec.staff.container.destroy();
    rec.staff = null;
    // The line stays while a mate still works the bar.
    if (!this.isWorked(rec)) for (const unit of this.barGroup(rec)) this.clearBarQueue(unit);
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
      // Back at their own unit (see bars.js for walking along the bar).
      this.releaseBartender(rec.staff);
      this.tweens.killTweensOf(c);
      rec.staff.atUnit = rec;
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

  // A patron gets a drink from a staffed bar and pays for it.
  serveDrink(rec, patron) {
    const now = this.time.now;
    // Their order from the drink menu (drinks.js; Bottoms Up! serves one
    // without asking), doubled while the drink meter is full.
    const drink = this.drinkOf(patron.order || this.pickDrink(patron).key);
    patron.order = null;
    const price = drink.price * this.drinkPriceFactor();
    const tip = Math.round(this.tipAmount(patron, price * randRange(...MONEY.drinkTip)) * this.barTricksFactor(rec));
    this.cash += price + tip;
    this.noteIncome('drinkMoney', price);
    this.noteIncome('tips', tip);
    patron.spent = (patron.spent || 0) + price + tip;
    patron.drinks = (patron.drinks || 0) + 1;
    this.useDrinkStock(); // one less in the bars (upgrades.js)
    this.fans += XP.drinkServed; // XP for good service
    this.drinksSold = (this.drinksSold || 0) + 1;
    this.bumpGoal('drinks');
    if (this.partyStats) {
      this.partyStats.drinks += 1;
      this.partyStats.drinkRevenue += price + tip;
    }
    this.cheerPatron(patron, MOOD.drinkMood + drink.fun * DRINK_FUN_MOOD);
    patron.thirstyAt = now + randRange(...THIRST_INTERVAL) / this.boostFactor() / this.partyEffect('thirst', 1);
    this.startDrinking(patron, rec); // they drink it for a while (see activities.js)
    this.popReaction(patron, 'happy', randRange(600, 1300)); // after the price pops up
    SFX.tip();
    this.floatMoney(patron.container.x, patron.container.y - PATRON_POPUP_Y, `$${price + tip}`);
    this.updateUI();
    return price;
  }

  // Pays every working staff member. If the club can't cover the whole bill,
  // staff quit (most expensive first) until it can.
  payWages() {
    if (!this.clubOpen()) return; // nobody works between nights
    const working = this.hireableRecords().filter((rec) => rec.staff);
    if (working.length === 0 && (this.bouncers || 1) <= 1) return;
    const wageOf = (rec) => STAFF_TYPES[PROP_TYPES[rec.type].staff].wage;
    working.sort((a, b) => wageOf(b) - wageOf(a));
    const quit = [];
    while (working.length && this.totalWages() > this.cash) {
      const rec = working.shift();
      quit.push(STAFF_TYPES[PROP_TYPES[rec.type].staff].label);
      this.detachStaff(rec);
    }
    while (this.totalWages() > this.cash && (this.bouncers || 1) > 1) { // then bouncers, newest first
      this.bouncers -= 1;
      quit.push('Bouncer');
      this.setupSecurity();
    }
    this.noteIncome('wages', this.totalWages());
    this.cash -= this.totalWages();
    for (const rec of working) {
      const { x, y } = rec.staff.container;
      this.floatText(x, y - PATRON_POPUP_Y, `-$${wageOf(rec)}`, '#ffb1b1');
    }
    for (const g of (this.guards || []).slice(1)) this.floatText(g.container.x, g.container.y - PATRON_POPUP_Y, `-$${BOUNCERS.wage}`, '#ffb1b1');
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
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '14px', color,
      stroke: '#0a1830', strokeThickness: 4,
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

  // Money over a guest's head, like Nightclub City's: a big green amount with
  // a white outline that pops up and floats away. While a boost or a party
  // multiplies tips, "+2x Tip!" rides above it (unless `tipped` is false:
  // the cover charge and bonuses).
  floatMoney(x, y, text, tipped = true) {
    const color = MONEY_GREEN;
    const mult = tipped ? (this.isBoosted() ? BOOST.tipMultiplier : 1) * this.partyEffect('tips', 1) : 1;
    const style = (size) => ({
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: `${size}px`, color,
      stroke: '#ffffff', strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 2, color: '#0a1830', blur: 0, fill: true, stroke: true },
    });
    const parts = [this.add.text(0, 0, text, style(20)).setOrigin(0.5, 1)];
    if (mult > 1.01) {
      const times = Number.isInteger(mult) ? mult : mult.toFixed(1).replace(/\.0$/, '');
      parts.push(this.add.text(0, -22, `+${times}x Tip!`, style(14)).setOrigin(0.5, 1));
    }
    const holder = this.add.container(x, y, parts).setScale(0.4);
    this.patronLayer.add(holder);
    this.tweens.add({ targets: holder, scale: 1, duration: 240, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: holder, y: y - 34, alpha: 0, delay: 650, duration: 1000, ease: 'Quad.easeIn',
      onComplete: () => holder.destroy(),
    });
    return holder;
  }

  // --- DJ booths -------------------------------------------------------------

  // Every DJ booth in the club (shop items like any other, each with a DJ).
  clubBooths() {
    return this.staffableRecords().filter((rec) => PROP_TYPES[rec.type].staff === 'dj');
  }

  // The club's main booth: the best one (the priciest), whose DJ talks.
  clubBooth() {
    const booths = this.clubBooths();
    return booths.reduce((best, rec) => (!best || (PROP_TYPES[rec.type].cost || 0) > (PROP_TYPES[best.type].cost || 0) ? rec : best), null);
  }

  // True if `rec` is the club's only DJ booth (it can't be sold or put away).
  lastBooth(rec) {
    const booths = this.clubBooths();
    return booths.length <= 1 && (!booths.length || booths[0] === rec);
  }

  // Makes sure the club has a DJ booth, every booth with its DJ playing. A
  // new club, or a save with none, gets a free Wood Booth against the back
  // wall.
  ensureClubBooth() {
    let booths = this.clubBooths();
    if (!booths.length) {
      const mid = Math.floor((this.gridW - 3) / 2);
      const spots = [];
      for (let gy = 0; gy < this.gridH; gy++) {
        for (let d = 0; d < this.gridW; d++) {
          for (const gx of [mid + d, mid - d]) if (gx >= 0 && gx < this.gridW - 1) spots.push([gx, gy]);
        }
      }
      for (const [gx, gy] of spots) {
        const booth = this.restoreProp('woodBooth', 0, [gx, gy]);
        if (booth) { booths = [booth]; break; }
      }
    }
    for (const booth of booths) if (!booth.staff) this.attachStaff(booth);
  }

  // A brand-new club opens like Nightclub City's starter room: the DJ booth
  // against the left wall, toward the front, facing into the room, with a
  // small 3x3 Basic Floor in front of it, one Starter Bar with a bartender
  // against the right wall, serving into the room, and a Standing Table in
  // the corner at the front end of the right wall. (ensureClubBooth() then
  // gives the booth its DJ.)
  placeStarterLayout() {
    const n = this.gridH; // along the left wall
    const booth = this.restoreProp('woodBooth', 90, [1, n - 5]); // the DJ's tiles are against the wall
    if (!booth) this.ensureClubBooth();
    for (let gx = 2; gx <= 4; gx++) {
      for (let gy = n - 5; gy <= n - 3; gy++) this.restoreProp('basicFloor', 0, [gx, gy]);
    }
    const bar = this.restoreProp('starterBar', 0, [this.gridW - 4, 0]);
    if (bar) this.attachStaff(bar);
    this.restoreProp('standingTable', 0, [this.gridW - 1, 0]);
  }

  // --- Shop tab -----------------------------------------------------------

  // A head-and-shoulders picture of a character (their first front-facing
  // idle frame, cropped to the head), as an image URL; made once per look.
  headshotUrl(character) {
    this.headshots = this.headshots || {};
    if (this.headshots[character]) return this.headshots[character];
    const key = `patron_${character}`;
    if (!this.textures.exists(key)) return null;
    const img = this.textures.get(key).getSourceImage();
    const m = patronMetaOf(character);
    const frame = m.starts.idle_front;
    const cellX = (frame % m.columns) * m.frameWidth;
    const cellY = Math.floor(frame / m.columns) * m.frameHeight;
    const headTop = m.originY * m.frameHeight - m.standingHeight;
    const side = m.standingHeight * 0.56;           // the head and a bit of the shoulders
    const cx = m.originX * m.frameWidth;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    c.getContext('2d').drawImage(img, cellX + cx - side / 2, cellY + headTop - side * 0.08, side, side, 0, 0, 128, 128);
    this.headshots[character] = c.toDataURL();
    return this.headshots[character];
  }

  // The dock's Staff tab, in three titled groups: the Bar (drink menu,
  // restocking, training), the Bartenders (one card per bar: who works it,
  // or hire one) and the Bouncers (each one, and a card to hire another).
  // People show as headshots with their name. Details are in the hover tips.
  renderStaffCard() {
    const el = this.shopItemsEl;
    const menuKey = this.drinkMenu().map((d) => d.key).join(',');
    const records = this.hireableRecords();
    const type = STAFF_TYPES.bartender;
    const allowed = this.bartenderAllowance();
    const hired = this.bartenderCount();
    const next = this.nextBartenderLevel();
    const bouncers = this.bouncers || 1;
    const bouncerCost = BOUNCERS.hireCost[bouncers] || 0;
    const bouncerAllowed = this.bouncerAllowance();
    // Only rebuild when something on the cards changed (this runs often).
    const key = 'staff:' + menuKey + ':' + records.map((r) => `${r.anchor}:${!!r.staff}:${this.barGroup(r).length}`).join('|')
      + `:${this.cash >= type.hireCost}:${allowed}:${bouncers}:${bouncerAllowed}:${this.cash >= bouncerCost}:${this.drinkStockLeft()}:${this.barTraining || 0}:${this.cash >= this.restockCost()}:${this.levelInfo().level}`;
    if (el.dataset.rendered === key) return;
    el.innerHTML = '';
    el.dataset.rendered = key;
    const limit = `You have ${hired} of the ${allowed} bartender${allowed > 1 ? 's' : ''} your level allows${next ? `; one more at level ${next}` : ''}.`;
    // A titled group of cards.
    const group = (title, note) => {
      const box = document.createElement('div');
      box.className = 'staffGroup';
      const head = document.createElement('div');
      head.className = 'staffGroupTitle';
      head.textContent = title;
      if (note) { const n = document.createElement('span'); n.textContent = note; head.appendChild(n); }
      const row = document.createElement('div');
      row.className = 'staffGroupCards';
      box.append(head, row);
      el.appendChild(box);
      return row;
    };
    // A person's card: their headshot, name on top, what they do underneath.
    const personCard = (title, text, character, name, role) => {
      const card = this.makeCard(title, text, null);
      card.slot.classList.add('staffPerson');
      const shot = this.headshotUrl(character);
      if (shot) card.icon.style.backgroundImage = `url(${shot})`;
      card.icon.classList.add('headshot');
      const label = document.createElement('div');
      label.className = 'staffName';
      label.textContent = name;
      const sub = document.createElement('div');
      sub.className = 'staffRole';
      sub.textContent = role;
      card.button.append(label, sub);
      return card;
    };
    const fireButton = (slot, tip, onFire) => {
      const fire = document.createElement('div');
      fire.className = 'staffFire';
      fire.textContent = '✕';
      fire.dataset.tipName = 'Let go';
      fire.dataset.tipText = tip;
      fire.addEventListener('click', (e) => { e.stopPropagation(); onFire(); this.renderStaffCard(); });
      slot.appendChild(fire);
    };

    // --- The bar: menu, stock and training ---
    const bar = group('Bar');
    if (records.length) {
      const menu = this.drinkMenu();
      const card = this.makeCard('Drink Menu', `On the menu: ${menu.map((d) => d.name).join(', ')}. Click to choose what your bars serve. Fancier drinks pay more and make guests happier, but take longer to mix.`, null);
      card.slot.classList.add('menuSlot');
      card.icon.innerHTML = drinkIconSvg(menu.reduce((a, b) => (b.price > a.price ? b : a)));
      card.cost.textContent = `Menu ×${menu.length}`;
      card.slot.addEventListener('click', () => this.openDrinkMenu());
      bar.appendChild(card.slot);
      const left = this.drinkStockLeft();
      const full = this.maxDrinkStock();
      const restock = this.restockCost();
      const stock = this.makeCard('Restock the bars', left === 0
        ? `Out of drinks! The bartenders can't serve anyone. Restock all ${full} for $${restock}.`
        : `${left} of ${full} drinks in stock. Every drink served uses one${restock > 0 ? `; restock the rest for $${restock}` : ': fully stocked'}.`, null);
      stock.slot.classList.add('menuSlot', 'stockSlot');
      stock.icon.innerHTML = '<div class="emojiIcon">📦</div>';
      stock.cost.textContent = `Stock ${left}/${full}`;
      stock.button.classList.toggle('unaffordable', restock > 0 && this.cash < restock);
      if (left <= full * DRINK_STOCK.lowShare) stock.slot.classList.add('lowStock');
      stock.slot.addEventListener('click', () => { this.restockBar(); this.renderStaffCard(); });
      bar.appendChild(stock.slot);
      const nextT = this.nextTraining();
      const stars = '★'.repeat(this.barTraining || 0) + '☆'.repeat(BAR_TRAINING.costs.length - (this.barTraining || 0));
      const train = this.makeCard(`Bartender training ${stars}`, nextT
        ? `Your bartenders work ${Math.round((this.trainingSpeed() - 1) * 100)}% faster. ${this.levelInfo().level >= nextT.unlockLevel ? `Train them up for $${nextT.cost}: ${Math.round(BAR_TRAINING.speedPer * 100)}% faster again.` : `More training at level ${nextT.unlockLevel}.`}`
        : `Fully trained: your bartenders work ${Math.round((this.trainingSpeed() - 1) * 100)}% faster.`, null);
      train.slot.classList.add('menuSlot', 'trainSlot');
      train.icon.innerHTML = '<div class="emojiIcon">🎓</div>';
      if (!nextT) train.cost.textContent = stars;
      else if (this.levelInfo().level < nextT.unlockLevel) { train.cost.textContent = `🔒 Lv ${nextT.unlockLevel}`; train.button.classList.add('locked'); }
      else {
        train.cost.textContent = `Train $${nextT.cost}`;
        train.button.classList.toggle('unaffordable', this.cash < nextT.cost);
        train.slot.addEventListener('click', () => { this.trainBartenders(); this.renderStaffCard(); });
      }
      bar.appendChild(train.slot);
    } else {
      const { slot, cost } = this.makeCard('No bars yet', `Place a bar first, then hire a bartender to work it. ${limit}`, null);
      slot.classList.add('emptySlot');
      cost.textContent = 'Place a bar first';
      bar.appendChild(slot);
    }

    // --- Bartenders: one card per long bar ---
    if (records.length) {
      const tenders = group('Bartenders', `${hired}/${allowed}`);
      const counts = {};
      const seen = new Set();
      for (const rec of records) {
        if (seen.has(rec)) continue;
        const grp = this.barGroup(rec);
        grp.forEach((r) => seen.add(r));
        const def = PROP_TYPES[rec.type];
        counts[rec.type] = (counts[rec.type] || 0) + 1;
        const working = grp.filter((r) => r.staff).length;
        const barName = grp.length > 1 ? `${def.label} ${counts[rec.type]} (${grp.length} long)` : `${def.label} ${counts[rec.type]}`;
        const full = working >= grp.length;
        const atLimit = hired >= allowed;
        const staffRec = grp.find((r) => r.staff);
        let status = working
          ? `${working} bartender${working > 1 ? 's' : ''} working at the ${barName} · $${type.wage} each every 30 seconds.`
          : `No bartender at the ${barName}: it's not selling drinks.`;
        if (full) status += ' Every spot behind this bar is taken.';
        else if (atLimit) status += ` ${limit}`;
        else status += ` Click to hire ${working ? 'another' : 'one'} for $${type.hireCost}. ${limit}`;
        if (staffRec && !staffRec.staff.name) staffRec.staff.name = this.staffNameFor(`bar:${staffRec.anchor}`);
        const look = staffRec ? staffRec.staff.container.staffCharacter : type.character;
        const name = staffRec ? staffRec.staff.name.split(' ')[0] : 'Hire one';
        const { slot, button, cost } = personCard(`Bartender · ${barName}`, status, look, name, def.label);
        slot.classList.add('staffSlot');
        slot.classList.toggle('staffed', working > 0);
        if (!working) button.classList.add('vacant');
        if (full || atLimit) {
          cost.textContent = working ? (working > 1 ? `${working} working` : 'Working') : (next ? `🔒 Lv ${next}` : 'Max');
          if (!working) button.classList.add('locked');
        } else {
          button.classList.toggle('unaffordable', this.cash < type.hireCost);
          cost.textContent = working ? `+1 $${type.hireCost}` : `Hire $${type.hireCost}`;
          slot.addEventListener('click', () => { this.hireStaff(rec); this.renderStaffCard(); });
        }
        if (working) fireButton(slot, working > 1 ? 'Let one of this bar\'s bartenders go.' : 'Let this bartender go. The bar stops selling drinks.', () => this.fireStaff(rec));
        tenders.appendChild(slot);
      }
    }

    // --- Bouncers ---
    const guards = group('Bouncers', `${bouncers}/${bouncerAllowed}`);
    for (const g of this.guards || []) {
      const house = g.index === 0;
      const text = house
        ? 'Your house bouncer: keeps the door, breaks up arguments and walks troublemakers out. Always on the team, free.'
        : `A bouncer you hired: watches their part of the room and walks troublemakers out · $${BOUNCERS.wage} every 30 seconds.`;
      const { slot, cost } = personCard(`Bouncer · ${g.name}`, text, g.container.staffCharacter, g.name.split(' ')[0], house ? 'At the door' : 'On the floor');
      slot.classList.add('staffSlot', 'staffed', 'bouncerSlot');
      cost.textContent = house ? 'Free' : `$${BOUNCERS.wage}/30s`;
      if (!house) fireButton(slot, 'Let this bouncer go.', () => this.fireBouncer());
      guards.appendChild(slot);
    }
    if (bouncers < BOUNCERS.levels.length) {
      const nextB = BOUNCERS.levels[bouncers];
      const unlocked = bouncers < bouncerAllowed;
      const text = unlocked
        ? `Hire another bouncer for $${bouncerCost}: they watch another part of the room and walk troublemakers out ($${BOUNCERS.wage} every 30 seconds).`
        : `Another bouncer unlocks at level ${nextB}.`;
      const { slot, button, cost } = personCard('Hire a bouncer', text, BOUNCERS.characters[bouncers] ?? 4, 'Hire one', 'Bouncer');
      slot.classList.add('staffSlot', 'bouncerSlot', 'hireBouncer');
      button.classList.add('vacant');
      if (!unlocked) { button.classList.add('locked'); cost.textContent = `🔒 Lv ${nextB}`; }
      else {
        button.classList.toggle('unaffordable', this.cash < bouncerCost);
        cost.textContent = `Hire $${bouncerCost}`;
        slot.addEventListener('click', () => { this.hireBouncer(); this.renderStaffCard(); });
      }
      guards.appendChild(slot);
    }
  }
}
