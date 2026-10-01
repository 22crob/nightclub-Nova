// Smoke test: opens the built game (dist/index.html, straight from disk like
// a player double-clicking it) in headless Chromium and plays through the
// core loop. Run with `npm test` (builds first).
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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// Screen position of a tile's centre, for clicking on it.
const tileXY = (gx, gy) => page.evaluate(([gx, gy]) => {
  const s = window.__clubNova.scene.getScene('club');
  const { sx, sy } = s.gridToScreen(gx, gy);
  return { x: s.world.x + sx * s.world.scaleX, y: s.world.y + sy * s.world.scaleY };
}, [gx, gy]);
const state = () => page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return {
    cash: s.cash, fans: s.fans, placed: s.placedCount(), patrons: s.patrons.length,
    textures: ['bar_0', 'bar_90', 'bar_180', 'bar_270', 'dj_club_0', 'dj_wood_90', 'dj_ice_270', 'patron_0', 'patron_11']
      .filter((k) => !s.textures.exists(k)),
  };
});
const clickTile = async (gx, gy, button = 'left') => {
  const { x, y } = await tileXY(gx, gy);
  await page.mouse.move(x, y);
  await page.mouse.move(x + 1, y);
  await page.mouse.click(x, y, { button });
  await page.waitForTimeout(150);
};
const waitForScene = () => page.waitForFunction(() => {
  const s = window.__clubNova && window.__clubNova.scene.getScene('club');
  return s && s.world && s.sys.settings.status >= 5; // RUNNING
});

// Fresh start.
await page.goto(gameUrl);
await page.evaluate(() => localStorage.clear());
await page.reload();
await waitForScene();

let st = await state();
check('starts with $700 and an empty club', st.cash === 700 && st.placed === 0, `cash ${st.cash}, placed ${st.placed}`);
check('all sprites loaded', st.textures.length === 0, st.textures.join(', ') || 'none missing');

// Tips are paused while the checks below compare exact cash amounts.
await page.evaluate(() => { window.__clubNova.scene.getScene('club').collectPatronTip = () => {}; });

// Shop opens with every tab.
await page.click('#shopToggle');
const tabs = await page.locator('.shopTab').allTextContents();
check('shop opens with 8 tabs', tabs.length === 8 && tabs.includes('Staff'), tabs.join(' / '));
check('bar shows its real sprite icon', await page.locator('.propButton .icon').first().evaluate((el) => el.style.backgroundImage.includes('data:image/png')));
await page.click('#shopClose');

// Place the Starter Bar (selected by default, $100) and a Wood Booth ($180).
await clickTile(2, 5);
st = await state();
check('placing a Starter Bar costs $100', st.cash === 600 && st.placed === 1, `cash ${st.cash}`);

await page.click('#shopToggle');
await page.click('.shopTab:has-text("DJ Booths")');
await page.locator('.propButton').first().click();
await clickTile(5, 5);
st = await state();
check('placing a Wood Booth costs $180', st.cash === 420 && st.placed === 2, `cash ${st.cash}`);

// The bar sprite spans exactly its 1x3 footprint: 4 half-tiles across,
// plus the render script's small crop margin.
const barWidth = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return s.placed['2,5'].gameObject.displayWidth;
});
check('bar sprite matches its footprint width', barWidth >= 128 && barWidth <= 136, `${barWidth}px for a 128px footprint`);

// Draw order: a prop nearer the camera is drawn over one behind it, even
// when the one behind is bought later.
const order = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const cashBefore = s.cash;
  s.selectedProp = 'plant'; s.cash += 1000;
  s.placeProp(1, 1);
  const behind = s.placed['1,1'].gameObject;
  const front = s.placed['2,5'].gameObject;
  const ok = s.propLayer.getIndex(behind) < s.propLayer.getIndex(front);
  s.sellProp(1, 1); s.cash = cashBefore; s.selectedProp = 'dj';
  return ok;
});
check('props draw back to front', order);

// Every bar tier is in the shop, and bars draw as two layers with room for
// the bartender between them.
const tiers = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const rec = s.placed['2,5'];
  return {
    layered: !!rec.frontObject && rec.frontObject.depth > rec.gameObject.depth,
    bars: ['starterBar', 'woodBar', 'bar', 'neonBar', 'iceBar'].filter((k) => s.hasLayerSprites(k)).length,
    booths: ['woodBooth', 'proBooth', 'dj', 'neonBooth', 'iceBooth'].filter((k) => s.hasAnySprite(k)).length,
  };
});
check('all five bar tiers load, each in two layers', tiers.bars === 5, `${tiers.bars} of 5`);
check('a bar facing the camera draws its counter in front', tiers.layered);
check('all five DJ booth tiers load', tiers.booths === 5, `${tiers.booths} of 5`);

// Placing on an occupied tile is refused.
await clickTile(5, 5);
st = await state();
check('occupied tile is refused', st.cash === 420 && st.placed === 2, JSON.stringify({ cash: st.cash, placed: st.placed }));

// Rotate the placed booth (hover + R).
const before = await page.evaluate(() => window.__clubNova.scene.getScene('club').placed['5,5'].facing);
const { x: rx, y: ry } = await tileXY(5, 5);
await page.mouse.move(rx, ry); await page.mouse.move(rx + 1, ry);
await page.keyboard.press('r');
const after = await page.evaluate(() => window.__clubNova.scene.getScene('club').placed['5,5'].facing);
check('R rotates a placed DJ booth', after === (before + 90) % 360, `${before} -> ${after}`);

// Staff: without them, the DJ booth earns no fans and the bar sells nothing.
const unstaffedRate = await page.evaluate(() => window.__clubNova.scene.getScene('club').totalFanRate());
check('unstaffed DJ booth earns no fans', unstaffedRate === 0, `rate ${unstaffedRate}`);
await page.keyboard.press('Escape');
await page.click('#staffButton');
const staffRows = await page.locator('.staffRow').count();
check('Staff tab lists the bar and the DJ booth', staffRows === 2, `${staffRows} rows`);
await page.locator('.staffButton.hire').first().click();
await page.locator('.staffButton.hire').first().click();
await page.click('#shopClose');
const staffed = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return { cash: s.cash, music: s.musicPlaying(), working: s.staffableRecords().filter((r) => r.staff).length, rate: s.totalFanRate() };
});
check('hiring a bartender ($50) and a DJ ($80)', staffed.cash === 290 && staffed.working === 2, JSON.stringify(staffed));
await page.evaluate(() => { delete window.__clubNova.scene.getScene('club').collectPatronTip; });
check('a working DJ plays music and earns fans', staffed.music && staffed.rate > 0, JSON.stringify(staffed));

// Patrons arrive, get thirsty, buy drinks, earn fans and tip.
await page.waitForTimeout(24000);
st = await state();
check('patrons arrive', st.patrons > 0, `${st.patrons} on the floor`);
const looks = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return s.patrons.map((p) => ({ tex: p.container.patronSprite && p.container.patronSprite.texture.key, anim: p.container.patronSprite && p.container.patronSprite.anims.currentAnim && p.container.patronSprite.anims.currentAnim.key }));
});
check('patrons use chibi characters and play an animation', looks.length > 0 && looks.every((l) => /^patron_\d+$/.test(l.tex) && /^patron_\d+_(idle|walk|dance)_(front|back)$/.test(l.anim)), JSON.stringify(looks[0]));

// Facing: moving down-screen shows the front, up-screen the back, and the
// sprite is mirrored for the right-hand diagonals.
const facing = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const p = s.patrons[0];
  const c = p.container;
  const out = {};
  for (const [name, dx, dy] of [['downLeft', -10, 10], ['downRight', 10, 10], ['upLeft', -10, -10], ['upRight', 10, -10]]) {
    s.faceToward(p, c.x + dx, c.y + dy);
    out[name] = `${c.patronDir}${c.scaleX < 0 ? ' mirrored' : ''}`;
  }
  return out;
});
check('patrons face the way they walk', facing.downLeft === 'front' && facing.downRight === 'front mirrored' && facing.upRight === 'back' && facing.upLeft === 'back mirrored', JSON.stringify(facing));
check('fans grow over time', st.fans > 5, `${st.fans.toFixed(1)} fans`);
const drinks = await page.evaluate(() => window.__clubNova.scene.getScene('club').drinksSold || 0);
check('patrons buy drinks at the staffed bar', drinks > 0, `${drinks} drinks sold`);

// Mood: drinks cheer patrons up, the Vibe readout shows the average, very
// unhappy patrons storm out, and leaving patrons bring fans by mood.
const mood = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const p = s.patrons.find((x) => !x.leaving && !x.gone);
  const out = { vibeText: document.getElementById('vibeVal').textContent };
  p.mood = 50; s.cheerPatron(p, 15); out.cheered = p.mood;
  const fake = (extra) => ({ mood: 80, container: { x: 0, y: 0 }, ...extra });
  const f0 = s.fans; s.patronLeaves(fake({})); out.happyFans = Math.round(s.fans - f0);
  const f1 = s.fans; s.patronLeaves(fake({ stormedOut: true })); out.angryFans = Math.round(s.fans - f1);
  p.mood = 10; s.updatePatronMood(p, 0.1); out.stormed = p.leaving && p.stormedOut;
  return out;
});
check('Vibe shows the club mood', /^\d+%$/.test(mood.vibeText), mood.vibeText);
check('a drink cheers a patron up', mood.cheered === 65, `mood ${mood.cheered}`);
check('happy patrons bring 3 fans, angry ones cost 2', mood.happyFans === 3 && mood.angryFans === -2, JSON.stringify(mood));
check('a very unhappy patron storms out', mood.stormed === true);

// Wages: $4 + $6 every 30 seconds; if the club can't pay, staff quit.
const wages = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const before = s.cash;
  s.payWages();
  const paid = before - s.cash;
  s.cash = 3;
  s.payWages();
  const left = s.staffableRecords().filter((r) => r.staff).length;
  const cashAfter = s.cash;
  s.cash += 500;
  s.hireStaff(s.placed['5,5']); // re-hire the DJ for the save test below
  return { paid, left, cashAfter };
});
check('wages are paid', wages.paid === 10, `paid $${wages.paid}`);
check('unpaid staff quit instead of going into debt', wages.left === 0 && wages.cashAfter === 3, JSON.stringify(wages));
await page.screenshot({ path: path.join(shotDir, 'club.png') });

// Right-click sells for half price. Wages are paused so a payday landing
// mid-check can't skew the sum.
await page.evaluate(() => { window.__clubNova.scene.getScene('club').payWages = () => {}; });
const cashBeforeSell = (await state()).cash;
await page.keyboard.press('Escape');
await clickTile(2, 5, 'right');
st = await state();
check('right-click sells the bar for half price ($50)', st.placed === 1 && st.cash - cashBeforeSell >= 50 && st.cash - cashBeforeSell < 75, `+$${st.cash - cashBeforeSell}`);
await page.evaluate(() => { delete window.__clubNova.scene.getScene('club').payWages; });

// Save survives a reload. The game also saves as the page unloads, so
// compare what was restored with what's actually in the save.
await page.evaluate(() => window.__clubNova.scene.getScene('club').saveGame());
await page.reload();
await waitForScene();
const restored = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const saved = JSON.parse(localStorage.getItem('clubNovaSave_v1'));
  return { savedPlaced: saved.placed.length, savedCash: Math.floor(saved.cash), placed: s.placedCount(), cash: Math.floor(s.cash) };
});
check('save restores after reload', restored.placed === restored.savedPlaced && Math.abs(restored.cash - restored.savedCash) <= 20, JSON.stringify(restored));
const djAfterReload = await page.evaluate(() => !!window.__clubNova.scene.getScene('club').placed['5,5'].staff);
check('hired staff are saved', djAfterReload);

// Zoom buttons change the zoom and stay within limits.
const zoom0 = await page.evaluate(() => window.__clubNova.scene.getScene('club').world.scaleX);
await page.click('#zoomIn');
const zoom1 = await page.evaluate(() => window.__clubNova.scene.getScene('club').world.scaleX);
for (let i = 0; i < 20; i++) await page.click('#zoomOut');
const zoom2 = await page.evaluate(() => window.__clubNova.scene.getScene('club').world.scaleX);
check('zoom buttons zoom in and out within limits', zoom1 > zoom0 && Math.abs(zoom2 - 0.6) < 1e-6, `${zoom0.toFixed(2)} -> ${zoom1.toFixed(2)} -> ${zoom2.toFixed(2)}`);

// Dance floors: nine designs, the animated ones move only while the DJ
// plays, and a Step Floor lights up under a patron.
const floors = await page.evaluate(async () => {
  const s = window.__clubNova.scene.getScene('club');
  const floorKeys = ['plainFloor', 'dance', 'woodFloor', 'glowFloor', 'neonFloor', 'ringFloor', 'waveFloor', 'rainbowFloor', 'stepFloor'];
  const missing = floorKeys.filter((k) => !s.textures.exists(`floor_${{ plainFloor: 'plain', dance: 'checker', woodFloor: 'parquet', glowFloor: 'glow', neonFloor: 'lightUp', ringFloor: 'neonRings', waveFloor: 'wave', rainbowFloor: 'rainbow', stepFloor: 'step' }[k]}_0`));
  const wave = s.restoreProp('waveFloor', 0, [9, 9]);
  const step = s.restoreProp('stepFloor', 0, [10, 9]);
  const music = s.musicPlaying();
  const flowing = [[8, 9], [8, 10], [9, 10], [10, 10], [11, 10]].map(([x, y], i) => s.restoreProp(i % 2 ? 'rainbowFloor' : 'waveFloor', 0, [x, y]));
  const frames = new Set();
  const broken = new Set();
  for (let i = 0; i < 30; i++) {
    s.animateFloors();
    frames.add(wave.gameObject.floorFrame);
    for (const rec of flowing) if (rec.gameObject.texture.key === '__MISSING') broken.add(rec.type);
  }
  const patron = s.patrons.find((p) => !p.gone);
  let lit = null;
  if (patron) { patron.gx = 10; patron.gy = 9; s.animateFloors(); lit = step.gameObject.floorFrame; }
  return { missing, music, waveFrames: frames.size, lit, broken: [...broken] };
});
check('all nine dance floor designs are drawn', floors.missing.length === 0, floors.missing.join(', ') || '9 of 9');
check('an animated floor moves while the DJ plays', floors.music && floors.waveFrames > 3, `${floors.waveFrames} frames`);
check('every animated floor tile always has a picture', floors.broken.length === 0, floors.broken.join(', ') || 'none blank');
check('a Step Floor lights up under a patron', floors.lit === 7, `frame ${floors.lit}`);

// Wallpaper: pick one in the shop, click a wall section to paint it.
const wallXY = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  s.selectProp('wpBrick');
  const paint = s.paintWall.bind(s);
  s.paintCosts = [];
  s.paintWall = (section) => { const before = s.cash; paint(section); s.paintCosts.push(before - s.cash); };
  // Middle of right-wall section 3, half way up.
  const { x, y } = s.wallSectionOrigin('R3');
  const lx = x + 16, ly = y + 8 + 64 + 16;
  return { x: s.world.x + lx * s.world.scaleX, y: s.world.y + ly * s.world.scaleY, hit: s.wallSectionAt(lx, ly) };
});
await page.mouse.move(wallXY.x, wallXY.y);
await page.mouse.click(wallXY.x, wallXY.y);
await page.waitForTimeout(150);
const wall = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const saved = JSON.parse(localStorage.getItem('clubNovaSave_v1'));
  const img = s.wallImages && s.wallImages.R3;
  s.wallpaper.L1 = 'wpLed'; s.drawWallSection('L1', 'wpLed');
  const frames = new Set();
  for (let i = 0; i < 10; i++) { s.animateFloors(); frames.add(s.wallImages.L1.wallFrame); }
  s.deselectProp();
  delete s.paintWall;
  return { costs: s.paintCosts, painted: s.wallpaper.R3, saved: saved.wallpaper && saved.wallpaper.R3, visible: !!img && img.texture.key !== '__MISSING', ledFrames: frames.size };
});
check('clicking a wall paints it with wallpaper ($15)', wall.painted === 'wpBrick' && wall.costs.join() === '15' && wall.visible, `${wallXY.hit} -> ${wall.painted}, paid ${wall.costs.join()}`);
check('wallpaper is saved', wall.saved === 'wpBrick');
check('animated wallpaper moves while the DJ plays', wall.ledFrames > 3, `${wall.ledFrames} frames`);

// The doorway tile can't be blocked with furniture (floor tiles are fine).
const door = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return { solid: s.footprintValid([[0, 0]], 'plant'), floor: s.footprintValid([[0, 0]], 'dance') };
});
check('furniture can\'t block the front door', door.solid === false && door.floor === true, JSON.stringify(door));

// Seating: every piece has its art, and a patron can sit on a couch (drawn
// between its two layers), feel better for it, and get up again.
const seating = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const keys = ['woodStool', 'couch', 'table', 'barStool', 'leatherCouch', 'vipLounge', 'blackBooth', 'goldBooth'];
  const missing = keys.filter((k) => !(k === 'table' ? s.hasAnySprite(k) : s.hasLayerSprites(k)));
  const couch = s.restoreProp('couch', 0, [1, 11]);
  const p = s.patrons.find((q) => !q.leaving && !q.gone);
  if (!couch || !p) return { missing, error: !couch ? 'no couch' : 'no patron' };
  s.tweens.killTweensOf(p.container);
  p.moving = false;
  s.releaseSeat(p);
  const claimed = s.claimSeat(p);
  s.sitDown(p);
  const d = p.container.depth;
  const between = d > couch.gameObject.depth && d < couch.frontObject.depth;
  const taken = couch.seatTaken.includes(p);
  const fun0 = p.fun;
  s.updatePatronMood(p, 2);
  const funUp = p.fun > fun0;
  s.releaseSeats(couch);
  return { missing, claimed, sitting: between && taken, funUp, freed: !p.sitting && !p.seat && couch.seatTaken.length === 0 };
});
check('all eight seating pieces have their art', seating.missing.length === 0, seating.missing.join(', ') || '8 of 8');
check('a patron sits on a couch, between its layers', seating.claimed && seating.sitting, JSON.stringify(seating));
check('sitting cheers a patron up', seating.funUp);
check('selling or turning seating gets everyone up', seating.freed);

// Decorations: all sixteen have their sprites, and one can be placed and
// rotated like any other prop.
const decor = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const keys = ['crates', 'plant', 'woodSpeaker', 'discoBall', 'velvetRope', 'palm', 'lavaLamp', 'speakerTower',
    'neonSign', 'glowTube', 'poolTable', 'spotlight', 'aquarium', 'neonSpeaker', 'trophy', 'luckyCat'];
  const missing = keys.filter((k) => !s.hasAnySprite(k));
  const pool = s.restoreProp('poolTable', 90, [10, 2]);
  return { missing, poolTiles: pool ? pool.tiles.length : 0, poolTex: pool && pool.gameObject.texture.key };
});
check('all sixteen decorations have their art', decor.missing.length === 0, decor.missing.join(', ') || '16 of 16');
check('the pool table takes two tiles', decor.poolTiles === 2 && decor.poolTex === 'decor_pool_90', `${decor.poolTiles} tiles, ${decor.poolTex}`);

check('no errors in the page', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
