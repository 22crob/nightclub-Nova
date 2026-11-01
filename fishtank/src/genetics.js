// What a fish looks like (its genome), how babies inherit it, and how rare
// and valuable that makes a fish.
//
// A genome: { species, color, color2, pattern, fins, glow, size, seed }.
// `seed` places spots and marbling, so each fish's markings are its own.
import { SPECIES, COLORS, PATTERNS, FINS, FIN_NAMES, RARITY } from './config.js';

const pick = (list, rand) => list[Math.floor(rand() * list.length) % list.length];
const round2 = (n) => Math.round(n * 100) / 100;
const newSeed = (rand) => Math.floor(rand() * 2 ** 31);

// Rarer traits come up less often when something mutates.
const TIER_WEIGHT = [6, 3, 1.4, 0.5];
function weightedPick(table, rand) {
  const keys = Object.keys(table);
  const total = keys.reduce((s, k) => s + TIER_WEIGHT[table[k].tier], 0);
  let r = rand() * total;
  for (const k of keys) {
    r -= TIER_WEIGHT[table[k].tier];
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}

// A fish from the shop: its kind's usual look, now and then a little unusual.
export function shopGenome(species, rand = Math.random) {
  const sp = SPECIES[species];
  const g = {
    species,
    color: pick(sp.colors, rand),
    color2: pick(sp.colors2, rand),
    pattern: pick(sp.patterns, rand),
    fins: sp.fins,
    glow: false,
    size: round2(0.9 + rand() * 0.2),
    seed: newSeed(rand),
  };
  if (g.color === g.color2) g.color2 = sp.colors2.find((c) => c !== g.color) || 'white';
  if (rand() < 0.06) g.color = weightedPick(COLORS, rand);
  return g;
}

// A baby: each trait comes from mum or dad, with a chance of something new
// (higher when the parents are happy).
export function breed(a, b, happiness = 1, rand = Math.random) {
  const mut = 0.06 + 0.06 * happiness;
  const from = (k) => (rand() < 0.5 ? a[k] : b[k]);
  const g = { species: a.species };
  g.color = rand() < mut ? weightedPick(COLORS, rand) : from('color');
  g.color2 = rand() < mut ? weightedPick(COLORS, rand) : from('color2');
  g.pattern = rand() < mut ? weightedPick(PATTERNS, rand) : from('pattern');
  let fin = FINS.indexOf(from('fins'));
  if (rand() < mut) fin += rand() < 0.5 ? -1 : 1;
  g.fins = FINS[Math.max(0, Math.min(FINS.length - 1, fin))];
  const glowChance = a.glow && b.glow ? 0.6 : a.glow || b.glow ? 0.25 : 0.01;
  g.glow = rand() < glowChance;
  let size = (a.size + b.size) / 2 + (rand() - 0.5) * 0.15;
  if (rand() < 0.03) size += 0.15;
  g.size = round2(Math.max(0.75, Math.min(1.45, size)));
  g.seed = newSeed(rand);
  if (g.color === g.color2) g.color2 = g.color === 'white' ? 'black' : 'white';
  return g;
}

// How unusual this fish is for its kind: a trait it normally has scores 0.
export function rarityScore(g) {
  const sp = SPECIES[g.species];
  let s = 0;
  if (!sp.colors.includes(g.color)) s += COLORS[g.color].tier + 1;
  if (!sp.colors2.includes(g.color2) && g.pattern !== 'solid') s += Math.floor(COLORS[g.color2].tier / 2);
  if (!sp.patterns.includes(g.pattern)) s += PATTERNS[g.pattern].tier + 1;
  s += Math.max(0, FINS.indexOf(g.fins) - FINS.indexOf(sp.fins)) * 1;
  if (g.glow) s += 3;
  if (g.size >= 1.25) s += 1;
  return s;
}

export function rarityTier(g) {
  const s = rarityScore(g);
  return s <= 0 ? 0 : s <= 2 ? 1 : s <= 4 ? 2 : s <= 6 ? 3 : 4;
}

export const rarityOf = (g) => RARITY[rarityTier(g)];

// What it sells for. Babies sell for less than grown-ups.
export function fishValue(g, growth = 1) {
  const sp = SPECIES[g.species];
  const v = sp.base * rarityOf(g).mult * (0.8 + 0.2 * g.size);
  return Math.max(1, Math.round(v * (growth >= 1 ? 1 : 0.4)));
}

// "Glowing Giant Purple Spotted Veiltail Guppy".
export function fishName(g) {
  const sp = SPECIES[g.species];
  const parts = [];
  if (g.glow) parts.push('Glowing');
  if (g.size >= 1.25) parts.push('Giant');
  const pat = PATTERNS[g.pattern];
  if (g.pattern === 'solid') parts.push(COLORS[g.color].name);
  else parts.push(`${COLORS[g.color].name} & ${COLORS[g.color2].name}`, pat.adj);
  if (g.fins !== sp.fins) parts.push(g.fins === 'veil' ? 'Veiltail' : g.fins === 'long' ? 'Longfin' : 'Shortfin');
  parts.push(sp.name);
  return parts.join(' ');
}

export function traitList(g) {
  return [
    ['Colour', g.pattern === 'solid' ? COLORS[g.color].name : `${COLORS[g.color].name} & ${COLORS[g.color2].name}`],
    ['Pattern', PATTERNS[g.pattern].name],
    ['Fins', FIN_NAMES[g.fins]],
    ['Size', g.size >= 1.25 ? 'Giant' : g.size >= 1.05 ? 'Big' : g.size <= 0.85 ? 'Small' : 'Normal'],
    ...(g.glow ? [['Special', 'Glows!']] : []),
  ];
}

// Fish Book entries: one per look (markings' exact placement doesn't count).
export function lookKey(g) {
  const c2 = g.pattern === 'solid' ? '-' : g.color2;
  return [g.species, g.color, c2, g.pattern, g.fins, g.glow ? 'glow' : ''].join('|');
}

// A seeded random number generator, for markings that stay the same.
export function seededRand(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
