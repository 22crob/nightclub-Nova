// Slimes: bouncy blobs that roam the wilds and chase the hero. A few sword
// hits pop them, dropping coins. More come out at night.
import * as THREE from 'three';
import { SLIMES, WORLD, VILLAGE, PLAYER } from './config.js';
import { heightAt } from './terrain.js';
import { resolve } from './colliders.js';
import { mulberry32 } from './noise.js';
import { toon, part } from './materials.js';

const COLORS = ['#6fd35a', '#4fb8e8', '#e06fb4', '#f0b43c'];
const rand = mulberry32(2024);

function slimeMesh(color) {
  const g = new THREE.Group();
  const bodyMat = toon(color, { emissive: new THREE.Color(color), emissiveIntensity: 0 });
  // A soft drop shape: rounder at the bottom.
  const geo = new THREE.SphereGeometry(0.75, 28, 20);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = 1 + Math.max(0, -y) * 0.25 - Math.max(0, y) * 0.08;
    p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const body = part(geo, bodyMat, { y: 0.55, outline: 0.04 });
  body.scale.set(1, 0.78, 1);
  g.add(body);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
  shine.scale.set(1.3, 0.6, 0.6);
  shine.position.set(-0.3, 0.55, 0.45);
  shine.rotation.z = 0.6;
  body.add(shine);
  const dark = toon('#241826'), white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), dark);
    eye.scale.set(0.8, 1.15, 0.5);
    eye.position.set(s * 0.24, 0.66, 0.66);
    eye.rotation.y = s * 0.3;
    g.add(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), white);
    glint.position.set(s * 0.24 + 0.03, 0.71, 0.72);
    g.add(glint);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 4, 10, Math.PI), dark);
  mouth.position.set(0, 0.5, 0.71);
  mouth.rotation.z = Math.PI;
  g.add(mouth);
  return { group: g, body, bodyMat };
}

function spawnPoint() {
  for (let i = 0; i < 200; i++) {
    const a = rand() * Math.PI * 2, r = SLIMES.safeRadius + 10 + rand() * (WORLD.playRadius - SLIMES.safeRadius - 20);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (heightAt(x, z) > WORLD.waterLevel + 0.8) return { x, z };
  }
  return { x: 60, z: -60 };
}

export class Slimes {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    for (let i = 0; i < SLIMES.count + SLIMES.nightExtra; i++) this.add(i >= SLIMES.count);
  }

  add(nightOnly) {
    const color = COLORS[this.list.length % COLORS.length];
    const m = slimeMesh(color);
    this.scene.add(m.group);
    const s = { ...m, nightOnly, color, pos: new THREE.Vector3(), vel: new THREE.Vector3(), alive: false, respawnAt: 0, hp: SLIMES.hp, hop: 0, nextHop: 0, flash: 0, dieT: 0, facing: 0 };
    this.spawn(s);
    this.list.push(s);
  }

  spawn(s) {
    const p = spawnPoint();
    s.pos.set(p.x, heightAt(p.x, p.z), p.z);
    s.home = { x: p.x, z: p.z };
    s.hp = SLIMES.hp;
    s.alive = true;
    s.dieT = 0;
    s.group.visible = true;
    s.group.scale.setScalar(1);
  }

  get alive() { return this.list.filter((s) => s.alive && s.group.visible); }

  // Returns events: { hurtPlayer, killed: [slime] }.
  update(dt, now, player, night) {
    const ev = { hurtPlayer: null, killed: [] };
    for (const s of this.list) {
      if (!s.alive) {
        if (s.dieT > 0) {
          s.dieT -= dt;
          const k = Math.max(0, s.dieT / 0.3);
          s.group.scale.set(1 + (1 - k) * 0.8, k, 1 + (1 - k) * 0.8);
          if (s.dieT <= 0) s.group.visible = false;
        } else if (now > s.respawnAt && Math.hypot(player.pos.x - s.home.x, player.pos.z - s.home.z) > 40) {
          this.spawn(s);
        }
        continue;
      }
      // Night-only slimes melt away by day (when the player isn't looking close).
      const out = !s.nightOnly || night > 0.5;
      s.group.visible = out;
      if (!out) continue;

      const dx = player.pos.x - s.pos.x, dz = player.pos.z - s.pos.z;
      const dist = Math.hypot(dx, dz);
      const playerSafe = Math.hypot(player.pos.x - VILLAGE.x, player.pos.z - VILLAGE.z) < SLIMES.safeRadius;
      const chasing = dist < SLIMES.sight * (1 + night * 0.4) && !playerSafe && player.hearts > 0;
      const grounded = s.pos.y <= heightAt(s.pos.x, s.pos.z) + 0.01;

      if (grounded && now > s.nextHop) {
        let tx, tz;
        if (chasing) { tx = dx / dist; tz = dz / dist; } else {
          const hx = s.home.x - s.pos.x, hz = s.home.z - s.pos.z, hd = Math.hypot(hx, hz);
          const a = rand() * Math.PI * 2;
          tx = Math.cos(a) + (hd > 12 ? hx / hd * 1.5 : 0); tz = Math.sin(a) + (hd > 12 ? hz / hd * 1.5 : 0);
          const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        }
        const sp = SLIMES.speed * (chasing ? 1.25 : 0.6);
        s.vel.set(tx * sp, chasing ? 5.5 : 4.5, tz * sp);
        s.facing = Math.atan2(tx, tz);
        s.nextHop = now + (chasing ? 450 : 900 + rand() * 1400);
      }
      s.vel.y -= 18 * dt;
      s.pos.addScaledVector(s.vel, dt);
      // Keep out of the village and the deep water.
      const vd = Math.hypot(s.pos.x - VILLAGE.x, s.pos.z - VILLAGE.z);
      if (vd < SLIMES.safeRadius) { s.pos.x *= SLIMES.safeRadius / vd; s.pos.z *= SLIMES.safeRadius / vd; }
      resolve(s.pos, 0.6);
      const g = heightAt(s.pos.x, s.pos.z);
      if (g < WORLD.waterLevel - 0.3) { s.pos.x -= s.vel.x * dt * 2; s.pos.z -= s.vel.z * dt * 2; s.vel.x = s.vel.z = 0; }
      const g2 = heightAt(s.pos.x, s.pos.z);
      if (s.pos.y <= g2) { s.pos.y = g2; s.vel.set(0, 0, 0); }

      // Squash and stretch.
      const air = s.pos.y - g2;
      const squash = air > 0.05 ? 1.15 : 0.85 + Math.sin(now / 160) * 0.05;
      s.body.scale.set(1 / Math.sqrt(squash), 0.78 * squash, 1 / Math.sqrt(squash));
      s.group.position.copy(s.pos);
      s.group.rotation.y = s.facing;
      s.flash = Math.max(0, s.flash - dt * 4);
      s.bodyMat.emissiveIntensity = night * 0.55 + s.flash * 2;
      s.bodyMat.emissive.set(s.flash > 0 ? '#ffffff' : s.color);

      if (dist < 1.25 && Math.abs(player.pos.y - s.pos.y) < 1.4 && player.hearts > 0) ev.hurtPlayer = s;
    }

    // Sword hits.
    if (player.swinging(now)) {
      const k = player.swingProgress(now);
      if (k > PLAYER.hitFrom && k < PLAYER.hitTo) {
        const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
        for (const s of this.list) {
          if (!s.alive || !s.group.visible || player.hitThisSwing.has(s)) continue;
          const dx = s.pos.x - player.pos.x, dz = s.pos.z - player.pos.z, d = Math.hypot(dx, dz);
          if (d > PLAYER.reach || Math.abs(s.pos.y - player.pos.y) > 1.8) continue;
          if (d > 0.6 && (dx * fx + dz * fz) / d < 0.35) continue;
          player.hitThisSwing.add(s);
          if (this.hit(s, now, fx, fz)) ev.killed.push(s);
        }
      }
    }
    return ev;
  }

  hit(s, now, fx, fz) {
    s.hp -= 1;
    s.flash = 1;
    s.vel.set(fx * 9, 5, fz * 9);
    if (s.hp > 0) return false;
    s.alive = false;
    s.dieT = 0.3;
    s.respawnAt = now + SLIMES.respawnMs;
    return true;
  }
}
