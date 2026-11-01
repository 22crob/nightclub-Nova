// The ground: a low-poly heightfield with hills, a lake, mountains around the
// edge, flat spots for the village and each place, and dirt paths between.
import * as THREE from 'three';
import { WORLD, VILLAGE, LAKE, PLACES, PATHS } from './config.js';
import { makeNoise2D, smoothstep, lerp, distToSegment, mulberry32 } from './noise.js';

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

// Colour of the ground at a spot, used by the mesh and the minimap.
const C = {
  sand: new THREE.Color('#dcc890'), grass: new THREE.Color('#79b34e'), lush: new THREE.Color('#5a9a3e'),
  meadow: new THREE.Color('#9cc35a'), rock: new THREE.Color('#8b867c'), darkRock: new THREE.Color('#6d6a66'),
  snow: new THREE.Color('#f1f4f8'), path: new THREE.Color('#bf9f6c'), lakeBed: new THREE.Color('#9c8f68'),
};
export function groundColor(x, z, h, slope, out = new THREE.Color()) {
  const w = WORLD.waterLevel;
  if (h < w - 0.4) return out.copy(C.lakeBed);
  if (h < w + 0.7) return out.copy(C.sand);
  const v = detail(x / 40, z / 40);
  out.copy(C.grass).lerp(C.lush, smoothstep(-0.2, 0.6, v)).lerp(C.meadow, smoothstep(0.3, 0.9, -v) * 0.7);
  if (pathDistance(x, z) < 2.2 + detail(x / 5, z / 5) * 0.8) out.copy(C.path);
  const rockiness = Math.max(smoothstep(0.75, 1.1, slope), smoothstep(20, 28, h));
  if (rockiness > 0) out.lerp(slope > 1.4 ? C.darkRock : C.rock, rockiness);
  if (h > 38) out.lerp(C.snow, smoothstep(38, 44, h + v * 3));
  return out;
}

export function buildTerrain() {
  const tris = N * N * 2;
  const pos = new Float32Array(tris * 9);
  const col = new Float32Array(tris * 9);
  const rand = mulberry32(WORLD.seed + 9);
  const c = new THREE.Color();
  let p = 0;
  const put = (i, j, color) => {
    pos[p] = i * WORLD.cell - half; pos[p + 1] = hAt(i, j); pos[p + 2] = j * WORLD.cell - half;
    col[p] = color.r; col[p + 1] = color.g; col[p + 2] = color.b;
    p += 3;
  };
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      // Two triangles: (00, 11, 10) and (00, 01, 11), wound to face up.
      for (const tri of [[[0, 0], [1, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]]]) {
        let cx = 0, cz = 0, ch = 0;
        for (const [a, b] of tri) { cx += (i + a); cz += (j + b); ch += hAt(i + a, j + b); }
        cx = cx / 3 * WORLD.cell - half; cz = cz / 3 * WORLD.cell - half; ch /= 3;
        groundColor(cx, cz, ch, slopeAt(cx, cz), c);
        c.offsetHSL(0, 0, (rand() - 0.5) * 0.035);
        for (const [a, b] of tri) put(i + a, j + b, c);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

export function buildWater() {
  const geo = new THREE.PlaneGeometry(WORLD.size * 1.5, WORLD.size * 1.5, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: '#3f8fc9', transparent: true, opacity: 0.78, shininess: 90, specular: '#cfe9ff',
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WORLD.waterLevel;
  mesh.receiveShadow = true;
  mesh.name = 'water';
  return mesh;
}
