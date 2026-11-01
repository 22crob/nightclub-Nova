// Trees, bushes, rocks and flowers scattered over the land. Each kind is an
// instanced mesh per 64 m patch, so patches out of view are skipped.
import * as THREE from 'three';
import { WORLD, VILLAGE, PLACES, LAKE } from './config.js';
import { heightAt, slopeAt, pathDistance } from './terrain.js';
import { makeNoise2D, mulberry32 } from './noise.js';
import { addCircle } from './colliders.js';
import { toon, windy } from './materials.js';

const CHUNK = 64;

// Where trees shouldn't grow (village, places, paths, water, cliffs).
function clearSpot(x, z, margin = 0) {
  if (Math.hypot(x, z) > WORLD.playRadius * 1.15) return false;
  if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 4 + margin) return false;
  for (const p of Object.values(PLACES)) if (Math.hypot(x - p.x, z - p.z) < 18 + margin) return false;
  if (heightAt(x, z) < WORLD.waterLevel + 0.9) return false;
  if (slopeAt(x, z) > 0.9) return false;
  if (pathDistance(x, z) < 3.5 + margin) return false;
  return true;
}

// Bends a geometry's normals to point out from a centre, so a lumpy shape is
// lit like one soft ball (the classic "fluffy tree" trick).
function puffNormals(geo, cx, cy, cz, amount = 1) {
  const p = geo.attributes.position, n = geo.attributes.normal, v = new THREE.Vector3(), o = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) - cx, p.getY(i) - cy, p.getZ(i) - cz).normalize();
    o.set(n.getX(i), n.getY(i), n.getZ(i)).lerp(v, amount).normalize();
    n.setXYZ(i, o.x, o.y, o.z);
  }
  return geo;
}

function lumpy(geo, seed, amt) {
  const nz = makeNoise2D(seed), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const k = 1 + nz(v.x * 1.7 + v.y, v.z * 1.7 - v.y) * amt;
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  return geo;
}

export function mergeGeos(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o);
    nor.set(g.attributes.normal.array, o);
    o += g.attributes.position.array.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}

function canopyGeo() {
  const blobs = [[0, 3.3, 0, 1.55], [0.95, 2.85, 0.3, 1.1], [-0.85, 2.95, -0.35, 1.15], [0.2, 2.75, -0.95, 1.05], [-0.3, 4.15, 0.25, 1.05], [0.15, 2.7, 0.95, 1.0]];
  const geos = blobs.map(([x, y, z, r], i) => lumpy(new THREE.IcosahedronGeometry(r, 2), 10 + i, 0.08).translate(x, y, z));
  return puffNormals(mergeGeos(geos), 0, 3.2, 0, 0.75);
}

function pineGeo() {
  const tiers = [[1.75, 2.1, 1.7], [1.4, 1.9, 2.75], [1.0, 1.7, 3.7], [0.6, 1.3, 4.5]];
  const geos = tiers.map(([r, h, y], i) => {
    const g = new THREE.ConeGeometry(r, h, 11, 2);
    // Droop the skirt a little and make it wavy.
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const vy = p.getY(k);
      if (vy < -h / 2 + 0.01) {
        const a = Math.atan2(p.getZ(k), p.getX(k));
        p.setY(k, vy - 0.18 + Math.sin(a * 5 + i) * 0.1);
      }
    }
    return g.translate(0, y, 0);
  });
  return puffNormals(mergeGeos(geos), 0, 3.4, 0, 0.45);
}

function trunkGeo() {
  const g = new THREE.CylinderGeometry(0.16, 0.3, 2.4, 7, 2).translate(0, 1.2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.05) { p.setX(i, p.getX(i) * 1.35); p.setZ(i, p.getZ(i) * 1.35); }
  g.computeVertexNormals();
  return g;
}

function bushGeo() {
  const geos = [[0, 0.5, 0, 0.7], [0.55, 0.38, 0.15, 0.5], [-0.5, 0.4, -0.1, 0.52]].map(([x, y, z, r], i) =>
    lumpy(new THREE.IcosahedronGeometry(r, 1), 30 + i, 0.1).translate(x, y, z));
  return puffNormals(mergeGeos(geos), 0, 0.3, 0, 0.8);
}

function rockGeo() {
  const g = lumpy(new THREE.IcosahedronGeometry(0.8, 2), 77, 0.22);
  g.computeVertexNormals();
  // Moss on top: green where the rock faces up.
  const n = g.attributes.normal, col = new Float32Array(n.count * 3);
  const rock = new THREE.Color('#ffffff'), moss = new THREE.Color('#8fcf6a'), c = new THREE.Color();
  for (let i = 0; i < n.count; i++) {
    c.copy(rock).lerp(moss, THREE.MathUtils.smoothstep(n.getY(i), 0.55, 0.8));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function flowerGeo() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(new THREE.SphereGeometry(0.1, 8, 5).scale(1, 0.45, 1).translate(Math.cos(a) * 0.11, 0.38, Math.sin(a) * 0.11));
  }
  parts.push(new THREE.SphereGeometry(0.07, 8, 5).translate(0, 0.41, 0));
  const g = mergeGeos(parts);
  return puffNormals(g, 0, 0.2, 0, 0.6);
}

// Collects instances by patch, then makes one InstancedMesh per patch.
class Scatter {
  constructor(geo, mat, { shadow = true } = {}) { this.geo = geo; this.mat = mat; this.shadow = shadow; this.chunks = new Map(); this.count = 0; }
  add(matrix, color) {
    const e = new THREE.Vector3().setFromMatrixPosition(matrix);
    const key = `${Math.floor(e.x / CHUNK)},${Math.floor(e.z / CHUNK)}`;
    if (!this.chunks.has(key)) this.chunks.set(key, []);
    this.chunks.get(key).push([matrix.clone(), color ? color.clone() : null]);
    this.count++;
  }
  build(group) {
    for (const list of this.chunks.values()) {
      const m = new THREE.InstancedMesh(this.geo, this.mat, list.length);
      list.forEach(([mat, col], i) => { m.setMatrixAt(i, mat); if (col) m.setColorAt(i, col); });
      m.castShadow = this.shadow;
      m.receiveShadow = true;
      m.computeBoundingSphere();
      group.add(m);
    }
  }
}

const dummy = new THREE.Object3D();
function matrixAt(x, y, z, s, rotY, sy = s, rx = 0, rz = 0) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(rx, rotY, rz);
  dummy.scale.set(s, sy, s);
  dummy.updateMatrix();
  return dummy.matrix;
}

export function buildNature() {
  const group = new THREE.Group();
  group.name = 'nature';
  const rand = mulberry32(WORLD.seed + 3);
  const forest = makeNoise2D(WORLD.seed + 4);
  const color = new THREE.Color();

  const trunks = new Scatter(trunkGeo(), toon('#8a5a3c'));
  const canopies = new Scatter(canopyGeo(), windy(toon('#ffffff'), 0.035, 2.2));
  const pines = new Scatter(pineGeo(), windy(toon('#ffffff'), 0.03, 1.5));
  const bushes = new Scatter(bushGeo(), windy(toon('#ffffff'), 0.06, 0.4));
  const rocks = new Scatter(rockGeo(), toon('#ffffff', { vertexColors: true }));
  const flowers = new Scatter(flowerGeo(), windy(toon('#ffffff'), 0.2, 0.1), { shadow: false });

  // Trees: thick where the forest noise is high, a few scattered elsewhere.
  for (let tries = 0; tries < 26000 && trunks.count < 2000; tries++) {
    const x = (rand() - 0.5) * WORLD.size, z = (rand() - 0.5) * WORLD.size;
    const f = forest(x / 70, z / 70);
    if (rand() > (f > 0.15 ? 0.5 : 0.035)) continue;
    if (!clearSpot(x, z)) continue;
    const h = heightAt(x, z);
    if (h > 34) continue;
    const s = 0.85 + rand() * 0.6;
    const isPine = h > 14 ? rand() < 0.8 : rand() < 0.35;
    const rot = rand() * 6.28;
    trunks.add(matrixAt(x, h - 0.15, z, s, rot, s * (isPine ? 0.8 : 1)));
    if (isPine) {
      color.setHSL(0.42 + rand() * 0.06, 0.45, 0.3 + rand() * 0.08);
      pines.add(matrixAt(x, h - 0.15, z, s, rot), color);
    } else {
      const r = rand();
      if (r < 0.08) color.setHSL(0.93 + rand() * 0.04, 0.6, 0.78);          // blossom
      else if (r < 0.15) color.setHSL(0.07 + rand() * 0.04, 0.75, 0.55);    // autumn
      else color.setHSL(0.22 + rand() * 0.1, 0.55, 0.42 + rand() * 0.1);
      canopies.add(matrixAt(x, h - 0.15, z, s, rot), color);
    }
    addCircle(x, z, 0.32 * s + 0.1);
  }

  // Bushes along the forest edges and here and there.
  for (let tries = 0; tries < 9000 && bushes.count < 900; tries++) {
    const x = (rand() - 0.5) * WORLD.size, z = (rand() - 0.5) * WORLD.size;
    if (!clearSpot(x, z, -2)) continue;
    if (rand() > 0.2 + Math.max(0, forest(x / 70, z / 70)) * 0.8) continue;
    const r = rand();
    if (r < 0.15) color.setHSL(0.95, 0.5, 0.55); else color.setHSL(0.27 + rand() * 0.08, 0.5, 0.38 + rand() * 0.1);
    bushes.add(matrixAt(x, heightAt(x, z) - 0.1, z, 0.8 + rand() * 0.7, rand() * 6.28), color);
  }

  for (let tries = 0; tries < 4000 && rocks.count < 420; tries++) {
    const x = (rand() - 0.5) * WORLD.size, z = (rand() - 0.5) * WORLD.size;
    if (Math.hypot(x, z) > WORLD.playRadius * 1.1) continue;
    if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 4) continue;
    const h = heightAt(x, z);
    if (h < WORLD.waterLevel - 0.5 || pathDistance(x, z) < 3) continue;
    const s = 0.5 + Math.pow(rand(), 2) * 2.2;
    color.setHSL(0.65 + rand() * 0.1, 0.06 + rand() * 0.06, 0.55 + rand() * 0.12);
    rocks.add(matrixAt(x, h + s * 0.15, z, s, rand() * 6.28, s * (0.55 + rand() * 0.35), (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4), color);
    if (s > 0.9) addCircle(x, z, s * 0.7);
  }

  // Flowers, in little patches.
  const hues = [0.0, 0.12, 0.58, 0.78, 0.92, 0.15];
  for (let tries = 0; tries < 9000 && flowers.count < 2600; tries++) {
    const cx = (rand() - 0.5) * WORLD.size * 0.8, cz = (rand() - 0.5) * WORLD.size * 0.8;
    const h0 = heightAt(cx, cz);
    if (h0 < WORLD.waterLevel + 1 || h0 > 22 || slopeAt(cx, cz) > 0.6 || pathDistance(cx, cz) < 3) continue;
    if (Math.hypot(cx - LAKE.x, cz - LAKE.z) < LAKE.r * 0.7 || Math.hypot(cx, cz) < 9) continue;
    const hue = hues[Math.floor(rand() * hues.length)];
    for (let k = 0; k < 7; k++) {
      const x = cx + (rand() - 0.5) * 3, z = cz + (rand() - 0.5) * 3;
      color.setHSL(hue + (rand() - 0.5) * 0.03, 0.8, 0.68);
      flowers.add(matrixAt(x, heightAt(x, z) - 0.03, z, 0.9 + rand() * 0.6, rand() * 6.28), color);
    }
  }

  for (const s of [trunks, canopies, pines, bushes, rocks, flowers]) s.build(group);
  group.userData.counts = { trees: trunks.count, bushes: bushes.count, rocks: rocks.count, flowers: flowers.count };
  return group;
}
