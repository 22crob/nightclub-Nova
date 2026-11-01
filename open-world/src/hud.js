// The on-screen display: hearts, coins, shards, quest, minimap, prompts,
// big announcements and the dialogue box.
import { WORLD, VILLAGE, PLAYER, QUEST } from './config.js';
import { heightAt, slopeAt, groundColor } from './terrain.js';
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = $('hud');
    this.toastTimer = 0;
    this.lastHearts = -1;
    this.buildMapImage();
  }

  show() { this.el.classList.remove('hidden'); }

  setHearts(n) {
    if (n === this.lastHearts) return;
    const box = $('hearts');
    box.innerHTML = '';
    for (let i = 0; i < PLAYER.hearts; i++) {
      const h = document.createElement('div');
      h.className = 'heart' + (i >= n ? ' empty' : '') + (i === n && n < this.lastHearts ? ' pop' : '');
      box.appendChild(h);
    }
    this.lastHearts = n;
  }
  setCoins(n) { $('coins').textContent = n; }
  setShards(n) { $('shards').textContent = `${n} / ${QUEST.shards}`; }
  setQuest(title, text) { $('questTitle').textContent = title; $('questText').textContent = text; }
  setClock(text) { $('clock').textContent = text; }

  prompt(text) {
    $('prompt').classList.toggle('hidden', !text);
    if (text) $('promptText').textContent = text;
  }

  toast(big, small = '', ms = 2600) {
    const t = $('toast');
    $('toastBig').textContent = big;
    $('toastSmall').textContent = small;
    t.classList.remove('hidden');
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  }

  dialog(name, text) {
    $('dialog').classList.toggle('hidden', !name);
    if (name) { $('dialogName').textContent = name; $('dialogText').textContent = text; }
  }

  fade(on) { $('fade').classList.toggle('on', on); }

  // A top-down picture of the whole land, one pixel per metre.
  buildMapImage() {
    const n = WORLD.size;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d');
    const img = g.createImageData(n, n);
    const col = new THREE.Color();
    const water = new THREE.Color('#3f8fc9');
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = i - n / 2, z = j - n / 2;
        const h = heightAt(x, z);
        groundColor(x, z, h, slopeAt(x, z), col);
        if (h < WORLD.waterLevel) col.lerp(water, 0.85);
        const shade = 0.85 + Math.max(-0.15, Math.min(0.15, (heightAt(x - 1, z - 1) - h) * -0.08));
        const o = (j * n + i) * 4;
        img.data[o] = Math.min(255, col.r * 255 * shade);
        img.data[o + 1] = Math.min(255, col.g * 255 * shade);
        img.data[o + 2] = Math.min(255, col.b * 255 * shade);
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // Village roofs.
    g.fillStyle = '#b4503a';
    for (const deg of [78, 142, 196, 269, 3]) {
      const a = (deg * Math.PI) / 180;
      g.fillRect(n / 2 + Math.cos(a) * 21 - 3, n / 2 + Math.sin(a) * 21 - 3, 6, 6);
    }
    this.mapImage = c;
  }

  drawMinimap(player, shards, camYaw) {
    const cv = $('minimap'), g = cv.getContext('2d');
    const W = cv.width, span = 170, k = W / span, half = WORLD.size / 2;
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath(); g.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#5b5348'; g.fillRect(0, 0, W, W);
    g.imageSmoothingEnabled = false;
    g.drawImage(this.mapImage, player.pos.x + half - span / 2, player.pos.z + half - span / 2, span, span, 0, 0, W, W);
    const toMap = (x, z) => [W / 2 + (x - player.pos.x) * k, W / 2 + (z - player.pos.z) * k];

    // The view cone of the camera.
    const fwd = Math.atan2(-Math.cos(camYaw), -Math.sin(camYaw));
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath(); g.moveTo(W / 2, W / 2); g.arc(W / 2, W / 2, 60, fwd - 0.5, fwd + 0.5); g.closePath(); g.fill();

    // The village.
    const [vx, vy] = toMap(VILLAGE.x, VILLAGE.z);
    g.font = 'bold 16px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
    // Shards: shown at the rim when they're beyond the edge.
    for (const s of shards) {
      if (s.taken) continue;
      let [sx, sy] = toMap(s.pos.x, s.pos.z);
      const dx = sx - W / 2, dy = sy - W / 2, d = Math.hypot(dx, dy), max = W / 2 - 10;
      if (d > max) { sx = W / 2 + dx / d * max; sy = W / 2 + dy / d * max; }
      g.save(); g.translate(sx, sy);
      g.fillStyle = '#bff4ff'; g.strokeStyle = '#1b6f94'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 0); g.lineTo(0, 7); g.lineTo(-5, 0); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    if (Math.hypot(vx - W / 2, vy - W / 2) < W / 2 - 8) {
      g.fillStyle = '#fff2c4'; g.strokeStyle = '#4a3320'; g.lineWidth = 3;
      g.strokeText('⌂', vx, vy); g.fillText('⌂', vx, vy);
    }
    // The player.
    g.translate(W / 2, W / 2);
    g.rotate(Math.atan2(Math.cos(player.facing), Math.sin(player.facing)));
    g.fillStyle = '#ffdf5e'; g.strokeStyle = '#4a3320'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -6); g.lineTo(-3, 0); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
