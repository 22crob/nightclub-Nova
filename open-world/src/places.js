// The village and the five places out in the wild, each hiding a Moonshard,
// plus treasure chests tucked around the map.
import * as THREE from 'three';
import { VILLAGE, PLACES, LAKE } from './config.js';
import { heightAt, placeGround } from './terrain.js';
import { addBox, addCircle } from './colliders.js';
import { mulberry32 } from './noise.js';

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (w, h, d, color, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color) : color, x, y, z);

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

function prism(w, h, d, color) {
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  return mesh(geo, mat(color));
}

function cottage(x, z, rotY, colors) {
  const g = new THREE.Group();
  const y = heightAt(x, z);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  g.add(box(6.4, 0.5, 5.4, '#8b8279', 0, 0.25, 0));                 // stone base
  g.add(box(6, 3, 5, colors.wall, 0, 2, 0));                          // walls
  for (const sx of [-2.9, 2.9]) for (const sz of [-2.4, 2.4]) g.add(box(0.3, 3.1, 0.3, '#6b4528', sx, 2, sz)); // beams
  const roof = prism(7.2, 2.6, 6.2, colors.roof);
  roof.position.y = 3.5;
  roof.rotation.y = Math.PI / 2;
  g.add(roof);
  g.add(box(1.2, 2, 0.12, '#6b4528', 0, 1.5, 2.52));                  // door
  g.add(box(0.12, 0.12, 0.06, '#e3c062', 0.4, 1.5, 2.6));
  const glass = mat('#ffd98a', { emissive: new THREE.Color('#000000') });
  for (const sx of [-1.9, 1.9]) {
    g.add(box(0.9, 0.8, 0.1, glass, sx, 2.1, 2.52));
    g.add(box(1.1, 0.12, 0.2, '#6b4528', sx, 1.65, 2.56));
  }
  g.add(box(0.7, 1.6, 0.7, '#8b8279', 1.8, 4.8, -1));                 // chimney
  addBox(x, z, 6.4, 5.4, -rotY);
  return { group: g, glass };
}

function lanternPost(x, z) {
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  g.add(box(0.16, 2.6, 0.16, '#4a3322', 0, 1.3, 0));
  g.add(box(0.7, 0.1, 0.12, '#4a3322', 0.3, 2.55, 0));
  const lampMat = mat('#ffd27a', { emissive: new THREE.Color('#ffb347'), emissiveIntensity: 0 });
  g.add(box(0.32, 0.4, 0.32, lampMat, 0.6, 2.25, 0));
  const glow = glowSprite('#ffc266', 2.6, 0);
  glow.position.set(0.6, 2.25, 0);
  g.add(glow);
  addCircle(x, z, 0.25);
  return { group: g, lampMat, glow };
}

function well() {
  const g = new THREE.Group();
  g.position.set(VILLAGE.x, heightAt(VILLAGE.x, VILLAGE.z), VILLAGE.z);
  g.add(mesh(new THREE.CylinderGeometry(1.4, 1.5, 1, 10, 1, true), mat('#8b8279', { side: THREE.DoubleSide }), 0, 0.5, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 10), mat('#2f5f8a'), 0, 0.6, 0));
  for (const s of [-1, 1]) g.add(box(0.18, 2.4, 0.18, '#6b4528', s * 1.2, 1.2, 0));
  const roof = prism(3.2, 1.1, 2.4, '#a8432f');
  roof.position.y = 2.3;
  roof.rotation.y = Math.PI / 2;
  g.add(roof);
  g.add(box(2.4, 0.12, 0.12, '#6b4528', 0, 1.8, 0));
  addCircle(VILLAGE.x, VILLAGE.z, 1.7);
  return g;
}

function crate(x, z, s = 1) {
  const c = box(s, s, s, '#a0743f', x, heightAt(x, z) + s / 2, z);
  c.rotation.y = x * 0.7;
  addCircle(x, z, s * 0.6);
  return c;
}

function barrel(x, z) {
  const b = mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 8), mat('#8a5a32'), x, heightAt(x, z) + 0.55, z);
  addCircle(x, z, 0.5);
  return b;
}

function shard(id, x, z, y) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const crystal = mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshLambertMaterial({
    color: '#bff4ff', emissive: new THREE.Color('#5fd8ff'), emissiveIntensity: 1.4, flatShading: true,
  }), 0, 1.4, 0);
  crystal.scale.y = 1.6;
  crystal.castShadow = false;
  g.add(crystal);
  const glow = glowSprite('#8fe6ff', 3.4, 0.9);
  glow.position.y = 1.4;
  g.add(glow);
  // A tall beam of light, so the shard can be seen from far away.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.6, 80, 10, 1, true).translate(0, 40, 0),
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
  g.add(box(1.1, 0.6, 0.7, '#8a5a2b', 0, 0.3, 0));
  g.add(box(1.14, 0.08, 0.74, '#d1a53c', 0, 0.58, 0));
  const lid = new THREE.Group();
  lid.position.set(0, 0.6, -0.35);
  lid.add(box(1.1, 0.3, 0.7, '#9b6532', 0, 0.15, 0.35));
  lid.add(box(0.18, 0.2, 0.06, '#d1a53c', 0, 0.05, 0.71));
  g.add(lid);
  const glow = glowSprite('#ffd75e', 1.6, 0);
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

  // --- The village: cottages around a well, between the paths. ---
  const houseColors = [
    { wall: '#efe2c4', roof: '#b4503a' }, { wall: '#e8d7b0', roof: '#4f6fa8' }, { wall: '#f3e9d2', roof: '#6f8f3c' },
    { wall: '#e6d2b5', roof: '#9a5a8f' }, { wall: '#efe0c0', roof: '#c27a2c' },
  ];
  [78, 142, 196, 269, 3].forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const x = Math.cos(a) * 21, z = Math.sin(a) * 21;
    const c = cottage(x, z, Math.atan2(-Math.cos(a), -Math.sin(a)), houseColors[i]);
    group.add(c.group);
    windows.push(c.glass);
  });
  group.add(well());
  for (const deg of [20, 60, 110, 160, 230, 300]) {
    const a = (deg * Math.PI) / 180;
    const l = lanternPost(Math.cos(a) * 11, Math.sin(a) * 11);
    group.add(l.group);
    lanterns.push(l);
  }
  group.add(crate(7, -6), crate(7.8, -5.2, 0.7), barrel(6.4, -7.4), barrel(-8, 6.5), crate(-9, 5.4, 0.8));

  // --- The Whispering Stones: a ring of standing stones on a hill. ---
  const shards = [];
  {
    const p = PLACES.stones, y = placeGround('stones');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const x = p.x + Math.cos(a) * 8, z = p.z + Math.sin(a) * 8;
      const h = 3 + rand() * 1.8;
      const s = box(1.3, h, 0.8, '#8d8a86', x, y + h / 2 - 0.2, z);
      s.rotation.set((rand() - 0.5) * 0.12, -a, (rand() - 0.5) * 0.12);
      group.add(s);
      addCircle(x, z, 0.8);
      if (i % 3 === 0) {
        const lintel = box(0.9, 0.2, 0.6, '#6fd0ff', x, y + h * 0.6, z);
        lintel.material.emissive = new THREE.Color('#2a8cc0');
        lintel.material.emissiveIntensity = 0;
        lintel.rotation.y = -a;
        lintel.castShadow = false;
        lintel.scale.set(0.4, 0.4, 1.05);
        group.add(lintel);
        glowing.push(lintel.material);
      }
    }
    group.add(box(2, 0.8, 2, '#7a7671', p.x, y + 0.35, p.z));
    addCircle(p.x, p.z, 1.3);
    shards.push(shard('stones', p.x, p.z, y + 0.8));
  }

  // --- The Old Watchtower. ---
  {
    const p = PLACES.tower, y = placeGround('tower');
    group.add(mesh(new THREE.CylinderGeometry(2.6, 3.2, 13, 9), mat('#9a948a'), p.x, y + 6.5, p.z));
    group.add(mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.5, 9), mat('#6b4528'), p.x, y + 13.2, p.z));
    group.add(mesh(new THREE.ConeGeometry(3.9, 3.4, 9), mat('#7a3b2e'), p.x, y + 15.1, p.z));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      group.add(box(0.2, 1.6, 0.2, '#6b4528', p.x + Math.cos(a) * 3.3, y + 13.8, p.z + Math.sin(a) * 3.3));
    }
    const door = box(1.4, 2.4, 0.4, '#4a3322', p.x - 0.4, y + 1.2, p.z + 3);
    group.add(door);
    addCircle(p.x, p.z, 3.3);
    // Fallen stones from the top.
    for (let i = 0; i < 6; i++) {
      const x = p.x + (rand() - 0.5) * 12, z = p.z + 5 + rand() * 6;
      const b = box(0.8, 0.5, 0.6, '#9a948a', x, heightAt(x, z) + 0.2, z);
      b.rotation.set(rand(), rand() * 3, rand());
      group.add(b);
    }
    shards.push(shard('tower', p.x - 0.5, p.z + 5.5, heightAt(p.x - 0.5, p.z + 5.5)));
  }

  // --- Lake Isle: a little island with a tree and a shrine. ---
  {
    const p = PLACES.island, y = heightAt(p.x, p.z);
    for (const s of [-1, 1]) group.add(box(0.3, 2.4, 0.3, '#c9433a', p.x + s * 1.2, y + 1.2, p.z - 2));
    group.add(box(3.4, 0.3, 0.4, '#c9433a', p.x, y + 2.45, p.z - 2));
    addCircle(p.x - 1.2, p.z - 2, 0.25); addCircle(p.x + 1.2, p.z - 2, 0.25);
    shards.push(shard('island', p.x, p.z + 0.5, heightAt(p.x, p.z + 0.5)));
  }

  // --- Glowcap Grove: giant mushrooms that glow at night. ---
  {
    const p = PLACES.grove;
    const caps = ['#d9473f', '#c25ad6', '#3fb3d9', '#e08a2c'];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + rand() * 0.3;
      const r = 6 + rand() * 7;
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const y = heightAt(x, z), s = 0.7 + rand() * 1.1;
      const capMat = mat(caps[i % caps.length], { emissive: new THREE.Color(caps[i % caps.length]), emissiveIntensity: 0 });
      glowing.push(capMat);
      group.add(mesh(new THREE.CylinderGeometry(0.35 * s, 0.5 * s, 3 * s, 7), mat('#efe6d2'), x, y + 1.5 * s, z));
      const cap = mesh(new THREE.SphereGeometry(1.6 * s, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), capMat, x, y + 2.9 * s, z);
      cap.scale.y = 0.75;
      group.add(cap);
      for (let k = 0; k < 4; k++) {
        const sa = rand() * 6.28, sr = 0.7 + rand() * 0.6;
        const dot = box(0.3 * s, 0.1, 0.3 * s, '#fff8ea', x + Math.cos(sa) * sr * s, y + 2.9 * s + 1.0 * s * Math.sqrt(1 - sr * sr * 0.38) * 0.75, z + Math.sin(sa) * sr * s);
        dot.castShadow = false;
        group.add(dot);
      }
      addCircle(x, z, 0.55 * s);
    }
    shards.push(shard('grove', p.x, p.z, heightAt(p.x, p.z)));
  }

  // --- The Fallen Keep: broken walls and columns. ---
  {
    const p = PLACES.ruins, y = placeGround('ruins');
    const stone = '#a39e93';
    const walls = [
      [0, -8, 16, 1, 3.4], [-8, 0, 1, 16, 2.4], [8, -3, 1, 10, 4], [-4, 8, 8, 1, 1.6], [6, 8, 4, 1, 2.8],
    ];
    for (const [dx, dz, w, d, h] of walls) {
      group.add(box(w, h, d, stone, p.x + dx, y + h / 2 - 0.2, p.z + dz));
      addBox(p.x + dx, p.z + dz, w, d);
    }
    for (const [dx, dz, h] of [[-4, -4, 5], [4, -4, 2.2], [-4, 4, 3.6], [4, 4, 5.5]]) {
      group.add(mesh(new THREE.CylinderGeometry(0.55, 0.65, h, 8), mat('#b8b2a6'), p.x + dx, y + h / 2, p.z + dz));
      addCircle(p.x + dx, p.z + dz, 0.7);
    }
    for (let i = 0; i < 10; i++) {
      const x = p.x + (rand() - 0.5) * 20, z = p.z + (rand() - 0.5) * 20;
      const b = box(0.6 + rand(), 0.4 + rand() * 0.4, 0.6 + rand() * 0.6, stone, x, heightAt(x, z) + 0.2, z);
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
        l.lampMat.emissiveIntensity = night * 2.2;
        l.glow.material.opacity = night * 0.9;
      }
      for (const w of windows) w.emissive.setRGB(night * 0.9, night * 0.6, night * 0.2);
      for (const m of glowing) m.emissiveIntensity = night * 0.85;
      for (const c of chests) {
        if (c.opened && c.openT < 1) c.openT = Math.min(1, c.openT + 0.04);
        c.lid.rotation.x = -c.openT * 1.9;
        c.glow.material.opacity = c.opened ? Math.max(0, 0.8 - c.openT * 0.8) * (c.openT < 1 ? 1 : 0) : 0.25 + Math.sin(t * 3 + c.pos.x) * 0.12;
      }
    },
  };
}
