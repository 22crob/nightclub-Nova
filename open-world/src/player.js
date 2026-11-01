// The hero: walking, sprinting, jumping, swimming and swinging a sword.
import * as THREE from 'three';
import { PLAYER, WORLD } from './config.js';
import { heightAt } from './terrain.js';
import { resolve } from './colliders.js';
import { makePerson, animatePerson } from './character.js';

export class Player {
  constructor(scene) {
    this.model = makePerson({
      skin: '#f3c9a4', shirt: '#2f7a5f', pants: '#3e3a52', boots: '#4a2f1f', hair: '#c8742c',
      cape: '#b8323a', sword: true, shield: true,
    });
    scene.add(this.model);
    this.pos = new THREE.Vector3(0, 0, 8);
    this.vel = new THREE.Vector3();
    this.facing = Math.PI;      // radians; 0 faces +Z
    this.onGround = true;
    this.swimming = false;
    this.hearts = PLAYER.hearts;
    this.hurtUntil = 0;
    this.swingStart = -1;
    this.hitThisSwing = new Set();
    this.moveAmt = 0;
    this.t = 0;
    this.pos.y = heightAt(this.pos.x, this.pos.z);
  }

  place(x, z, facing = this.facing) {
    this.pos.set(x, heightAt(x, z), z);
    this.vel.set(0, 0, 0);
    this.facing = facing;
  }

  swinging(now) { return this.swingStart >= 0 && now - this.swingStart < PLAYER.swingMs; }
  swingProgress(now) { return (now - this.swingStart) / PLAYER.swingMs; }

  attack(now) {
    if (this.swimming || this.swinging(now)) return false;
    this.swingStart = now;
    this.hitThisSwing.clear();
    return true;
  }

  // `wish` is the wanted direction on the ground (x, z), length 0..1.
  update(dt, now, wish, sprint, jump) {
    this.t += dt;
    const ground = heightAt(this.pos.x, this.pos.z);
    this.swimming = ground < WORLD.waterLevel - WORLD.swimDepth && this.pos.y <= WORLD.waterLevel - WORLD.swimDepth + 0.2;
    const speed = this.swimming ? PLAYER.swim : sprint ? PLAYER.sprint : PLAYER.walk;
    const slow = this.swinging(now) && this.onGround ? 0.45 : 1;
    const tx = wish.x * speed * slow, tz = wish.z * speed * slow;
    const a = Math.min(1, PLAYER.accel * dt * (this.onGround || this.swimming ? 1 : 0.35));
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.z += (tz - this.vel.z) * a;

    if (jump && this.onGround && !this.swimming) { this.vel.y = PLAYER.jump; this.onGround = false; this.jumped = true; }

    // Move, then refuse steps up anything too steep to walk.
    const ox = this.pos.x, oz = this.pos.z;
    const step = (nx, nz) => {
      const h0 = heightAt(this.pos.x, this.pos.z), h1 = heightAt(nx, nz);
      const run = Math.hypot(nx - this.pos.x, nz - this.pos.z);
      // A swimmer can always pull themselves up onto a low bank.
      const climbOut = this.swimming && h1 < this.pos.y + 0.7;
      if (run > 0 && !climbOut && h1 - h0 > PLAYER.maxSlope * run && h1 > this.pos.y - 0.05) return false;
      this.pos.x = nx; this.pos.z = nz;
      return true;
    };
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    if (!step(nx, nz)) { if (!step(nx, this.pos.z)) step(this.pos.x, nz); }
    resolve(this.pos, PLAYER.radius);
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > WORLD.playRadius) { this.pos.x *= WORLD.playRadius / r; this.pos.z *= WORLD.playRadius / r; }
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-4);

    // Up and down.
    const g = heightAt(this.pos.x, this.pos.z);
    const swimY = WORLD.waterLevel - WORLD.swimDepth;
    const floor = Math.max(g, g < swimY ? swimY : -Infinity);
    this.vel.y -= PLAYER.gravity * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= floor) {
      // Walking downhill keeps the feet on the ground instead of floating off.
      this.pos.y = floor;
      this.vel.y = 0;
      this.onGround = true;
    } else if (this.onGround && this.pos.y - floor < 0.6 && this.vel.y <= 0) {
      this.pos.y = floor;
      this.vel.y = 0;
    } else {
      this.onGround = false;
    }
    if (g < swimY && this.pos.y <= swimY + 0.01) { this.swimming = true; this.onGround = false; }

    // Turn to face where we're going.
    if (Math.hypot(wish.x, wish.z) > 0.1) {
      const want = Math.atan2(wish.x, wish.z);
      let d = want - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 12);
    }
    this.moveAmt += (Math.min(1, moved / PLAYER.walk) - this.moveAmt) * Math.min(1, dt * 10);

    this.model.position.copy(this.pos);
    if (this.swimming) this.model.position.y += 0.15;
    this.model.rotation.y = this.facing;
    animatePerson(this.model, this.t, this.moveAmt, {
      stride: sprint ? 12 : 9,
      swim: this.swimming,
      air: !this.onGround && !this.swimming,
      swing: this.swinging(now) ? this.swingProgress(now) : null,
    });
    // Blink while hurt.
    this.model.visible = now > this.hurtUntil || Math.floor(now / 90) % 2 === 0;
  }

  hurt(now, from) {
    if (now < this.hurtUntil) return false;
    this.hearts = Math.max(0, this.hearts - 1);
    this.hurtUntil = now + PLAYER.invulnMs;
    if (from) {
      const dx = this.pos.x - from.x, dz = this.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
      this.vel.x = dx / d * 9; this.vel.z = dz / d * 9; this.vel.y = 5; this.onGround = false;
    }
    return true;
  }
}
