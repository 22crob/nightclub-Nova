// The village and the five places out in the wild, each hiding a Moonshard,
// plus treasure chests tucked around the map. Storybook style: rounded
// shapes, soft shading, outlines.
import * as THREE from 'three';
import { VILLAGE, PLACES, LAKE } from './config.js';
import { heightAt, placeGround } from './terrain.js';
import { addBox, addCircle } from './colliders.js';
import { mulberry32 } from './noise.js';
import { toon, part, rbox } from './materials.js';

const OL = 0.05;

// A soft round glow, for sprites around things that shine.
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
export function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  s.scale.set(size, size, 1);
  return s;
}

// A soft puff of chimney smoke.
let puffTex = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(28, 26, 4, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.7, 'rgba(235,235,245,0.7)');
  grd.addColorStop(1, 'rgba(220,220,235,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  puffTex = new THREE.CanvasTexture(c);
  puffTex.colorSpace = THREE.SRGBColorSpace;
  return puffTex;
}

const box = (w, h, d, color, x, y, z, { r = 0.08, outline = OL } = {}) => part(rbox(w, h, d, r), color, { x, y, z, outline });

function prismGeo(w, h, d) {
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  return geo;
}

function cottage(x, z, rotY, colors, rand) {
  const g = new THREE.Group();
  const y = heightAt(x, z);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const W = 6, D = 5, wallH = 2.9, base = 0.6;
  g.add(box(W + 0.5, base, D + 0.5, '#a7a3a6', 0, base / 2, 0, { r: 0.18 }));          // stone base
  g.add(box(W, wallH, D, colors.wall, 0, base + wallH / 2, 0, { r: 0.1 }));            // walls
  const beam = '#6e4630';
  for (const sx of [-W / 2, W / 2]) for (const sz of [-D / 2, D / 2]) g.add(box(0.32, wallH + 0.1, 0.32, beam, sx, base + wallH / 2, sz, { r: 0.06, outline: 0.03 }));
  for (const sz of [-D / 2 - 0.02, D / 2 + 0.02]) g.add(box(W, 0.22, 0.14, beam, 0, base + wallH - 0.15, sz, { r: 0.05, outline: 0.03 }));
  // Roof: two thick slabs meeting at a ridge, overhanging all round.
  const pitch = 0.68, span = D / 2 + 0.7, rise = span * Math.tan(pitch), top = base + wallH;
  const slabLen = span / Math.cos(pitch) + 0.1;
  for (const s of [1, -1]) {
    const slab = box(W + 1.2, 0.36, slabLen, colors.roof, 0, top + rise / 2 + 0.12, s * span / 2, { r: 0.14 });
    slab.rotation.x = s * pitch;
    g.add(slab);
  }
  g.add(box(W + 1.3, 0.3, 0.42, colors.ridge || colors.roof, 0, top + rise + 0.22, 0, { r: 0.14 }));
  const gable = part(prismGeo(D, rise, W - 0.05), colors.wall, { y: top, outline: OL });
  gable.rotation.y = Math.PI / 2;
  g.add(gable);
  // Door with a rounded top.
  const fz = D / 2 + 0.03;
  g.add(box(1.15, 1.7, 0.16, '#7a4b2c', 0, base + 0.85, fz, { r: 0.05, outline: 0.03 }));
  g.add(part(new THREE.CylinderGeometry(0.575, 0.575, 0.16, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), '#7a4b2c', { y: base + 1.7, z: fz, outline: 0.03 }));
  g.add(part(new THREE.SphereGeometry(0.07, 8, 6), '#f2c95a', { x: 0.36, y: base + 0.95, z: fz + 0.1, outline: 0 }));
  g.add(box(1.6, 0.18, 0.7, '#a7a3a6', 0, base * 0.3, fz + 0.45, { r: 0.06 }));        // step
  // Windows with shutters and flower boxes.
  const glass = toon('#ffe3a3', { emissive: new THREE.Color('#ffb04a'), emissiveIntensity: 0 });
  for (const sx of [-1.85, 1.85]) {
    g.add(box(1.0, 0.95, 0.12, beam, sx, base + 1.65, fz, { r: 0.04, outline: 0.03 }));
    g.add(part(rbox(0.8, 0.75, 0.1, 0.03), glass, { x: sx, y: base + 1.65, z: fz + 0.04, outline: 0 }));
    g.add(box(0.06, 0.75, 0.04, beam, sx, base + 1.65, fz + 0.1, { r: 0.02, outline: 0 }));
    for (const s of [-1, 1]) g.add(box(0.38, 0.95, 0.08, colors.shutter, sx + s * 0.72, base + 1.65, fz + 0.03, { r: 0.04, outline: 0.03 }));
    g.add(box(1.0, 0.24, 0.3, '#8a5a3c', sx, base + 1.08, fz + 0.18, { r: 0.05, outline: 0.03 }));
    for (let k = 0; k < 4; k++) {
      const hue = [0.95, 0.12, 0.6, 0.0][(k + Math.floor(sx)) & 3];
      const c = new THREE.Color().setHSL(hue, 0.75, 0.65);
      g.add(part(new THREE.IcosahedronGeometry(0.13, 1), toon(c), { x: sx - 0.36 + k * 0.24, y: base + 1.28, z: fz + 0.2, outline: 0.02 }));
    }
  }
  // Chimney with smoke.
  const cx = W / 2 - 1.2, cz = -span * 0.45;
  g.add(box(0.8, 2.2, 0.8, '#b0a7a3', cx, top + rise * 0.55 + 0.6, cz, { r: 0.1 }));
  g.add(box(1.0, 0.25, 1.0, '#8e8682', cx, top + rise * 0.55 + 1.75, cz, { r: 0.08 }));
  const puffs = [];
  for (let k = 0; k < 5; k++) {
    const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, opacity: 0.8 }));
    p.position.set(cx, top + rise * 0.55 + 2, cz);
    p.userData.phase = k / 5 + rand() * 0.05;
    p.userData.base = p.position.clone();
    g.add(p);
    puffs.push(p);
  }
  addBox(x, z, W + 0.5, D + 0.5, -rotY);
  return { group: g, glass, puffs };
}

function lanternPost(x, z) {
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  g.add(part(new THREE.CylinderGeometry(0.09, 0.13, 2.8, 8), '#4a3328', { y: 1.4, outline: 0.03 }));
  g.add(part(new THREE.TorusGeometry(0.35, 0.05, 6, 12, Math.PI / 2), '#4a3328', { x: 0.35, y: 2.75, outline: 0.02 }));
  const lampMat = toon('#ffe3a3', { emissive: new THREE.Color('#ffb347'), emissiveIntensity: 0 });
  g.add(part(rbox(0.34, 0.42, 0.34, 0.06), lampMat, { x: 0.7, y: 2.5, outline: 0.03 }));
  g.add(part(new THREE.ConeGeometry(0.3, 0.22, 4).rotateY(Math.PI / 4), '#3a2a22', { x: 0.7, y: 2.82, outline: 0.03 }));
  const glow = glowSprite('#ffc266', 3, 0);
  glow.position.set(0.7, 2.5, 0);
  g.add(glow);
  addCircle(x, z, 0.25);
  return { group: g, lampMat, glow };
}

function well() {
  const g = new THREE.Group();
  g.position.set(VILLAGE.x, heightAt(VILLAGE.x, VILLAGE.z), VILLAGE.z);
  const ring = part(new THREE.TorusGeometry(1.25, 0.32, 10, 24).rotateX(Math.PI / 2), '#b3aeb0', { y: 0.75, outline: OL });
  ring.scale.y = 1.6;
  g.add(ring);
  g.add(part(new THREE.CylinderGeometry(1.4, 1.5, 0.6, 24), '#a29c9e', { y: 0.3, outline: OL }));
  g.add(part(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 20), toon('#3f9fd4', { emissive: new THREE.Color('#123a55') }), { y: 0.95, outline: 0 }));
  for (const s of [-1, 1]) g.add(box(0.2, 2.6, 0.2, '#6e4630', s * 1.25, 1.5, 0, { r: 0.05, outline: 0.03 }));
  for (const s of [1, -1]) {
    const slab = box(3.4, 0.16, 1.5, '#c5523e', 0, 2.95, s * 0.6, { r: 0.06 });
    slab.rotation.x = s * 0.6;
    g.add(slab);
  }
  g.add(part(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 8).rotateZ(Math.PI / 2), '#6e4630', { y: 2.1, outline: 0.02 }));
  g.add(part(new THREE.CylinderGeometry(0.18, 0.14, 0.3, 10), '#8a5a3c', { y: 1.6, outline: 0.02 }));
  addCircle(VILLAGE.x, VILLAGE.z, 1.8);
  return g;
}

function crate(x, z, s = 1) {
  const c = box(s, s, s, '#c08a4e', x, heightAt(x, z) + s / 2, z, { r: 0.06 });
  c.rotation.y = x * 0.7;
  addCircle(x, z, s * 0.6);
  return c;
}

function barrel(x, z) {
  const b = part(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 14), '#9b6236', { x, y: heightAt(x, z) + 0.55, z, outline: OL });
  for (const y of [-0.35, 0.35]) b.add(part(new THREE.TorusGeometry(0.46, 0.035, 4, 16).rotateX(Math.PI / 2), '#5a4a44', { y, outline: 0 }));
  addCircle(x, z, 0.5);
  return b;
}

function shard(id, x, z, y) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const crystal = part(new THREE.OctahedronGeometry(0.55, 0), toon('#d8fbff', {
    emissive: new THREE.Color('#5fd8ff'), emissiveIntensity: 1.6,
  }), { y: 1.4, outline: 0.03, shadow: false });
  crystal.scale.y = 1.6;
  g.add(crystal);
  const glow = glowSprite('#8fe6ff', 3.6, 0.9);
  glow.position.y = 1.4;
  g.add(glow);
  // A tall beam of light, so the shard can be seen from far away.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.7, 90, 12, 1, true).translate(0, 45, 0),
    new THREE.MeshBasicMaterial({ color: '#8fe6ff', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
  );
  g.add(beam);
  return { id, group: g, crystal, beam, pos: new THREE.Vector3(x, y, z), taken: false };
}

function chest(id, x, z, rotY = 0) {
  const g = new THREE.Group();
  const y = heightAt(x, z);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  g.add(box(1.1, 0.6, 0.72, '#a0642f', 0, 0.3, 0, { r: 0.06, outline: 0.04 }));
  for (const sx of [-0.4, 0.4]) g.add(box(0.12, 0.62, 0.76, '#f2c95a', sx, 0.31, 0, { r: 0.03, outline: 0 }));
  const lid = new THREE.Group();
  lid.position.set(0, 0.6, -0.36);
  const top = part(new THREE.CylinderGeometry(0.36, 0.36, 1.1, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), '#b5743a', { z: 0.36, outline: 0.04 });
  lid.add(top);
  lid.add(box(0.18, 0.22, 0.08, '#f2c95a', 0, 0.04, 0.74, { r: 0.03, outline: 0.02 }));
  g.add(lid);
  const glow = glowSprite('#ffd75e', 1.8, 0);
  glow.position.y = 0.9;
  g.add(glow);
  addCircle(x, z, 0.65);
  return { id, group: g, lid, glow, pos: new THREE.Vector3(x, y, z), opened: false, openT: 0 };
}

export function buildPlaces() {
  const group = new THREE.Group();
  group.name = 'places';
  const rand = mulberry32(99);
  const windows = [];
  const lanterns = [];
  const glowing = [];   // materials that light up at night
  const puffs = [];

  // --- The village: cottages around a well, between the paths. ---
  const houseColors = [
    { wall: '#fbeed3', roof: '#d9573f', shutter: '#4f8fc4' }, { wall: '#f6e6c4', roof: '#4f7fc7', shutter: '#d9573f' },
    { wall: '#fff3dc', roof: '#5fae4f', shutter: '#e6a33a' }, { wall: '#f2e1c8', roof: '#a35fc0', shutter: '#5fae4f' },
    { wall: '#fbebcc', roof: '#e8892e', shutter: '#7a5fc0' },
  ];
  [78, 142, 196, 269, 3].forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const x = Math.cos(a) * 21, z = Math.sin(a) * 21;
    const c = cottage(x, z, Math.atan2(-Math.cos(a), -Math.sin(a)), houseColors[i], rand);
    group.add(c.group);
    windows.push(c.glass);
    puffs.push(...c.puffs);
  });
  group.add(well());
  for (const deg of [20, 60, 110, 160, 230, 300]) {
    const a = (deg * Math.PI) / 180;
    const l = lanternPost(Math.cos(a) * 11, Math.sin(a) * 11);
    group.add(l.group);
    lanterns.push(l);
  }
  group.add(crate(7, -6), crate(7.8, -5.2, 0.7), barrel(6.4, -7.4), barrel(-8, 6.5), crate(-9, 5.4, 0.8));

  // --- The Whispering Stones: a ring of mossy standing stones on a hill. ---
  const shards = [];
  {
    const p = PLACES.stones, y = placeGround('stones');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const x = p.x + Math.cos(a) * 8, z = p.z + Math.sin(a) * 8;
      const h = 3 + rand() * 1.8;
      const s = box(1.4, h, 0.9, '#a8a3b0', x, y + h / 2 - 0.2, z, { r: 0.3 });
      s.rotation.set((rand() - 0.5) * 0.12, -a, (rand() - 0.5) * 0.12);
      s.add(part(rbox(1.5, 0.35, 1.0, 0.15), '#7fbf5a', { y: h / 2 - 0.1, outline: 0.03 }));
      const rune = part(rbox(0.5, 0.7, 0.1, 0.05), toon('#7fe0ff', { emissive: new THREE.Color('#3fb8ff'), emissiveIntensity: 0 }), { y: 0.2, z: 0.46, outline: 0, shadow: false });
      glowing.push(rune.material);
      s.add(rune);
      group.add(s);
      addCircle(x, z, 0.85);
    }
    group.add(box(2.2, 0.8, 2.2, '#9c97a3', p.x, y + 0.35, p.z, { r: 0.2 }));
    addCircle(p.x, p.z, 1.3);
    shards.push(shard('stones', p.x, p.z, y + 0.8));
  }

  // --- The Old Watchtower. ---
  {
    const p = PLACES.tower, y = placeGround('tower');
    group.add(part(new THREE.CylinderGeometry(2.6, 3.2, 13, 20), '#b4adab', { x: p.x, y: y + 6.5, z: p.z, outline: 0.08 }));
    for (const hy of [3, 7, 11]) group.add(part(new THREE.TorusGeometry(2.95 - hy * 0.035, 0.18, 6, 24).rotateX(Math.PI / 2), '#8f8886', { x: p.x, y: y + hy, z: p.z, outline: 0 }));
    group.add(part(new THREE.CylinderGeometry(3.7, 3.5, 0.6, 20), '#7a5238', { x: p.x, y: y + 13.2, z: p.z, outline: 0.06 }));
    group.add(part(new THREE.ConeGeometry(4.1, 3.8, 20), '#3f74c4', { x: p.x, y: y + 15.3, z: p.z, outline: 0.08 }));
    const flag = part(new THREE.PlaneGeometry(1.2, 0.7), toon('#e04a4a', { side: THREE.DoubleSide }), { x: p.x + 0.6, y: y + 18, z: p.z, outline: 0 });
    group.add(part(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), '#4a3328', { x: p.x, y: y + 17.6, z: p.z, outline: 0 }), flag);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      group.add(part(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 6), '#7a5238', { x: p.x + Math.cos(a) * 3.4, y: y + 13.9, z: p.z + Math.sin(a) * 3.4, outline: 0.02 }));
    }
    group.add(box(1.5, 2.4, 0.4, '#6e4630', p.x - 0.4, y + 1.2, p.z + 3, { r: 0.1 }));
    addCircle(p.x, p.z, 3.3);
    for (let i = 0; i < 6; i++) {
      const x = p.x + (rand() - 0.5) * 12, z = p.z + 5 + rand() * 6;
      const b = box(0.8, 0.5, 0.6, '#b4adab', x, heightAt(x, z) + 0.2, z, { r: 0.15 });
      b.rotation.set(rand(), rand() * 3, rand());
      group.add(b);
    }
    shards.push(shard('tower', p.x - 0.5, p.z + 5.5, heightAt(p.x - 0.5, p.z + 5.5)));
  }

  // --- Lake Isle: a little island with a red gate. ---
  {
    const p = PLACES.island, y = heightAt(p.x, p.z);
    for (const s of [-1, 1]) group.add(part(new THREE.CylinderGeometry(0.17, 0.2, 2.6, 10), '#d8433a', { x: p.x + s * 1.2, y: y + 1.3, z: p.z - 2, outline: 0.04 }));
    const top = box(3.8, 0.3, 0.4, '#d8433a', p.x, y + 2.65, p.z - 2, { r: 0.1 });
    group.add(top, box(3.0, 0.2, 0.3, '#d8433a', p.x, y + 2.2, p.z - 2, { r: 0.06 }));
    group.add(box(4.1, 0.16, 0.5, '#3a2a2a', p.x, y + 2.85, p.z - 2, { r: 0.06 }));
    addCircle(p.x - 1.2, p.z - 2, 0.25); addCircle(p.x + 1.2, p.z - 2, 0.25);
    shards.push(shard('island', p.x, p.z + 0.5, heightAt(p.x, p.z + 0.5)));
  }

  // --- Glowcap Grove: giant spotted mushrooms that glow at night. ---
  {
    const p = PLACES.grove;
    const caps = ['#e2463c', '#b35ae0', '#3fb3e0', '#f0962c'];
    const spotMat = toon('#fffaf0');
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + rand() * 0.3;
      const r = 6 + rand() * 7;
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const y = heightAt(x, z), s = 0.7 + rand() * 1.1;
      const capColor = caps[i % caps.length];
      const capMat = toon(capColor, { emissive: new THREE.Color(capColor), emissiveIntensity: 0 });
      glowing.push(capMat);
      const stem = part(new THREE.CylinderGeometry(0.32 * s, 0.5 * s, 3 * s, 14), '#f4ecdc', { x, y: y + 1.5 * s, z, outline: 0.05 });
      stem.rotation.z = (rand() - 0.5) * 0.15;
      group.add(stem);
      const R = 1.6 * s;
      const cap = part(new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), capMat, { x, y: y + 2.85 * s, z, outline: 0.06 });
      cap.scale.y = 0.72;
      group.add(cap);
      group.add(part(new THREE.CylinderGeometry(R * 0.98, R * 0.98, 0.12, 24), '#f4dcc8', { x, y: y + 2.86 * s, z, outline: 0 }));
      for (let k = 0; k < 6; k++) {
        // Spots sit on the cap's surface.
        const th = rand() * Math.PI * 2, ph = 0.25 + rand() * 0.9;
        const dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 10, 6), spotMat);
        spot.scale.set(1, 0.35, 1);
        spot.position.set(dir.x * R, dir.y * R, dir.z * R);
        spot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        cap.add(spot);
      }
      addCircle(x, z, 0.55 * s);
    }
    shards.push(shard('grove', p.x, p.z, heightAt(p.x, p.z)));
  }

  // --- The Fallen Keep: broken walls and columns. ---
  {
    const p = PLACES.ruins, y = placeGround('ruins');
    const stone = '#c2bab0';
    const walls = [
      [0, -8, 16, 1, 3.4], [-8, 0, 1, 16, 2.4], [8, -3, 1, 10, 4], [-4, 8, 8, 1, 1.6], [6, 8, 4, 1, 2.8],
    ];
    for (const [dx, dz, w, d, h] of walls) {
      const wall = box(w, h, d, stone, p.x + dx, y + h / 2 - 0.2, p.z + dz, { r: 0.2 });
      wall.add(part(rbox(w + 0.1, 0.3, d + 0.1, 0.12), '#7fbf5a', { y: h / 2 - 0.05, outline: 0.03 }));
      group.add(wall);
      addBox(p.x + dx, p.z + dz, w, d);
    }
    for (const [dx, dz, h] of [[-4, -4, 5], [4, -4, 2.2], [-4, 4, 3.6], [4, 4, 5.5]]) {
      group.add(part(new THREE.CylinderGeometry(0.55, 0.65, h, 14), '#d3ccc2', { x: p.x + dx, y: y + h / 2, z: p.z + dz, outline: 0.05 }));
      group.add(part(rbox(1.5, 0.35, 1.5, 0.1), '#d3ccc2', { x: p.x + dx, y: y + h, z: p.z + dz, outline: 0.04 }));
      addCircle(p.x + dx, p.z + dz, 0.7);
    }
    for (let i = 0; i < 10; i++) {
      const x = p.x + (rand() - 0.5) * 20, z = p.z + (rand() - 0.5) * 20;
      const b = box(0.6 + rand(), 0.4 + rand() * 0.4, 0.6 + rand() * 0.6, stone, x, heightAt(x, z) + 0.2, z, { r: 0.15 });
      b.rotation.set(rand() * 0.4, rand() * 3, rand() * 0.4);
      group.add(b);
    }
    shards.push(shard('ruins', p.x, p.z, y));
  }
  for (const s of shards) group.add(s.group);

  // --- Treasure chests. ---
  const chestSpots = [
    ['c_tower', PLACES.tower.x + 6, PLACES.tower.z - 4, 2.4],
    ['c_stones', PLACES.stones.x - 12, PLACES.stones.z - 6, 0.6],
    ['c_grove', PLACES.grove.x + 9, PLACES.grove.z + 9, 3.6],
    ['c_ruins', PLACES.ruins.x - 5, PLACES.ruins.z - 5, 0.8],
    ['c_shore', LAKE.x - 34, LAKE.z + 22, 1.6],
    ['c_hill', 118, 104, 4],
    ['c_woods', -120, -130, 1],
  ];
  const chests = chestSpots.map(([id, x, z, r]) => chest(id, x, z, r));
  for (const c of chests) group.add(c.group);

  return {
    group, shards, chests, lanterns, windows, glowing,
    update(t, night) {
      for (const s of shards) {
        if (s.taken) continue;
        s.crystal.rotation.y = t * 1.5;
        s.crystal.position.y = 1.4 + Math.sin(t * 2 + s.pos.x) * 0.18;
        s.beam.material.opacity = 0.16 + night * 0.18 + Math.sin(t * 3) * 0.03;
      }
      for (const l of lanterns) {
        l.lampMat.emissiveIntensity = night * 2.6;
        l.glow.material.opacity = night * 0.9;
      }
      for (const w of windows) w.emissiveIntensity = night * 1.6;
      for (const m of glowing) m.emissiveIntensity = night * 1.9;
      for (const p of puffs) {
        const k = (t * 0.12 + p.userData.phase) % 1;
        p.position.set(p.userData.base.x + k * 1.2, p.userData.base.y + k * 3.5, p.userData.base.z - k * 0.6);
        const s = 0.6 + k * 1.6;
        p.scale.set(s, s, 1);
        p.material.opacity = Math.sin(k * Math.PI) * 0.75;
      }
      for (const c of chests) {
        if (c.opened && c.openT < 1) c.openT = Math.min(1, c.openT + 0.04);
        c.lid.rotation.x = -c.openT * 1.9;
        c.glow.material.opacity = c.opened ? (c.openT < 1 ? Math.max(0, 0.8 - c.openT * 0.8) : 0) : 0.25 + Math.sin(t * 3 + c.pos.x) * 0.12;
      }
    },
  };
}
