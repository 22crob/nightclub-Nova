// Trees, rocks, grass and flowers scattered over the land, drawn as
// instanced meshes (one draw call per kind) so there can be thousands.
import * as THREE from 'three';
import { WORLD, VILLAGE, PLACES, LAKE } from './config.js';
import { heightAt, slopeAt, pathDistance } from './terrain.js';
import { makeNoise2D, mulberry32 } from './noise.js';
import { addCircle } from './colliders.js';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

// Where nothing should grow (village, places, paths, water, cliffs).
function clearSpot(x, z, margin = 0) {
  if (Math.hypot(x, z) > WORLD.playRadius * 1.15) return false;
  if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 4 + margin) return false;
  for (const p of Object.values(PLACES)) if (Math.hypot(x - p.x, z - p.z) < 18 + margin) return false;
  const h = heightAt(x, z);
  if (h < WORLD.waterLevel + 0.9) return false;
  if (slopeAt(x, z) > 0.9) return false;
  if (pathDistance(x, z) < 3.5 + margin) return false;
  return true;
}

function instanced(geo, mat, count, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.castShadow = shadow;
  m.receiveShadow = true;
  m.count = 0;
  return m;
}

const dummy = new THREE.Object3D();
function pushInstance(mesh, x, y, z, s, rotY, color, sy = s) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, rotY, 0);
  dummy.scale.set(s, sy, s);
  dummy.updateMatrix();
  mesh.setMatrixAt(mesh.count, dummy.matrix);
  if (color) mesh.setColorAt(mesh.count, color);
  mesh.count++;
}

export function buildNature() {
  const group = new THREE.Group();
  group.name = 'nature';
  const rand = mulberry32(WORLD.seed + 3);
  const forest = makeNoise2D(WORLD.seed + 4);
  const color = new THREE.Color();

  // Pine: trunk + three stacked cones. Round tree: trunk + a lumpy ball.
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 1.6, 6).translate(0, 0.8, 0);
  const pineGeo = (() => {
    const parts = [[1.6, 2.2, 1.6], [1.25, 1.9, 2.6], [0.85, 1.6, 3.5]];
    const geos = parts.map(([r, h, y]) => new THREE.ConeGeometry(r, h, 7).translate(0, y, 0));
    return mergeGeos(geos);
  })();
  const roundGeo = new THREE.IcosahedronGeometry(1.5, 0).translate(0, 2.8, 0);
  const rockGeo = new THREE.DodecahedronGeometry(0.8, 0);
  const grassGeo = (() => {
    const blades = [];
    for (let i = 0; i < 3; i++) blades.push(new THREE.ConeGeometry(0.07, 0.55, 3, 1, true).translate(Math.cos(i * 2.1) * 0.1, 0.27, Math.sin(i * 2.1) * 0.1));
    return mergeGeos(blades);
  })();
  const flowerGeo = new THREE.IcosahedronGeometry(0.12, 0).translate(0, 0.32, 0);

  const MAXT = 2600;
  const trunks = instanced(trunkGeo, lambert('#7a5232'), MAXT);
  const pines = instanced(pineGeo, lambert('#ffffff'), MAXT);
  const rounds = instanced(roundGeo, lambert('#ffffff'), MAXT);
  const rocks = instanced(rockGeo, lambert('#ffffff'), 500);
  const grass = instanced(grassGeo, lambert('#ffffff', { side: THREE.DoubleSide }), 11000, false);
  const flowers = instanced(flowerGeo, lambert('#ffffff'), 1600, false);

  // Trees: thick where the forest noise is high, a few scattered elsewhere.
  for (let tries = 0; tries < 26000 && trunks.count < MAXT; tries++) {
    const x = (rand() - 0.5) * WORLD.size, z = (rand() - 0.5) * WORLD.size;
    const f = forest(x / 70, z / 70);
    if (rand() > (f > 0.15 ? 0.55 : 0.04)) continue;
    if (!clearSpot(x, z)) continue;
    const h = heightAt(x, z);
    if (h > 34) continue;
    const s = 0.8 + rand() * 0.7;
    const isPine = h > 14 ? rand() < 0.85 : rand() < 0.5;
    pushInstance(trunks, x, h - 0.1, z, s, rand() * 6.28);
    if (isPine) {
      color.setHSL(0.33 + rand() * 0.05, 0.45, 0.24 + rand() * 0.08);
      pushInstance(pines, x, h - 0.1, z, s, rand() * 6.28, color);
    } else {
      color.setHSL(0.24 + rand() * 0.1, 0.5, 0.35 + rand() * 0.1);
      pushInstance(rounds, x, h - 0.1, z, s, rand() * 6.28, color);
    }
    addCircle(x, z, 0.35 * s + 0.1);
  }

  for (let tries = 0; tries < 4000 && rocks.count < 500; tries++) {
    const x = (rand() - 0.5) * WORLD.size, z = (rand() - 0.5) * WORLD.size;
    if (Math.hypot(x, z) > WORLD.playRadius * 1.1) continue;
    if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 4) continue;
    const h = heightAt(x, z);
    if (h < WORLD.waterLevel - 0.5 || pathDistance(x, z) < 3) continue;
    const s = 0.5 + Math.pow(rand(), 2) * 2.2;
    color.setHSL(0.08, 0.05 + rand() * 0.06, 0.45 + rand() * 0.15);
    dummy.position.set(x, h + s * 0.2, z);
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    dummy.scale.set(s, s * (0.6 + rand() * 0.4), s);
    dummy.updateMatrix();
    rocks.setMatrixAt(rocks.count, dummy.matrix);
    rocks.setColorAt(rocks.count, color);
    rocks.count++;
    if (s > 0.9) addCircle(x, z, s * 0.7);
  }

  // Grass tufts and flowers, thicker near the village where you start.
  for (let tries = 0; tries < 60000 && grass.count < 11000; tries++) {
    const near = rand() < 0.35;
    const x = near ? (rand() - 0.5) * 180 : (rand() - 0.5) * WORLD.size * 0.85;
    const z = near ? (rand() - 0.5) * 180 : (rand() - 0.5) * WORLD.size * 0.85;
    const h = heightAt(x, z);
    if (h < WORLD.waterLevel + 0.8 || h > 24 || slopeAt(x, z) > 0.7) continue;
    if (pathDistance(x, z) < 2.6) continue;
    if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 9) continue;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r * 0.6) continue;
    const s = 0.7 + rand() * 0.8;
    color.setHSL(0.24 + rand() * 0.07, 0.55, 0.32 + rand() * 0.12);
    pushInstance(grass, x, h - 0.05, z, s, rand() * 6.28, color);
    if (rand() < 0.11 && flowers.count < 1600) {
      const hue = [0.0, 0.13, 0.6, 0.8, 0.95][Math.floor(rand() * 5)];
      color.setHSL(hue, 0.75, 0.65);
      pushInstance(flowers, x + 0.2, h - 0.05, z + 0.1, 0.8 + rand() * 0.6, 0, color);
    }
  }

  for (const m of [trunks, pines, rounds, rocks, grass, flowers]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    group.add(m);
  }
  group.userData.counts = { trees: trunks.count, rocks: rocks.count, grass: grass.count, flowers: flowers.count };
  return group;
}

// Joins several geometries into one (all must be non-indexed or indexed alike).
export function mergeGeos(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of parts) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}
