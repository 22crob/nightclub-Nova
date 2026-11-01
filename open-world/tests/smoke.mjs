// Smoke test: opens the built game (dist/index.html, straight from disk) in
// headless Chromium and plays through the quest. Run with `npm test`.
// Headless Chromium draws without a graphics card, so frames are slow; the
// checks drive the game by calling game.step() directly.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const gameUrl = pathToFileURL(path.join(root, 'dist', 'index.html')).href;
const shotDir = path.join(root, 'test-results');
fs.mkdirSync(shotDir, { recursive: true });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

const exe = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  executablePath: fs.existsSync(exe) ? exe : undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const G = (fn, arg) => page.evaluate(fn, arg);
const steps = (n, dt = 0.033) => G(([n, dt]) => { for (let i = 0; i < n; i++) window.__lumen.step(dt); }, [n, dt]);
const state = () => G(() => {
  const g = window.__lumen;
  return {
    pos: g.player.pos.toArray(), hearts: g.player.hearts, coins: g.coins, quest: g.quest, shards: g.shardCount,
    swimming: g.player.swimming, dialog: !!g.dialogState, night: g.sky.night,
  };
});
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(shotDir, `${name}.png`) }); };
// Puts the player at x, z facing a direction, with the camera behind them.
const teleport = (x, z, facing = 0) => G(([x, z, f]) => {
  const g = window.__lumen;
  g.player.place(x, z, f);
  g.cam.yaw = f + Math.PI;
  g.step(0.016);
}, [x, z, facing]);
const loadGame = async () => {
  await page.goto(gameUrl);
  await page.waitForFunction(() => window.__lumen && window.__lumen.ready, null, { timeout: 90000 });
};

await page.goto(gameUrl);
await page.evaluate(() => localStorage.clear());
await loadGame();
check('title screen shows', await page.isVisible('#title'));
check('no Continue without a save', !(await page.isVisible('#continueBtn')));
await shot('01_title');

await page.click('#newBtn');
await steps(3);
let s = await state();
check('HUD shows after starting', await page.isVisible('#hud'));
check('starts with full hearts', s.hearts === 5, `hearts ${s.hearts}`);
check('quest starts at intro', s.quest === 'intro');
check('world was built', await G(() => {
  const c = window.__lumen.nature.userData.counts;
  return c.trees > 1000 && c.rocks > 200 && c.bushes > 300 && c.flowers > 1000;
}));

check('painterly look is set up', await G(() => {
  const g = window.__lumen;
  let outlines = 0;
  g.player.model.traverse((o) => { if (o.userData.outline) outlines++; });
  return g.grass.geometry.instanceCount > 50000 && g.water.material.isShaderMaterial && !!g.bloom
    && outlines > 10 && g.sky.clouds.children.length > 10;
}));
// The picture isn't blank: lots of different colours on screen.
const colours = await G(() => {
  const gl = window.__lumen.renderer.getContext();
  window.__lumen.render();
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const px = new Uint8Array(4);
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    gl.readPixels(Math.floor((i * 37) % w), Math.floor((i * 53) % h), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    seen.add(`${px[0] >> 4},${px[1] >> 4},${px[2] >> 4}`);
  }
  return seen.size;
});
check('3D scene renders', colours > 15, `${colours} colours`);
await shot('02_village');

// Walking: W moves the player forward (away from the camera).
const before = (await state()).pos;
await page.keyboard.down('w');
await steps(30);
await page.keyboard.up('w');
s = await state();
const walked = Math.hypot(s.pos[0] - before[0], s.pos[2] - before[2]);
check('W walks forward', walked > 3, `${walked.toFixed(1)} m`);
check('feet stay on the ground', await G(() => {
  const g = window.__lumen; return Math.abs(g.player.pos.y - g.groundAt(g.player.pos.x, g.player.pos.z)) < 0.05;
}));

// Jumping.
await teleport(0, 10);
await page.keyboard.press(' ');
await steps(6);
check('Space jumps', await G(() => !window.__lumen.player.onGround));
await steps(40);
check('lands again', await G(() => window.__lumen.player.onGround));

// The well is solid.
await teleport(0, 4, Math.PI);
await page.keyboard.down('w');
await steps(40);
await page.keyboard.up('w');
check('can\'t walk through the well', await G(() => Math.hypot(window.__lumen.player.pos.x, window.__lumen.player.pos.z) >= 2.1));

// Talking to Elder Maren starts the quest.
await G(() => { const m = window.__lumen.villagers.byId('maren'); m.target = null; m.waitUntil = 1e12; });
const maren = await G(() => window.__lumen.villagers.byId('maren').pos.toArray());
await teleport(maren[0], maren[2] + 1.6, Math.PI);
check('prompt offers to talk', (await page.textContent('#promptText')).includes('Elder Maren') && await page.isVisible('#prompt'));
await page.keyboard.press('e');
await steps(1);
check('dialogue opens', await page.isVisible('#dialog'));
await shot('03_dialogue');
for (let i = 0; i < 4; i++) { await page.keyboard.press('e'); await steps(1); }
s = await state();
check('dialogue closes', !s.dialog && !(await page.isVisible('#dialog')));
check('quest moves to collecting', s.quest === 'collect', s.quest);
check('quest panel updates', (await page.textContent('#questText')).includes('beams of light'));

// Every place is reachable on foot (not inside a cliff) and has its shard.
const shards = await G(() => window.__lumen.places.shards.map((s) => ({ id: s.id, p: s.pos.toArray() })));
check('five shards', shards.length === 5);
for (const sh of shards) {
  await teleport(sh.p[0], sh.p[2] + 6, Math.PI);
  await shot(`04_place_${sh.id}`);
  await page.keyboard.down('w');
  await steps(45);
  await page.keyboard.up('w');
  const got = await G((id) => window.__lumen.places.shards.find((s) => s.id === id).taken, sh.id);
  check(`walked up to and picked up the ${sh.id} shard`, got);
  if (!got) await teleport(sh.p[0], sh.p[2]);
}
s = await state();
check('all five shards found', s.shards === 5, `${s.shards}`);
check('quest asks to return', (await page.textContent('#questText')).includes('Bring them back'));

// Handing them in pays the reward.
await G(() => { window.__lumen.dialogState = null; window.__lumen.hud.dialog(null); });
await teleport(maren[0], maren[2] + 1.6, Math.PI);
const coinsBefore = (await state()).coins;
await page.keyboard.press('e');
await steps(1);
for (let i = 0; i < 2; i++) { await page.keyboard.press('e'); await steps(1); }
s = await state();
check('quest completes', s.quest === 'done', s.quest);
check('reward paid', s.coins === coinsBefore + 50, `${coinsBefore} -> ${s.coins}`);

// Chests give coins that fly to the player.
const chest = await G(() => window.__lumen.places.chests[0].pos.toArray());
await teleport(chest[0], chest[2] + 1.6, Math.PI);
check('prompt offers the chest', (await page.textContent('#promptText')).includes('chest'));
const c0 = (await state()).coins;
await page.keyboard.press('e');
await steps(80);
s = await state();
check('chest opens', await G(() => window.__lumen.places.chests[0].opened));
check('chest coins collected', s.coins >= c0 + 10, `${c0} -> ${s.coins}`);

// Sword: three hits pop a slime, which drops coins.
const slimeTest = await G(async () => {
  const g = window.__lumen;
  g.player.place(60, -40, 0);
  const sl = g.slimes.list.find((x) => !x.nightOnly);
  sl.alive = true; sl.hp = 3; sl.group.visible = true;
  const before = g.coins;
  let hits = 0;
  for (let k = 0; k < 3; k++) {
    sl.pos.set(60, g.groundAt(60, -38.4), -38.4); sl.vel.set(0, 0, 0); sl.nextHop = g.now + 1e6;
    g.player.place(60, -40, 0);
    g.player.hurtUntil = g.now + 1e6;
    g.player.attack(g.now);
    for (let i = 0; i < 20; i++) g.step(0.02);
    hits++;
  }
  for (let i = 0; i < 80; i++) g.step(0.033);
  return { alive: sl.alive, coins: g.coins - before };
});
check('three sword hits pop a slime', !slimeTest.alive);
check('slime drops coins', slimeTest.coins >= 1, `+${slimeTest.coins}`);

// Getting hurt, and waking up in the village after losing every heart.
const hurt = await G(() => {
  const g = window.__lumen;
  g.player.place(60, -40, 0);
  g.player.hurtUntil = 0;
  const sl = g.slimes.list.find((x) => !x.nightOnly && x.alive) || g.slimes.list[0];
  sl.alive = true; sl.group.visible = true;
  sl.pos.copy(g.player.pos); sl.nextHop = g.now + 1e6;
  g.step(0.016);
  const after = g.player.hearts;
  sl.pos.set(500, 0, 500); sl.home = { x: 150, z: 150 };
  return after;
});
check('a slime hurts the player', hurt === 4, `hearts ${hurt}`);
await G(() => {
  const g = window.__lumen;
  g.player.hearts = 1; g.player.hurtUntil = 0;
  const sl = g.slimes.list.find((x) => !x.nightOnly && x.alive);
  sl.pos.copy(g.player.pos); sl.nextHop = g.now + 1e6;
  g.step(0.016);
  sl.pos.set(500, 0, 500);
});
await steps(70);
s = await state();
check('screen fades back in', !(await G(() => document.getElementById('fade').classList.contains('on'))));
check('waking up in the village after fainting', Math.hypot(s.pos[0], s.pos[2]) < 15 && s.hearts === 5, `at ${s.pos.map((v) => v.toFixed(0))}, hearts ${s.hearts}`);

// Slimes keep out of the village.
check('no slimes in the village', await G(() => window.__lumen.slimes.list.every((x) => !x.alive || Math.hypot(x.pos.x, x.pos.z) >= 39.9)));

// Swimming in the lake.
await G(() => { const g = window.__lumen; g.player.place(72 + 20, 64, 0); for (let i = 0; i < 10; i++) g.step(0.033); });
check('swims in deep water', (await state()).swimming);

// The edge of the world holds the player in.
await G(() => { const g = window.__lumen; g.player.place(0, 199, 0); });
await page.keyboard.down('w');
await steps(40);
await page.keyboard.up('w');
check('can\'t leave the vale', await G(() => Math.hypot(window.__lumen.player.pos.x, window.__lumen.player.pos.z) <= 200.01));

// Night: stars, glowing lanterns and mushrooms.
await G(() => { const g = window.__lumen; g.sky.setTime(0.02); g.player.place(-64, 113, 0); g.cam.yaw = Math.PI; g.cam.pitch = 0.35; g.step(0.016); g.step(0.016); });
s = await state();
check('night falls', s.night > 0.9, s.night.toFixed(2));
check('stars come out', await G(() => window.__lumen.sky.stars.material.opacity > 0.8));
check('night slimes come out', await G(() => window.__lumen.slimes.list.some((x) => x.nightOnly && x.group.visible)));
check('camera isn\'t blocked by the mushrooms', await G(() => {
  const g = window.__lumen, t = g.player.pos.clone().setY(g.player.pos.y + 1.6);
  const d = g.camera.position.clone().sub(t);
  g.ray.set(t, d.clone().normalize()); g.ray.far = d.length() - 0.05;
  return g.ray.intersectObjects(g.solids, false).length === 0;
}));
await shot('05_night_grove');
await G(() => { const g = window.__lumen; g.player.place(0, 14, Math.PI); g.cam.yaw = 0; g.cam.pitch = 0.3; g.step(0.016); });
check('village lanterns lit at night', await G(() => window.__lumen.places.lanterns[0].lampMat.emissiveIntensity > 1));
await shot('06_night_village');

// Saving and continuing.
await G(() => { const g = window.__lumen; g.sky.setTime(0.4); g.player.place(10, 30, 0); g.save(); });
await loadGame();
check('Continue offered with a save', await page.isVisible('#continueBtn'));
await page.click('#continueBtn');
await steps(2);
s = await state();
check('save restores the quest', s.quest === 'done' && s.shards === 5, `${s.quest}, ${s.shards} shards`);
check('save restores position', Math.abs(s.pos[0] - 10) < 0.5 && Math.abs(s.pos[2] - 30) < 0.5);
check('opened chests stay open', await G(() => window.__lumen.places.chests[0].opened));
await shot('07_day');

check('no errors in the console', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
