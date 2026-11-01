// The game's state and rules, with no drawing: tanks, fish, money, XP,
// feeding and cleaning, breeding, buying and selling, saving.
//
// Everything that happens fires an event (`onEvent`), which the scene and
// the HUD listen to: 'tip', 'eggs', 'hatch', 'grown', 'levelUp', 'change'.
import {
  SAVE_KEY, START_CASH, MAX_TANKS, OFFLINE_MAX_MS, LEVEL_XP, MAX_LEVEL, XP,
  SPECIES, TANKS, DECOR, CARE, COLORS,
} from './config.js';
import { shopGenome, breed, fishValue, lookKey, rarityTier } from './genetics.js';

export const G = {};
const listeners = [];
let quiet = false; // catching up time away: no popups
export const onEvent = (fn) => listeners.push(fn);
const fire = (e) => { if (!quiet) listeners.forEach((fn) => fn(e)); };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// --- lookups ---
export const tankDef = (t) => TANKS[t.type];
export const tankById = (id) => G.tanks.find((t) => t.id === id);
export const fishById = (id) => G.fish.find((f) => f.id === id);
export const fishIn = (tankId) => G.fish.filter((f) => f.tankId === tankId);
export const adultsIn = (tankId) => fishIn(tankId).filter((f) => f.growth >= 1);
export const fryIn = (tankId) => fishIn(tankId).filter((f) => f.growth < 1);
// In a breeding tank: the pair (grown-ups that weren't born there), and the
// young (babies, and babies that grew up but haven't moved out yet).
export const parentsIn = (tankId) => fishIn(tankId).filter((f) => f.growth >= 1 && !f.young);
export const youngIn = (tankId) => fishIn(tankId).filter((f) => f.growth < 1 || f.young);
export const currentTank = () => tankById(G.current) || G.tanks[0];
export const waterOf = (t) => tankDef(t).water;

// --- new game / setup ---
function blank() {
  return { cash: START_CASH, xp: 0, level: 1, tanks: [], fish: [], nextId: 1, current: null, discovered: {}, stats: { bred: 0, sold: 0, earned: 0 }, savedAt: Date.now() };
}

function addTank(type) {
  const def = TANKS[type];
  const same = G.tanks.filter((t) => t.type === type).length;
  const t = { id: G.nextId++, type, name: same ? `${def.name} ${same + 1}` : def.name, decor: [], food: 0.9, dirt: 0.05, breedMs: 0, eggs: null, incomeMs: 0 };
  G.tanks.push(t);
  return t;
}

function addFish(g, tankId, growth = 1) {
  const f = { id: G.nextId++, tankId, g, growth };
  G.fish.push(f);
  discover(g);
  return f;
}

// Records a look in the Fish Book; true if it's new.
function discover(g) {
  const k = lookKey(g);
  if (G.discovered[k]) return false;
  G.discovered[k] = { ...g };
  return true;
}

export function newGame() {
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, blank());
  const show = addTank('fresh_small');
  const nursery = addTank('fresh_breed');
  addFish({ ...shopGenome('guppy'), color: 'blue' }, show.id);
  addFish(shopGenome('goldfish'), show.id);
  // A pair already in the breeding tank, so the first babies come quickly.
  addFish({ ...shopGenome('guppy'), color: 'orange', color2: 'black', pattern: 'spots' }, nursery.id);
  addFish({ ...shopGenome('guppy'), color: 'yellow', color2: 'blue', pattern: 'solid' }, nursery.id);
  show.decor.push({ key: 'plant', x: 0.14 }, { key: 'rock', x: 0.72 }, { key: 'plant', x: 0.86 }, { key: 'bubbler', x: 0.42 });
  nursery.decor.push({ key: 'plant', x: 0.2 });
  show.food = 1;
  nursery.food = 1;
  G.current = show.id;
  save();
  fire({ type: 'change', rebuild: true });
}

// --- happiness, rating, tips ---
export function tankHappiness(t) {
  const h = 1 - Math.max(0, 0.35 - t.food) * 2 - Math.max(0, t.dirt - 0.35) * 1.2;
  return clamp(h, 0, 1);
}

export function decorBeauty(t) {
  return t.decor.reduce((s, d) => s + DECOR[d.key].beauty, 0);
}

export function tankScore(t) {
  const fishPts = fishIn(t.id).reduce((s, f) => s + (f.growth >= 1 ? 1 + rarityTier(f.g) * 1.2 : 0.3), 0);
  return fishPts + decorBeauty(t);
}

// 0.5 .. 5 stars, in halves.
export function tankStars(t) {
  const def = tankDef(t);
  const max = def.cap * 3 + def.decor * 3;
  const raw = (1 + (4 * tankScore(t)) / max) * (0.4 + 0.6 * tankHappiness(t));
  return clamp(Math.round(raw * 2) / 2, 0.5, 5);
}

// What visitors tip a display tank every CARE.incomeEveryMs.
export function tankTip(t) {
  if (tankDef(t).kind !== 'display') return 0;
  return Math.round(tankScore(t) * 0.5 * tankHappiness(t));
}

// --- room ---
export function roomFor(t, growth = 1) {
  const def = tankDef(t);
  if (def.kind === 'breeding') return growth >= 1 ? parentsIn(t.id).length < def.cap : youngIn(t.id).length < def.fry;
  return fishIn(t.id).length < def.cap;
}

function noRoomMsg(t, growth) {
  const def = tankDef(t);
  if (def.kind === 'breeding') return growth >= 1 ? 'A breeding tank holds two grown-up fish.' : 'The nursery is full.';
  return `${t.name} is full (${def.cap} fish).`;
}

// --- the clock ---
export function tick(dt) {
  const sec = dt / 1000;
  for (const t of G.tanks) {
    const n = fishIn(t.id).length;
    if (n) t.food = clamp(t.food - sec * (CARE.foodDrainBase + CARE.foodDrainPerFish * n), 0, 1);
    t.dirt = clamp(t.dirt + sec * (CARE.dirtBase + CARE.dirtPerFish * n), 0, 1);
    const happy = tankHappiness(t);
    const def = tankDef(t);
    if (def.kind === 'display') {
      t.incomeMs += dt;
      while (t.incomeMs >= CARE.incomeEveryMs) {
        t.incomeMs -= CARE.incomeEveryMs;
        const amount = tankTip(t);
        if (amount > 0) {
          G.cash += amount;
          G.stats.earned += amount;
          fire({ type: 'tip', tankId: t.id, amount });
        }
      }
    } else {
      tickBreeding(t, dt, happy);
    }
  }
  for (const f of G.fish) {
    if (f.growth >= 1) continue;
    const t = tankById(f.tankId);
    const sp = SPECIES[f.g.species];
    f.growth = Math.min(1, f.growth + (dt / sp.growMs) * (0.3 + 0.7 * tankHappiness(t)));
    if (f.growth >= 1) {
      addXp(XP.grownUp);
      fire({ type: 'grown', fishId: f.id, tankId: f.tankId });
    }
  }
}

function breedingPair(t) {
  const adults = parentsIn(t.id);
  return adults.length === 2 && adults[0].g.species === adults[1].g.species ? adults : null;
}

function tickBreeding(t, dt, happy) {
  const def = tankDef(t);
  if (t.eggs) {
    t.eggs.ms -= dt;
    if (t.eggs.ms <= 0) hatch(t);
    return;
  }
  // Grown-up babies take over as parents when there's a free place.
  let parents = parentsIn(t.id).length;
  for (const f of youngIn(t.id)) {
    if (parents >= def.cap) break;
    if (f.growth >= 1) { f.young = false; parents++; }
  }
  const pair = breedingPair(t);
  if (!pair || happy < CARE.breedMinHappy || youngIn(t.id).length >= def.fry) return;
  const sp = SPECIES[pair[0].g.species];
  t.breedMs += dt * happy;
  if (t.breedMs >= sp.breedMs) {
    t.breedMs = 0;
    const room = def.fry - youngIn(t.id).length;
    t.eggs = { ms: CARE.eggHatchMs, count: Math.min(room, randInt(...sp.clutch)), a: { ...pair[0].g }, b: { ...pair[1].g }, happy };
    fire({ type: 'eggs', tankId: t.id });
  }
}

function hatch(t) {
  const { a, b, count, happy } = t.eggs;
  t.eggs = null;
  const babies = [], newLooks = [];
  for (let i = 0; i < count && roomFor(t, 0); i++) {
    const g = breed(a, b, happy);
    const isNew = !G.discovered[lookKey(g)];
    const f = addFish(g, t.id, 0);
    f.young = true;
    babies.push(f);
    G.stats.bred++;
    addXp(XP.hatch + (isNew ? XP.newLook : 0));
    if (isNew) newLooks.push(f);
  }
  fire({ type: 'hatch', tankId: t.id, babies, newLooks });
}

// What a breeding tank is up to, for the HUD.
export function breedStatus(t) {
  const def = tankDef(t);
  if (def.kind !== 'breeding') return null;
  if (t.eggs) return { text: 'Eggs! They hatch soon.', progress: 1 - t.eggs.ms / CARE.eggHatchMs, eggs: true };
  const adults = parentsIn(t.id);
  const grown = youngIn(t.id).filter((f) => f.growth >= 1).length;
  const st = breedStatusText(t, def, adults);
  if (grown) st.grown = grown;
  return st;
}


function breedStatusText(t, def, adults) {
  if (adults.length < 2) return { text: 'Move two grown-up fish of the same kind in here to breed them.', progress: 0 };
  if (!breedingPair(t)) return { text: "These two are different kinds, so they can't have babies.", progress: 0 };
  if (youngIn(t.id).length >= def.fry) return { text: 'The nursery is full. Move or sell some babies.', progress: 0 };
  if (tankHappiness(t) < CARE.breedMinHappy) return { text: 'Too hungry or dirty to breed. Feed and clean them!', progress: t.breedMs / SPECIES[adults[0].g.species].breedMs };
  return { text: 'Getting ready to lay eggs…', progress: t.breedMs / SPECIES[adults[0].g.species].breedMs };
}

// --- XP and levels ---
export function addXp(n) {
  G.xp += Math.max(0, Math.round(n));
  while (G.level < MAX_LEVEL && G.xp >= LEVEL_XP[G.level]) {
    G.level++;
    fire({ type: 'levelUp', level: G.level });
  }
}

export function xpProgress() {
  if (G.level >= MAX_LEVEL) return { into: 1, need: 1, max: true };
  const lo = LEVEL_XP[G.level - 1], hi = LEVEL_XP[G.level];
  return { into: G.xp - lo, need: hi - lo, max: false };
}

export function unlocksAt(level) {
  const pick = (table) => Object.entries(table).filter(([, v]) => v.level === level).map(([k]) => k);
  return { species: pick(SPECIES), tanks: pick(TANKS), decor: pick(DECOR) };
}

// --- actions (each returns { ok, msg, ... }) ---
const fail = (msg) => ({ ok: false, msg });

function spend(price) {
  G.cash -= price;
  addXp(price * XP.perDollarSpent);
}

export function buyFish(species, preferTankId) {
  const sp = SPECIES[species];
  if (G.level < sp.level) return fail(`${sp.name} unlocks at level ${sp.level}.`);
  if (G.cash < sp.price) return fail('Not enough money.');
  const fits = (t) => waterOf(t) === sp.water && roomFor(t, 1);
  const prefer = tankById(preferTankId);
  const tank = (prefer && fits(prefer) && prefer) ||
    G.tanks.find((t) => fits(t) && tankDef(t).kind === 'display') || G.tanks.find(fits);
  if (!tank) {
    const any = G.tanks.some((t) => waterOf(t) === sp.water);
    return fail(any ? `No room: every ${sp.water === 'salt' ? 'saltwater' : 'freshwater'} tank is full.` : `A ${sp.name} needs a saltwater tank. Buy one first!`);
  }
  spend(sp.price);
  const fish = addFish(shopGenome(species), tank.id);
  save();
  fire({ type: 'change' });
  return { ok: true, fish, tank, msg: `New ${sp.name} in ${tank.name}!` };
}

export function buyTank(type) {
  const def = TANKS[type];
  if (G.level < def.level) return fail(`Unlocks at level ${def.level}.`);
  if (G.tanks.length >= MAX_TANKS) return fail(`You can have up to ${MAX_TANKS} tanks.`);
  if (G.cash < def.price) return fail('Not enough money.');
  spend(def.price);
  const t = addTank(type);
  t.food = 1;
  G.current = t.id;
  save();
  fire({ type: 'change', rebuild: true });
  return { ok: true, tank: t, msg: `${t.name} set up!` };
}

export function canPlaceDecor(tankId, key) {
  const t = tankById(tankId), d = DECOR[key];
  if (!t) return fail('No tank.');
  if (G.level < d.level) return fail(`Unlocks at level ${d.level}.`);
  if (d.water !== 'any' && d.water !== waterOf(t)) return fail(`${d.name} only goes in ${d.water === 'salt' ? 'saltwater' : 'freshwater'} tanks.`);
  if (t.decor.length >= tankDef(t).decor) return fail(`This tank has room for ${tankDef(t).decor} decorations.`);
  if (G.cash < d.price) return fail('Not enough money.');
  return { ok: true };
}

export function placeDecor(tankId, key, x) {
  const can = canPlaceDecor(tankId, key);
  if (!can.ok) return can;
  const t = tankById(tankId);
  spend(DECOR[key].price);
  t.decor.push({ key, x: clamp(x, 0.05, 0.95) });
  save();
  fire({ type: 'change', rebuild: true });
  return { ok: true, msg: `${DECOR[key].name} placed.` };
}

export function sellDecor(tankId, index) {
  const t = tankById(tankId);
  const d = t && t.decor[index];
  if (!d) return fail('Nothing there.');
  const refund = Math.floor(DECOR[d.key].price / 2);
  t.decor.splice(index, 1);
  G.cash += refund;
  save();
  fire({ type: 'change', rebuild: true });
  return { ok: true, refund, msg: `Sold for $${refund}.` };
}

export function sellFish(id) {
  const f = fishById(id);
  if (!f) return fail('That fish is gone.');
  const price = fishValue(f.g, f.growth);
  G.fish.splice(G.fish.indexOf(f), 1);
  G.cash += price;
  G.stats.sold++;
  G.stats.earned += price;
  addXp(price * XP.perDollarSold);
  save();
  fire({ type: 'change' });
  return { ok: true, price, msg: `Sold for $${price}!` };
}

export function moveFish(id, tankId) {
  const f = fishById(id), t = tankById(tankId);
  if (!f || !t) return fail('Not possible.');
  if (f.tankId === tankId) return fail('Already in that tank.');
  const sp = SPECIES[f.g.species];
  if (waterOf(t) !== sp.water) return fail(`A ${sp.name} can't live in ${waterOf(t) === 'salt' ? 'saltwater' : 'freshwater'}!`);
  if (!roomFor(t, f.growth)) return fail(noRoomMsg(t, f.growth));
  const from = tankById(f.tankId);
  f.tankId = tankId;
  f.young = tankDef(t).kind === 'breeding' && f.growth < 1;
  if (from && tankDef(from).kind === 'breeding' && !breedingPair(from)) from.breedMs = 0;
  save();
  fire({ type: 'change' });
  return { ok: true, msg: `Moved to ${t.name}.` };
}

export function feed(tankId) {
  const t = tankById(tankId);
  if (!t) return fail('No tank.');
  if (t.food > 0.95) return fail("They're full!");
  if (t.food < 0.6) addXp(XP.feed);
  t.food = 1;
  save();
  fire({ type: 'fed', tankId });
  return { ok: true };
}

export function clean(tankId) {
  const t = tankById(tankId);
  if (!t) return fail('No tank.');
  if (t.dirt < 0.08) return fail('Already sparkling clean!');
  if (t.dirt > 0.4) addXp(XP.clean);
  t.dirt = 0;
  save();
  fire({ type: 'cleaned', tankId });
  return { ok: true };
}

export function setCurrent(tankId) {
  if (!tankById(tankId)) return;
  G.current = tankId;
  fire({ type: 'change', rebuild: true });
}

// --- saving ---
export function save() {
  try {
    G.savedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(G));
  } catch (e) { /* storage full or blocked: play on without saving */ }
}

// Loads the save and catches up on time away. Returns what happened while
// away (or null when there's no save).
export function load() {
  let data;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { data = null; }
  if (!data || !Array.isArray(data.tanks) || !data.tanks.length) return null;
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, blank(), data);
  // Drop anything an older or newer version knows that this one doesn't.
  G.tanks = G.tanks.filter((t) => TANKS[t.type]);
  for (const t of G.tanks) t.decor = (t.decor || []).filter((d) => DECOR[d.key]);
  G.fish = G.fish.filter((f) => SPECIES[f.g.species] && COLORS[f.g.color] && COLORS[f.g.color2] && tankById(f.tankId));
  if (!G.tanks.length) return null;
  const away = Math.min(OFFLINE_MAX_MS, Math.max(0, Date.now() - (data.savedAt || Date.now())));
  const before = { cash: G.cash, bred: G.stats.bred, level: G.level };
  quiet = true;
  for (let ms = 0; ms < away; ms += 1000) tick(1000);
  quiet = false;
  return { away, earned: G.cash - before.cash, babies: G.stats.bred - before.bred, levels: G.level - before.level };
}
