// Lumen Vale: builds the world and runs the game loop.
import * as THREE from 'three';
import { WORLD, VILLAGE, PLACES, PLAYER, CAMERA, QUEST, SLIMES } from './config.js';
import { buildTerrain, heightAt } from './terrain.js';
import { buildWater } from './water.js';
import { buildGrass } from './grass.js';
import { timeUniform } from './materials.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildNature } from './nature.js';
import { buildPlaces, glowSprite } from './places.js';
import { Sky } from './sky.js';
import { Player } from './player.js';
import { Slimes } from './slimes.js';
import { Villagers, marenTalk } from './npcs.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { sfx, initAudio, setMuted, isMuted } from './sfx.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { mulberry32 } from './noise.js';

const rand = mulberry32(31);

export class Game {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1200);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    // Finishing touches: a soft glow around bright things (bloom).
    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
    });

    this.water = buildWater();
    this.grass = buildGrass();
    this.scene.add(buildTerrain(), this.water, this.grass);
    this.nature = buildNature();
    this.scene.add(this.nature);
    this.places = buildPlaces();
    this.scene.add(this.places.group);
    // Solid things the camera shouldn't end up inside.
    this.solids = [];
    this.places.group.traverse((o) => { if (o.isMesh && o.castShadow) this.solids.push(o); });
    this.ray = new THREE.Raycaster();
    this.sky = new Sky(this.scene);
    this.player = new Player(this.scene);
    this.slimes = new Slimes(this.scene);
    this.villagers = new Villagers(this.scene);
    this.hud = new Hud();
    this.input = new Input(this.renderer.domElement);

    this.now = 0;              // game time in ms (only runs while playing)
    this.playing = false;
    this.cam = { yaw: Math.PI * 0.15, pitch: CAMERA.pitch, dist: CAMERA.dist };
    this.coins = 0;
    this.quest = 'intro';
    this.dialogState = null;
    this.drops = [];
    this.sparks = [];
    this.place = null;
    this.dyingAt = 0;
    this.lastSave = 0;

    const muteBtn = document.getElementById('muteBtn');
    muteBtn.addEventListener('click', () => { setMuted(!isMuted()); muteBtn.classList.toggle('off', isMuted()); });
    document.getElementById('dialog').addEventListener('click', () => this.advanceDialog());

    this.last = performance.now();
    this.ready = true;
    requestAnimationFrame((t) => this.frame(t));
  }

  groundAt(x, z) { return heightAt(x, z); }

  get shardCount() { return this.places.shards.filter((s) => s.taken).length; }

  // --- Starting, saving and loading ---

  start(fromSave) {
    initAudio();
    const save = fromSave ? loadSave() : null;
    if (!fromSave) clearSave();
    if (save) this.applySave(save);
    else { this.player.place(0, 8, Math.PI); this.cam.yaw = 0; }
    this.playing = true;
    this.place = undefined;   // the first place check is silent
    this.hud.show();
    this.refreshHud();
    if (!save) this.hud.toast('Lumen Vale', 'Talk to Elder Maren by the well', 3500);
    else this.hud.toast('Welcome back', '', 2000);
  }

  saveData() {
    return {
      v: 1, x: this.player.pos.x, z: this.player.pos.z, facing: this.player.facing, hearts: this.player.hearts,
      coins: this.coins, quest: this.quest, time: this.sky.time, camYaw: this.cam.yaw,
      shards: this.places.shards.filter((s) => s.taken).map((s) => s.id),
      chests: this.places.chests.filter((c) => c.opened).map((c) => c.id),
    };
  }

  save() { writeSave(this.saveData()); this.lastSave = this.now; }

  applySave(s) {
    this.player.place(s.x ?? 0, s.z ?? 8, s.facing ?? Math.PI);
    this.player.hearts = Math.max(1, s.hearts ?? PLAYER.hearts);
    this.coins = s.coins ?? 0;
    this.quest = s.quest ?? 'intro';
    this.sky.setTime(s.time ?? 0.3);
    this.cam.yaw = s.camYaw ?? 0;
    for (const sh of this.places.shards) if ((s.shards || []).includes(sh.id)) this.takeShard(sh, true);
    for (const c of this.places.chests) if ((s.chests || []).includes(c.id)) { c.opened = true; c.openT = 1; }
  }

  // --- The loop ---

  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.step(dt);
    this.render();
    requestAnimationFrame((tt) => this.frame(tt));
  }

  render() { this.composer.render(); }

  // Passes the light, fog and hero position on to the grass and water.
  updateShaders(focus) {
    const fog = this.scene.fog, light = this.sky.groundLight;
    const g = this.grass.userData.uniforms, w = this.water.userData.uniforms;
    for (const u of [g, w]) {
      u.uFogColor.value.copy(fog.color); u.uFogNear.value = fog.near; u.uFogFar.value = fog.far;
      if (light) u.uLight.value.copy(light);
    }
    g.uCenter.value.set(focus.x, focus.z);
    g.uPlayer.value.copy(this.player.pos);
    if (this.sky.sunDir) w.uSunDir.value.copy(this.sky.sunDir);
    w.uSky.value.copy(this.sky.horizon);
    w.uSun.value = 1 - this.sky.night;
  }

  step(dt) {
    const input = this.input;
    timeUniform.value += dt;
    if (!this.playing) {
      // Title screen: a slow flight around the village.
      this.sky.update(dt * 0.3, new THREE.Vector3(0, 0, 0), this.camera.position);
      this.places.update(performance.now() / 1000, this.sky.night);
      const a = performance.now() / 14000;
      this.camera.position.set(Math.sin(a) * 46, VILLAGE.h + 20, Math.cos(a) * 46);
      this.camera.lookAt(0, VILLAGE.h + 3, 0);
      this.villagers.update(dt, performance.now(), this.player);
      this.updateShaders(new THREE.Vector3(0, 0, 0));
      input.endFrame();
      return;
    }
    this.now += dt * 1000;
    const now = this.now;
    const p = this.player;

    // Camera controls.
    this.cam.yaw -= input.look.dx * CAMERA.lookSpeed;
    this.cam.pitch = Math.max(CAMERA.minPitch, Math.min(CAMERA.maxPitch, this.cam.pitch + input.look.dy * CAMERA.lookSpeed));
    this.cam.dist = Math.max(CAMERA.minDist, Math.min(CAMERA.maxDist, this.cam.dist * (1 + input.zoom * 0.1)));

    let wish = { x: 0, z: 0 };
    const dying = this.dyingAt > 0;
    if (this.dialogState) {
      if (input.tapped('e', ' ', 'enter') || input.clicked) this.advanceDialog();
    } else if (!dying) {
      const m = input.move();
      const sy = Math.sin(this.cam.yaw), cy = Math.cos(this.cam.yaw);
      // Forward is away from the camera.
      wish = { x: -sy * -m.z + cy * m.x, z: -cy * -m.z - sy * m.x };
      if (input.clicked || input.tapped('f')) { if (p.attack(now)) sfx.swing(); }
      if (input.tapped('e')) this.interact();
    }
    const wasSwimming = p.swimming;
    p.jumped = false;
    p.update(dt, now, wish, input.down('shift'), !this.dialogState && !dying && input.tapped(' '));
    if (p.jumped) sfx.jump();
    if (p.swimming && !wasSwimming) sfx.splash();

    if (!this.dialogState) {
      const ev = this.slimes.update(dt, now, p, this.sky.night);
      if (ev.hurtPlayer && !dying && p.hurt(now, ev.hurtPlayer.pos)) {
        sfx.hurt();
        if (p.hearts <= 0) this.die();
      }
      for (const s of ev.killed) this.slimePopped(s);
      for (const s of this.slimes.list) if (s.flash === 1) { sfx.hit(); s.flash = 0.99; }
    }
    this.villagers.update(dt, now, p);
    this.sky.update(dt, p.pos, this.camera.position);
    const lit = this.quest === 'done' ? 1 : 0.35;
    this.places.update(now / 1000, Math.max(this.sky.night * lit, this.quest === 'done' ? 0.25 : 0));
    this.updateDrops(dt, now);
    this.updateSparks(dt);

    // Picking up shards.
    for (const s of this.places.shards) {
      if (!s.taken && p.pos.distanceTo(s.pos) < 2.2) this.takeShard(s);
    }
    this.checkPlace();
    if (!this.dialogState) this.hud.prompt(this.nearestInteract()?.label || null);
    else this.hud.prompt(null);
    if (dying && now - this.dyingAt > 500) this.hud.fade(true);
    if (dying && now - this.dyingAt > 1600) this.respawn();

    this.updateCamera(dt);
    this.updateShaders(p.pos);
    this.hud.setHearts(p.hearts);
    this.hud.setClock(this.sky.clockText());
    this.hud.drawMinimap(p, this.places.shards, this.cam.yaw);
    if (now - this.lastSave > 5000) this.save();
    input.endFrame();
  }

  updateCamera() {
    const p = this.player.pos, c = this.cam;
    const target = new THREE.Vector3(p.x, p.y + 1.6, p.z);
    const pos = new THREE.Vector3(
      target.x + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist,
      target.y + Math.sin(c.pitch) * c.dist,
      target.z + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist,
    );
    // Pull in closer if a house, tree-sized mushroom or wall is in the way.
    const dir = pos.clone().sub(target);
    const len = dir.length();
    this.ray.set(target, dir.normalize());
    this.ray.far = len;
    const hit = this.ray.intersectObjects(this.solids, false)[0];
    if (hit) pos.copy(target).addScaledVector(dir, Math.max(0.8, hit.distance - 0.4));
    // Don't let the camera dip under hills or water.
    const floor = Math.max(heightAt(pos.x, pos.z), WORLD.waterLevel) + 0.8;
    if (pos.y < floor) pos.y = floor;
    this.camera.position.copy(pos);
    this.camera.lookAt(target);
  }

  // --- Things to do ---

  interactables() {
    const out = [];
    for (const v of this.villagers.list) out.push({ pos: v.pos, r: 2.6, label: `Talk to ${v.name}`, act: () => this.talkTo(v) });
    for (const c of this.places.chests) if (!c.opened) out.push({ pos: c.pos, r: 2.2, label: 'Open the chest', act: () => this.openChest(c) });
    if (this.player.hearts < PLAYER.hearts) out.push({ pos: new THREE.Vector3(VILLAGE.x, 0, VILLAGE.z), r: 3, label: 'Drink from the well', act: () => this.drinkWell() });
    return out;
  }

  nearestInteract() {
    const p = this.player.pos;
    let best = null, bd = Infinity;
    for (const it of this.interactables()) {
      const d = Math.hypot(it.pos.x - p.x, it.pos.z - p.z);
      if (d < it.r && d < bd) { best = it; bd = d; }
    }
    return best;
  }

  interact() { const it = this.nearestInteract(); if (it) it.act(); }

  talkTo(v) {
    let lines, then;
    if (v.id === 'maren') ({ lines, then } = marenTalk(this.quest, this.shardCount));
    else { lines = [v.lines[v.line % v.lines.length]]; v.line++; }
    v.talking = true;
    this.dialogState = { who: v, lines, i: 0, then };
    this.hud.dialog(v.name, lines[0]);
    sfx.talk();
  }

  advanceDialog() {
    const d = this.dialogState;
    if (!d) return;
    d.i++;
    if (d.i < d.lines.length) { this.hud.dialog(d.who.name, d.lines[d.i]); sfx.talk(); return; }
    d.who.talking = false;
    this.dialogState = null;
    this.hud.dialog(null);
    if (d.then) this.setQuest(d.then);
  }

  setQuest(q) {
    this.quest = q;
    if (q === 'collect') this.hud.toast('New Quest', 'The Scattered Moonshards', 2800);
    if (q === 'done') {
      this.coins += QUEST.reward;
      sfx.quest();
      this.hud.toast('Quest Complete!', `The lanterns of Lumen Vale shine again · +${QUEST.reward} coins`, 4000);
    }
    this.refreshHud();
    this.save();
  }

  takeShard(s, quiet = false) {
    s.taken = true;
    s.group.visible = false;
    if (quiet) return;
    sfx.shard();
    this.burst(s.pos.clone().setY(s.pos.y + 1.4), '#8fe6ff', 26);
    const n = this.shardCount;
    this.hud.toast('Moonshard found!', n < QUEST.shards ? `${n} of ${QUEST.shards}` : 'All five! Return to Elder Maren', 3000);
    this.refreshHud();
    this.save();
  }

  openChest(c) {
    c.opened = true;
    const amount = 10 + Math.floor(rand() * 16);
    sfx.chest();
    this.burst(c.pos.clone().setY(c.pos.y + 0.8), '#ffd75e', 18);
    // The coins pop out and fly to the player; each is worth a share.
    for (let i = 0; i < 6; i++) this.dropCoin(c.pos, Math.floor(amount / 6) + (i < amount % 6 ? 1 : 0));
    this.hud.toast('Treasure!', `${amount} coins`, 2200);
    this.refreshHud();
    this.save();
  }

  drinkWell() {
    this.player.hearts = PLAYER.hearts;
    sfx.coin();
    this.hud.toast('Refreshed', 'Your hearts are full', 1800);
  }

  slimePopped(s) {
    sfx.pop();
    this.burst(s.pos.clone().setY(s.pos.y + 0.6), s.color, 14);
    const n = SLIMES.coins[0] + Math.floor(rand() * (SLIMES.coins[1] - SLIMES.coins[0] + 1));
    for (let i = 0; i < n; i++) this.dropCoin(s.pos, 1);
  }

  die() {
    this.dyingAt = this.now;
  }

  respawn() {
    this.dyingAt = 0;
    this.player.place(0, 8, Math.PI);
    this.player.hearts = PLAYER.hearts;
    this.player.hurtUntil = this.now + 1500;
    this.hud.fade(false);
    this.hud.toast('You wake up in the village', 'The slimes got the better of you', 3000);
    this.save();
  }

  checkPlace() {
    const p = this.player.pos;
    let here = null;
    if (Math.hypot(p.x - VILLAGE.x, p.z - VILLAGE.z) < VILLAGE.r) here = 'village';
    for (const [k, pl] of Object.entries(PLACES)) if (Math.hypot(p.x - pl.x, p.z - pl.z) < 22) here = k;
    if (here && here !== this.place && this.place !== undefined && this.now > 3000) {
      if (!this.dialogState) this.hud.toast(here === 'village' ? 'Lumen Vale Village' : PLACES[here].name, '', 2200);
    }
    this.place = here;
  }

  refreshHud() {
    const n = this.shardCount;
    this.hud.setCoins(this.coins);
    this.hud.setShards(n);
    if (this.quest === 'intro') this.hud.setQuest('A Traveller Arrives', 'Talk to Elder Maren by the village well.');
    else if (this.quest === 'collect' && n < QUEST.shards) this.hud.setQuest('The Scattered Moonshards', `Follow the beams of light in the sky to find the Moonshards (${n} of ${QUEST.shards}).`);
    else if (this.quest === 'collect') this.hud.setQuest('The Scattered Moonshards', 'You have all five! Bring them back to Elder Maren.');
    else {
      const open = this.places.chests.filter((c) => c.opened).length;
      this.hud.setQuest('Lumen Vale Shines', `Quest complete! Roam the vale and find the hidden chests (${open} of ${this.places.chests.length}).`);
    }
  }

  // --- Coins and sparkles ---

  dropCoin(from, value) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10), new THREE.MeshLambertMaterial({ color: '#f2c84b', emissive: new THREE.Color('#7a5a10') }));
    m.rotation.x = Math.PI / 2;
    m.position.set(from.x, from.y + 0.8, from.z);
    this.scene.add(m);
    const a = rand() * Math.PI * 2;
    this.drops.push({ mesh: m, value, vel: new THREE.Vector3(Math.cos(a) * 2.5, 6 + rand() * 2, Math.sin(a) * 2.5), born: this.now });
  }

  updateDrops(dt, now) {
    const p = this.player.pos;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i], m = d.mesh;
      if (now - d.born > 600) {
        // Fly to the player.
        const to = new THREE.Vector3(p.x, p.y + 1.2, p.z).sub(m.position);
        const dist = to.length();
        if (dist < 0.6) {
          this.scene.remove(m);
          m.geometry.dispose(); m.material.dispose();
          this.drops.splice(i, 1);
          this.coins += d.value;
          this.hud.setCoins(this.coins);
          sfx.coin();
          continue;
        }
        m.position.addScaledVector(to.normalize(), Math.min(dist, (12 + (now - d.born) / 60) * dt));
      } else {
        d.vel.y -= 20 * dt;
        m.position.addScaledVector(d.vel, dt);
        const g = heightAt(m.position.x, m.position.z) + 0.2;
        if (m.position.y < g) { m.position.y = g; d.vel.multiplyScalar(0.4); d.vel.y = Math.abs(d.vel.y); }
      }
      m.rotation.z += dt * 8;
    }
  }

  burst(at, color, n) {
    for (let i = 0; i < n; i++) {
      const s = glowSprite(color, 0.5 + rand() * 0.5, 1);
      s.position.copy(at);
      this.scene.add(s);
      const a = rand() * Math.PI * 2, up = rand();
      this.sparks.push({ s, vel: new THREE.Vector3(Math.cos(a) * (1 - up) * 5, up * 6 + 1, Math.sin(a) * (1 - up) * 5), life: 0.6 + rand() * 0.5, max: 1.1 });
    }
  }

  updateSparks(dt) {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const k = this.sparks[i];
      k.life -= dt;
      if (k.life <= 0) { this.scene.remove(k.s); k.s.material.dispose(); this.sparks.splice(i, 1); continue; }
      k.vel.y -= 6 * dt;
      k.s.position.addScaledVector(k.vel, dt);
      k.s.material.opacity = Math.min(1, k.life / 0.4);
    }
  }
}
