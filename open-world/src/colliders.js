// Things the player (and slimes) bump into: circles (trees, rocks, posts)
// and boxes (houses, walls), kept in a grid so only nearby ones are checked.
const CELL = 8;
const grid = new Map();
const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;

function add(c, minX, maxX, minZ, maxZ) {
  for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
    for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
      const k = key(cx, cz);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(c);
    }
  }
}

export function addCircle(x, z, r) {
  const c = { kind: 'circle', x, z, r };
  add(c, x - r, x + r, z - r, z + r);
  return c;
}

// A box turned by `rot` radians about its centre.
export function addBox(x, z, w, d, rot = 0) {
  const c = { kind: 'box', x, z, hw: w / 2, hd: d / 2, cos: Math.cos(rot), sin: Math.sin(rot) };
  const r = Math.hypot(w, d) / 2;
  add(c, x - r, x + r, z - r, z + r);
  return c;
}

export function nearby(x, z) {
  const out = new Set();
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const list = grid.get(key(cx + i, cz + j));
    if (list) for (const c of list) out.add(c);
  }
  return out;
}

// Pushes a circle at (x, z) of radius r out of everything it overlaps.
export function resolve(pos, r) {
  for (const c of nearby(pos.x, pos.z)) {
    if (c.kind === 'circle') {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz), min = c.r + r;
      if (d < min && d > 1e-6) { pos.x = c.x + dx / d * min; pos.z = c.z + dz / d * min; }
    } else {
      // Into the box's own frame.
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const lx = dx * c.cos + dz * c.sin, lz = -dx * c.sin + dz * c.cos;
      const qx = Math.max(-c.hw, Math.min(c.hw, lx)), qz = Math.max(-c.hd, Math.min(c.hd, lz));
      let ox = lx - qx, oz = lz - qz;
      const d = Math.hypot(ox, oz);
      let nx, nz;
      if (d > 1e-6) {
        if (d >= r) continue;
        nx = qx + ox / d * r; nz = qz + oz / d * r;
      } else {
        // Centre inside the box: out through the nearest side.
        const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
        if (px < pz) { nx = Math.sign(lx || 1) * (c.hw + r); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (c.hd + r); }
      }
      pos.x = c.x + nx * c.cos - nz * c.sin;
      pos.z = c.z + nx * c.sin + nz * c.cos;
    }
  }
}

export function blocked(x, z, r) {
  const p = { x, z };
  resolve(p, r);
  return Math.abs(p.x - x) > 1e-4 || Math.abs(p.z - z) > 1e-4;
}
