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
// The level-up menu would cover the buttons the checks click, so it stays
// shut here; it's checked on its own further down.
const waitForScene = async () => {
  await page.waitForFunction(() => {
    const s = window.__clubNova && window.__clubNova.scene.getScene('club');
    return s && s.world && s.sys.settings.status >= 5; // RUNNING
  });
  await page.evaluate(() => { window.__clubNova.scene.getScene('club').showLevelUp = () => {}; });
};

// Fresh start.
await page.goto(gameUrl);
await page.evaluate(() => localStorage.clear());
await page.reload();
await waitForScene();

const heldAtStart = await page.evaluate(() => window.__clubNova.scene.getScene('club').selectedProp);
check('you start with nothing in hand, just the cursor', heldAtStart === null, String(heldAtStart));
let st = await state();
const opening = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const booth = s.clubBooth();
  const units = s.hireableRecords().filter((rec) => rec.type === 'starterBar');
  const bar = units.find((rec) => rec.staff);
  const floor = Object.keys(s.placed).filter((k) => s.placed[k].type === 'basicFloor').sort();
  return { floor: floor.join(' '), dancing: s.isDanceFloorTile(2, 6), type: booth && booth.type, anchor: booth && booth.anchor.join(','), dj: !!(booth && booth.staff), music: s.musicPlaying(), size: s.gridSize, bar: units.map((r) => r.anchor.join(',')).sort().join(' '), bartender: !!bar, staffed: units.filter((r) => r.staff).length, worked: units.every((r) => s.isWorked(r)), boothTiles: booth && booth.tiles.length, djOnTile: !!booth && (() => { const p = s.gridToScreen(0, 5.5); return Math.abs(booth.staff.container.x - p.sx) < 1 && Math.abs(booth.staff.container.y - p.sy) < 1 && booth.tiles.filter((t) => t.back).length === 2; })() };
});
check('starts with $700, a 10x10 room, a 2-tile DJ booth, a 3x3 dance floor and a 4-long bar with one bartender', st.cash === 700 && st.placed === 14 && opening.boothTiles === 4 && opening.djOnTile && opening.floor === '2,5 2,6 2,7 3,5 3,6 3,7 4,5 4,6 4,7' && opening.dancing && opening.size === 10 && opening.bar === '6,0 7,0 8,0 9,0' && opening.bartender && opening.staffed === 1 && opening.worked, `cash ${st.cash}, placed ${st.placed}, ${JSON.stringify(opening)}`);
check('every club opens with a Wood Booth and a DJ playing', opening.type === 'woodBooth' && opening.anchor === '1,5' && opening.dj && opening.music, JSON.stringify(opening));

// The checks below were written for the old opening (a 16x16 room with just
// the DJ booth, saved at 6,0 against the wall, from before the DJ had
// their own tiles: loading moves it out to 6,1).
await page.evaluate(() => {
  window.__clubNova.scene.getScene('club').restarting = true; // don't save over it on the way out
  localStorage.setItem('clubNovaSave_v2', JSON.stringify({
    cash: 700, fans: 0, gridSize: 16, placed: [{ type: 'woodBooth', facing: 0, anchor: [6, 0], staff: true }], wallpaper: {}, floorPaint: {},
  }));
});
await page.reload();
await waitForScene();
check('all sprites loaded', st.textures.length === 0, st.textures.join(', ') || 'none missing');

// Tips are paused while the checks below compare exact cash amounts.
await page.evaluate(() => { const s = window.__clubNova.scene.getScene('club'); s.collectPatronTip = () => {}; s.chargeCover = () => {}; });

// The shop dock: five tabs. Decorations opens the store: a row of seven
// drawn categories (floors and dance floors together, Staff among them)
// and OK to go back.
const tabs = await page.$$eval('.dockTab', (els) => els.map((e) => e.dataset.tipName));
await page.click('#tabDecor');
const storeTabs = await page.$$eval('.storeTab', (els) => els.map((e) => e.dataset.tipName));
check('the dock has Decorations, Inventory, Edit, Staff, Expand and VIP tabs; the store has 6 categories', tabs.join() === 'Decorations,Inventory,Edit,Staff,Expand,VIPs' && storeTabs.join() === 'Bars,Seating,Floors,Wallpaper,Decorations,DJ Booths', `${tabs.join(' / ')} | ${storeTabs.join(' / ')}`);
check('bar shows its real sprite icon', await page.locator('.propButton .icon').first().evaluate((el) => el.style.backgroundImage.includes('data:image/png')));
// Floors: dance floors and regular floors in one category, the tip says which.
await page.click('.storeTab[data-tip-name="Floors"]');
const floorTips = await page.$$eval('#shopItems .propSlot', (els) => els.map((e) => e.dataset.tipText));
check('dance floors and regular floors share one category, and the tip says which', floorTips.some((t) => /^Dance floor/.test(t)) && floorTips.some((t) => /^Regular floor/.test(t)) && floorTips.every((t) => /Luxury: \d+/.test(t)), floorTips.length + ' floors');
// Floors unlock one a level, taking turns: regular, dance, regular, ...
const floorOrder = await page.$$eval('#shopItems .propSlot', (els) => els.map((e) => /^Dance/.test(e.dataset.tipText) ? 'D' : 'R').join(''));
check('floors alternate regular and dance floors, one per level (plus the Basic dance floor at level 1)', floorOrder === 'RDDRDRDRDRDRDRDRDD', floorOrder);
// Clicking a card picks the item up; clicking it again puts it down.
await page.click('.storeTab[data-tip-name="Seating"]');
await page.locator('.propSlot').first().click();
const picked = await page.evaluate(() => ({ held: window.__clubNova.scene.getScene('club').selectedProp, glow: !!document.querySelector('.propButton.selected') }));
await page.locator('.propSlot').first().click();
const closed = await page.evaluate(() => ({ held: window.__clubNova.scene.getScene('club').selectedProp }));
check('clicking a shop card picks the item up, clicking again puts it down', picked.held === 'woodStool' && picked.glow && !closed.held, JSON.stringify({ picked, closed }));
await page.click('#storeOk');
// Expand: one card with the next size and its price.
await page.click('#tabExpand');
const expandCard = await page.evaluate(() => ({ cards: document.querySelectorAll('#shopItems .propSlot').length, tip: document.querySelector('#shopItems .propSlot')?.dataset.tipText, price: document.querySelector('#shopItems .propCost')?.textContent }));
check('the Expand tab shows the next size up and its price', expandCard.cards === 1 && /Grow from \d+×\d+ to \d+×\d+/.test(expandCard.tip) && /\$|Lv/.test(expandCard.price), JSON.stringify(expandCard));
await page.click('#tabDecor');
await page.evaluate(() => window.__clubNova.scene.getScene('club').selectProp('starterBar'));

// Place the Starter Bar (selected by default, $100).
await clickTile(2, 5);
st = await state();
check('placing a Starter Bar costs $100', st.cash === 600 && st.placed === 2, `cash ${st.cash}`);

// The bar sprite spans exactly its 1x3 footprint: 4 half-tiles across,
// plus the render script's small crop margin.
const barWidth = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return s.placed['2,5'].gameObject.displayWidth;
});
check('bar sprite matches its 1x3 footprint', barWidth >= 94 && barWidth <= 104, `${barWidth}px for a 96px footprint`);

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
  s.sellProp(1, 1); s.cash = cashBefore; s.selectedProp = 'starterBar';
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
await clickTile(2, 5);
st = await state();
check('occupied tile is refused', st.cash === 600 && st.placed === 2, JSON.stringify({ cash: st.cash, placed: st.placed }));

// Rotate the DJ booth (hover + R).
const moved = await page.evaluate(() => { const b = window.__clubNova.scene.getScene('club').clubBooth(); return b && b.anchor.join(','); });
check('an old booth against the wall moves out a tile, so the DJ has room behind it', moved === '6,1', moved);
const before = await page.evaluate(() => window.__clubNova.scene.getScene('club').placed['6,1'].facing);
const { x: rx, y: ry } = await tileXY(6, 1);
await page.mouse.move(rx, ry); await page.mouse.move(rx + 1, ry);
await page.keyboard.press('r');
const after = await page.evaluate(() => window.__clubNova.scene.getScene('club').placed['6,1'].facing);
check('R rotates the DJ booth', after === (before + 90) % 360, `${before} -> ${after}`);

// The DJ earns fans from the start; the bar needs a bartender.
const openingRate = await page.evaluate(() => window.__clubNova.scene.getScene('club').totalFanRate());
check('the DJ booth earns fans from the start', openingRate > 0, `rate ${openingRate}`);
await page.keyboard.press('Escape');
await page.evaluate(() => window.__clubNova.scene.getScene('club').setDockTab('inventory'));
await page.click('#tabStaff');
const staffRows = await page.locator('.staffSlot').count();
check('Staff lists just the bar (the DJ is free)', staffRows === 1, `${staffRows} cards`);
await page.locator('.staffSlot:not(.staffed)').first().click();
const staffed = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return { cash: s.cash, music: s.musicPlaying(), bartenders: s.hireableRecords().filter((r) => r.staff).length };
});
check('hiring a bartender costs $50', staffed.cash === 550 && staffed.bartenders === 1 && staffed.music, JSON.stringify(staffed));
await page.evaluate(() => { const s = window.__clubNova.scene.getScene('club'); delete s.collectPatronTip; delete s.chargeCover; });

// Patrons arrive, get thirsty, buy drinks, earn fans and tip.
const fansBefore = (await state()).fans;
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
check('fans grow over time', st.fans > fansBefore + 3, `${fansBefore.toFixed(1)} -> ${st.fans.toFixed(1)} fans`);
// Patrons want their first drink 3-18s after arriving, so give it time.
await page.waitForFunction(() => (window.__clubNova.scene.getScene('club').drinksSold || 0) > 0, null, { timeout: 30000 }).catch(() => {});
const drinks = await page.evaluate(() => window.__clubNova.scene.getScene('club').drinksSold || 0);
check('patrons buy drinks at the staffed bar', drinks > 0, `${drinks} drinks sold`);

// Mood: drinks cheer patrons up (there's no Vibe readout any more), very
// unhappy patrons storm out, and leaving patrons bring fans by mood.
const mood = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const p = s.patrons.find((x) => !x.leaving && !x.gone);
  const out = { vibeHidden: !document.getElementById('vibeVal') };
  p.mood = 50; s.cheerPatron(p, 15); out.cheered = p.mood;
  const fake = (extra) => ({ mood: 80, container: { x: 0, y: 0 }, ...extra });
  const f0 = s.fans; s.patronLeaves(fake({})); out.happyFans = Math.round(s.fans - f0);
  const f1 = s.fans; s.patronLeaves(fake({ stormedOut: true })); out.angryFans = Math.round(s.fans - f1);
  p.mood = 10; s.updatePatronMood(p, 0.1); out.stormed = p.leaving && p.stormedOut;
  return out;
});
check('there is no Vibe readout', mood.vibeHidden);
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
  const left = s.hireableRecords().filter((r) => r.staff).length;
  const cashAfter = s.cash;
  s.cash += 500;
  const dj = !!s.clubBooth().staff;
  return { paid, left, cashAfter, dj };
});
check('wages are paid (the DJ is free)', wages.paid === 4, `paid $${wages.paid}`);
check('unpaid bartenders quit; the DJ never does', wages.left === 0 && wages.cashAfter === 3 && wages.dj, JSON.stringify(wages));
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
  const saved = JSON.parse(localStorage.getItem('clubNovaSave_v2'));
  return { savedPlaced: saved.placed.length, savedCash: Math.floor(saved.cash), placed: s.placedCount(), cash: Math.floor(s.cash) };
});
check('save restores after reload', restored.placed === restored.savedPlaced && Math.abs(restored.cash - restored.savedCash) <= 20, JSON.stringify(restored));
const djAfterReload = await page.evaluate(() => { const b = window.__clubNova.scene.getScene('club').clubBooth(); return !!b && !!b.staff && b.anchor.join(',') === '6,1'; });
check('the DJ booth and its DJ come back after reload', djAfterReload);

// The DJ booth can't be sold, only upgraded in place (paying the new price
// less half the old one's).
const upgrade = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const fans = s.fans;
  s.fans = Math.max(s.fans, 150); // level 2, for the Pro Booth
  const c0 = s.cash;
  s.sellProp(6, 0);
  const kept = !!s.clubBooth() && s.cash === c0;
  s.cash = 1000;
  const ok = s.upgradeClubBooth('proBooth');
  const b = s.clubBooth();
  const result = { kept, ok, type: b.type, anchor: b.anchor.join(','), dj: !!b.staff, paid: 1000 - s.cash, booths: s.staffableRecords().filter((r) => r.staff && r.staff.kind === 'dj').length };
  s.fans = fans;
  return result;
});
check('the DJ booth can\'t be sold', upgrade.kept, JSON.stringify(upgrade));
check('upgrading the booth swaps it in place ($215 - $90)', upgrade.ok && upgrade.type === 'proBooth' && upgrade.anchor === '6,1' && upgrade.dj && upgrade.paid === 125 && upgrade.booths === 1, JSON.stringify(upgrade));

// Drop the Bass: a 90-second boost, then a cooldown.
const boost = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const started = s.startBoost();
  const during = { boosted: s.isBoosted(), factor: s.boostFactor(), button: document.getElementById('boostButton').dataset.state, label: document.getElementById('boostLabel').textContent };
  const again = s.startBoost();
  s.boostUntil = s.time.now - 1; // skip to the end
  s.tickBoost();
  const afterEnd = { boosted: s.isBoosted(), button: document.getElementById('boostButton').dataset.state, canBoost: s.canBoost() };
  s.boostReadyAt = 0; s.tickBoost(); // skip the cooldown so later checks aren't affected
  return { started, during, again, afterEnd };
});
check('Drop the Bass starts a 90-second boost', boost.started && boost.during.boosted && boost.during.factor === 2 && boost.during.button === 'active' && /1:(30|29)/.test(boost.during.label), JSON.stringify(boost.during));
check('the boost can\'t be stacked, and has a cooldown after', !boost.again && !boost.afterEnd.boosted && boost.afterEnd.button === 'cooldown' && !boost.afterEnd.canBoost, JSON.stringify(boost.afterEnd));

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
  const floorKeys = ['basicFloor', 'plainFloor', 'dance', 'woodFloor', 'glowFloor', 'neonFloor', 'ringFloor', 'waveFloor', 'rainbowFloor', 'stepFloor'];
  const missing = floorKeys.filter((k) => !s.textures.exists(`floor_${{ basicFloor: 'basic', plainFloor: 'plain', dance: 'checker', woodFloor: 'parquet', glowFloor: 'glow', neonFloor: 'lightUp', ringFloor: 'neonRings', waveFloor: 'wave', rainbowFloor: 'rainbow', stepFloor: 'step' }[k]}_0`));
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
  s.selectProp('wpPaint');
  const paint = s.paintWall.bind(s);
  s.paintCosts = [];
  s.paintWall = (section) => { const before = s.cash; paint(section); s.paintCosts.push(before - s.cash); };
  // Middle of right-wall section 3, half way up.
  const { x, y } = s.wallSectionOrigin('R3');
  const lx = x + 12, ly = y + 80;
  return { x: s.world.x + lx * s.world.scaleX, y: s.world.y + ly * s.world.scaleY, hit: s.wallSectionAt(lx, ly) };
});
await page.mouse.move(wallXY.x, wallXY.y);
await page.mouse.click(wallXY.x, wallXY.y);
await page.waitForTimeout(150);
const wall = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const saved = JSON.parse(localStorage.getItem('clubNovaSave_v2'));
  const img = s.wallImages && s.wallImages.R3;
  s.wallpaper.L1 = 'wpLed'; s.drawWallSection('L1', 'wpLed');
  const frames = new Set();
  for (let i = 0; i < 10; i++) { s.animateFloors(); frames.add(s.wallImages.L1.wallFrame); }
  s.deselectProp();
  delete s.paintWall;
  return { costs: s.paintCosts, painted: s.wallpaper.R3, saved: saved.wallpaper && saved.wallpaper.R3, visible: !!img && img.texture.key !== '__MISSING', ledFrames: frames.size };
});
check('clicking a wall paints it with wallpaper ($8)', wall.painted === 'wpPaint' && wall.costs.join() === '8' && wall.visible, `${wallXY.hit} -> ${wall.painted}, paid ${wall.costs.join()}`);
check('wallpaper is saved', wall.saved === 'wpPaint');
check('animated wallpaper moves while the DJ plays', wall.ledFrames > 3, `${wall.ledFrames} frames`);

// The door is at the front end of the left wall, by the line outside; its
// tile can't be blocked with furniture (floor tiles are fine).
const door = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const d = s.doorTile();
  const free = !s.placed[`${d.gx},${d.gy}`];
  return { at: [d.gx, d.gy], size: s.gridSize, solid: s.footprintValid([[d.gx, d.gy]], 'plant'), floor: !free || s.footprintValid([[d.gx, d.gy]], 'dance') };
});
check('the door is at the front of the left wall, and furniture can\'t block it', door.at[0] === 0 && door.at[1] === door.size - 1 && door.solid === false && door.floor === true, JSON.stringify(door));

// Mood lighting: the room is dimmed. Glows under lights are switched off
// for now (MOOD_LIGHTING.glows), so a lava lamp casts none.
const lighting = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const shaded = s.floorShade.commandBuffer.length > 0 && s.wallShade.commandBuffer.length > 0;
  s.cash += 1000;
  const lamp = s.restoreProp('lavaLamp', 0, [11, 6]);
  const glow = !!lamp.lightPool;
  s.sellProp(11, 6);
  return { shaded, glow };
});
check('the room is dimmed, with no glows under lights', lighting.shaded && !lighting.glow, JSON.stringify(lighting));

// Bar lines: customers queue in a straight line out from the counter and
// step up when the front one is served.
const queue = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  s.cash += 500;
  const bar = s.restoreProp('woodBar', 0, [6, 6]);
  s.hireStaff(bar);
  const others = s.staffableRecords().filter((r) => r !== bar && r.staff && r.staff.kind === 'bartender');
  others.forEach((r) => s.detachStaff(r)); // only this bar is open
  const tiles = s.barQueueTiles(bar).map((t) => t.join(','));
  // Two stand-in customers (the line logic only needs these fields).
  const a = { nextMoveAt: 0 };
  const b = { nextMoveAt: 0 };
  s.joinBarQueue(a); s.joinBarQueue(b);
  const before = [[a.targetGx, a.targetGy].join(','), [b.targetGx, b.targetGy].join(',')];
  s.leaveBarQueue(a);
  const after = [b.targetGx, b.targetGy].join(',');
  s.leaveBarQueue(b);
  return { tiles, before, after };
});
check('bar customers line up in a straight row', queue.tiles && queue.tiles.join(' ') === '6,9 6,10 6,11 6,12', JSON.stringify(queue));
check('the line steps up when someone is served', queue.before && queue.before[0] === '6,9' && queue.before[1] === '6,10' && queue.after === '6,9', JSON.stringify(queue));

// Regular floors: pick one and click (or drag across) tiles to paint them.
// It's saved, and patrons don't dance on it.
await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  s.cash += 500;
  s.selectProp('fpConcrete');
  const paint = s.paintFloor.bind(s);
  s.paintCosts = [];
  s.paintFloor = (gx, gy) => { const before = s.cash; const done = paint(gx, gy); if (done) s.paintCosts.push(before - s.cash); return done; };
});
{
  const a = await tileXY(3, 9);
  const b = await tileXY(4, 9);
  await page.mouse.move(a.x, a.y); await page.mouse.move(a.x + 1, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}
const paint = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const saved = JSON.parse(localStorage.getItem('clubNovaSave_v2')).floorPaint || {};
  const r = { a: s.floorPaint['3,9'], b: s.floorPaint['4,9'], costs: s.paintCosts, saved: saved['3,9'], dance: s.isDanceFloorTile(3, 9) };
  delete s.paintFloor;
  s.deselectProp();
  return r;
});
check('dragging paints a stroke of floor ($3 a tile)', paint.a === 'fpConcrete' && paint.b === 'fpConcrete' && paint.costs.length >= 2 && paint.costs.every((c) => c === 3), JSON.stringify(paint));
check('painted floor is saved, and isn\'t a dance floor', paint.saved === 'fpConcrete' && !paint.dance, JSON.stringify(paint));

// Seating: every piece has its art, and a patron can sit on a couch (drawn
// on top of it when facing the camera, else between its two layers), feel better for it, and get up again.
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
  const lo = Math.min(couch.gameObject.depth, couch.frontObject.depth);
  const hi = Math.max(couch.gameObject.depth, couch.frontObject.depth);
  // Facing the camera: on top of the whole piece; facing away: between its layers.
  const between = p.container.patronDir === 'back' ? d > lo && d < hi : d > hi;
  const taken = couch.seatTaken.includes(p);
  const sitAnim = !p.container.patronSprite || String(p.container.patronAnimState).startsWith('sit_');
  const fun0 = p.fun;
  s.updatePatronMood(p, 2);
  const funUp = p.fun > fun0;
  s.releaseSeats(couch);
  return { missing, claimed, sitting: between && taken, sitAnim, funUp, freed: !p.sitting && !p.seat && couch.seatTaken.length === 0 };
});
check('all eight seating pieces have their art', seating.missing.length === 0, seating.missing.join(', ') || '8 of 8');
check('a patron sits on a couch, layered right', seating.claimed && seating.sitting, JSON.stringify(seating));
check('sitting cheers a patron up', seating.funUp);
check('a seated patron plays the sit animation', seating.sitAnim);
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
check('the pool table takes three tiles', decor.poolTiles === 3 && decor.poolTex === 'decor_pool_90', `${decor.poolTiles} tiles, ${decor.poolTex}`);

// The street outside: people line up at the rope and go in one by one.
const street = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const before = s.patrons.length;
  const inLine = s.streetQueue.length;
  const front = s.streetQueue[0];
  if (front) { front.arrived = true; front.walking = false; front.slot = 0; }
  // Make room inside, and clear the doorway.
  s.patronCapacity = () => 99;
  s.patronTileOccupied = () => false;
  s.admitFromLine();
  delete s.patronCapacity;
  delete s.patronTileOccupied;
  return { inLine, after: s.streetQueue.length, before, bouncer: !!s.streetBouncer, lamps: s.streetLamps.commandBuffer.length > 0 };
});
check('the street has a line at the rope, a bouncer and lamps; the front of the line goes in', street.inLine > 0 && street.after === street.inLine - 1 && street.bouncer && street.lamps, JSON.stringify(street));

// Guests have names; clicking one opens their card. A thirsty guest shows a
// drink bubble. Clicking a bartender shows Bottoms Up!, which serves the
// whole line at once and then needs to recover. Luxury grows with what you
// place and raises tips.
const people = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const p = s.patrons.find((q) => !q.leaving && !q.gone);
  const screen = (c) => ({ x: s.world.x + c.x * s.world.scaleX, y: s.world.y + (c.y - 30) * s.world.scaleY });
  out.named = !!p.name && / /.test(p.name);
  let at = screen(p.container);
  out.clickedGuest = s.clickPerson(at);
  out.card = document.getElementById('infoCard').classList.contains('open') && document.getElementById('infoName').textContent === p.name;
  out.quote = document.getElementById('infoQuote').textContent;
  p.thirstyAt = s.time.now - 1;
  s.updateGuestBubble(p);
  out.bubble = !!p.container.bubble && p.container.bubble.visible && p.container.bubble.text === '🍹';
  s.closeInfoCard();
  const bar = s.staffableRecords().find((r) => r.staff && r.staff.kind === 'bartender');
  at = screen(bar.staff.container);
  const crowd = s.patrons;
  s.patrons = []; // nobody standing in front of the bartender
  out.clickedBar = s.clickPerson(at) && s.infoCard && s.infoCard.kind === 'bartender';
  s.patrons = crowd;
  out.barCard = document.getElementById('bottomsUp').offsetParent !== null;
  // Line up three guests and serve them all at once.
  const line = s.patrons.filter((q) => !q.leaving && !q.gone).slice(0, 3);
  bar.queue = [...line];
  for (const q of line) q.queue = bar;
  const drinks0 = s.drinksSold || 0;
  const cash0 = s.cash;
  document.getElementById('bottomsUp').click();
  out.served = (s.drinksSold || 0) - drinks0;
  out.paid = s.cash - cash0;
  out.lineEmpty = bar.queue.length === 0;
  out.cooling = !s.bottomsUpReady(bar) && s.bottomsUp(bar) === 0;
  s.closeInfoCard();
  const lux0 = s.luxury();
  const tip0 = s.luxuryTipFactor();
  const lamp = s.restoreProp('lavaLamp', 0, [14, 14]);
  out.luxuryUp = s.luxury() - lux0;
  out.tipsUp = s.luxuryTipFactor() > tip0;
  s.updateUI();
  out.luxuryShown = document.getElementById('luxuryVal').textContent === String(s.luxury());
  if (lamp) s.removeProp(lamp);
  return out;
});
check('guests have names, and clicking one opens their card', people.named && people.clickedGuest && people.card && people.quote.length > 2, JSON.stringify(people));
check('a thirsty guest shows a drink bubble', people.bubble, JSON.stringify(people));
check('Bottoms Up serves the whole line at once, then recovers', people.clickedBar && people.barCard && people.served >= 1 && people.paid > 0 && people.lineEmpty && people.cooling, JSON.stringify(people));
check('Luxury grows with what you place, shows in the top bar and raises tips', people.luxuryUp > 0 && people.tipsUp && people.luxuryShown, JSON.stringify(people));

// From the owner's screenshots, part two: the DJ's song box (Change, Like),
// seating a guest yourself, the VIP list, and the club's star rating.
const extras = await page.evaluate(async () => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const title0 = document.getElementById('songTitle').textContent;
  document.getElementById('songChange').click();
  out.changed = document.getElementById('songTitle').textContent !== title0 && document.getElementById('songTitle').textContent === s.currentSong().title;
  const fans0 = s.fans;
  document.getElementById('songLike').click();
  document.getElementById('songLike').click();
  out.liked = Math.round((s.fans - fans0) * 10) / 10;
  // Seating: only at VIP booths. With just a couch the button is greyed
  // out; with a Red Velvet Booth the guest goes to it.
  const p = s.patrons.find((q) => !q.leaving && !q.gone && !q.sitting && !q.seat);
  const couch = s.restoreProp('couch', 0, [12, 9]);
  s.openInfoCard('guest', p);
  out.greyed = document.getElementById('seatGuest').classList.contains('disabled') && /no VIP booth/.test(document.getElementById('seatGuest').dataset.tip);
  out.couchOnly = s.seatGuest(p) === false && !p.seat;
  const booth = s.restoreProp('vipLounge', 0, [11, 11]);
  s.refreshInfoCard();
  out.lit = !document.getElementById('seatGuest').classList.contains('disabled');
  const mood0 = p.mood;
  out.seated = s.seatGuest(p) && !!p.seat && p.seat.rec === booth && p.mood > mood0;
  s.releaseSeat(p);
  // Drink on the house: once a visit.
  p.onTheHouse = false;
  const drinks0 = p.drinks || 0;
  out.onHouse = s.drinkGuest(p) && p.drinks === drinks0 + 1 && s.drinkGuest(p) === false;
  // Dancing needs a dance floor.
  out.danceReason = s.danceBlocker(p);
  out.danced = out.danceReason === null && s.danceGuest(p) && s.isDanceFloorTile(p.targetGx, p.targetGy);
  s.closeInfoCard();
  if (couch) s.removeProp(couch);
  if (booth) s.removeProp(booth);
  // VIPs: a very happy leaver joins; a returning VIP keeps their name and tips double.
  const before = (s.vips || []).length;
  s.maybeJoinVips({ name: 'Test Guest', mood: 95, container: { patronCharacter: 2 } });
  out.joined = (s.vips || []).length === before + 1 && s.vips.some((v) => v.name === 'Test Guest');
  const q = s.patrons.find((x) => !x.leaving && !x.gone);
  const vip = s.vips.find((v) => v.name === 'Test Guest');
  s.welcomeVip(q, vip);
  out.welcomed = q.name === 'Test Guest' && s.vipTipFactor(q) === 2 && vip.visits === 2;
  document.getElementById('tabVip').click();
  out.listed = [...document.querySelectorAll('#shopItems .vipSlot')].some((c) => /Test Guest/.test(c.dataset.tipName));
  document.getElementById('tabDecor').click();
  // Rating: the average of recent ratings.
  const stars0 = s.nightStars;
  s.nightStars = [3, 4];
  s.updateUI();
  out.rating = s.clubRating();
  out.ratingShown = document.getElementById('ratingVal').textContent;
  out.faster = s.ratingArrivalFactor() > 1;
  s.saveGame();
  const saved = JSON.parse(localStorage.getItem('clubNovaSave_v2'));
  out.saved = saved.vips.some((v) => v.name === 'Test Guest') && saved.nightStars.join() === '3,4';
  s.nightStars = stars0;
  return out;
});
check('the song box changes tracks, and Like gives a fan once a song', extras.changed && extras.liked === 1, JSON.stringify(extras));
check('guests can only be seated at a VIP booth; the button is greyed out without one', extras.greyed && extras.couchOnly && extras.lit && extras.seated, JSON.stringify(extras));
check('a drink on the house, once a visit', extras.onHouse, JSON.stringify(extras));
check('a guest can be sent to the dance floor', extras.danced, JSON.stringify(extras));
check('happy guests join the VIP list, come back by name and tip double', extras.joined && extras.welcomed && extras.listed, JSON.stringify(extras));
check('the club rating is the average of recent ratings, shown at the top', extras.rating === 3.5 && extras.ratingShown === '3.5' && extras.faster, JSON.stringify(extras));
check('VIPs and ratings are saved', extras.saved, JSON.stringify(extras));

// Money comes in like Nightclub City: a cover charge at the door, each
// drink with a tip on top, and tips from dancers now and then (not from
// guests just standing around).
const money = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const p = s.patrons.find((q) => !q.leaving && !q.gone);
  let cash = s.cash;
  s.chargeCover(p);
  out.cover = s.cash - cash;
  const bar = s.staffableRecords().find((r) => r.staff && r.staff.kind === 'bartender');
  cash = s.cash;
  s.serveDrink(bar, p);
  out.drink = s.cash - cash; // price + tip
  // Standing around: no tip even when it's "due".
  const anim = p.container.patronAnimState;
  p.container.patronAnimState = 'idle_front';
  p.nextTipAt = 0;
  cash = s.cash;
  s.tickPatrons();
  out.idleTip = s.cash - cash;
  p.container.patronAnimState = 'dance_front';
  p.nextTipAt = 0;
  const thirsty = p.thirstyAt;
  p.thirstyAt = s.time.now + 1e6;
  cash = s.cash;
  s.tickPatrons();
  out.danceTip = s.cash - cash;
  out.nextTipIn = p.nextTipAt - s.time.now;
  p.container.patronAnimState = anim;
  p.thirstyAt = thirsty;
  return out;
});
check('guests pay a cover charge at the door', money.cover === 5, JSON.stringify(money));
check('a drink costs its price plus a tip', money.drink > 10, JSON.stringify(money));
check('standing around pays nothing; dancers tip now and then', money.idleTip === 0 && money.danceTip > 0 && money.nextTipIn > 5000, JSON.stringify(money));

// Long bars: bar units side by side join into one bar with one bartender.
const longBar = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const units = [0, 1, 2].map((i) => s.restoreProp('woodBar', 0, [11 + i, 13]));
  out.placed = units.every(Boolean);
  out.joined = s.barGroup(units[0]).length === 3;
  const cash = s.cash;
  const fans = s.fans;
  s.cash = 1000;
  // Level 1 allows one bartender, and the club already has one.
  s.fans = 0;
  out.limit1 = s.bartenderAllowance() === 1 && s.hireStaff(units[1]) === false;
  // Level 4: a second bartender, here the long bar's first, in the middle.
  s.fans = 750;
  out.level4 = s.levelInfo().level === 4 && s.bartenderAllowance() === 2;
  out.hired = s.hireStaff(units[0]) && !!units[1].staff && !units[0].staff;
  out.allWorked = units.every((u) => s.isWorked(u));
  out.limit2 = s.hireStaff(units[0]) === false;
  // Level 7: a third, joining the same long bar; the two spread out.
  s.fans = 2400;
  out.level7 = s.levelInfo().level === 7 && s.bartenderAllowance() === 3;
  out.second = s.hireStaff(units[0]) && !!units[0].staff && !units[1].staff && !!units[2].staff;
  s.fireStaff(units[0]);
  out.letGo = units.filter((u) => u.staff).length === 1 && !!units[1].staff;
  s.removeProp(units[1]); // the middle goes: the two ends are no longer joined
  out.split = s.barGroup(units[0]).length === 1 && s.barGroup(units[2]).length === 1;
  out.kept = s.isWorked(units[0]) || s.isWorked(units[2]);
  s.removeProp(units[0]);
  s.removeProp(units[2]);
  s.cash = cash;
  s.fans = fans;
  s.updateUI();
  return out;
});
check('bar units side by side make one long bar', longBar.placed && longBar.joined && longBar.allWorked, JSON.stringify(longBar));
check('your level sets how many bartenders you can hire (1, then 2 at level 4, 3 at level 7)', longBar.limit1 && longBar.level4 && longBar.hired && longBar.limit2 && longBar.level7, JSON.stringify(longBar));
check('a long bar can take more bartenders, spread along it, and let one go', longBar.second && longBar.letGo, JSON.stringify(longBar));
check('a long bar keeps its bartender when the unit they stood at is sold', longBar.split && longBar.kept, JSON.stringify(longBar));

// Throw a Party: the picker lists every party, a House Party costs $60 and
// lets more guests in with bigger tips, one at a time, with a banner
// counting down; it ends after 3 minutes.
const party = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const labelAtStart = document.getElementById('partyButton').dataset.tipName;
  s.cash = Math.max(s.cash, 1000);
  const cap0 = s.patronCapacity();
  const cash0 = s.cash;
  document.getElementById('partyButton').click();
  const rows = document.querySelectorAll('#partyList .partyRow').length;
  const locked = document.querySelectorAll('#partyList .partyRow.blocked').length;
  document.querySelector('#partyList .partyRow[data-party="house"]').click();
  const out = {
    rows, locked,
    paid: cash0 - s.cash,
    capacity: s.patronCapacity() - cap0,
    tips: s.partyEffect('tips', 1),
    closed: !document.getElementById('partyPicker').classList.contains('open'),
    button: document.getElementById('partyButton').dataset.state,
    labelAtStart,
    banner: document.getElementById('partyBanner').classList.contains('open') && /House Party/.test(document.getElementById('bannerName').textContent) && /Ends in: \d+:\d\d/.test(document.getElementById('bannerLeft').textContent),
  };
  out.second = s.throwParty('hiphop');
  s.partyStartedAt -= 3 * 60 * 1000 + 1000; // time's up
  s.updatePartyButton();
  out.ended = s.party === null && s.partyEffect('capacity', 0) === 0 && !document.getElementById('partyBanner').classList.contains('open');
  return out;
});
check('the party picker lists four parties, the fancy ones locked at first', party.labelAtStart === 'Throw a Party' && party.rows === 4 && party.locked >= 1, JSON.stringify(party));
check('a House Party costs $60, lets 2 more guests in and raises tips', party.paid === 60 && party.capacity === 2 && party.tips > 1 && party.closed, JSON.stringify(party));
check('one party at a time, with a countdown banner, over after 3 minutes', party.banner && party.second === false && party.button === 'active' && party.ended, JSON.stringify(party));

// Levels get slower: 150 fans for level 2, 250 more for level 3.
const levels = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const fans = s.fans;
  const at = (n) => { s.fans = n; return s.levelInfo().level; };
  const out = [at(0), at(149), at(150), at(399), at(400), at(1200)];
  s.fans = fans;
  return out;
});
check('levels need more fans each time', levels.join() === '1,1,2,2,3,5', levels.join());

// One endless night: no night clock or summary, the doors and the music
// never stop, wages keep being paid, and every minute the club gets stars
// for how happy the crowd has been (with a few bonus fans).
const endless = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = { noClock: !document.getElementById('nightClock') && !document.getElementById('nightSummary'), open: s.doorsOpen() && s.musicPlaying() };
  const stars0 = [...(s.nightStars || [])];
  const fans0 = s.fans;
  s.vibeSum = 90 * 10;
  s.vibeCount = 10;
  s.ratedAt = s.time.now - 61 * 1000;
  s.tickRating();
  out.rated = s.nightStars[s.nightStars.length - 1] === 5 && s.fans >= fans0 + 5 && s.vibeCount === 0;
  out.notYet = (() => { const n = s.nightStars.length; s.vibeCount = 1; s.vibeSum = 50; s.tickRating(); return s.nightStars.length === n; })();
  out.songEnds = /^Ends in \d+:\d\d$/.test(document.getElementById('songEnds').textContent);
  s.nightStars = stars0;
  return out;
});
check('the club runs one endless night: no clock or summary, doors and music always on', endless.noClock && endless.open, JSON.stringify(endless));
check('every minute the club is rated on its crowd, with bonus fans for a good one', endless.rated && endless.notYet, JSON.stringify(endless));
check('the song box counts down to the next song', endless.songEnds, JSON.stringify(endless));

// Restart: asks first, then wipes the save and starts a fresh club.
const restart = await page.evaluate(() => {
  document.getElementById('restartButton').click();
  const asked = document.getElementById('restartConfirm').classList.contains('open');
  document.getElementById('restartNo').click();
  const kept = !document.getElementById('restartConfirm').classList.contains('open') && !!localStorage.getItem('clubNovaSave_v2');
  return { asked, kept };
});
await page.evaluate(() => document.getElementById('restartYes').click());
await page.waitForTimeout(500);
await waitForScene();
const fresh = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return { cash: s.cash, fans: s.fans };
});
check('restart asks first, then starts a brand-new club', restart.asked && restart.kept && fresh.cash === 700 && fresh.fans === 0, JSON.stringify({ ...restart, ...fresh }));

// Edit and Inventory: Move picks a placed item up to place again for
// free; Put away sends one to the inventory, which lists it, and placing
// it from there costs nothing. The inventory is saved.
const inv = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  s.cash = Math.max(s.cash, 500);
  // A stool to play with, on a free tile.
  let spot = null;
  for (let gy = 1; gy < s.gridSize - 1 && !spot; gy++) for (let gx = 1; gx < s.gridSize - 1 && !spot; gx++) {
    if (s.footprintValid(s.getFootprint('woodStool', 0, gx, gy), 'woodStool')) spot = [gx, gy];
  }
  s.selectProp('woodStool');
  s.placeProp(spot[0], spot[1]);
  s.deselectProp();
  document.getElementById('tabEdit').click();
  out.tools = [...document.querySelectorAll('#shopItems .toolSlot')].map((e) => e.dataset.tool).join();
  // Move: picked up and held, from the inventory.
  const cash0 = s.cash;
  s.editTool = 'move';
  out.moved = s.editClick(spot[0], spot[1]) && !s.placed[`${spot[0]},${spot[1]}`] && s.selectedProp === 'woodStool' && s.holdingFromInventory;
  s.placeProp(spot[0], spot[1]);
  out.placedFree = !!s.placed[`${spot[0]},${spot[1]}`] && s.cash === cash0 && s.inventoryCount('woodStool') === 0 && !s.selectedProp;
  // Put away, then it's in the Inventory tab.
  s.editTool = 'store';
  s.editClick(spot[0], spot[1]);
  out.stored = !s.placed[`${spot[0]},${spot[1]}`] && s.inventoryCount('woodStool') === 1;
  out.saved = JSON.parse(localStorage.getItem('clubNovaSave_v2')).inventory.woodStool === 1;
  document.getElementById('tabInventory').click();
  const card = document.querySelector('#shopItems .propSlot');
  out.listed = card && /Stool/i.test(card.dataset.tipName) && /×1/.test(card.textContent);
  card.click();
  s.placeProp(spot[0], spot[1]);
  out.fromInventory = !!s.placed[`${spot[0]},${spot[1]}`] && s.cash === cash0 && s.inventoryCount('woodStool') === 0;
  // Something you own places from the inventory even if it unlocks later.
  s.sellProp(spot[0], spot[1]);
  s.addToInventory('stepFloor');
  const lockedCash = s.cash;
  s.selectFromInventory('stepFloor');
  s.placeProp(spot[0], spot[1]);
  out.lockedPlaced = s.placed[`${spot[0]},${spot[1]}`]?.type === 'stepFloor' && s.cash === lockedCash && !s.isUnlocked('stepFloor');
  s.sellProp(spot[0], spot[1]);
  // The DJ booth can't be put away, but it can be moved: picked up with
  // its DJ, put back if the move is called off, or set down somewhere new.
  const booth = s.clubBooth();
  const home = [...booth.anchor];
  s.editTool = 'store';
  s.editClick(home[0], home[1]);
  out.boothStays = s.clubBooth() === booth && s.inventoryCount(booth.type) === 0;
  s.editTool = 'move';
  s.editClick(home[0], home[1]);
  out.boothLifted = !s.clubBooth() && s.selectedProp === booth.type && s.holdingFromInventory;
  out.savedWhileMoving = JSON.parse(JSON.stringify(s.serializeState())).placed.some((p) => p.type === booth.type && p.anchor.join() === home.join());
  s.deselectProp();
  const back = s.clubBooth();
  out.boothBack = !!back && back.anchor.join() === home.join() && !!back.staff && s.inventoryCount(booth.type) === 0;
  let free = null;
  for (let gy = 1; gy < s.gridSize - 1 && !free; gy++) for (let gx = 1; gx < s.gridSize - 1 && !free; gx++) {
    if (gx === home[0] && gy === home[1]) continue;
    s.editClick(home[0], home[1]);
    const ok = s.footprintValid(s.getFootprint(booth.type, s.currentFacing, gx, gy), booth.type);
    if (ok) free = [gx, gy]; else s.deselectProp();
  }
  const boothCash = s.cash;
  s.placeProp(free[0], free[1]);
  const moved = s.clubBooth();
  out.boothMoved = !!moved && moved.anchor.join() === free.join() && !!moved.staff && s.cash === boothCash && s.musicPlaying() && s.inventoryCount(booth.type) === 0;
  // ...and back home, for the checks after this.
  s.editClick(free[0], free[1]);
  s.placeProp(home[0], home[1]);
  out.boothHome = s.clubBooth()?.anchor.join() === home.join();
  return out;
});
check('Edit has Move, Turn, Put away and Sell', inv.tools === 'move,rotate,store,sell', inv.tools);
check('Move picks an item up and it goes back down for free', inv.moved && inv.placedFree, JSON.stringify(inv));
check('Put away sends an item to the saved inventory, and it places from there for free', inv.stored && inv.saved && inv.listed && inv.fromInventory, JSON.stringify(inv));
check('things in the inventory place even if they unlock at a later level', inv.lockedPlaced, JSON.stringify(inv));
check('the DJ booth cannot be put away, but it moves with its DJ', inv.boothStays && inv.boothLifted && inv.savedWhileMoving && inv.boothBack && inv.boothMoved && inv.boothHome, JSON.stringify(inv));

// With something in hand, clicking where a guest stands places it rather
// than opening the guest's card.
const handSpot = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  s.setDockTab('inventory');
  s.cardOpened = 0;
  s.clickPersonReal = s.clickPerson;
  s.clickPerson = (p) => { s.cardOpened += 1; return true; };
  for (let gy = 2; gy < s.gridSize - 2; gy++) for (let gx = 2; gx < s.gridSize - 2; gx++) {
    if (s.footprintValid(s.getFootprint('woodStool', 0, gx, gy), 'woodStool')) { s.selectProp('woodStool'); return [gx, gy]; }
  }
  return null;
});
await clickTile(handSpot[0], handSpot[1]);
const hand = await page.evaluate(([gx, gy]) => {
  const s = window.__clubNova.scene.getScene('club');
  const out = { placed: s.placed[`${gx},${gy}`]?.type, cards: s.cardOpened };
  s.clickPerson = s.clickPersonReal;
  s.deselectProp();
  s.sellProp(gx, gy);
  return out;
}, handSpot);
check('holding something, a click places it instead of opening a guest card', hand.placed === 'woodStool' && hand.cards === 0, JSON.stringify(hand));

// Level up: a menu with a card for everything just unlocked.
const lvl = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  Object.getPrototypeOf(s).showLevelUp.call(s, 5);
  const names = [...document.querySelectorAll('#levelUnlocks .unlockTile')].map((t) => t.dataset.tipName);
  const pictures = [...document.querySelectorAll('#levelUnlocks .unlockPic')].every((p) => p.style.backgroundImage || p.querySelector('svg') || p.textContent);
  const out = { open: document.getElementById('levelUp').classList.contains('open'), title: document.getElementById('levelUpTitle').textContent, names, pictures };
  document.getElementById('levelOk').click();
  out.bartender = Object.getPrototypeOf(s).unlocksAt.call(s, 4).some((u) => u.name === '+1 Bartender') && !s.unlocksAt(5).some((u) => u.name === '+1 Bartender');
  out.closed = !document.getElementById('levelUp').classList.contains('open');
  return out;
});
check('levelling up shows a menu of everything unlocked, each with a picture', lvl.open && lvl.title === 'Level 5!' && lvl.names.includes('Old Brick') && lvl.names.includes('Brick') && lvl.names.some((n) => /club/.test(n)) && lvl.pictures && lvl.closed && lvl.bartender, JSON.stringify(lvl));

// A new club's walls are beaten-up torn wallpaper; brick is a level 5 wallpaper.
const walls = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return { bare: [...new Set((s.bareWallImages || []).map((i) => i.texture.key))] };
});
check('the bare walls are torn old wallpaper', walls.bare.length > 0 && walls.bare.every((k) => /tornPaper/.test(k)), JSON.stringify(walls));
await page.click('#tabInventory');

// Buttons are drawn icons with no words on them; hovering one pops up its
// name and what it does.
const icons = await page.evaluate(() => {
  const ids = ['tabDecor', 'tabInventory', 'tabEdit', 'tabStaff', 'tabExpand', 'tabVip', 'boostButton', 'partyButton', 'songChange', 'songLike', 'tipsButton'];
  const bare = ids.filter((id) => {
    const el = document.getElementById(id);
    const words = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    return !el.querySelector('svg.uiGlyph, svg.uiArt') || words !== '' || !el.dataset.tipName;
  });
  const tabs = [...document.querySelectorAll('.storeTab')];
  return { bare, tabs: tabs.length, tabIcons: tabs.filter((t) => t.querySelector('svg.uiGlyph, svg.uiArt') && t.dataset.tipName && !t.textContent.trim()).length };
});
await page.hover('#boostButton');
await page.waitForTimeout(200);
const hoverTip = await page.evaluate(() => {
  const t = document.getElementById('hoverTip');
  return { shown: !!t && t.classList.contains('show'), name: t?.querySelector('.tipName').textContent, text: t?.querySelector('.tipText').textContent };
});
await page.mouse.move(5, 400);
check('buttons and shop tabs are icons with no words, each with a hover name', icons.bare.length === 0 && icons.tabs === 6 && icons.tabIcons === 6, JSON.stringify(icons));
check('hovering Drop the Bass pops up its name and what it does', hoverTip.shown && hoverTip.name === 'Drop the Bass!' && hoverTip.text.length > 10, JSON.stringify(hoverTip));

check('no errors in the page', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
