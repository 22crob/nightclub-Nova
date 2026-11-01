// The ground: a low-poly heightfield with hills, a lake, mountains around the
// edge, flat spots for the village and each place, and dirt paths between.
import * as THREE from 'three';
import { WORLD, VILLAGE, LAKE, PLACES, PATHS } from './config.js';
import { makeNoise2D, smoothstep, lerp, distToSegment } from './noise.js';
import { toon } from './materials.js';

const noise = makeNoise2D(WORLD.seed);
const detail = makeNoise2D(WORLD.seed + 1);

// Hills to raise under some places, and how flat a disc each place gets.
const SHAPE = {
  stones: { hill: 7, flat: 12 },
  tower: { hill: 9, flat: 7 },
  island: { flat: 0 },
  grove: { hill: 0, flat: 16 },
  ruins: { hill: 3, flat: 16 },
};

function baseHeight(x, z) {
  let h = 0, amp = 1, f = 1 / 110;
  for (let o = 0; o < 5; o++) { h += noise(x * f, z * f) * amp; amp *= 0.5; f *= 2.03; }
  h = h * 7 + 5;
  const ridge = 1 - Math.abs(noise(x / 170 + 40, z / 170 - 20));
  h += Math.pow(ridge, 4) * 16;
  // Mountains ring the playable land.
  const r = Math.hypot(x, z);
  h += smoothstep(WORLD.playRadius * 0.85, WORLD.playRadius * 1.25, r) * 46;
  h += smoothstep(WORLD.playRadius * 0.9, WORLD.playRadius * 1.3, r) * noise(x / 30, z / 30) * 10;
  return h;
}

// Each place gets a flat spot at the height the land has there (plus a hill).
const placeHeight = {};
for (const [k, p] of Object.entries(PLACES)) {
  placeHeight[k] = Math.max(baseHeight(p.x, p.z), 3) + (SHAPE[k].hill || 0);
}

function shapedHeight(x, z) {
  let h = baseHeight(x, z);
  // Places: a hill, then flattened on top.
  for (const [k, p] of Object.entries(PLACES)) {
    const s = SHAPE[k];
    if (k === 'island') continue;
    const d = Math.hypot(x - p.x, z - p.z);
    if (s.hill) h += (1 - smoothstep(0, s.flat + 26, d)) * s.hill * 0.6;
    h = lerp(placeHeight[k], h, smoothstep(s.flat, s.flat + 18, d));
  }
  // The lake, with an island in the middle.
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  const wob = detail(x / 14, z / 14) * 5;
  h = lerp(-3.5, h, smoothstep(LAKE.r * 0.55, LAKE.r + 10, dl + wob));
  h += (1 - smoothstep(3, 15, dl)) * 6.4;
  // The village is flat.
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  h = lerp(VILLAGE.h, h, smoothstep(VILLAGE.r, VILLAGE.r + 22, dv));
  // Paths are smoothed a little.
  const pd = pathDistance(x, z);
  if (pd < 6) h = lerp(h, h * 0.92 + 0.3, 1 - pd / 6);
  // Small bumps everywhere.
  h += detail(x / 6, z / 6) * 0.35;
  return h;
}

export function pathDistance(x, z) {
  let best = Infinity;
  for (const path of PATHS) {
    for (let i = 0; i < path.length - 1; i++) {
      const [a, b] = [path[i], path[i + 1]];
      best = Math.min(best, distToSegment(x, z, a[0], a[1], b[0], b[1]));
    }
  }
  return best;
}

// Heights at every grid corner, so the ground the player stands on matches
// the triangles that are drawn exactly.
const N = WORLD.size / WORLD.cell;        // cells per side
const H = new Float32Array((N + 1) * (N + 1));
const half = WORLD.size / 2;
for (let j = 0; j <= N; j++) {
  for (let i = 0; i <= N; i++) H[j * (N + 1) + i] = shapedHeight(i * WORLD.cell - half, j * WORLD.cell - half);
}
const hAt = (i, j) => H[Math.max(0, Math.min(N, j)) * (N + 1) + Math.max(0, Math.min(N, i))];

// Ground height at any point (each cell is two triangles split corner to corner).
export function heightAt(x, z) {
  const gx = (x + half) / WORLD.cell, gz = (z + half) / WORLD.cell;
  const i = Math.floor(gx), j = Math.floor(gz);
  const fx = gx - i, fz = gz - j;
  const h00 = hAt(i, j), h10 = hAt(i + 1, j), h01 = hAt(i, j + 1), h11 = hAt(i + 1, j + 1);
  if (fx >= fz) return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
  return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
}

export function slopeAt(x, z) {
  const e = 1;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

export const placeGround = (k) => heightAt(PLACES[k].x, PLACES[k].z);

// Colour of the ground at a spot, used by the mesh, the grass and the minimap.
const C = {
  sand: new THREE.Color('#f0d89c'), grass: new THREE.Color('#78c257'), lush: new THREE.Color('#4fa64a'),
  meadow: new THREE.Color('#b5d965'), rock: new THREE.Color('#a49c96'), darkRock: new THREE.Color('#7d7787'),
  snow: new THREE.Color('#f4f7ff'), path: new THREE.Color('#d9ae72'), lakeBed: new THREE.Color('#b6a77a'),
};
export function groundColor(x, z, h, slope, out = new THREE.Color()) {
  const w = WORLD.waterLevel;
  if (h < w - 0.4) return out.copy(C.lakeBed);
  const v = detail(x / 40, z / 40), v2 = detail(x / 9 + 50, z / 9);
  out.copy(C.grass).lerp(C.lush, smoothstep(-0.2, 0.6, v)).lerp(C.meadow, smoothstep(0.2, 0.8, -v) * 0.8);
  out.offsetHSL(0, 0, v2 * 0.025);
  out.lerp(C.sand, 1 - smoothstep(w + 0.3, w + 1.1, h));
  const pd = pathDistance(x, z) + v2 * 0.6;
  out.lerp(C.path, 1 - smoothstep(1.6, 2.6, pd));
  const rockiness = Math.max(smoothstep(0.7, 1.05, slope), smoothstep(22, 30, h));
  if (rockiness > 0) out.lerp(slope > 1.4 ? C.darkRock : C.rock, rockiness);
  if (h > 38) out.lerp(C.snow, smoothstep(38, 44, h + v * 3));
  return out;
}

// How much grass grows at a spot, 0..1.
export function grassAt(x, z, h, slope) {
  if (h < WORLD.waterLevel + 0.6 || h > 30) return 0;
  let d = 1 - smoothstep(0.55, 0.85, slope);
  d *= smoothstep(1.8, 3.2, pathDistance(x, z));
  d *= 1 - (1 - smoothstep(4, 9, Math.hypot(x - VILLAGE.x, z - VILLAGE.z))) * 0.9;
  d *= smoothstep(WORLD.waterLevel + 0.6, WORLD.waterLevel + 1.6, h);
  d *= 0.75 + 0.25 * detail(x / 25, z / 25);
  return Math.max(0, Math.min(1, d));
}

export function buildTerrain() {
  const V = N + 1;
  const pos = new Float32Array(V * V * 3);
  const col = new Float32Array(V * V * 3);
  const c = new THREE.Color();
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < V; i++) {
      const k = j * V + i, x = i * WORLD.cell - half, z = j * WORLD.cell - half, h = H[k];
      pos.set([x, h, z], k * 3);
      groundColor(x, z, h, slopeAt(x, z), c);
      col.set([c.r, c.g, c.b], k * 3);
    }
  }
  // Same triangles as heightAt(): (00, 11, 10) and (00, 01, 11) in each cell.
  const idx = new Uint32Array(N * N * 6);
  let o = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * V + i, b = a + 1, d = a + V, e = d + 1;
      idx.set([a, e, b, a, d, e], o);
      o += 6;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, toon('#ffffff', { vertexColors: true }));
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// The heights and ground colours as textures, for the grass and water shaders.
let texCache = null;
export function terrainTextures() {
  if (texCache) return texCache;
  const V = N + 1;
  const hData = new Float32Array(V * V);
  hData.set(H);
  const heightTex = new THREE.DataTexture(hData, V, V, THREE.RedFormat, THREE.FloatType);
  heightTex.minFilter = heightTex.magFilter = THREE.NearestFilter;
  heightTex.needsUpdate = true;
  const gData = new Uint8Array(V * V * 4);
  const c = new THREE.Color();
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < V; i++) {
      const x = i * WORLD.cell - half, z = j * WORLD.cell - half, h = H[j * V + i], sl = slopeAt(x, z);
      groundColor(x, z, h, sl, c);
      gData.set([c.r * 255, c.g * 255, c.b * 255, grassAt(x, z, h, sl) * 255], (j * V + i) * 4);
    }
  }
  const groundTex = new THREE.DataTexture(gData, V, V, THREE.RGBAFormat);
  groundTex.minFilter = groundTex.magFilter = THREE.LinearFilter;
  groundTex.needsUpdate = true;
  texCache = { heightTex, groundTex, n: N, half, cell: WORLD.cell };
  return texCache;
}

// GLSL for reading the ground height in a shader, matching heightAt().
export const HEIGHT_GLSL = `
  uniform sampler2D uHeight; uniform float uN; uniform float uHalf; uniform float uCell;
  float hFetch(ivec2 c) { c = clamp(c, ivec2(0), ivec2(int(uN))); return texelFetch(uHeight, c, 0).r; }
  float groundHeight(vec2 p) {
    vec2 g = (p + uHalf) / uCell; ivec2 i = ivec2(floor(g)); vec2 f = g - floor(g);
    float h00 = hFetch(i), h10 = hFetch(i + ivec2(1, 0)), h01 = hFetch(i + ivec2(0, 1)), h11 = hFetch(i + ivec2(1, 1));
    if (f.x >= f.y) return h00 + (h10 - h00) * f.x + (h11 - h10) * f.y;
    return h00 + (h11 - h01) * f.x + (h01 - h00) * f.y;
  }`;
export function heightUniforms() {
  const t = terrainTextures();
  return { uHeight: { value: t.heightTex }, uN: { value: t.n }, uHalf: { value: t.half }, uCell: { value: t.cell } };
}
