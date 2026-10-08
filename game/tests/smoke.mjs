// Smoke test: opens the built game (dist/index.html, straight from disk like
// a player double-clicking it) in headless Chromium and plays through the
// core loop. Run with `npm test` (builds first).
import { chromium, devices } from 'playwright';
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
// shut here; it's checked on its own further down. Goals still tick off but
// pay nothing, so the cash checks stay exact (goals are checked on their own).
const waitForScene = async () => {
  await page.waitForFunction(() => {
    const s = window.__clubNova && window.__clubNova.scene.getScene('club');
    return s && s.world && s.sys.settings.status >= 5; // RUNNING
  });
  await page.evaluate(() => {
    const s = window.__clubNova.scene.getScene('club');
    s.showLevelUp = () => {};
    s.completeGoal = (goal) => { s.goalsDone.push(goal.id); };
    // A club without a name asks for one first (checked on its own below).
    if (!s.clubName) s.setClubName('Test Club');
    document.getElementById('namePrompt')?.classList.remove('open');
    // The daily gift would pay cash and cover the buttons (checked on its own below).
    s.showDaily = () => false;
    document.getElementById('dailyBox')?.classList.remove('open');
  });
};

// Fresh start. A new club is asked for its name first; it goes up on the
// neon sign outside and is saved.
await page.goto(gameUrl);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => { const s = window.__clubNova && window.__clubNova.scene.getScene('club'); return s && s.world && s.sys.settings.status >= 5; });
const naming = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = { asked: document.getElementById('namePrompt').classList.contains('open'), noSignYet: !s.clubSign };
  document.getElementById('clubNameInput').value = '  The   Velvet Room  ';
  document.getElementById('clubNameOk').click();
  out.name = s.clubName;
  out.closed = !document.getElementById('namePrompt').classList.contains('open');
  out.sign = !!(s.clubSign && s.clubSign.visible && s.textures.exists('clubSign_on'));
  out.saved = JSON.parse(localStorage.getItem('clubNovaSave_v2')).clubName;
  return out;
});
check('a new club asks for its name and puts it up on a neon sign outside', naming.asked && naming.noSignYet && naming.name === 'The Velvet Room' && naming.closed && naming.sign && naming.saved === 'The Velvet Room', JSON.stringify(naming));
await page.reload();
await page.waitForFunction(() => { const s = window.__clubNova && window.__clubNova.scene.getScene('club'); return s && s.world && s.sys.settings.status >= 5; });
const renamed = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = { kept: s.clubName === 'The Velvet Room', notAsked: !document.getElementById('namePrompt').classList.contains('open') };
  out.signNotClickable = !s.clubSign.input || !s.clubSign.input.enabled;
  document.getElementById('renameButton').click();
  out.cancelShown = getComputedStyle(document.getElementById('clubNameCancel')).display !== 'none';
  document.getElementById('clubNameInput').value = 'Club Nova';
  document.getElementById('clubNameOk').click();
  out.name = s.clubName;
  return out;
});
check('the name is kept on reload; the club is renamed from the pencil in the profile, not by clicking the sign', renamed.kept && renamed.notAsked && renamed.signNotClickable && renamed.cancelShown && renamed.name === 'Club Nova', JSON.stringify(renamed));
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
  const table = Object.values(s.placed).find((r) => r.type === 'standingTable');
  return { table: table && table.anchor.join(','), floor: floor.join(' '), dancing: s.isDanceFloorTile(2, 6), type: booth && booth.type, anchor: booth && booth.anchor.join(','), dj: !!(booth && booth.staff), music: s.musicPlaying(), size: s.gridW === s.gridH ? s.gridW : -1, bar: units.map((r) => r.anchor.join(',')).sort().join(' '), bartender: !!bar, staffed: units.filter((r) => r.staff).length, worked: units.every((r) => s.isWorked(r)), boothTiles: booth && booth.tiles.length, djOnTile: !!booth && (() => { const p = s.gridToScreen(0, 5.5); return Math.abs(booth.staff.container.x - p.sx) < 1 && Math.abs(booth.staff.container.y - p.sy) < 1 && booth.tiles.filter((t) => t.back).length === 2; })() };
});
check('starts with $700, a 10x10 room, a 2-tile DJ booth, a 3x3 dance floor, one bar with a bartender and a standing table in the corner', st.cash === 700 && st.placed === 12 && opening.boothTiles === 4 && opening.djOnTile && opening.floor === '2,5 2,6 2,7 3,5 3,6 3,7 4,5 4,6 4,7' && opening.dancing && opening.size === 10 && opening.bar === '6,0' && opening.bartender && opening.staffed === 1 && opening.worked && opening.table === '9,0', `cash ${st.cash}, placed ${st.placed}, ${JSON.stringify(opening)}`);
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

// The dock along the bottom: Build, Staff, Club, Inventory and VIP, each
// labelled. Build opens a row of drawn categories (NEW first, floors and
// dance floors together) and OK closes it; Club's keys are Edit and Expand.
const tabs = await page.$$eval('.dockTab', (els) => els.map((e) => `${e.dataset.tipName}=${e.querySelector('.navLabel').textContent}`));
await page.click('#navBuild');
const visibleKeys = () => page.$$eval('.storeTab', (els) => els.filter((e) => e.offsetParent).map((e) => e.dataset.tipName));
const storeTabs = await visibleKeys();
await page.click('#navClub');
const clubKeys = await visibleKeys();
await page.click('#navBuild');
check('the dock is Build, Staff, Club, Inventory, VIP (labelled); Build has NEW and 6 categories; Club has Edit and Expand', tabs.join() === 'Build=Build,Staff=Staff,Club=Club,Inventory=Inventory,VIP Celebrities=VIP' && storeTabs.join() === 'New,Bars,Seating,Floors,Wallpaper,Decorations,DJ Booths' && clubKeys.join() === 'Edit,Expand', `${tabs.join(' / ')} | ${storeTabs.join(' / ')} | ${clubKeys.join(' / ')}`);
check('bar shows its real sprite icon', await page.locator('.propButton .icon').first().evaluate((el) => el.style.backgroundImage.includes('data:image/png')));
// Floors: dance floors and regular floors in one category, the tip says which.
await page.click('.storeTab[data-tip-name="Floors"]');
const floorTips = await page.$$eval('#shopItems .propSlot', (els) => els.map((e) => e.dataset.tipText));
check('dance floors and regular floors share one category, and the tip says which', floorTips.some((t) => /^Dance floor/.test(t)) && floorTips.some((t) => /^Regular floor/.test(t)) && floorTips.every((t) => /Luxury: \d+/.test(t)), floorTips.length + ' floors');
// Floors are listed in the order they unlock (LEVEL_PLAN.md): a mix of
// regular and dance floors spread over levels 1-37.
const floorOrder = await page.$$eval('#shopItems .propSlot', (els) => els.map((e) => /^Dance/.test(e.dataset.tipText) ? 'D' : 'R').join(''));
check('regular and dance floors unlock mixed together, in the order of the level plan', floorOrder === 'RDRDRDDDRDDRDRDRDDRDDRDRD', floorOrder);
// Clicking a card picks the item up; clicking it again puts it down.
await page.click('.storeTab[data-tip-name="Seating"]');
await page.locator('.propSlot').first().click();
const picked = await page.evaluate(() => ({ held: window.__clubNova.scene.getScene('club').selectedProp, glow: !!document.querySelector('.propButton.selected') }));
await page.locator('.propSlot').first().click();
const closed = await page.evaluate(() => ({ held: window.__clubNova.scene.getScene('club').selectedProp }));
check('clicking a shop card picks the item up, clicking again puts it down', picked.held === 'woodStool' && picked.glow && !closed.held, JSON.stringify({ picked, closed }));
await page.click('#storeOk');
// Expand: a card for each open edge, each adding one row of floor. Hovering
// or clicking one shows the new row in green; a confirm card buys it.
await page.evaluate(() => window.__clubNova.scene.getScene('club').setDockTab('expand'));
const expandCard = await page.evaluate(() => {
  const slots = [...document.querySelectorAll('#shopItems .expandSlot')];
  return { cards: slots.length, sides: slots.map((e) => e.dataset.side).join(), tip: slots[0]?.dataset.tipText, price: slots[0]?.querySelector('.propCost')?.textContent };
});
const unlockAll = () => page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const real = s.levelInfo.bind(s);
  s.__realLevelInfo = real;
  s.levelInfo = () => ({ ...real(), level: 40 });
  s.__cash = s.cash;
  s.cash = 99999;
  s.shopItemsEl.dataset.rendered = '';
  s.renderExpandCard();
});
await unlockAll();
const sizeBefore = await page.evaluate(() => { const s = window.__clubNova.scene.getScene('club'); return [s.gridW, s.gridH]; });
await page.hover('#shopItems .expandSlot[data-side="left"]');
const hovered = await page.evaluate(() => { const s = window.__clubNova.scene.getScene('club'); return s.expandPreviewSide; });
await page.click('#shopItems .expandSlot[data-side="left"]');
const picked2 = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return { pending: s.pendingExpand, preview: s.expandPreviewSide, strip: s.expansionTiles('left').length, grid: [s.gridW, s.gridH], confirm: !!document.querySelector('#shopItems .confirmSlot') };
});
await page.click('#shopItems .confirmSlot');
const bought = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const saved = JSON.parse(localStorage.getItem('clubNovaSave_v2'));
  const out = { grid: [s.gridW, s.gridH], spent: 99999 - s.cash, tile: !!s.tiles[`0,${s.gridH - 1}`], saved: [saved.gridW, saved.gridH], preview: s.expandPreviewSide, confirm: !!document.querySelector('#shopItems .confirmSlot') };
  s.levelInfo = s.__realLevelInfo;
  s.cash = s.__cash;
  s.shopItemsEl.dataset.rendered = '';
  s.renderExpandCard();
  return out;
});
check('the Expand tab has a card for each side, with its price', expandCard.cards === 2 && expandCard.sides === 'left,right' && /more floor tiles/.test(expandCard.tip) && /\$|Lv|Max/.test(expandCard.price), JSON.stringify(expandCard));
check('picking a side shows the new row in green sizeBefore you buy it', hovered === 'left' && picked2.pending === 'left' && picked2.preview === 'left' && picked2.strip === sizeBefore[0] && picked2.grid.join() === sizeBefore.join() && picked2.confirm, JSON.stringify({ hovered, picked2 }));
check('confirming adds just one row on that side', bought.grid[0] === sizeBefore[0] && bought.grid[1] === sizeBefore[1] + 1 && bought.spent > 0 && bought.tile && bought.saved.join() === bought.grid.join() && !bought.preview && !bought.confirm, JSON.stringify({ sizeBefore, bought }));
await page.click('#navBuild');
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
    bars: ['starterBar', 'woodBar', 'bar', 'neonBar', 'iceBar', 'tikiBar', 'surfBar', 'dinerBar', 'gardenBar', 'breweryBar',
      'speakeasyBar', 'discoBar', 'candyBar', 'marbleBar', 'cyberBar'].filter((k) => s.hasLayerSprites(k)).length,
    booths: ['woodBooth', 'crateBooth', 'proBooth', 'brickBooth', 'dj', 'theatreBooth', 'neonBooth', 'trussBooth', 'screenBooth',
      'iceBooth', 'decoBooth', 'holoBooth'].filter((k) => s.hasAnySprite(k)).length,
  };
});
check('all fifteen bars load, each in two layers', tiers.bars === 15, `${tiers.bars} of 15`);
check('a bar facing the camera draws its counter in front', tiers.layered);
check('all twelve DJ booth tiers load', tiers.booths === 12, `${tiers.booths} of 12`);

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
await page.evaluate(() => window.__clubNova.scene.getScene('club').setDockTab('staff'));
const staffRows = await page.locator('.staffSlot:not(.bouncerSlot)').count();
const bouncerRows = await page.locator('.bouncerSlot').count();
check('Staff lists the bar\'s bartender (the DJ is free) and the bouncers', staffRows === 1 && bouncerRows === 2, `${staffRows} bartender cards, ${bouncerRows} bouncer cards`);
await page.locator('.staffSlot:not(.staffed)').first().click();
const staffed = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return { cash: s.cash, music: s.musicPlaying(), bartenders: s.hireableRecords().filter((r) => r.staff).length };
});
check('hiring a bartender costs $50', staffed.cash === 550 && staffed.bartenders === 1 && staffed.music, JSON.stringify(staffed));
await page.evaluate(() => { const s = window.__clubNova.scene.getScene('club'); delete s.collectPatronTip; delete s.chargeCover; });

// Patrons arrive, get thirsty, buy drinks, earn fans and tip.
const fansBefore = (await state()).fans;
const stormsBefore = await page.evaluate(() => window.__clubNova.scene.getScene('club').stormedOut || 0);
await page.waitForTimeout(24000);
// A guest storming out costs 2 XP; leave that out of the comparison.
const stormXp = 2 * ((await page.evaluate(() => window.__clubNova.scene.getScene('club').stormedOut || 0)) - stormsBefore);
st = await state();
check('patrons arrive', st.patrons > 0, `${st.patrons} on the floor`);
const looks = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return s.patrons.map((p) => ({ tex: p.container.patronSprite && p.container.patronSprite.texture.key, anim: p.container.patronSprite && p.container.patronSprite.anims.currentAnim && p.container.patronSprite.anims.currentAnim.key }));
});
check('patrons use chibi characters and play an animation', looks.length > 0 && looks.every((l) => /^patron_\d+$/.test(l.tex) && /^patron_\d+_(idle|walk|dance|drink|sit|sittalk)_(front|back)$/.test(l.anim)), JSON.stringify(looks[0]));
const guestLooks = await page.evaluate(() => [...new Set(window.__clubNova.scene.getScene('club').patrons.filter((p) => !p.celeb).map((p) => p.container.patronCharacter))]);
check('every ordinary guest is the ChatGPT-painted guy (guy01, a 3D sheet after the 12 drawn ones)', guestLooks.length === 1 && guestLooks[0] >= 12, JSON.stringify(guestLooks));

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
check('fans grow over time', st.fans + stormXp > fansBefore, `${fansBefore.toFixed(1)} -> ${st.fans.toFixed(1)} fans`);
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
check('happy guests bring 5 XP, angry ones cost 2', mood.happyFans === 5 && mood.angryFans === -2, JSON.stringify(mood));
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
  s.fans = Math.max(s.fans, s.fansForLevel(7)); // level 7, for the Pro Booth
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

// Bass Boost and Drink Rush: each runs for a while, then needs to recharge.
// Starting one sends a share of the crowd off (one by one) to dance or to
// the bars, and makes dancing / drinking much more likely meanwhile.
const boost = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  // Run the staggered "off they go" calls straight away for the check.
  const later = s.time.delayedCall.bind(s.time);
  s.time.delayedCall = (ms, fn) => fn();
  const guests = s.patrons.filter((p) => !p.leaving && !p.gone && !p.queue);
  guests.forEach((p) => { p.activity = { kind: 'wander', until: s.time.now + 60000 }; p.thirstyAt = s.time.now + 1e6; });
  const started = s.startBoost();
  const during = { boosted: s.isBoosted(), factor: s.boostFactor(), danceWeight: s.boostDanceFactor(), button: document.getElementById('boostButton').dataset.state, label: document.getElementById('boostLabel').textContent };
  during.rallied = guests.length === 0 || guests.some((p) => p.activity === null);
  const again = s.startBoost();
  s.boostUntil = s.time.now - 1; // skip to the end
  s.tickBoost();
  const afterEnd = { boosted: s.isBoosted(), button: document.getElementById('boostButton').dataset.state, canBoost: s.canBoost() };
  s.boostReadyAt = 0; s.tickBoost(); // skip the cooldown so later checks aren't affected
  guests.forEach((p) => { p.activity = { kind: 'wander', until: s.time.now + 60000 }; p.thirstyAt = s.time.now + 1e6; });
  const rush = { started: s.startRush(), rushing: s.isRushing(), drinkWeight: s.rushDrinkFactor(), button: document.getElementById('rushButton').dataset.state };
  rush.thirsty = guests.length === 0 || guests.some((p) => p.thirstyAt <= s.time.now);
  rush.again = s.startRush();
  s.rushUntil = s.time.now - 1;
  s.tickBoost();
  rush.cooldown = document.getElementById('rushButton').dataset.state === 'cooldown' && !s.canRush();
  s.rushReadyAt = 0; s.tickBoost();
  s.time.delayedCall = later;
  return { started, during, again, afterEnd, rush };
});
check('Bass Boost runs for a minute, more guests want to dance, and some head for the floor', boost.started && boost.during.boosted && boost.during.factor > 1 && boost.during.danceWeight > 1 && boost.during.rallied && boost.during.button === 'active' && /^(1:0[01]|0:5[89])$/.test(boost.during.label), JSON.stringify(boost.during));
check('the boost can\'t be stacked, and has a cooldown after', !boost.again && !boost.afterEnd.boosted && boost.afterEnd.button === 'cooldown' && !boost.afterEnd.canBoost, JSON.stringify(boost.afterEnd));
check('Drink Rush makes guests want a drink, then recharges', boost.rush.started && boost.rush.rushing && boost.rush.drinkWeight > 1 && boost.rush.thirsty && boost.rush.button === 'active' && !boost.rush.again && boost.rush.cooldown, JSON.stringify(boost.rush));

// The crowd answering Bass Boost / Drink Rush: a popup and a pulse across
// the dance floor (or the bars lighting up); guests answer with a reaction
// over their head right away, then head off; dancers get more energetic
// and dance longer. Guests in a bar line, leaving or arguing carry on.
const rally = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const later = s.time.delayedCall.bind(s.time);
  const cap = s.patronCapacity;
  s.patronCapacity = () => 99;
  const door = s.doorTile();
  const spawn = () => {
    const block = s.patrons.filter((p) => p.gx === door.gx && p.gy === door.gy);
    block.forEach((p) => { p.gx = -50; });
    s.trySpawnPatron();
    block.forEach((p) => { p.gx = door.gx; });
    const p = s.patrons[s.patrons.length - 1];
    p.gx = -70 - s.patrons.length;
    p.moving = false;
    return p;
  };
  const [free, queued, leaving, arguing, dancer, drinking] = [spawn(), spawn(), spawn(), spawn(), spawn(), spawn()];
  s.patronCapacity = cap;
  s.time.delayedCall = (ms, fn) => fn();
  free.activity = { kind: 'wander', until: s.time.now + 60000 };
  queued.queue = { queue: [queued] };
  leaving.leaving = true;
  arguing.arguing = true;
  dancer.activity = { kind: 'dance', until: s.time.now + 10000 };
  s.setPatronAnimation(dancer, 'dance');
  drinking.activity = { kind: 'drink', phase: 'drinking', until: s.time.now + 20000 };
  for (const p of [free, queued, leaving, arguing, dancer, drinking]) p.reactingUntil = 0;
  // Bass Boost.
  s.boostUntil = undefined; s.boostReadyAt = 0;
  const until0 = dancer.activity.until;
  s.startBoost();
  const pop = document.getElementById('bigPopup');
  out.popup = pop.classList.contains('show') && pop.querySelector('.bpTitle').textContent === 'Bass Boost!';
  out.energetic = dancer.activity.until > until0 + 15000 && dancer.container.patronSprite.anims.timeScale > 1;
  // For ten seconds they go wild: much faster, with heart eyes or ! popping up.
  out.excited = dancer.excitedUntil - s.time.now > 9000 && dancer.container.patronSprite.anims.timeScale >= 1.7 && dancer.reactingUntil > s.time.now;
  dancer.excitedUntil = s.time.now - 1;
  s.energize(dancer);
  out.afterExcite = dancer.container.patronSprite.anims.timeScale > 1 && dancer.container.patronSprite.anims.timeScale < 1.7;
  out.pulse = s.pulseDanceFloor() === Object.keys(s.placed).filter((k) => s.isDanceFloorTile(...k.split(',').map(Number))).length;
  for (const p of [free, queued, leaving, arguing]) { p.wantActivity = null; p.reactingUntil = 0; }
  out.joined = s.rallyGuests('dance', { joinShare: 1, staggerMs: [0, 0], durationMs: 60000 });
  out.freeGoes = free.wantActivity === 'dance' && free.reactingUntil > s.time.now;
  out.othersStay = [queued, leaving, arguing].every((p) => !p.wantActivity && !(p.reactingUntil > s.time.now));
  s.boostUntil = s.time.now - 1; s.tickBoost(); s.boostReadyAt = 0; s.tickBoost();
  out.calm = dancer.container.patronSprite.anims.timeScale === 1;
  // Drink Rush.
  s.rushUntil = undefined; s.rushReadyAt = 0;
  for (const p of [free, drinking]) { p.wantActivity = null; p.reactingUntil = 0; }
  free.activity = { kind: 'wander', until: s.time.now + 60000 };
  drinking.activity = { kind: 'drink', phase: 'drinking', until: s.time.now + 20000 };
  s.startRush();
  out.rushPopup = pop.querySelector('.bpTitle').textContent === 'Drink Rush!';
  out.bars = s.highlightBars() === s.hireableRecords().filter((r) => s.isWorked(r)).length;
  s.rallyGuests('drink', { joinShare: 1, staggerMs: [0, 0], durationMs: 45000 });
  out.thirstyGo = free.wantActivity === 'drink' && free.thirstyAt <= s.time.now;
  out.drinkerStays = drinking.activity.kind === 'drink' && !drinking.wantActivity;
  s.rushUntil = s.time.now - 1; s.tickBoost(); s.rushReadyAt = 0; s.tickBoost();
  // Off they go: their next pick is the call they answered.
  free.activity = null;
  s.chooseActivity(free);
  out.headsOff = !free.wantActivity && (free.activity && ['drink', 'wander'].includes(free.activity.kind));
  s.time.delayedCall = later;
  queued.queue = null; arguing.arguing = false;
  for (const p of [free, queued, arguing, dancer, drinking]) s.startPatronDeparture(p);
  leaving.leaving = false; s.startPatronDeparture(leaving);
  return out;
});
check('Bass Boost: a popup, a pulse across the dance floor, and dancers go wild for 10 s, then dance faster and longer', rally.popup && rally.pulse && rally.energetic && rally.excited && rally.afterExcite && rally.calm, JSON.stringify(rally));
check('guests answering react at once and head off; those in a bar line, leaving or arguing stay put', rally.joined >= 1 && rally.freeGoes && rally.othersStay, JSON.stringify(rally));
check('Drink Rush: a popup, the bars light up, and guests head for a drink (those drinking carry on)', rally.rushPopup && rally.bars && rally.thirstyGo && rally.drinkerStays && rally.headsOff, JSON.stringify(rally));

// The spotlight shines: a beam and a glow that turn with it and go when
// it's sold.
const spot = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  let at = null;
  for (let gy = 1; gy < s.gridH - 1 && !at; gy++) for (let gx = 1; gx < s.gridW - 1 && !at; gx++) {
    if (s.footprintValid(s.getFootprint('spotlight', 0, gx, gy), 'spotlight')) at = [gx, gy];
  }
  const rec = s.restoreProp('spotlight', 0, at);
  const out = { beam: !!rec.spotBeam && rec.spotBeam.parts.length >= 2 && rec.spotBeam.parts.every((p) => p.active) };
  const first = rec.spotBeam.parts[0];
  const angle0 = first.rotation;
  s.rotatePlacedProp(`${at[0]},${at[1]}`);
  out.turned = !first.active && !!rec.spotBeam && Math.abs(rec.spotBeam.parts[0].rotation - angle0) > 0.5;
  const parts = rec.spotBeam.parts;
  s.removeProp(rec);
  out.gone = parts.every((p) => !p.active);
  return out;
});
check('the spotlight shines a beam that turns with it and goes when it is removed', spot.beam && spot.turned && spot.gone, JSON.stringify(spot));
const disco = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  let at = null;
  for (let gy = 1; gy < s.gridH - 1 && !at; gy++) for (let gx = 1; gx < s.gridW - 1 && !at; gx++) {
    if (s.footprintValid(s.getFootprint('discoBall', 0, gx, gy), 'discoBall')) at = [gx, gy];
  }
  const rec = s.restoreProp('discoBall', 0, at);
  const out = { glow: !!rec.discoGlow && rec.discoGlow.parts.length >= 3 && rec.discoGlow.parts.every((p) => p.active) };
  const parts = rec.discoGlow.parts;
  s.removeProp(rec);
  out.gone = parts.every((p) => !p.active);
  return out;
});
check('the disco ball glows (halo, rays, sparkles), and the glow goes when it is removed', disco.glow && disco.gone, JSON.stringify(disco));
const speakers = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  let at = null;
  for (let gy = 1; gy < s.gridH - 1 && !at; gy++) for (let gx = 1; gx < s.gridW - 1 && !at; gx++) {
    if (s.footprintValid(s.getFootprint('speakerTower', 0, gx, gy), 'speakerTower')) at = [gx, gy];
  }
  const rec = s.restoreProp('speakerTower', 0, at);
  const out = { cones: rec.speakerFx && rec.speakerFx.cones.length };
  s.pulseSpeakers('kick');
  const big = rec.speakerFx.cones.find((c) => c.big);
  out.bump = big.wave.alpha > 0.5 && s.tweens.isTweening(big.cone);
  // Turned with its back to you, no cones show.
  s.rotatePlacedProp(`${at[0]},${at[1]}`);
  s.rotatePlacedProp(`${at[0]},${at[1]}`);
  out.backHidden = rec.facing === 180 && rec.speakerFx.cones.length === 0;
  const parts = rec.speakerFx.parts;
  s.removeProp(rec);
  out.gone = parts.every((p) => !p.active) && !rec.speakerFx;
  return out;
});
check('speaker cones bump to the beat (and hide when the speaker faces away)', speakers.cones === 3 && speakers.bump && speakers.backHidden && speakers.gone, JSON.stringify(speakers));

// Bonuses: a happy guest now and then holds up a high five or fist bump.
// Clicking it collects $88 (and opens no card); left alone it fades.
const bonusSetup = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  for (const b of [...(s.bonuses || [])]) s.removeBonus(b, false);
  const cap = s.patronCapacity;
  s.patronCapacity = () => 99;
  const door = s.doorTile();
  s.patrons.filter((q) => q.gx === door.gx && q.gy === door.gy).forEach((q) => { q.gx = -50; });
  s.trySpawnPatron();
  s.patronCapacity = cap;
  const happy = s.patrons[s.patrons.length - 1];
  [happy.gx, happy.gy] = [5, 5];
  const spot = s.gridToScreen(5, 5);
  happy.container.setPosition(spot.sx, spot.sy);
  happy.mood = 95;
  s.nextBonusAt = s.time.now - 1;
  const others = s.patrons;
  s.patrons = [happy];
  s.tickBonuses();
  s.patrons = others;
  s.followBonus();
  const bonus0 = s.bonuses[0];
  out.offered = !!bonus0 && bonus0.patron === happy && ['highfive', 'fist'].includes(bonus0.kind);
  const h = bonus0.holder;
  out.at = { x: s.world.x + h.x * s.world.scaleX, y: s.world.y + h.y * s.world.scaleY };
  out.cash = s.cash;
  happy.moving = true; // stay put while we click
  s.tweens.killTweensOf(happy.container);
  return out;
});
await page.mouse.click(bonusSetup.at.x, bonusSetup.at.y);
const bonus = await page.evaluate((setup) => {
  const s = window.__clubNova.scene.getScene('club');
  const out = { ...setup };
  out.paid = s.cash - setup.cash;
  out.noCard = !document.getElementById('infoCard').classList.contains('open');
  out.gone = s.bonuses.length === 0 && s.nextBonusAt > s.time.now + 20000;
  // One left alone fades after about 8 seconds.
  const p = s.patrons.find((q) => !q.leaving && !q.gone);
  p.mood = 95;
  const b2 = s.offerBonus(p);
  out.life = Math.round((b2.expiresAt - s.time.now) / 1000);
  b2.expiresAt = s.time.now - 1;
  s.tickBonuses();
  out.expired = s.bonuses.length === 0;
  s.patrons.forEach((q) => { q.moving = false; });
  return out;
}, bonusSetup);
check('a happy guest offers a high five or fist bump; clicking it pays $88 and opens no card', bonus.offered && bonus.paid === 88 && bonus.noCard && bonus.gone, JSON.stringify(bonus));
check('an unclaimed bonus fades after about 8 seconds', bonus.life === 8 && bonus.expired, JSON.stringify(bonus));

// Hovering and selecting: what's drawn under the cursor, pixel for pixel.
// Hovering a three-tile booth anywhere glows the whole booth; clicking it
// selects it and outlines its whole footprint; the Edit tools act on it.
const select = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  s.cash += 2000;
  let at = null;
  for (let gy = 2; gy < s.gridH - 3 && !at; gy++) for (let gx = 2; gx < s.gridW - 3 && !at; gx++) {
    if (s.footprintValid(s.getFootprint('blackBooth', 0, gx, gy), 'blackBooth')) at = [gx, gy];
  }
  const rec = s.restoreProp('blackBooth', 0, at);
  out.tiles = rec.tiles.length;
  // Keep guests out of the way for the check.
  const everyone = s.patrons;
  s.patrons = [];
  // A point on the booth's picture far from its anchor tile.
  const img = rec.gameObject;
  const b = img.getBounds();
  const pts = [];
  for (let fx = 0.1; fx <= 0.9; fx += 0.1) for (let fy = 0.2; fy <= 0.9; fy += 0.1) {
    pts.push({ x: b.x + b.width * fx, y: b.y + b.height * fy }); // getBounds() is already in screen space
  }
  const onIt = pts.filter((p) => { const h = s.objectAt(p.x, p.y); return h && h.target === rec; });
  out.hitPoints = onIt.length;
  const p = onIt[onIt.length - 1];
  s.updateHoverObject(p);
  out.glow = s.hovered && s.hovered.target === rec && (!img.preFX || !!img.selectGlow);
  s.clickObject(p);
  out.selected = s.selected && s.selected.target === rec && s.selectionOutline.commandBuffer.length > 0;
  s.clearSelection();
  out.cleared = !s.selected && (!img.preFX || !img.selectGlow);
  // Edit > Move picks up the whole booth from anywhere on it.
  s.setDockTab('edit');
  s.editTool = 'move';
  s.clickObject(p);
  out.pickedUp = !s.placed[`${at[0]},${at[1]}`] && s.selectedProp === 'blackBooth';
  s.deselectProp();
  s.setDockTab('inventory');
  s.patrons = everyone;
  return out;
});
check('hovering any part of a three-tile booth glows the whole booth; clicking selects it and outlines its footprint', select.tiles === 9 && select.hitPoints > 3 && select.glow && select.selected && select.cleared, JSON.stringify(select));
check('in Edit, clicking anywhere on the booth picks the whole booth up', select.pickedUp, JSON.stringify(select));

// Capacity: 8 guests in a new club; more as popularity grows (not by
// expanding), as long as the room holds them. Happy visits raise popularity,
// storming out lowers it. Shown as "n/max" over a Guests label.
const capacity = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const [w, h, pop] = [s.gridW, s.gridH, s.popularity];
  const out = {};
  s.gridW = 10; s.gridH = 10; s.popularity = 0;
  out.base = s.patronCapacity();
  s.gridW = 12;
  out.expandedOnly = s.patronCapacity();
  s.gridW = 10; s.popularity = 100;
  out.popular = s.patronCapacity();
  s.popularity = 10000;
  out.roomLimit = s.patronCapacity();
  s.popularity = 50;
  s.noteVisitPopularity({ mood: 90 });
  out.happyUp = s.popularity - 50;
  s.noteVisitPopularity({ mood: 10, stormedOut: true });
  out.stormDown = s.popularity - 50 - out.happyUp;
  out.faster = s.popularityArrivalFactor() > 1;
  [s.gridW, s.gridH, s.popularity] = [w, h, pop];
  s.updateUI();
  out.text = document.getElementById('placedVal').textContent;
  out.matches = out.text === `${s.patrons.filter((p) => !p.gone).length}/${s.patronCapacity()}`;
  out.popShown = document.getElementById('popularityVal').textContent === String(s.popularity);
  // Full: nobody else comes in.
  const n0 = s.patrons.length;
  const cap = s.patronCapacity;
  s.patronCapacity = () => s.guestCount();
  s.trySpawnPatron();
  out.fullBlocks = s.patrons.length === n0;
  s.patronCapacity = cap;
  return out;
});
check('8 guests fit a new club; more as popularity grows (expanding alone adds none), up to what the room holds; happy visits raise popularity and storm-outs lower it', capacity.base === 8 && capacity.expandedOnly === 8 && capacity.popular === 20 && capacity.roomLimit === 25 && capacity.happyUp === 3 && capacity.stormDown === -5 && capacity.faster && capacity.matches && capacity.popShown && capacity.fullBlocks, JSON.stringify(capacity));

// A club can only grow a row per wall every couple of levels.
const growth = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return { l1: s.maxWallAt(1), l3: s.maxWallAt(3), l10: s.maxWallAt(10), l40: s.maxWallAt(40) };
});
check('expanding is locked by level: walls of 10 at level 1, 11 at 3, 14 at 10, 26 at 40', growth.l1 === 10 && growth.l3 === 11 && growth.l10 === 14 && growth.l40 === 26, JSON.stringify(growth));

// XP for purchases: buying gives XP by price, moving gives none, and
// selling takes it back, so buying and selling can't farm levels.
const buyXp = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  s.cash += 2000;
  let at = null;
  for (let gy = 1; gy < s.gridH - 1 && !at; gy++) for (let gx = 1; gx < s.gridW - 1 && !at; gx++) {
    if (s.footprintValid(s.getFootprint('plant', 0, gx, gy), 'plant')) at = [gx, gy];
  }
  const xp0 = s.fans;
  s.selectProp('plant');
  s.currentFacing = 0;
  s.placeProp(at[0], at[1]);
  const rec = s.placed[`${at[0]},${at[1]}`];
  out.gained = +(s.fans - xp0).toFixed(2);
  out.expected = +(s.currentCost('plant') * 0.05).toFixed(2);
  s.deselectProp();
  // Put it away and place it again: no XP either way.
  const xp1 = s.fans;
  s.pickUpProp(rec);
  s.selectFromInventory('plant');
  s.placeProp(at[0], at[1]);
  out.moveFree = Math.abs(s.fans - xp1) < 1e-9;
  // Sell it: the XP goes back.
  s.sellProp(at[0], at[1]);
  out.sellBack = Math.abs(s.fans - xp0) < 1e-9;
  s.updateUI();
  out.label = document.querySelector('[data-tip-name="XP"]') !== null && /XP$/.test(document.getElementById('xpText')?.textContent || 'XP');
  return out;
});
check('buying gives XP by price, moving gives none, and selling takes it back', buyXp.gained > 0 && buyXp.gained === buyXp.expected && buyXp.moveFree && buyXp.sellBack && buyXp.label, JSON.stringify(buyXp));

// The card's red X stays in its corner with nothing under it, even on a
// bartender's card with a long line of dialogue.
const cardX = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  let bar = s.hireableRecords().find((r) => r.staff) || s.hireableRecords()[0];
  let placedBar = false;
  if (!bar) {
    for (let gy = 1; gy < s.gridH - 3 && !bar; gy++) for (let gx = 1; gx < s.gridW - 1 && !bar; gx++) bar = s.restoreProp('woodBar', 0, [gx, gy]);
    placedBar = true;
  }
  const hired = !bar.staff;
  if (hired) s.attachStaff(bar);
  s.openInfoCard('bartender', bar);
  const quote = document.getElementById('infoQuote');
  quote.textContent = '"Busy night! Three in line, a Drink Rush going, and someone keeps asking for a drink with a tiny umbrella in it."';
  const x = document.getElementById('infoClose').getBoundingClientRect();
  const card = document.getElementById('infoCard').getBoundingClientRect();
  const below = [...document.querySelectorAll('#infoCard .infoTop, #infoCard .infoQuote, #infoCard .infoName, #infoCard .infoRole')]
    .every((el) => { const r = el.getBoundingClientRect(); return r.top >= x.bottom || r.right <= x.left; });
  const hit = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2);
  const out = { below, inCorner: x.top - card.top < 12 && card.right - x.right < 14, clickable: hit && hit.id === 'infoClose' };
  s.closeInfoCard();
  if (hired) s.detachStaff(bar); // leave the club as it was
  if (placedBar) s.removeProp(bar);
  return out;
});
check('the card\'s red X stays in its corner, with the speech bubble and text below it', cardX.below && cardX.inCorner && cardX.clickable, JSON.stringify(cardX));

// The green check finishes what you're doing and closes the panel, leaving
// just the nav bar; clicking an open pad again closes it too.
await page.evaluate(() => window.__clubNova.scene.getScene('club').setDockTab('staff'));
const openStaff = await page.evaluate(() => ({ panel: getComputedStyle(document.getElementById('dockPanel')).display !== 'none', check: getComputedStyle(document.getElementById('storeOk')).display !== 'none' }));
await page.evaluate(() => window.__clubNova.scene.getScene('club').selectProp('woodStool'));
await page.click('#storeOk');
const closedDock = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return { panel: getComputedStyle(document.getElementById('dockPanel')).display, tabs: [...document.querySelectorAll('.dockTab')].filter((t) => t.offsetParent).length, held: s.selectedProp, tab: s.dockTab };
});
await page.click('#navClub');
await page.click('#navClub');
const toggled = await page.evaluate(() => getComputedStyle(document.getElementById('dockPanel')).display);
await page.click('#navBuild');
await page.click('#storeOk');
const storeClosed = await page.evaluate(() => getComputedStyle(document.getElementById('dockPanel')).display);
check('the green check finishes the action and closes the panel, leaving only the nav bar', openStaff.panel && openStaff.check && closedDock.panel === 'none' && closedDock.tabs === 5 && !closedDock.held && closedDock.tab === null && storeClosed === 'none', JSON.stringify({ openStaff, closedDock, storeClosed }));
check('clicking an open tab again closes it', toggled === 'none', toggled);

// The doorway stays clear: arrivals walk to a clear spot inside first,
// nobody picks the doorway to stand, dance or chat on, and the guard
// stands just out of it.
const doorway = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const zone = new Set(s.doorZone());
  const door = s.doorTile();
  out.zone = zone.has(`${door.gx},${door.gy}`) && zone.size >= 4;
  const cap = s.patronCapacity;
  s.patronCapacity = () => 99;
  s.patrons.filter((q) => q.gx === door.gx && q.gy === door.gy).forEach((q) => { q.gx = -50; });
  s.trySpawnPatron();
  s.patronCapacity = cap;
  const p = s.patrons[s.patrons.length - 1];
  out.walksIn = p.entering && !zone.has(`${p.targetGx},${p.targetGy}`) && p.nextMoveAt - s.time.now < 500;
  // Wandering never stops in the doorway.
  let inDoor = 0;
  for (let i = 0; i < 200; i++) { s.pickWanderTile(p); if (zone.has(`${p.targetGx},${p.targetGy}`)) inDoor += 1; }
  out.wanderClear = inDoor === 0;
  out.guardClear = !s.guard || !zone.has(`${s.guardPost()[0]},${s.guardPost()[1]}`);
  // Once in, they pick an activity.
  [p.gx, p.gy] = [p.targetGx, p.targetGy];
  p.moving = false;
  s.arriveForActivity(p);
  out.arrived = !p.entering;
  s.startPatronDeparture(p);
  return out;
});
check('the doorway stays clear: arrivals walk in to a clear spot first, and nobody idles in the doorway', doorway.zone && doorway.walksIn && doorway.wanderClear && doorway.guardClear && doorway.arrived, JSON.stringify(doorway));

// Floors in Edit: a painted floor tile can be moved (laid again for free)
// or sold (half back, its XP taken back), and a dance floor tile too;
// the basic floor shows underneath.
const floorEdit = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  s.cash += 500;
  let a = null;
  let b = null;
  for (let gy = 3; gy < s.gridH - 1 && !b; gy++) for (let gx = 3; gx < s.gridW - 1 && !b; gx++) {
    if (s.placed[`${gx},${gy}`] || s.floorPaint[`${gx},${gy}`]) continue;
    if (!a) a = [gx, gy]; else if (gx !== a[0] || gy !== a[1]) b = [gx, gy];
  }
  s.selectProp('fpConcrete');
  s.paintFloor(a[0], a[1]);
  s.deselectProp();
  s.setDockTab('edit');
  s.editTool = 'move';
  const cash0 = s.cash;
  out.pickedUp = s.editClick(a[0], a[1]) && !s.floorPaint[`${a[0]},${a[1]}`] && s.selectedProp === 'fpConcrete' && s.holdingFromInventory;
  s.paintFloor(b[0], b[1]);
  out.movedFree = s.floorPaint[`${b[0]},${b[1]}`] === 'fpConcrete' && s.cash === cash0 && !s.selectedProp;
  s.editTool = 'sell';
  const xp0 = s.fans;
  const cash1 = s.cash;
  s.editClick(b[0], b[1]);
  out.sold = !s.floorPaint[`${b[0]},${b[1]}`] && s.cash > cash1 && s.fans <= xp0 && !s.floorPaintImages[`${b[0]},${b[1]}`];
  // A dance floor tile: put away like furniture.
  s.editTool = 'store';
  const dance = s.restoreProp('basicFloor', 0, a);
  const inv0 = s.inventoryCount('basicFloor');
  s.editClick(a[0], a[1]);
  out.danceStored = !s.placed[`${a[0]},${a[1]}`] && s.inventoryCount('basicFloor') === inv0 + 1 && !!dance;
  s.addToInventory('basicFloor', -1);
  s.editTool = 'move';
  s.closeDock();
  return out;
});
check('in Edit, floor tiles can be moved (free), sold or put away, showing the basic floor underneath', floorEdit.pickedUp && floorEdit.movedFree && floorEdit.sold && floorEdit.danceStored, JSON.stringify(floorEdit));

// Admiring decorations: a guest walks up to a decoration, looks at it
// for about 3 s, says WOW! or OUU! and offers a tip to click; they won't
// tip for the same decoration again for a while.
const admire = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  let at = null;
  for (let gy = 3; gy < s.gridH - 2 && !at; gy++) for (let gx = 3; gx < s.gridW - 2 && !at; gx++) {
    if (s.footprintValid(s.getFootprint('woodSpeaker', 0, gx, gy), 'woodSpeaker')) at = [gx, gy];
  }
  const rec = s.restoreProp('woodSpeaker', 0, at);
  const cap = s.patronCapacity;
  s.patronCapacity = () => 99;
  const door = s.doorTile();
  s.patrons.filter((q) => q.gx === door.gx && q.gy === door.gy).forEach((q) => { q.gx = -50; });
  s.trySpawnPatron();
  s.patronCapacity = cap;
  const p = s.patrons[s.patrons.length - 1];
  p.entering = false;
  [p.gx, p.gy] = [at[0] + 2, at[1] + 2];
  p.moving = false;
  // Pick this speaker (others may be in the club too).
  let tries = 0;
  do { p.activity = null; s.beginActivity(p, 'admire'); tries += 1; } while (p.activity && p.activity.rec !== rec && tries < 50);
  out.going = !!p.activity && p.activity.kind === 'admire' && p.activity.rec === rec;
  const t = [p.targetGx, p.targetGy];
  out.besideIt = Math.max(Math.abs(t[0] - at[0]), Math.abs(t[1] - at[1])) === 1;
  [p.gx, p.gy] = t;
  s.arriveForActivity(p);
  out.looks = Math.round((p.activity.until - s.time.now) / 1000) === 3;
  const n0 = (s.bonuses || []).length;
  s.tickActivity(p);
  out.notYet = (s.bonuses || []).length === n0;
  p.activity.until = s.time.now - 1;
  s.tickActivity(p);
  const tip = (s.bonuses || []).find((b) => b.patron === p && b.kind === 'tip');
  out.tip = !!tip && tip.amount >= 5;
  // Clicking the coin pays the tip.
  const cash0 = s.cash;
  s.followBonus();
  const sx = s.world.x + tip.holder.x * s.world.scaleX;
  const sy = s.world.y + tip.holder.y * s.world.scaleY;
  out.paid = s.clickBonus({ x: sx, y: sy }) && s.cash - cash0 === tip.amount;
  // Not again for this decoration for a while.
  let again = false;
  for (let i = 0; i < 30; i++) { const spot = s.admireSpot(p); if (spot && spot.rec === rec) again = true; }
  out.cooldown = !again;
  s.startPatronDeparture(p);
  s.removeProp(rec);
  return out;
});
check('a guest admires a decoration for ~3 s, then WOW!/OUU! with a tip to click, and not again soon', admire.going && admire.besideIt && admire.looks && admire.notYet && admire.tip && admire.paid && admire.cooldown, JSON.stringify(admire));

// Nobody hangs about at the ends of a bar, and wanderers pick quiet spots.
const spread = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const group = s.barGroups()[0];
  if (!group) return { noBar: true };
  const off = s.keepOffTiles();
  const first = group[0];
  const along = first.facing === 90 || first.facing === 270 ? [0, 1] : [1, 0];
  const ends = [];
  for (const unit of [group[0], group[group.length - 1]]) for (const [x, y] of unit.tiles) {
    for (const d of [-1, 1]) { const k = `${x + along[0] * d},${y + along[1] * d}`; if (!s.placed[k] && s.inGrid(x + along[0] * d, y + along[1] * d)) ends.push(k); }
  }
  out.endsOff = ends.length > 0 && ends.every((k) => off.has(k));
  out.crowdFn = typeof s.crowdAt === 'function' && typeof s.leastCrowded === 'function';
  return out;
});
check('nobody idles at the ends of a bar, and guests pick the quieter spots', spread.noBar || (spread.endsOff && spread.crowdFn), JSON.stringify(spread));

// The + and - keys change the zoom and stay within limits.
const zoom0 = await page.evaluate(() => window.__clubNova.scene.getScene('club').world.scaleX);
await page.evaluate(() => { const s = window.__clubNova.scene.getScene('club'); s.zoomTo(s.world.scaleX / 0.85); });
const zoom1 = await page.evaluate(() => window.__clubNova.scene.getScene('club').world.scaleX);
await page.evaluate(() => { const s = window.__clubNova.scene.getScene('club'); for (let i = 0; i < 20; i++) s.zoomTo(s.world.scaleX * 0.85); });
const zoom2 = await page.evaluate(() => window.__clubNova.scene.getScene('club').world.scaleX);
check('zooming in and out stays within limits', zoom1 > zoom0 && Math.abs(zoom2 - 0.6) < 1e-6, `${zoom0.toFixed(2)} -> ${zoom1.toFixed(2)} -> ${zoom2.toFixed(2)}`);

// Dance floors: fifteen designs, the animated ones move only while the DJ
// plays, and a Step Floor lights up under a patron.
const floors = await page.evaluate(async () => {
  const s = window.__clubNova.scene.getScene('club');
  const styles = ['basic', 'plain', 'checker', 'softGlow', 'parquet', 'bluePulse', 'pinkPulse', 'twoTone', 'glow', 'lightUp', 'neonRings', 'wave', 'rainbow', 'step', 'galaxy'];
  const missing = styles.filter((k) => !s.textures.exists(`floor_${k}_0`));
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
check('all fifteen dance floor designs are drawn', floors.missing.length === 0, floors.missing.join(', ') || '15 of 15');
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

// The door is near the back of the left wall, where the line outside
// leads; its tile can't be blocked with furniture (floor tiles are fine).
const door = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const d = s.doorTile();
  const free = !s.placed[`${d.gx},${d.gy}`];
  return { at: [d.gx, d.gy], size: [s.gridW, s.gridH], solid: s.footprintValid([[d.gx, d.gy]], 'plant'), floor: !free || s.footprintValid([[d.gx, d.gy]], 'dance') };
});
check('the door is near the back of the left wall, and furniture can\'t block it', door.at[0] === 0 && door.at[1] === 1 && door.solid === false && door.floor === true, JSON.stringify(door));

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

// Bar lines: customers take every service spot along a long bar, then
// wait in rows behind them and step up when a spot frees. Bartenders walk
// along the bar to a customer, one per spot, and take 3 s to serve. Nobody
// gives up before 20 s; after that some walk off angry.
const queue = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  s.cash += 1000;
  const allow = s.bartenderAllowance;
  s.bartenderAllowance = () => 5;
  const barA = s.restoreProp('woodBar', 0, [6, 6]);
  const barB = s.restoreProp('woodBar', 0, [7, 6]);
  const others = s.staffableRecords().filter((r) => r.staff && r.staff.kind === 'bartender' && !s.barGroup(barA).includes(r));
  others.forEach((r) => s.detachStaff(r)); // only this bar is open
  s.hireStaff(barA);
  out.group = s.barGroup(barA).length === 2;
  const cap = s.patronCapacity;
  s.patronCapacity = () => 99;
  const door = s.doorTile();
  const spawn = () => {
    const block = s.patrons.filter((p) => p.gx === door.gx && p.gy === door.gy);
    block.forEach((p) => { p.gx = -50; });
    s.trySpawnPatron();
    block.forEach((p) => { p.gx = door.gx; });
    const p = s.patrons[s.patrons.length - 1];
    p.gx = 6; p.gy = 12; p.moving = false;
    return p;
  };
  const guests = [spawn(), spawn(), spawn(), spawn()];
  s.patronCapacity = cap;
  // Everyone else stays away from this bar for the check.
  for (const p of s.patrons) if (!guests.includes(p) && p.queue && s.barGroup(barA).includes(p.queue)) s.leaveBarQueue(p);
  guests.forEach((p, i) => { s.joinBarQueue(p); p.queuedAt = s.time.now + i; });
  s.refreshBarLine(s.barGroup(barA));
  const where = (p) => `${p.targetGx},${p.targetGy}`;
  out.spots = guests.slice(0, 2).map(where).sort().join(' ');
  out.waiting = guests.slice(2).map(where).sort().join(' ');
  out.spotsOk = out.spots === '6,9 7,9' && guests[0].atSpot && guests[1].atSpot;
  out.lineOk = out.waiting === '6,10 7,10' && !guests[2].atSpot;
  // One leaves: the longest waiter steps up to the free spot.
  const freed = where(guests[0]);
  s.leaveBarQueue(guests[0]);
  out.stepUp = guests[2].atSpot && where(guests[2]) === freed;
  // Someone still walking to the counter isn't served.
  guests[1].readyToOrder = true;
  guests[1].moving = true;
  s.tickBars();
  out.notWhileWalking = !guests[1].servedBy;
  guests[1].readyToOrder = false;
  guests[1].moving = false;
  // Two bartenders, two customers ready: each takes a different spot.
  s.hireStaff(barB);
  const ready = [guests[1], guests[2]];
  for (const p of ready) { [p.gx, p.gy] = [p.targetGx, p.targetGy]; s.waitInLine(p); }
  out.ready = ready.every((p) => p.readyToOrder);
  s.tickBars();
  const staff = s.barGroup(barA).filter((u) => u.staff).map((u) => u.staff);
  out.claimed = staff.every((b) => b.task) && staff[0].task.unit !== staff[1].task.unit
    && staff.every((b) => b.task.unit.claimedBy === b && b.task.patron.servedBy === b);
  // Mixing takes about 3 seconds once they're there.
  const drinks0 = s.drinksSold || 0;
  for (const b of staff) {
    s.tweens.killTweensOf(b.container);
    b.atUnit = b.task.unit;
    b.task.phase = 'serve';
    b.task.until = s.time.now + 3000;
  }
  s.tickBars();
  out.notYet = (s.drinksSold || 0) === drinks0;
  for (const b of staff) b.task.until = s.time.now - 1;
  s.tickBars();
  out.served = (s.drinksSold || 0) - drinks0 === 2 && ready.every((p) => !p.queue) && staff.every((b) => !b.task);
  // Patience: nobody gives up before 20 s; after that some do, angrily.
  const w = guests[3];
  out.w = { queue: !!w.queue, atSpot: w.atSpot };
  w.patient = false; w.patienceCheckAt = 0;
  w.queuedAt = s.time.now - 10000;
  const rnd = Math.random;
  Math.random = () => 0.01;
  s.checkBarPatience(s.barGroup(barA));
  out.stillWaiting = !!w.queue;
  w.queuedAt = s.time.now - 25000;
  w.reactingUntil = 0;
  s.checkBarPatience(s.barGroup(barA));
  Math.random = rnd;
  out.gaveUp = !w.queue && w.reactingUntil > s.time.now;
  for (const p of guests) { if (p.queue) s.leaveBarQueue(p); s.startPatronDeparture(p); }
  s.removeProp(barB); // barA stays, staffed, for the checks below
  others.forEach((r) => s.attachStaff(r)); // the club's own bar back to work
  s.bartenderAllowance = allow;
  return out;
});
check('customers fill every spot along a long bar, then wait in rows behind and step up', queue.group && queue.spotsOk && queue.lineOk && queue.stepUp, JSON.stringify(queue));
check('bartenders each claim a different customer, take 3 s to serve, then serve (never while they walk)', queue.notWhileWalking && queue.ready && queue.claimed && queue.notYet && queue.served, JSON.stringify(queue));
check('nobody gives up on the bar before 20 s; after that some walk off angry', queue.stillWaiting && queue.gaveUp, JSON.stringify(queue));

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
  const sitAnim = !p.container.patronSprite || /^sit(talk)?_/.test(String(p.container.patronAnimState));
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

// The newer booths and sofas: every one has its art; a seat can face its
// own way (the Glow Lounge's two benches face each other); the Wood Lounge
// takes 3 x 2 tiles.
const moreSeats = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const keys = ['tikiHut', 'iglooBooth', 'glowLounge', 'woodLounge', 'tulipLounge', 'birdcageBooth', 'discoStage',
    'shellBooth', 'galaxyPods', 'donutLounge', 'gardenGazebo', 'fireSectional', 'cloudBed', 'kissSofa', 'bathtubSofa',
    'cruiserSofa', 'decoSofa', 'chesterfield', 'beerBench', 'cubeBench', 'rattanSeat'];
  const missing = keys.filter((k) => !s.hasLayerSprites(k));
  const lounge = s.restoreProp('glowLounge', 90, [12, 1]);
  const fronts = lounge ? [0, 2].map((i) => s.seatSpot(lounge, i).front) : null;
  const wood = s.restoreProp('woodLounge', 0, [1, 13]);
  const out = { missing, fronts, woodTiles: wood ? wood.tiles.length : 0 };
  for (const rec of [lounge, wood]) if (rec) s.removeProp(rec);
  return out;
});
check('all 21 new booths and sofas have their art', moreSeats.missing.length === 0, moreSeats.missing.join(', ') || '21 of 21');
check('a booth\'s seats can face each other (Glow Lounge)', moreSeats.fronts && moreSeats.fronts[0][0] === -moreSeats.fronts[1][0] && moreSeats.fronts[0][1] === -moreSeats.fronts[1][1] && (moreSeats.fronts[0][0] !== 0 || moreSeats.fronts[0][1] !== 0), JSON.stringify(moreSeats.fronts));
check('the Wood Lounge takes 3 x 2 tiles', moreSeats.woodTiles === 6, String(moreSeats.woodTiles));

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
// The October 2026 decorations: each has all four pictures, places, and
// the speaker stacks get bumping cones.
const newDecor = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const models = ['barrel', 'streetLamp', 'globeLamp', 'globeLampPink', 'crystal', 'crystalPink', 'glowPlinth', 'stack', 'stackPurple', 'partition', 'tank', 'tankBlue', 'gargoyle', 'robot', 'catStatue', 'waterfall', 'pagoda'];
  const missing = models.filter((m) => [0, 90, 180, 270].some((f) => !s.textures.exists(`decor_${m}_${f}`)));
  let spot = null;
  for (let gy = 1; gy < s.gridH - 1 && !spot; gy++) for (let gx = 1; gx < s.gridW - 1 && !spot; gx++) {
    if (s.footprintValid(s.getFootprint('speakerStack', 0, gx, gy), 'speakerStack')) spot = [gx, gy];
  }
  const rec = spot && s.restoreProp('speakerStack', 0, spot);
  const cones = rec?.speakerFx?.cones?.length || 0;
  if (rec) s.removeProp(rec);
  return { missing, cones };
});
check('the new decorations (barrel to pagoda) all have their pictures, and the speaker stack bumps four cones', newDecor.missing.length === 0 && newDecor.cones === 4, JSON.stringify(newDecor));

// The street outside: people line up at the rope and go in one by one.
const street = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const before = s.patrons.length;
  // Timers crawl in headless Chromium, so the line may still be empty: put
  // a few people in it straight away.
  while (s.streetQueue.length < 3) s.streetArrival(true);
  const inLine = s.streetQueue.length;
  s.streetQueue.forEach((p) => { p.arrived = true; s.walkStreetQueue(p, true); }); // everyone in their place
  const standing = s.streetQueue.filter((p) => p.arrived && !p.walking);
  const facing = standing.length > 0 && standing.every((p) => p.container.patronDir === 'back');
  const front = s.streetQueue[0];
  if (front) { front.arrived = true; front.walking = false; front.slot = 0; }
  // Make room inside, and clear the doorway.
  s.patronCapacity = () => 99;
  s.patronTileOccupied = () => false;
  s.admitFromLine();
  delete s.patronCapacity;
  delete s.patronTileOccupied;
  const sp = s.streetSpots();
  const slot0 = sp.slot(0);
  // Out on the left sidewalk behind the wall (which hides their legs),
  // starting at the door, everyone facing it.
  const outside = slot0.gx <= sp.t - 2 && Math.abs(slot0.gy - s.doorTile().gy) < 1 && sp.slot(1).gy > slot0.gy
    && s.streetBackLayer.list.includes(s.streetQueueLayer) && facing;
  return { inLine, after: s.streetQueue.length, before, bouncer: !!s.streetBouncer, lamps: s.streetLamps.commandBuffer.length > 0, outside, facing };
});
check('the line stands behind the left wall facing the door, with a bouncer and lamps; the front goes in', street.inLine > 0 && street.after === street.inLine - 1 && street.bouncer && street.lamps && street.outside, JSON.stringify(street));

// Guests have names; clicking one opens their card, and they have no
// lasting thought bubbles. Clicking a bartender shows Bottoms Up!, which doubles their
// speed for a while and then needs to recover. Luxury grows with what you
// place and raises tips.
const people = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const p = s.patrons.find((q) => !q.leaving && !q.gone);
  const screen = (c) => ({ x: s.world.x + c.x * s.world.scaleX, y: s.world.y + (c.y - 30) * s.world.scaleY });
  out.named = !!p.name && / /.test(p.name);
  let at = screen(p.container);
  const everyone = s.patrons;
  s.patrons = [p]; // nobody else standing in front of them
  out.clickedGuest = s.clickPerson(at);
  s.patrons = everyone;
  out.card = document.getElementById('infoCard').classList.contains('open') && document.getElementById('infoName').textContent === p.name;
  out.quote = document.getElementById('infoQuote').textContent;
  // No lasting thought bubbles (only the quick reactions that fade).
  out.bubble = !p.container.bubble && typeof s.updateGuestBubble === 'undefined';
  s.closeInfoCard();
  const bar = s.staffableRecords().find((r) => r.staff && r.staff.kind === 'bartender');
  at = screen(bar.staff.container);
  const crowd = s.patrons;
  s.patrons = []; // nobody standing in front of the bartender
  out.clickedBar = s.clickPerson(at) && s.infoCard && s.infoCard.kind === 'bartender';
  s.patrons = crowd;
  out.barCard = document.getElementById('bottomsUp').offsetParent !== null;
  // Line up three guests and serve them all at once (letting a few more in
  // first if the club is quiet).
  for (let i = 0; i < 6 && s.patrons.filter((q) => !q.leaving && !q.gone).length < 3; i++) {
    const n = s.patrons.length;
    s.trySpawnPatron();
    const fresh = s.patrons[n];
    if (fresh) { fresh.gx += 2 + i; fresh.gy += 1; } // step off the door so the next can come in
  }
  const line = s.patrons.filter((q) => !q.leaving && !q.gone).slice(0, 3);
  for (const q of s.patrons) if (q.queue) s.leaveBarQueue(q);
  for (const q of line) s.joinBarQueue(q);
  // A long line: the bartender says so in a speech bubble (not a banner).
  s.slammedHintAt = 0;
  s.checkSlammedBars();
  out.said = !!bar.staff.speech && s.barGroupQueue(bar).length >= 3;
  // Bottoms Up! doubles the bartender's speed for a while, then recovers.
  const before = s.bartenderSpeed(bar.staff);
  document.getElementById('bottomsUp').click();
  out.fast = before === 1 && s.bartenderSpeed(bar.staff) === 2;
  out.cooling = !s.bottomsUpReady(bar) && s.bottomsUp(bar) === false;
  bar.staff.fastUntil = s.time.now - 1;
  out.backToNormal = s.bartenderSpeed(bar.staff) === 1;
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
check('guests have no lasting thought bubbles over their heads', people.bubble, JSON.stringify(people));
check('a slammed bartender suggests Bottoms Up in a speech bubble; Bottoms Up doubles their speed for a while, then recovers', people.clickedBar && people.barCard && people.said && people.fast && people.cooling && people.backToNormal, JSON.stringify(people));
check('Luxury grows with what you place, shows in the top bar and raises tips', people.luxuryUp > 0 && people.tipsUp && people.luxuryShown, JSON.stringify(people));

// From the owner's screenshots, part two: the DJ's song box (Change, Like),
// seating a guest yourself, the VIP list, and the club's star rating.
const extras = await page.evaluate(async () => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const index0 = s.songIndex;
  s.songStartedAt -= 30000;
  document.getElementById('songChange').click();
  // Skip goes to the next song (or starts the only one again).
  out.changed = document.getElementById('songTitle').textContent === s.currentSong().title && s.time.now - s.songStartedAt < 1000
    && (s.songIndex !== index0 || s.songLength() === s.currentSong().lengthMs);
  // Opened from disk the songs (separate files) can't load: the
  // made-in-code tracks play instead. (Real songs are checked over http
  // at the end.)
  out.diskFallback = !s.currentSong().url && s.songLength() === 60000;
  const fans0 = s.fans;
  document.getElementById('songLike').click();
  document.getElementById('songLike').click();
  out.liked = Math.round((s.fans - fans0) * 10) / 10;
  // Seating: only at VIP booths. With just a couch the button is greyed
  // out; with a Red Velvet Booth the guest goes to it.
  const free = () => s.patrons.find((q) => !q.leaving && !q.gone && !q.sitting && !q.seat);
  if (!free()) s.trySpawnPatron();
  const p = free();
  const couch = s.restoreProp('couch', 0, [12, 9]);
  s.openInfoCard('guest', p);
  out.greyed = document.getElementById('seatGuest').classList.contains('disabled') && /no VIP booth/.test(document.getElementById('seatGuest').dataset.tip);
  out.couchOnly = s.seatGuest(p) === false && !p.seat;
  const booth = s.restoreProp('vipLounge', 0, [11, 11]);
  s.refreshInfoCard();
  out.lit = !document.getElementById('seatGuest').classList.contains('disabled');
  p.mood = 50; // room to cheer up
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
  // The Celebrity List: six celebrities by unlock level. The first visit
  // is by paid invitation; how good a time they have builds how much they
  // like the club, and once they've been and like it they come back on
  // their own, more often the more they like it.
  const realLevel = s.levelInfo.bind(s);
  s.levelInfo = () => ({ ...realLevel(), level: 18 });
  const queue0 = s.streetQueue;
  s.streetQueue = [];
  s.celebState = {};
  s.celebInvites = {};
  s.celebNextAt = {};
  out.noFreeVisits = s.celebDropIn() === null;
  const cash0 = s.cash;
  s.cash = 1000;
  out.invited = s.inviteCelebrity('rico') && s.cash === 1000 - 250 && s.celebStatus(s.celebDef('rico')) === 'invited';
  out.notTwice = s.inviteCelebrity('rico') === false;
  out.locked = s.inviteCelebrity('leo') === false; // level 24
  s.celebInvites.rico = 0;
  const drop = s.celebDropIn();
  out.arrives = !!drop && drop.celeb === 'rico' && !s.celebInvites.rico;
  s.cash = cash0;
  const q = s.patrons.find((x) => !x.leaving && !x.gone);
  const others = s.patrons.filter((x) => x !== q && !x.gone && !x.leaving);
  others.forEach((x) => { x.reactingUntil = 0; });
  const cashBefore = s.cash;
  const rnd = Math.random;
  Math.random = () => 0.1; // everyone reacts and tips
  s.welcomeCelebrity(q, 'rico');
  Math.random = rnd;
  out.welcomed = q.celeb && q.celeb.key === 'rico' && q.name === 'Rico Diamond' && s.celebTipFactor(q) > 1
    && document.getElementById('bigPopup').querySelector('.bpSub').textContent.includes('★');
  out.crowdReacts = others.length === 0 || others.every((x) => x.reactingUntil > s.time.now);
  out.reactionTex = s.textures.exists('react_stars');
  // A great visit: happy, seated at a VIP booth, a drink on the house.
  q.mood = 90; q.vipSeated = true; q.onTheHouse = true;
  const delta = s.celebVisitOver(q);
  const rec = s.celebRecord('rico');
  out.celebLiked = delta > 20 && rec.visits === 1 && rec.liking === delta;
  q.celeb = null; // they've gone home
  // Now they come back on their own when their time comes.
  s.celebNextAt.rico = s.time.now + 60000;
  out.notYet = s.celebDropIn() === null;
  s.celebNextAt.rico = 0;
  const back = s.celebDropIn();
  out.returns = !!back && back.celeb === 'rico';
  // The more they like the club, the sooner they're back.
  rec.liking = 100;
  const soon = s.celebReturnMs('rico');
  rec.liking = 15;
  out.fasterWhenLiked = soon < s.celebReturnMs('rico');
  rec.liking = 80;
  out.regular = s.isRegular('rico');
  // A bad visit costs liking; below the line they don't come back alone.
  const max = s.celebRecord('max');
  max.visits = 1; max.liking = 5;
  s.celebNextAt.max = 0;
  out.coldNoReturn = !s.celebDropIn() || s.celebDropIn().celeb !== 'max';
  out.flagsReset = true;
  s.streetQueue = [];
  q.celeb = s.celebDef('rico');
  document.getElementById('navCelebs').click();
  const cards = [...document.querySelectorAll('#shopItems .celebSlot')];
  out.list = cards.map((c) => `${c.querySelector('.celebName').textContent}|${c.querySelector('.celebStars').textContent}|${c.querySelector('.propCost').textContent}|${!!c.querySelector('.icon').style.backgroundImage}`);
  out.listed = cards.length === 6
    && out.list[0] === 'Rico Diamond|★|In Club|true'
    && out.list[1] === 'Max Volt|★|Invite $250|true'
    && out.list[2] === 'DJ Kai Blaze|★★|Invite $500|true'
    && out.list[3].startsWith('Leo Lux|★★★|🔒 Lv 24')
    && out.list[5].startsWith('Jett Starr|★★★★★|🔒 Lv 37')
    && cards[3].classList.contains('locked')
    && !!cards[0].querySelector('.regularTag') && !!cards[0].querySelector('.celebLiking');
  out.tab = document.querySelector('.dockTab.active')?.id;
  s.saveGame();
  const savedC = JSON.parse(localStorage.getItem('clubNovaSave_v2'));
  out.celebSaved = savedC.celebs && savedC.celebs.rico && savedC.celebs.rico.liking === 80 && savedC.celebs.rico.visits === 1;
  document.getElementById('navBuild').click();
  s.streetQueue = queue0;
  s.levelInfo = realLevel;
  s.celebState = {};
  s.celebNextAt = {};
  q.celeb = null;
  // Rating: the average of recent ratings.
  const stars0 = s.nightStars;
  s.nightStars = [3, 4];
  s.updateUI();
  out.rating = s.clubRating();
  out.ratingShown = document.getElementById('ratingVal').textContent;
  out.faster = s.ratingArrivalFactor() > 1;
  s.saveGame();
  const saved = JSON.parse(localStorage.getItem('clubNovaSave_v2'));
  out.saved = saved.nightStars.join() === '3,4' && !('vips' in saved);
  s.nightStars = stars0;
  return out;
});
check('the song box changes tracks, and Like gives a fan once a song', extras.changed && extras.liked === 1, JSON.stringify(extras));
check('opened from disk, the club plays the made-in-code tracks (the songs are separate files)', extras.diskFallback, JSON.stringify(extras));
check('guests can only be seated at a VIP booth; the button is greyed out without one', extras.greyed && extras.couchOnly && extras.lit && extras.seated, JSON.stringify(extras));
check('a drink on the house, once a visit', extras.onHouse, JSON.stringify(extras));
check('a guest can be sent to the dance floor', extras.danced, JSON.stringify(extras));
check('the Celebrity List shows six celebrities with portrait, name, fame stars, how much they like the club, and their invite fee', extras.tab === 'navCelebs' && extras.listed, JSON.stringify(extras.list));
check('celebrities come first by paid invitation only', extras.noFreeVisits && extras.invited && extras.notTwice && extras.locked && extras.arrives, JSON.stringify(extras));
check('when a celebrity walks in, the crowd gets star eyes, goes wild and tips', extras.welcomed && extras.crowdReacts && extras.reactionTex, JSON.stringify(extras));
check('a great visit (VIP booth, drink on the house) builds liking; they come back on their own, sooner the more they like the club, and become regulars', extras.celebLiked && extras.notYet && extras.returns && extras.fasterWhenLiked && extras.regular && extras.coldNoReturn, JSON.stringify(extras));
check('what celebrities think of the club is saved', extras.celebSaved, JSON.stringify(extras));
check('the club rating is the average of recent ratings, shown at the top', extras.rating === 3.5 && extras.ratingShown === '3.5' && extras.faster, JSON.stringify(extras));
check('ratings are saved', extras.saved, JSON.stringify(extras));

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
  s.fans = s.fansForLevel(5);
  out.level4 = s.levelInfo().level === 5 && s.bartenderAllowance() === 2;
  out.hired = s.hireStaff(units[0]) && !!units[1].staff && !units[0].staff;
  out.allWorked = units.every((u) => s.isWorked(u));
  out.limit2 = s.hireStaff(units[0]) === false;
  // Level 7: a third, joining the same long bar; the two spread out.
  s.fans = s.fansForLevel(10);
  out.level7 = s.levelInfo().level === 10 && s.bartenderAllowance() === 3;
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
check('your level sets how many bartenders you can hire (1, then 2 at level 5, 3 at level 10)', longBar.limit1 && longBar.level4 && longBar.hired && longBar.limit2 && longBar.level7, JSON.stringify(longBar));
check('a long bar can take more bartenders, spread along it, and let one go', longBar.second && longBar.letGo, JSON.stringify(longBar));
check('a long bar keeps its bartender when the unit they stood at is sold', longBar.split && longBar.kept, JSON.stringify(longBar));

// Throw a Party: the picker lists every party; a House Party costs $60,
// counts down first, then a crowd lines up outside
// and is let in a few at a time; it lets more guests in with bigger tips;
// one at a time; after 3 minutes its guests drift home and it earns fans.
const party = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const later = s.time.delayedCall.bind(s.time);
  s.time.delayedCall = (ms, fn) => fn(); // the crowd's staggered arrival, straight away
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
    closed: !document.getElementById('partyPicker').classList.contains('open'),
    labelAtStart,
    countdown: s.partyPhase === 'countdown' && s.partyEffect('tips', 1) === 1 && /Starts in: 0:\d\d/.test(document.getElementById('bannerLeft').textContent),
  };
  // The countdown ends: the party starts and the crowd turns up.
  s.streetQueue.slice().forEach((p) => p.container.destroy());
  s.streetQueue.length = 0;
  s.partyStartsAt = s.time.now - 1;
  s.updatePartyButton();
  out.running = s.partyPhase === 'running';
  out.capacity = s.patronCapacity() - cap0;
  out.tips = s.partyEffect('tips', 1);
  out.button = document.getElementById('partyButton').dataset.state;
  out.banner = document.getElementById('partyBanner').classList.contains('open') && /House Party/.test(document.getElementById('bannerName').textContent) && /Ends in: \d+:\d\d/.test(document.getElementById('bannerLeft').textContent);
  out.crowdInLine = s.streetQueue.filter((p) => p.info && p.info.partyGuest).length;
  out.crowdWaiting = (s.partyCrowd || []).length;
  // The bouncer lets them in a few at a time, not all at once.
  s.streetQueue.forEach((p) => { p.arrived = true; p.walking = false; });
  s.streetQueue[0].slot = 0;
  const cap = s.patronCapacity;
  s.patronCapacity = () => 99;
  const occ = s.patronTileOccupied;
  s.patronTileOccupied = () => false;
  const inLine = s.streetQueue.length;
  s.lastAdmitAt = 0;
  s.admitFromLine();
  s.admitFromLine(); // too soon for the next one
  out.gradual = s.streetQueue.length >= inLine - 1;
  s.patronCapacity = cap;
  s.patronTileOccupied = occ;
  // A celebrity wears a star and gets a welcome.
  const guest = s.patrons.find((p) => !p.leaving && !p.gone);
  if (guest) {
    s.notePartyGuest(guest);
    s.welcomeCelebrity(guest, 'jett');
    out.celeb = guest.celeb && guest.name === 'Jett Starr' && !!guest.container.starIcon && s.celebTipFactor(guest) >= 3;
  }
  out.second = s.throwParty('hiphop');
  // Time's up: party guests head home over the next minute; fans for the party.
  const fans = s.fans;
  if (guest) guest.despawnAt = s.time.now + 10 * 60000;
  s.partyStartedAt -= 3 * 60 * 1000 + 1000;
  s.updatePartyButton();
  out.ended = s.party === null && s.partyEffect('capacity', 0) === 0 && !document.getElementById('partyBanner').classList.contains('open');
  const sum = document.getElementById('partySummary');
  out.summary = sum.classList.contains('open') ? [...sum.querySelectorAll('.summaryRow')].map((r) => `${r.querySelector('.sLabel').textContent}=${r.querySelector('.sValue').textContent}`) : null;
  document.getElementById('partySummaryOk').click();
  out.summaryClosed = !sum.classList.contains('open');
  out.drift = !guest || (guest.despawnAt <= s.time.now + 71000 && guest.despawnAt > s.time.now);
  out.fans = s.fans >= fans;
  s.time.delayedCall = later;
  return out;
});
check('the party picker lists seven parties, the fancy ones locked at first', party.labelAtStart === 'Throw a Party' && party.rows === 7 && party.locked >= 1, JSON.stringify(party));
check('a House Party costs $60 and counts down before it starts', party.paid === 60 && party.closed && party.countdown, JSON.stringify(party));
check('when it starts, a crowd lines up outside and gets let in a few at a time', party.running && party.crowdInLine > 0 && party.crowdInLine + party.crowdWaiting >= 6 && party.gradual, JSON.stringify(party));
check('during the party tips are higher, with a timer banner', party.tips > 1 && party.banner && party.button === 'active', JSON.stringify(party));
check('celebrities wear a star and tip big', party.celeb, JSON.stringify(party));
check('one party at a time; at the end its guests drift home over a minute and it earns fans', party.second === false && party.ended && party.drift && party.fans, JSON.stringify(party));
check('a party ends with a wrap-up of what happened during it, and closing it carries on', !!party.summary && party.summaryClosed
  && ['Guests admitted', 'Celebrities', 'Drinks served', 'Drink revenue', 'Bonuses collected', 'Average happiness', 'Fights / ejections'].every((l) => party.summary.some((r) => r.startsWith(l + '=')))
  && party.summary.some((r) => r.startsWith('Celebrities=Jett Starr')) && party.summary.some((r) => /^Guests admitted=[1-9]/.test(r)), JSON.stringify(party.summary));

// Guest visits: 4-8 minutes, each guest a type with their own tastes,
// moving through activities (dance 30-90 s, drink 20-45 s, chat with
// someone nearby), and leaving when the visit is over, not after one dance.
const visits = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const now = s.time.now;
  const cap = s.patronCapacity;
  s.patronCapacity = () => 99;
  const before = s.patrons.length;
  // Clear the doorway for two test guests.
  const door = s.doorTile();
  const block = s.patrons.filter((p) => p.gx === door.gx && p.gy === door.gy);
  block.forEach((p) => { p.gx = -50; });
  s.trySpawnPatron();
  const a = s.patrons[s.patrons.length - 1];
  a.gx = -60;
  s.trySpawnPatron();
  const b = s.patrons[s.patrons.length - 1];
  block.forEach((p) => { p.gx = door.gx; });
  s.patronCapacity = cap;
  out.spawned = s.patrons.length === before + 2;
  const visit = a.despawnAt - now;
  out.visit = visit >= 4 * 60000 - 1000 && visit <= 8 * 60000 + 1000 && !!a.type && !!a.type.weights;
  // Dance: off to a dance floor tile; once there, dancing for 30-90 s.
  [a.gx, a.gy] = [2, 2];
  out.danceStarted = s.beginActivity(a, 'dance') && s.isDanceFloorTile(a.targetGx, a.targetGy);
  [a.gx, a.gy] = [a.targetGx, a.targetGy];
  s.arriveForActivity(a);
  const dance = a.activity.until - s.time.now;
  out.dancing = a.container.patronAnimState.startsWith('dance') && dance >= 29000 && dance <= 91000;
  // A drink: they drink it for 20-45 s.
  const bar = s.hireableRecords().find((r) => s.isWorked(r));
  s.serveDrink(bar, a);
  const drink = a.activity.until - s.time.now;
  out.drinking = a.activity.kind === 'drink' && a.activity.phase === 'drinking' && drink >= 19000 && drink <= 46000;
  // Chat: b walks up to a, and they talk for 30-75 s.
  a.activity = { kind: 'wander', until: s.time.now + 5000 };
  a.moving = false; b.moving = false;
  const spots = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [a.gx + dx, a.gy + dy]);
  [b.gx, b.gy] = spots.find(([x, y]) => x >= 0 && y >= 0 && !s.isBlockingProp(x, y)) || [a.gx + 1, a.gy];
  s.lastArgumentAt = s.time.now; // no argument this time (see the security checks)
  out.chatStarted = s.startChat(b) && b.chatWith === a && a.chatWith === b;
  [b.gx, b.gy] = [b.targetGx, b.targetGy];
  s.chatArrive(b);
  const chat = a.activity.until - s.time.now;
  out.chatting = a.activity.chatting && b.activity.chatting && chat >= 29000 && chat <= 76000;
  // Visit over: the next pick sends them home.
  s.endChat(b);
  b.despawnAt = s.time.now - 1;
  b.activity = null;
  s.chooseActivity(b);
  out.leaves = b.leaving === true;
  s.startPatronDeparture(a);
  return out;
});
check('guests stay 4-8 minutes and each has their own tastes', visits.spawned && visits.visit, JSON.stringify(visits));
check('guests dance for 30-90 s, drink for 20-45 s and chat with each other for 30-75 s', visits.danceStarted && visits.dancing && visits.drinking && visits.chatStarted && visits.chatting, JSON.stringify(visits));
check('guests leave when their visit is over', visits.leaves, JSON.stringify(visits));

// Interactions: dancers side by side may dance together; a chat can turn
// into an argument (💢), the security guard walks over and calms it down,
// or it becomes a cartoon fight and one of them is thrown out.
const fight = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const g = s.guard;
  out.guard = !!g && g.gx >= 0 && g.gy >= 0 && s.inGrid(g.gx, g.gy) && g.container.visible;
  const cap = s.patronCapacity;
  s.patronCapacity = () => 99;
  const door = s.doorTile();
  const spawn = () => {
    const block = s.patrons.filter((p) => p.gx === door.gx && p.gy === door.gy);
    block.forEach((p) => { p.gx = -50; });
    s.trySpawnPatron();
    block.forEach((p) => { p.gx = door.gx; });
    const p = s.patrons[s.patrons.length - 1];
    p.gx = -60 - s.patrons.length;
    return p;
  };
  const a = spawn();
  const b = spawn();
  s.patronCapacity = cap;
  const rnd = Math.random;
  // The next random pick is v (only the next: Phaser names textures randomly).
  const once = (v) => { Math.random = () => { Math.random = rnd; return v; }; };
  // Dancing together.
  for (const p of [a, b]) { p.moving = false; p.dancePartner = null; }
  [a.gx, a.gy] = [5, 6];
  [b.gx, b.gy] = [6, 6];
  a.activity = { kind: 'dance', until: s.time.now + 40000 };
  b.activity = { kind: 'dance', until: s.time.now + 30000 };
  once(0.001);
  s.maybeDanceTogether(b);
  out.together = a.dancePartner === b && b.dancePartner === a && a.activity.until === b.activity.until;
  s.endDanceTogether(a);
  // An argument that security settles.
  const tidy = () => { if (s.argument) s.clearArgument(); };
  tidy();
  s.lastArgumentAt = -Infinity;
  once(0.001);
  out.argues = s.maybeArgue(a, b);
  out.angry = !!a.container.angerIcon && !!b.container.angerIcon && a.arguing && b.arguing && a.nextMoveAt === Infinity;
  out.guardGoing = !!g.goal;
  once(0.001); // settles it
  s.guardArrived();
  out.settled = !s.argument && !a.container.angerIcon && !a.arguing && !b.arguing && !a.leaving && !b.leaving;
  out.cooldown = s.maybeArgue(a, b) === false; // not again straight away
  // An argument that turns into a fight and an ejection.
  s.startArgument(a, b);
  once(0.99); // he can't calm them down
  s.guardArrived();
  out.fighting = s.argument && s.argument.state === 'fight' && !!s.argument.cloud && !a.container.visible && !b.container.visible;
  s.argument.fightEndsAt = s.time.now - 1;
  s.tickSecurity();
  const out1 = [a, b].filter((p) => p.ejected && p.leaving);
  const stay = [a, b].filter((p) => !p.leaving);
  out.ejected = out1.length === 1 && stay.length === 1 && a.container.visible && b.container.visible && !s.argument && !a.container.angerIcon;
  // Unresolved for too long: the argument turns into a fight on its own.
  tidy();
  s.patronCapacity = () => 99;
  const c = spawn();
  s.patronCapacity = cap;
  [c.gx, c.gy] = [7, 7];
  s.startArgument(stay[0], c);
  s.argument.fightAt = s.time.now - 1;
  s.tickSecurity();
  out.escalates = s.argument && s.argument.state === 'fight';
  tidy();
  for (const p of [a, b, c]) if (!p.leaving) s.startPatronDeparture(p);
  return out;
});
check('a security guard stands inside the club', fight.guard, JSON.stringify(fight));
check('guests dancing side by side sometimes dance together', fight.together, JSON.stringify(fight));
check('a chat can turn into an argument with anger icons, and security walks over and settles it', fight.argues && fight.angry && fight.guardGoing && fight.settled && fight.cooldown, JSON.stringify(fight));
check('an argument security cannot settle becomes a cartoon fight and one guest is ejected', fight.fighting && fight.ejected && fight.escalates, JSON.stringify(fight));


// Levels get slower: 250 fans for level 2, and each level after needs more
// than the one before.
const levels = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const fans = s.fans;
  const at = (n) => { s.fans = n; return s.levelInfo().level; };
  const out = { at: [at(0), at(119), at(120), at(s.fansForLevel(3) - 1), at(s.fansForLevel(3)), at(s.fansForLevel(5))].join(), steps: [1, 2, 3, 4, 5].map((l) => s.fansToNextLevel(l)) };
  s.fans = fans;
  return out;
});
check('levels need more XP each time (120 for level 2)', levels.at === '1,1,2,2,3,5' && levels.steps.every((v, i, a) => i === 0 || v > a[i - 1] + (a[i - 1] - (a[i - 2] || 0)) * 0), JSON.stringify(levels));

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
  out.rated = s.nightStars[s.nightStars.length - 1] === 5 && s.fans >= fans0 + 2 && s.vibeCount === 0;
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
  for (let gy = 1; gy < s.gridH - 1 && !spot; gy++) for (let gx = 1; gx < s.gridW - 1 && !spot; gx++) {
    if (s.footprintValid(s.getFootprint('woodStool', 0, gx, gy), 'woodStool')) spot = [gx, gy];
  }
  s.selectProp('woodStool');
  s.placeProp(spot[0], spot[1]);
  s.deselectProp();
  document.querySelector('.storeTab[data-tip-name="Edit"]').click();
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
  document.getElementById('navInventory').click();
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
  for (let gy = 1; gy < s.gridH - 1 && !free; gy++) for (let gx = 1; gx < s.gridW - 1 && !free; gx++) {
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
check('Edit has Move, Turn, Put away, Sell and Clear Club', inv.tools === 'move,rotate,store,sell,clear', inv.tools);
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
  for (let gy = 2; gy < s.gridH - 2; gy++) for (let gx = 2; gx < s.gridW - 2; gx++) {
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
  const pictures = [...document.querySelectorAll('#levelUnlocks .unlockPic')].every((p) => p.style.backgroundImage || p.querySelector('svg') || p.textContent || (p.querySelector('.unlockFace') && p.querySelector('.unlockFace').style.backgroundImage));
  const out = { open: document.getElementById('levelUp').classList.contains('open'), title: document.getElementById('levelUpTitle').textContent, names, pictures };
  document.getElementById('levelOk').click();
  out.bartender = Object.getPrototypeOf(s).unlocksAt.call(s, 5).some((u) => u.name === '+1 Bartender') && !s.unlocksAt(4).some((u) => u.name === '+1 Bartender');
  out.celeb = s.unlocksAt(8).some((u) => u.name === 'Rico Diamond' && u.portrait !== undefined);
  out.closed = !document.getElementById('levelUp').classList.contains('open');
  return out;
});
check('levelling up shows a menu of everything unlocked, each with a picture', lvl.open && lvl.title === 'Level 5!' && lvl.names.includes('Soft Glow') && lvl.names.includes('Stripes') && lvl.names.includes('Hip Hop Night') && lvl.celeb && lvl.names.some((n) => /Walls up to/.test(n)) && lvl.pictures && lvl.closed && lvl.bartender, JSON.stringify(lvl));

// A new club's walls are beaten-up torn wallpaper; brick is a level 5 wallpaper.
const walls = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return { bare: [...new Set((s.bareWallImages || []).map((i) => i.texture.key))] };
});
check('the bare walls are torn old wallpaper', walls.bare.length > 0 && walls.bare.every((k) => /tornPaper/.test(k)), JSON.stringify(walls));
await page.click('#navInventory');

// Buttons are drawn icons with no words on them; hovering one pops up its
// name and what it does.
const icons = await page.evaluate(() => {
  // (The dock's pads carry their name in a label under the picture.)
  const ids = ['navBuild', 'navStaff', 'navClub', 'navInventory', 'navCelebs', 'goalTab', 'boostButton', 'rushButton', 'partyButton', 'songChange', 'songLike',
    'tipsButton', 'muteButton', 'restartButton', 'backupButton'];
  const bare = ids.filter((id) => {
    const el = document.getElementById(id);
    const words = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    return !el.querySelector('svg.uiGlyph, svg.uiArt') || words !== '' || !el.dataset.tipName;
  });
  const tabs = [...document.querySelectorAll('.storeTab')];
  // (A drawing may have letters in it, like NEW's burst; words on the
  // button itself are what's not allowed.)
  const ownWords = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
  return { bare, tabs: tabs.length, tabIcons: tabs.filter((t) => t.querySelector('svg.uiGlyph, svg.uiArt') && t.dataset.tipName && !ownWords(t)).length };
});
await page.hover('#boostButton');
await page.waitForTimeout(200);
const hoverTip = await page.evaluate(() => {
  const t = document.getElementById('hoverTip');
  return { shown: !!t && t.classList.contains('show'), name: t?.querySelector('.tipName').textContent, text: t?.querySelector('.tipText').textContent };
});
await page.mouse.move(5, 400);
check('buttons and shop tabs are icons with no words, each with a hover name', icons.bare.length === 0 && icons.tabs === 9 && icons.tabIcons === 9, JSON.stringify(icons));
check('hovering Bass Boost pops up its name and what it does', hoverTip.shown && hoverTip.name === 'Bass Boost!' && hoverTip.text.length > 10, JSON.stringify(hoverTip));

// Goals: three show at a time with their progress; finishing one pays its
// cash and XP, brings in the next and is saved.
const goals = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  delete s.completeGoal; // the real payout (waitForScene stubs it)
  s.goalsDone = [];
  s.goalStats = {};
  s.checkGoals();
  const out = { showing: document.querySelectorAll('#goalList .goalRow').length };
  const first = s.activeGoals()[0];
  out.first = first.id;
  const cash = s.cash;
  const fans = s.fans;
  s.bumpGoal(first.stat, 1);
  out.partial = document.querySelector(`#goalList [data-goal="${first.id}"] .goalCount`)?.textContent;
  s.bumpGoal(first.stat, first.target);
  out.paid = s.cash - cash;
  out.xp = s.fans - fans;
  out.reward = [first.cash, first.xp];
  out.gone = !document.querySelector(`#goalList [data-goal="${first.id}"]`);
  out.stillThree = document.querySelectorAll('#goalList .goalRow').length;
  s.saveGame();
  const saved = JSON.parse(localStorage.getItem('clubNovaSave_v2'));
  out.saved = (saved.goalsDone || []).includes(first.id) && saved.goalStats && saved.goalStats[first.stat] >= first.target;
  return out;
});
check('goals show three at a time, track progress, pay cash and XP when done, and are saved', goals.showing === 3 && goals.partial === '1/' + (goals.partial || '').split('/')[1] && goals.paid === goals.reward[0] && goals.xp === goals.reward[1] && goals.gone && goals.stillThree === 3 && goals.saved, JSON.stringify(goals));

// The new shop buttons: Edit Floor opens the store on Floors (and lights
// up), Store goes back to the last category, Sell opens Edit with the Sell
// tool; NEW lists what the last two levels unlocked, each tagged NEW; the
// Inventory button shows how many things are in it; Clear Club puts
// everything but the DJ booth and bars away.
const shopUi = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const lit = () => [...document.querySelectorAll('.dockTab.active')].map((e) => e.id).join();
  const out = {};
  s.closeDock();
  document.getElementById('navStaff').click();
  out.staff = { tab: s.dockTab, mode: document.getElementById('dock').dataset.mode, lit: lit(), cards: document.querySelectorAll('#shopItems .staffSlot').length };
  document.getElementById('navClub').click();
  document.querySelector('.storeTab[data-tip-name="Expand"]').click();
  out.expand = { tab: s.dockTab, lit: lit(), cards: document.querySelectorAll('#shopItems .expandSlot').length };
  document.getElementById('navStaff').click();
  document.getElementById('navClub').click();
  out.clubRemembers = s.dockTab === 'expand';
  document.getElementById('navBuild').click();
  document.querySelector('.storeTab[data-tip-name="Bars"]').click();
  out.bars = { tab: s.dockTab, lit: lit() };
  document.querySelector('.storeTab[data-tip-name="Edit"]').click();
  out.edit = { tab: s.dockTab, lit: lit() };
  out.tools = [...document.querySelectorAll('#shopItems .toolSlot')].map((e) => e.dataset.tool).join();
  // NEW: at level 7, things that unlock at levels 6 and 7.
  const real = s.levelInfo.bind(s);
  s.levelInfo = () => ({ ...real(), level: 7 });
  s.setShopCategory('New');
  const slots = [...document.querySelectorAll('#shopItems .propSlot')];
  out.newCount = slots.length;
  out.allTagged = slots.length > 0 && slots.every((e) => e.querySelector('.newTag'));
  s.setShopCategory('Bars');
  out.barTags = [...document.querySelectorAll('#shopItems .propSlot')].filter((e) => e.querySelector('.newTag')).map((e) => e.dataset.tipName).join();
  s.levelInfo = real;
  // Inventory count.
  const before = { ...(s.inventory || {}) };
  s.inventory = { palm: 2, plant: 1 };
  s.updateShopUI();
  out.badge = document.getElementById('inventoryBadge').textContent;
  s.inventory = {};
  s.updateShopUI();
  out.badgeEmpty = document.getElementById('inventoryBadge').textContent;
  // Clear Club.
  const plant = s.restoreProp('plant', 0, [9, 9]);
  const counted = () => Object.values(s.placed).filter((r, i, a) => a.indexOf(r) === i);
  s.setDockTab('edit');
  document.querySelector('#shopItems .toolSlot[data-tool="clear"]').click();
  out.toolKept = s.editTool !== 'clear';
  out.asked = document.getElementById('clearConfirm').classList.contains('open');
  document.getElementById('clearYes').click();
  const left = counted().map((r) => r.type);
  out.cleared = !!plant && left.every((t) => /Booth|Bar|^bar$|^dj$/.test(t) || /Bar$/.test(t));
  out.plantStored = s.inventoryCount('plant') >= 1;
  out.closedAsk = !document.getElementById('clearConfirm').classList.contains('open');
  // Put the starter dance floor back for later checks.
  for (const t of Object.keys(s.inventory)) if (t === 'basicFloor') { for (let gx = 2; gx <= 4; gx++) for (let gy = 5; gy <= 7; gy++) s.restoreProp('basicFloor', 0, [gx, gy]); delete s.inventory.basicFloor; }
  s.inventory = before;
  s.updateShopUI();
  return out;
});
check('each dock pad lights up for its own panels: Staff, Club (Edit, Expand, remembered), Build', shopUi.staff.tab === 'staff' && shopUi.staff.mode === 'main' && shopUi.staff.lit === 'navStaff' && shopUi.staff.cards >= 1
  && shopUi.expand.tab === 'expand' && shopUi.expand.lit === 'navClub' && shopUi.expand.cards === 2 && shopUi.clubRemembers && shopUi.bars.tab === 'decor' && shopUi.bars.lit === 'navBuild'
  && shopUi.edit.tab === 'edit' && shopUi.edit.lit === 'navClub', JSON.stringify(shopUi));
check('Edit has Move, Turn, Put away, Sell and Clear Club', shopUi.tools === 'move,rotate,store,sell,clear', JSON.stringify(shopUi));
check('NEW lists what the last two levels unlocked, each tagged NEW, and the tags show in other categories too', shopUi.newCount > 3 && shopUi.allTagged && /Brewery Bar/.test(shopUi.barTags) && !/Wood Bar/.test(shopUi.barTags), JSON.stringify(shopUi));
check('the Inventory button shows how many things are in it', shopUi.badge === '3' && shopUi.badgeEmpty === '', JSON.stringify(shopUi));
check('Clear Club asks first, then puts everything but the DJ booth and bars into the inventory', shopUi.asked && shopUi.toolKept && shopUi.cleared && shopUi.plantStored && shopUi.closedAsk, JSON.stringify(shopUi));

// The player panel: the level, XP bar, cash and the song with its audio
// controls are all one panel. The Goals tab on the left side drops the
// goals down and closes them (or the x does), and a finished goal puts a !
// on it until opened.
const topUi = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const panel = document.getElementById('hudProfile');
  out.onePanel = ['levelVal', 'xpBarFill', 'cashVal', 'songTitle', 'songLike', 'songChange', 'muteButton'].every((id) => panel.contains(document.getElementById(id)));
  const goals = document.getElementById('goals');
  const shown = () => getComputedStyle(goals).display !== 'none';
  s.toggleGoals(false);
  out.startsClosed = !shown();
  document.getElementById('goalTab').click();
  out.opens = shown() && s.goalsOpen() && document.querySelectorAll('#goalList .goalRow').length === 3;
  document.getElementById('goalTab').click();
  out.closes = !shown();
  document.getElementById('goalTab').click();
  document.getElementById('goalsClose').click();
  out.xCloses = !shown();
  out.notInDock = !document.getElementById('dock').contains(goals) && !document.getElementById('navGoals');
  delete s.completeGoal;
  const done = [...s.goalsDone];
  s.completeGoal(s.activeGoals()[0]);
  out.badge = document.getElementById('goalsBadge').textContent;
  s.goalsDone = done;
  s.completeGoal = (goal) => { s.goalsDone.push(goal.id); };
  document.getElementById('goalTab').click();
  out.badgeCleared = document.getElementById('goalsBadge').textContent === '';
  s.toggleGoals(false);
  return out;
});
check('the level, XP, cash and song with its audio controls are one player panel', topUi.onePanel, JSON.stringify(topUi));

// The cash readout rolls up to a new amount, glowing while it rolls, and
// the buttons are candy: a white rim and their own colour.
const cashRoll = await page.evaluate(async () => {
  const s = window.__clubNova.scene.getScene('club');
  const el = document.getElementById('cashVal');
  s.updateUI();
  const before = s.cash;
  s.cash = before + 400;
  s.updateUI();
  const out = { rolling: el.classList.contains('rolling') };
  for (let i = 0; i < 60 && el.classList.contains('rolling'); i++) await new Promise((r) => setTimeout(r, 50));
  out.landed = el.textContent === '$' + Math.floor(s.cash).toLocaleString('en-US') && (s.cash < 1000 || el.textContent.includes(','));
  out.stopped = !el.classList.contains('rolling');
  s.cash = before;
  s.updateUI();
  const pad = getComputedStyle(document.getElementById('boostButton'));
  out.rim = pad.borderTopColor;
  out.padColour = pad.getPropertyValue('--c').trim();
  return out;
});
check('the cash rolls up to a new amount; buttons have the candy look', cashRoll.rolling && cashRoll.landed && cashRoll.stopped && cashRoll.rim === 'rgb(255, 255, 255)' && !!cashRoll.padColour, JSON.stringify(cashRoll));
check('the Goals tab on the side drops the goals down and closes them (tab or x), not in the dock; a finished goal puts a ! on it until opened', topUi.startsClosed && topUi.opens && topUi.closes && topUi.xCloses && topUi.notInDock && topUi.badge === '!' && topUi.badgeCleared, JSON.stringify(topUi));

// With a drink in hand a guest goes and sits down with it when a seat is
// free, or stands somewhere quiet, never on the dance floor.
const drinkSpot = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  let p = s.patrons.find((q) => !q.gone && !q.leaving && !q.sitting && !q.seat);
  if (!p) {
    const cap = s.patronCapacity;
    s.patronCapacity = () => 99;
    s.trySpawnPatron();
    s.patronCapacity = cap;
    p = s.patrons.find((q) => !q.gone && !q.leaving && !q.sitting && !q.seat);
  }
  if (!p) return { noGuest: true };
  const bar = Object.values(s.placed).find((r) => s.isWorked && s.isWorked(r));
  const realRandom = Math.random;
  Math.random = () => 0.99;          // the standing branch
  let onFloor = 0;
  for (let i = 0; i < 40; i++) {
    s.pickDrinkingSpot(p, bar);
    if (p.targetGx !== undefined && s.isDanceFloorTile(p.targetGx, p.targetGy)) onFloor++;
  }
  Math.random = realRandom;
  out.onFloor = onFloor;
  // A free couch: they take a seat with the drink.
  let spot = null;
  for (let gy = 1; gy < s.gridH - 1 && !spot; gy++) for (let gx = 1; gx < s.gridW - 1 && !spot; gx++) {
    if (s.footprintValid(s.getFootprint('couch', 0, gx, gy), 'couch')) spot = [gx, gy];
  }
  const couch = spot && s.restoreProp('couch', 0, spot);
  Math.random = () => 0.01;
  s.pickDrinkingSpot(p, bar);
  Math.random = realRandom;
  out.seated = !!p.seat && p.seat.rec === couch;
  s.releaseSeat(p);
  if (couch) s.removeProp(couch);
  return out;
});
check('a guest with a drink sits down with it when a seat is free, and never drinks on the dance floor', !drinkSpot.noGuest && drinkSpot.onFloor === 0 && drinkSpot.seated, JSON.stringify(drinkSpot));

// Guests from the owner's 3D model: their own sheet and frame grid, with
// two more clips (drink, sittalk); the drawn guests stand or sit instead.
const model3d = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  let idx = 0;
  while (s.textures.exists(`patron_${idx}`) && !s.anims.exists(`patron_${idx}_drink_front`)) idx++;
  out.found = s.anims.exists(`patron_${idx}_drink_front`) && s.anims.exists(`patron_${idx}_sittalk_back`);
  out.drawnFallback = s.patronAnimKey({ patronCharacter: 0, patronDir: 'front' }, 'drink') === 'patron_0_idle_front'
    && s.patronAnimKey({ patronCharacter: 0, patronDir: 'back' }, 'sittalk') === 'patron_0_sit_back';
  if (!out.found) return out;
  const c = s.drawPatronCharacterSprite(100, 100, 1, idx);
  const guest = { container: c };
  s.setPatronAnimation(guest, 'drink');
  out.drinking = c.patronSprite.anims.currentAnim.key;
  s.setPatronAnimation(guest, 'sittalk');
  out.talking = c.patronSprite.anims.currentAnim.key;
  // Drawn at the same standing height as the drawn guests.
  const drawn = s.drawPatronCharacterSprite(100, 100, 1, 0);
  out.sameScale = Math.abs(c.patronSprite.scaleY - drawn.patronSprite.scaleY * 121.1 / 118) < 0.02;
  out.idx = idx;
  c.destroy();
  drawn.destroy();
  return out;
});
check('guests made from the owner\'s 3D model load with drink and sit-and-talk clips; drawn guests fall back to standing and sitting', model3d.found && model3d.drawnFallback && ( model3d.drinking === `patron_${model3d.idx}_drink_front` && model3d.talking === `patron_${model3d.idx}_sittalk_front` && model3d.sameScale), JSON.stringify(model3d));

// The drink meter on the right edge fills with drinks, tips and bonuses;
// full, drinks cost double for 30 seconds while it drains, then it empties.
const meter = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const el = document.getElementById('drinkMeter');
  s.doubleDrinksUntil = 0;
  s.meterLevel = 0;
  s.noteIncome('drinkMoney', 10);
  out.afterDrink = s.meterLevel;
  s.noteIncome('tips', 3);
  out.afterTip = s.meterLevel;
  s.noteIncome('bonuses', 88);
  out.afterBonus = s.meterLevel;
  s.noteIncome('wages', 50);
  out.wagesIgnored = s.meterLevel === out.afterBonus;
  out.fillShown = el.style.getPropertyValue('--fill');
  const bar = Object.values(s.placed).find((r) => r.type && /Bar/i.test(r.type));
  if (!s.patrons.some((p) => !p.gone)) { s.patronCapacity = () => 99; s.trySpawnPatron(); }
  const guest = s.patrons.find((p) => !p.gone);
  out.found = [!!bar, !!guest];
  if (guest) guest.order = 'cocktail';
  out.normalPrice = bar && guest ? s.serveDrink(bar, guest) : null;
  s.fillMeter(1000);
  out.doubled = s.drinksDoubled() && el.classList.contains('doubled');
  if (guest) guest.order = 'cocktail';
  out.doublePrice = bar && guest ? s.serveDrink(bar, guest) : null;
  out.frozen = (() => { const l = s.meterLevel; s.fillMeter(5); return s.meterLevel === l; })();
  s.doubleDrinksUntil = s.time.now - 1;
  s.tickMeter();
  out.over = !s.drinksDoubled() && s.meterLevel === 0 && !el.classList.contains('doubled');
  out.noZoom = !document.getElementById('zoomSlider') && !document.getElementById('zoomIn');
  return out;
});
check('the drink meter fills with drinks, tips and bonuses (not wages) and shows it', meter.afterDrink === 2 && meter.afterTip === 3 && meter.afterBonus === 8 && meter.wagesIgnored && meter.fillShown === '8.0%' && meter.noZoom, JSON.stringify(meter));
check('a full drink meter doubles drink prices for a while, then empties', meter.doubled && meter.normalPrice > 0 && meter.doublePrice === meter.normalPrice * 2 && meter.frozen && meter.over, JSON.stringify(meter));

// Money pops up over guests in big outlined letters; while a boost
// multiplies tips, "+1.5x Tip!" rides above the amount.
const moneyPop = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const plain = s.floatMoney(100, 100, '$5');
  const until = s.boostUntil;
  s.boostUntil = s.time.now + 30000;
  const boosted = s.floatMoney(100, 100, '$9');
  const cover = s.floatMoney(100, 100, '$5 Cover', false);
  s.boostUntil = until;
  const texts = (h) => h.list.map((t) => t.text);
  return { plain: texts(plain), boosted: texts(boosted), cover: texts(cover), big: parseInt(plain.list[0].style.fontSize, 10) };
});
check('money pops up big over guests, with "+1.5x Tip!" while tips are boosted (not on the cover charge)', moneyPop.plain.join() === '$5' && moneyPop.boosted.join() === '$9,+1.5x Tip!' && moneyPop.cover.join() === '$5 Cover' && moneyPop.big >= 20, JSON.stringify(moneyPop));

// Holding something to place always shows it where the pointer is, with the
// tiles it takes: green where it fits, red (and the picture tinted red)
// where it doesn't.
const held = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const real = s.levelInfo.bind(s);
  s.levelInfo = () => ({ ...real(), level: 10 });
  s.deselectProp();
  s.selectProp('vipLounge');
  const at = (gx, gy) => {
    s.hoverTile = { gx, gy };
    s.updateGhost();
    return { ghost: !!(s.ghost && s.ghost.visible), tinted: !!(s.ghost && s.ghost.isTinted), filled: s.footprintFill.commandBuffer.length > 0, outlined: s.footprintOutline.commandBuffer.length > 0 };
  };
  const bar = Object.values(s.placed).find((r) => /Bar$|^bar$/.test(r.type));
  let free = null;
  for (let x = 0; x < s.gridW && !free; x++) for (let y = 0; y < s.gridH && !free; y++) {
    if (s.footprintValid(s.getFootprint('vipLounge', s.currentFacing, x, y))) free = [x, y];
  }
  const out = { free: free ? at(...free) : null, blocked: at(bar.anchor[0], bar.anchor[1]) };
  s.deselectProp();
  s.levelInfo = real;
  out.clearedAfter = !s.ghost && s.footprintFill.commandBuffer.length === 0;
  return out;
});
check('a held item always shows with its tiles: green where it fits, red and tinted where it does not', held.free && held.free.ghost && !held.free.tinted && held.free.filled && held.free.outlined
  && held.blocked.ghost && held.blocked.tinted && held.blocked.filled && held.blocked.outlined && held.clearedAfter, JSON.stringify(held));

// The Neon Cartoon guy (art/characters/neon) is a guest too, with every
// clip in both views, standing the same height as the drawn guests.
const neon = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const i = s.textures.getTextureKeys().filter((k) => /^patron_\d+$/.test(k)).length - 1;
  const clips = ['idle', 'walk', 'dance', 'sit'].flatMap((c) => ['front', 'back'].map((d) => `patron_${i}_${c}_${d}`));
  const c = s.drawPatronCharacterSprite(0, 0, 1, i);
  const h = c.patronSprite.displayHeight;
  const d = s.drawPatronCharacterSprite(0, 0, 1, 0);
  const out = { i, anims: clips.every((k) => s.anims.exists(k)), height: Math.round(h), drawnHeight: Math.round(d.patronSprite.displayHeight) };
  c.destroy(); d.destroy();
  return out;
});
check('the Neon Cartoon guy is a guest with idle, walk, dance and sit, front and back', neon.anims && neon.height > 0, JSON.stringify(neon));

// The drink menu: drinks unlock with level and go on the menu; a click
// takes one off or puts it back (never the last one); guests order from the
// menu (celebrities the priciest), pay its price and fancier drinks take
// longer to mix; the level-up menu lists new drinks.
const drinkMenu = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const saved = { off: s.drinksOff, fans: s.fans };
  s.drinksOff = [];
  s.fans = 0;
  const out = { level1: s.drinkMenu().map((d) => d.key).join() };
  s.fans = s.fansForLevel(16);
  out.level8 = s.drinkMenu().map((d) => d.key).join();
  s.openDrinkMenu();
  out.cards = document.querySelectorAll('#drinkList .drinkCard').length;
  out.locked = document.querySelectorAll('#drinkList .drinkCard.locked').length;
  document.querySelector('#drinkList .drinkCard[data-drink="beer"]').click();
  out.beerOff = !s.isOnMenu('beer') && !document.querySelector('#drinkList .drinkCard[data-drink="beer"]').classList.contains('on');
  for (const k of ['cocktail', 'shots', 'mojito']) s.toggleDrink(k);
  out.lastStays = s.toggleDrink('martini') === false && s.drinkMenu().map((d) => d.key).join() === 'martini';
  out.order = s.pickDrink({}).key;
  out.celebOrder = (s.drinksOff = [], s.pickDrink({ celeb: {} }).key);
  document.getElementById('drinkMenuClose').click();
  out.closed = !document.getElementById('drinkMenu').classList.contains('open');
  const bar = s.hireableRecords().find((r) => s.isWorked(r));
  const guest = s.patrons.find((p) => !p.leaving);
  if (bar && guest) { guest.order = 'champagne'; out.price = s.serveDrink(bar, guest); }
  out.slower = s.drinkOf('champagne').mix > s.drinkOf('beer').mix;
  out.levelUpLists = s.unlocksAt(24).some((u) => u.name === 'Champagne' && /<svg/.test(u.svg));
  s.drinksOff = saved.off; s.fans = saved.fans;
  return out;
});
check('the drink menu: drinks unlock and go on the menu, toggle off and on (never the last), guests order from it, fancier ones pay more and mix slower',
  drinkMenu.level1 === 'beer' && drinkMenu.level8 === 'beer,cocktail,shots,mojito,martini' && drinkMenu.cards === 7 && drinkMenu.locked === 2 && drinkMenu.beerOff
  && drinkMenu.lastStays && drinkMenu.order === 'martini' && drinkMenu.celebOrder === 'martini' && drinkMenu.closed && (drinkMenu.price === undefined || drinkMenu.price >= 40) && drinkMenu.slower && drinkMenu.levelUpLists, JSON.stringify(drinkMenu));

// The daily gift: once a day; the streak moves on day by day (day 7 adds a
// decoration), starts over after a missed day, and only pays once a day.
const daily = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const show = Object.getPrototypeOf(s).showDaily;
  const saved = { cash: s.cash, fans: s.fans, daily: s.daily, inv: JSON.stringify(s.inventory) };
  s.daily = null;
  const out = {};
  out.shown = show.call(s, '2026-03-01') && document.getElementById('dailyBox').classList.contains('open');
  out.tiles = document.querySelectorAll('#dailyDays .dayTile').length;
  out.todayFirst = document.querySelector('#dailyDays .dayTile.today .dayName').textContent;
  const c0 = s.cash;
  document.getElementById('dailyCollect').click();
  out.paid = s.cash - c0;
  out.closed = !document.getElementById('dailyBox').classList.contains('open');
  out.again = show.call(s, '2026-03-01') === false && s.collectDaily('2026-03-01') === null;
  const days = [];
  for (const d of ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07']) days.push(s.collectDaily(d));
  out.streak = days.map((g) => g.day).join();
  out.day7decor = !!days[5].decor && s.inventoryCount(days[5].decor) > 0;
  out.wraps = s.collectDaily('2026-03-08').day === 1 || false;
  out.missed = s.collectDaily('2026-03-10').day;
  Object.assign(s, { cash: saved.cash, fans: saved.fans, daily: saved.daily, inventory: JSON.parse(saved.inv || '{}') });
  return out;
});
check('the daily gift comes once a day with a 7-day streak (day 7 adds a decoration) that starts over after a missed day', daily.shown && daily.tiles === 7 && daily.todayFirst === 'Day 1' && daily.paid === 100 && daily.closed && daily.again
  && daily.streak === '2,3,4,5,6,7' && daily.day7decor && daily.wraps && daily.missed === 1, JSON.stringify(daily));

// Save backup: the club as a code to copy, which reads back to the same
// club; anything else pasted is refused.
const backup = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  document.getElementById('backupButton').click();
  const code = document.getElementById('backupCode').value;
  const out = { open: document.getElementById('backupBox').classList.contains('open'), prefixed: code.startsWith('NOVA1:') };
  const back = s.readSaveCode(code);
  out.same = JSON.stringify(back) === JSON.stringify(s.serializeState());
  out.name = back && back.clubName;
  document.getElementById('backupPaste').value = 'hello there';
  document.getElementById('backupLoad').click();
  out.refused = /isn't a Club Nova save code/.test(document.getElementById('backupMsg').textContent);
  document.getElementById('backupClose').click();
  out.closed = !document.getElementById('backupBox').classList.contains('open');
  return out;
});
check('Save backup gives the club as a code that reads back the same, and refuses anything else', backup.open && backup.prefixed && backup.same && backup.name && backup.refused && backup.closed, JSON.stringify(backup));

// Regular floors go under furniture: holding one makes the furniture (and
// its staff) see-through and outlines the tile; laying it under a bar
// works, and putting the floor down makes everything solid again.
const underFloor = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const bar = Object.values(s.placed).find((r) => s.hireableRecords().includes(r));
  const [gx, gy] = bar.tiles[0];
  const cash = s.cash;
  s.cash = cash + 1000;
  s.selectProp('fpConcrete');
  s.hoverTile = { gx, gy };
  s.updateGhost();
  const out = { faded: bar.gameObject.alpha < 1 && (!bar.staff || bar.staff.container.alpha < 1), outlined: s.footprintOutline.commandBuffer.length > 0 };
  out.painted = s.paintFloor(gx, gy) && s.floorPaint[`${gx},${gy}`] === 'fpConcrete';
  s.deselectProp();
  out.solidAgain = bar.gameObject.alpha === 1;
  s.removeFloorPaint(gx, gy);
  s.cash = cash;
  return out;
});
check('a regular floor goes under furniture, which turns see-through while you hold it', underFloor.faded && underFloor.outlined && underFloor.painted && underFloor.solidAgain, JSON.stringify(underFloor));

// Test mode (?test, or the site's /test/ copy): top level, lots of cash, on
// its own save, and the real save is left alone.
const realSave = await page.evaluate(() => { window.__clubNova.scene.getScene('club').saveGame(); return localStorage.getItem('clubNovaSave_v2'); });
await page.goto(gameUrl + '?test');
await waitForScene();
const testMode = await page.evaluate((realSave) => {
  const s = window.__clubNova.scene.getScene('club');
  s.saveGame();
  return { level: s.levelInfo().level, top: s.topUnlockLevel(), cash: s.cash, tag: !!document.getElementById('testModeTag'),
    realKept: (() => { const r = JSON.parse(localStorage.getItem('clubNovaSave_v2') || 'null'); return !!r && r.cash < 10000000 && r.clubName === JSON.parse(realSave).clubName; })(),
    test: !!localStorage.getItem('clubNovaSave_v2_test') };
}, realSave);
check('test mode starts at the top level with lots of cash, on its own save', testMode.level >= testMode.top && testMode.cash >= 10000000 && testMode.tag && testMode.test && testMode.realKept,
  JSON.stringify({ level: testMode.level, top: testMode.top, cash: testMode.cash, tag: testMode.tag, test: testMode.test, realKept: testMode.realKept }));

// Seated guests and the furniture in front of them: on the Fire Pit
// Sectional turned away from the camera, a guest gets the cut-out of the
// part of the sofa in front of their seat drawn just over them (so the
// backrest hides them), and it goes when they get up.
const occl = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  let rec = null;
  for (let gy = 1; gy < s.gridH - 3 && !rec; gy++) for (let gx = 1; gx < s.gridW - 3 && !rec; gx++) {
    if (s.footprintValid(s.getFootprint('fireSectional', 180, gx, gy), 'fireSectional')) rec = s.restoreProp('fireSectional', 180, [gx, gy]);
  }
  if (!rec) return { placed: false };
  s.trySpawnPatron();
  const p = s.patrons.find((q) => !q.gone && !q.sitting && !q.leaving);
  if (!p) return { placed: true, guest: false };
  s.claimSpecificSeat(p, { rec, i: 0, access: s.seatAccessTile(rec, 0) || rec.anchor });
  s.sitDown(p);
  const occ = p.seatOccluder;
  const out = { placed: true, seats: rec.seatTaken.length, occluder: !!occ && occ.texture.key, above: !!occ && occ.depth > p.container.depth,
    overPiece: !!occ && p.container.depth > rec.gameObject.depth };
  s.releaseSeats(rec);
  out.gone = !p.seatOccluder;
  s.removeProp(rec);
  return out;
});
check('a guest sitting with a sofa back between them and the camera is hidden by it (its cut-out over them), and it goes when they get up',
  occl.occluder === 'seat_fireSectional_occ0_180' && occl.above && occl.overPiece && occl.gone, JSON.stringify(occl));

// Real songs, the way the play link serves the game: the page from a web
// server, the MP3s as separate files next to it (dist/music/), each
// downloaded when it plays, in time with its measured tempo. The game's
// page itself stays small (no songs packed in).
{
  const http = await import('node:http');
  const dist = path.join(root, 'dist');
  const server = http.createServer((req, res) => {
    const file = path.join(dist, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!file.startsWith(dist) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': file.endsWith('.mp3') ? 'audio/mpeg' : 'text/html' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const songPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await songPage.goto(`http://localhost:${port}/`);
  await songPage.waitForFunction(() => {
    const s = window.__clubNova && window.__clubNova.scene.getScene('club');
    return s && s.world && s.sys.settings.status >= 5 && window.__clubMusic;
  }, null, { timeout: 60000 });
  await songPage.evaluate(() => {
    const s = window.__clubNova.scene.getScene('club');
    s.showLevelUp = () => {};
    if (!s.clubName) s.setClubName('Test Club');
    document.getElementById('namePrompt')?.classList.remove('open');
    document.getElementById('dailyBox')?.classList.remove('open');
  });
  await songPage.mouse.click(640, 400);
  const song = await songPage.evaluate(async () => {
    const s = window.__clubNova.scene.getScene('club');
    const M = window.__clubMusic;
    for (let i = 0; i < 150 && !M.source; i++) await new Promise((r) => setTimeout(r, 100));
    const step0 = M.step;
    await new Promise((r) => setTimeout(r, 600));
    return { url: s.currentSong().url, length: s.songLength(), bpm: s.currentSong().bpm, playing: M.playing,
      seconds: M.source ? Math.round(M.source.buffer.duration) : 0, beats: M.step !== step0 };
  });
  check('over the web, the club plays real songs (separate MP3 files), each for its own length, in time with its tempo',
    /\/music\/[\w-]+\.mp3$/.test(song.url || '') && song.length > 60000 && song.seconds > 60 && song.beats, JSON.stringify(song));
  const pageMb = fs.statSync(path.join(dist, 'index.html')).size / 1e6;
  check('the game page stays small (no songs packed into it)', pageMb < 18, `${pageMb.toFixed(1)} MB`);
  await songPage.close();
  server.close();
}

// Kinds of guest: regulars, party animals, social butterflies, big spenders,
// high rollers, VIP guests and troublemakers; the big-spending kinds come more
// often to a fancier club, order pricier drinks and tip more. Comfier seats
// (by price, VIP booths most) cheer guests up faster; a happy guest stays longer.
const guestKinds = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const count = (n) => { const c = {}; for (let i = 0; i < n; i++) { const t = s.pickGuestType(); c[t.key] = (c[t.key] || 0) + 1; } return c; };
  const realLux = s.luxury.bind(s);
  s.luxury = () => 0;
  const plain = count(4000);
  s.luxury = () => 1200;
  const fancy = count(4000);
  s.luxury = realLux;
  const rich = (c) => (c.bigSpender || 0) + (c.highRoller || 0) + (c.vip || 0);
  out.kinds = Object.keys(fancy).sort().join();
  out.richerWhenFancy = rich(fancy) > rich(plain) * 1.5;
  const types = Object.fromEntries(['regular', 'vip', 'bigSpender'].map((k) => [k, s.pickGuestType.call({ luxury: () => 0 }) && null]));
  const T = (key) => { for (let i = 0; i < 20000; i++) { const t = s.pickGuestType(); if (t.key === key) return t; } return null; };
  const vipT = T('vip'), regT = T('regular'), bigT = T('bigSpender');
  out.vipTipsMore = s.tipAmount({ mood: 60, type: vipT }, 10) > s.tipAmount({ mood: 60, type: regT }, 10);
  const menu = s.drinkMenu();
  const cheapest = Math.min(...menu.map((d) => d.price));
  out.priceyOrders = menu.length < 2 || Array.from({ length: 30 }, () => s.pickDrink({ type: bigT }).price).every((p) => p > cheapest);
  out.stool = s.seatComfort('woodStool');
  out.booth = s.seatComfort('vipLounge');
  out.comfier = out.booth > out.stool;
  // A guest still happy when their visit runs out stays a while longer.
  s.trySpawnPatron();
  const p = s.patrons.filter((q) => !q.gone && !q.leaving).pop();
  if (p) {
    p.mood = 90; p.stayedLonger = false; p.despawnAt = s.time.now - 1;
    s.chooseActivity(p);
    out.stays = !p.leaving && p.despawnAt > s.time.now;
  }
  return out;
});
check('seven kinds of guest; big spenders, high rollers and VIPs come more often to a fancier club, order pricier drinks and tip more', guestKinds.kinds === 'bigSpender,highRoller,partier,regular,social,troublemaker,vip' && guestKinds.richerWhenFancy && guestKinds.vipTipsMore && guestKinds.priceyOrders, JSON.stringify(guestKinds));
check('seats have comfort (VIP booths comfier than stools), and a guest still happy at the end of their visit stays longer', guestKinds.comfier && guestKinds.stays, JSON.stringify(guestKinds));

// DJ, bar and seating upgrades: a better booth entertains more; Song
// Dedication cheers one guest (then a cooldown); Bar Tricks makes a bar's
// tips bigger for a while; training makes bartenders faster; drinks run out
// and the bars are restocked from Staff; big spenders pay to sit at a VIP booth.
const upgrades = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const realBooth = s.clubBooth.bind(s);
  s.clubBooth = () => ({ type: 'woodBooth' }); out.wood = s.djQuality();
  s.clubBooth = () => ({ type: 'holoBooth' }); out.holo = s.djQuality();
  s.clubBooth = realBooth;
  out.boothMatters = out.holo > out.wood;
  s.trySpawnPatron();
  const p = s.patrons.filter((q) => !q.gone && !q.leaving).pop();
  s.dedicationAt = 0;
  if (p) { p.mood = 40; out.dedicated = s.dedicateSong(p) && p.mood >= 65; out.cooldown = !s.dedicateSong(p); }
  const bar = s.hireableRecords().find((r) => r.staff);
  bar.staff.tricksAt = 0; bar.staff.tricksUntil = 0;
  out.tricks = s.barTricks(bar) && s.barTricksFactor(bar) === 1.5 && !s.barTricks(bar);
  bar.staff.tricksUntil = 0;
  const real = s.levelInfo.bind(s);
  const cash0 = s.cash;
  s.levelInfo = () => ({ ...real(), level: 3 });
  s.cash = 5000; s.barTraining = 0; bar.staff.fastUntil = 0;
  out.trained = s.trainBartenders() && s.barTraining === 1 && Math.abs(s.bartenderSpeed(bar.staff) - 1.2) < 1e-9;
  out.notYet = !s.trainBartenders(); // the next level of training is at level 8
  s.levelInfo = real;
  s.barTraining = 0;
  // Drink stock.
  const full = s.maxDrinkStock();
  s.drinkStock = 0;
  const q = s.patrons.find((x) => !x.gone && !x.leaving && !x.queue);
  out.cantOrderWhenOut = q ? !s.joinBarQueue(q) : true;
  s.cash = 5000;
  out.restockCost = s.restockCost();
  out.restocked = s.restockBar() && s.drinkStockLeft() === full && 5000 - s.cash === full * 2;
  // VIP booth reservation.
  const roller = { type: { vipSeats: true }, container: { x: 0, y: 0 }, spent: 0 };
  const c1 = s.cash;
  out.fee = s.vipBoothFee(roller, { type: 'vipLounge' });
  out.feeOnce = s.vipBoothFee(roller, { type: 'vipLounge' }) === 0 && s.cash - c1 === out.fee;
  out.regularNoFee = s.vipBoothFee({ type: { vipSeats: false }, container: { x: 0, y: 0 } }, { type: 'vipLounge' }) === 0;
  s.cash = cash0;
  return out;
});
check('a better DJ booth entertains more; Song Dedication cheers a guest up, then recovers', upgrades.boothMatters && upgrades.dedicated && upgrades.cooldown, JSON.stringify(upgrades));
check('Bar Tricks makes a bar\'s tips 1.5x for a while; training makes bartenders 20% faster (more at higher levels)', upgrades.tricks && upgrades.trained && upgrades.notYet, JSON.stringify(upgrades));
check('drinks run out (nobody can order) and restocking from Staff fills the bars for $2 a drink; big spenders pay once to sit at a VIP booth', upgrades.cantOrderWhenOut && upgrades.restocked && upgrades.fee >= 20 && upgrades.feeOnce && upgrades.regularNoFee, JSON.stringify(upgrades));

// Staff: the Staff panel shows people (bartenders per bar, bouncers) with
// pictures; more bouncers unlock with levels. Troublemakers bother the guests
// near them; a bouncer walks over and walks them out the door, for 5 XP.
const security = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const out = {};
  const real = s.levelInfo.bind(s);
  const cash0 = s.cash;
  s.levelInfo = () => ({ ...real(), level: 8 });
  s.cash = 5000;
  s.setDockTab('staff');
  s.shopItemsEl.dataset.rendered = '';
  s.renderStaffCard();
  out.people = document.querySelectorAll('#shopItems .staffPerson').length;
  out.portraits = [...document.querySelectorAll('#shopItems .staffPerson .icon')].every((e) => /url\(/.test(e.style.backgroundImage));
  out.hireCard = !!document.querySelector('#shopItems .hireBouncer');
  out.hired = s.hireBouncer() && s.guards.length === 2 && s.bouncers === 2;
  out.cantThird = !s.hireBouncer() && s.guards.length === 2; // the third unlocks at 18
  out.saved = s.serializeState().bouncers === 2;
  out.fired = s.fireBouncer() && s.guards.length === 1;
  s.levelInfo = real;
  s.cash = cash0;
  s.closeDock();
  // A troublemaker next to another guest.
  for (let i = 0; i < 2; i++) s.trySpawnPatron();
  const inside = s.patrons.filter((p) => !p.gone && !p.leaving);
  const [bad, victim] = inside.slice(-2);
  if (!bad || !victim) return out;
  for (const p of [bad, victim]) { p.entering = false; p.moving = false; p.sitting = false; p.troublemaker = false; }
  bad.troublemaker = true; bad.annoyAt = 0; bad.disturbances = 0;
  const g = s.guard;
  bad.gx = g.gx + 2; bad.gy = g.gy; victim.gx = bad.gx + 1; victim.gy = bad.gy;
  const mood0 = victim.mood = 80;
  s.tickTroublemakers();
  out.annoyed = victim.mood < mood0 && bad.disturbances === 1;
  out.spotted = g.target === bad && bad.targetedBy === g;
  const fans0 = s.fans;
  g.goal = null;
  s.escortOut(g, bad);
  out.out = bad.ejected && bad.leaving && s.fans - fans0 === 5 && !g.target;
  return out;
});
check('the Staff panel shows bartenders and bouncers with pictures; a second bouncer can be hired at level 8 (saved), a third not until 18', security.people >= 2 && security.portraits && security.hireCard && security.hired && security.cantThird && security.saved && security.fired, JSON.stringify(security));
check('a troublemaker upsets guests near them; a bouncer spots them and walks them out the door, for 5 XP', security.annoyed && security.spotted && security.out, JSON.stringify(security));

// The October 2026 wallpapers: each paints a wall section at level 40.
const newWalls = await page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  const fans = s.fans, cash = s.cash, held = s.selectedProp, before = s.wallpaper.R0;
  s.fans = Math.max(s.fans, s.fansForLevel(40));
  const types = ['wpCinder', 'wpSubway', 'wpPlanks', 'wpTheatre', 'wpSpeakers', 'wpArches', 'wpBottles', 'wpPurpleGlow', 'wpIce', 'wpLedDots'];
  const painted = types.filter((t) => { s.cash = 1e6; s.selectedProp = t; s.paintWall('R0'); return s.wallpaper.R0 === t; });
  s.selectedProp = held; s.fans = fans; s.cash = cash;
  if (before) { s.wallpaper.R0 = before; s.drawWallSection('R0', before); } else { delete s.wallpaper.R0; s.wallImages.R0?.destroy(); delete s.wallImages.R0; }
  return { painted: painted.length, of: types.length };
});
check('the ten new wallpapers each paint a wall', newWalls.painted === newWalls.of, JSON.stringify(newWalls));

// An old save with the Royal Thrones (taken out of the game) gets its price
// back for each one, placed or stored.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const tp = await ctx.newPage();
  await tp.goto(gameUrl);
  await tp.evaluate(() => localStorage.setItem('clubNovaSave_v2', JSON.stringify({ cash: 100, fans: 0, clubName: 'Old Club', placed: [{ type: 'throneBooth', anchor: [5, 5], facing: 0 }], inventory: { throneBooth: 1 } })));
  await tp.reload();
  await tp.waitForFunction(() => { const s = window.__clubNova && window.__clubNova.scene.getScene('club'); return s && s.world && s.sys.settings.status >= 5; });
  const old = await tp.evaluate(() => { const s = window.__clubNova.scene.getScene('club'); return { cash: s.cash, placed: Object.values(s.placed).some((r) => r.type === 'throneBooth'), stored: !!(s.inventory || {}).throneBooth }; });
  check('an old save\'s Royal Thrones (removed) are refunded, placed or stored', old.cash >= 3100 && !old.placed && !old.stored, JSON.stringify(old));
  await ctx.close();
}

// Phones: on a touch screen a tap on a guest opens their card, a tap
// collects a high five (a little off the badge still counts), two fingers
// pinch to zoom, and the HUD's top panels don't overlap.
{
  const phone = await browser.newContext({ ...devices['iPhone 13'] });
  const tp = await phone.newPage();
  tp.on('pageerror', (e) => errors.push(`phone: ${e.message}`));
  await tp.goto(gameUrl);
  await tp.waitForFunction(() => { const s = window.__clubNova && window.__clubNova.scene.getScene('club'); return s && s.world && s.sys.settings.status >= 5; });
  await tp.evaluate(() => {
    const s = window.__clubNova.scene.getScene('club');
    s.showLevelUp = () => {}; s.showDaily = () => false;
    if (!s.clubName) s.setClubName('Phone Club');
    document.getElementById('namePrompt')?.classList.remove('open');
    document.getElementById('dailyBox')?.classList.remove('open');
  });
  const at = await tp.evaluate(() => {
    const s = window.__clubNova.scene.getScene('club');
    s.trySpawnPatron();
    const p = s.patrons[s.patrons.length - 1];
    p.moving = false; p.path = [];
    const st = s.gridToScreen(5, 5);
    p.container.x = st.sx; p.container.y = st.sy;
    s.time.timeScale = 0; s.tweens.timeScale = 0;
    return { x: s.world.x + st.sx * s.world.scaleX, y: s.world.y + (st.sy - 40) * s.world.scaleY };
  });
  await tp.waitForTimeout(200);
  await tp.touchscreen.tap(at.x, at.y);
  await tp.waitForTimeout(300);
  const card = await tp.evaluate(() => document.getElementById('infoCard').classList.contains('open'));
  await tp.evaluate(() => document.getElementById('infoCard').classList.remove('open'));
  const bonus = await tp.evaluate(() => {
    const s = window.__clubNova.scene.getScene('club');
    s.offerBonus(s.patrons[s.patrons.length - 1]);
    const b = s.bonuses[s.bonuses.length - 1];
    return { x: s.world.x + b.holder.x * s.world.scaleX, y: s.world.y + b.holder.y * s.world.scaleY, cash: s.cash, amount: b.amount };
  });
  await tp.touchscreen.tap(bonus.x + 4, bonus.y + 6);
  await tp.waitForTimeout(300);
  const paid = await tp.evaluate(() => window.__clubNova.scene.getScene('club').cash) - bonus.cash;
  const cdp = await phone.newCDPSession(tp);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const zoom = () => tp.evaluate(() => window.__clubNova.scene.getScene('club').world.scaleX);
  const z0 = await zoom();
  await touch('touchStart', [[150, 400]]);
  await touch('touchStart', [[150, 400], [240, 400]]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[150 - i * 5, 400], [240 + i * 5, 400]]); await tp.waitForTimeout(20); }
  await touch('touchEnd', []);
  await tp.waitForTimeout(200);
  const z1 = await zoom();
  const layout = await tp.evaluate(() => {
    const a = document.getElementById('hudProfile').getBoundingClientRect();
    const b = document.getElementById('hudRight').getBoundingClientRect();
    return { gap: Math.round(b.left - a.right), fits: b.right <= window.innerWidth };
  });
  check('on a phone, tapping a guest opens their card', card);
  check('on a phone, tapping a high five collects it', paid === bonus.amount, `paid ${paid}`);
  check('on a phone, two fingers pinch to zoom', z1 > z0 * 1.3, `${z0.toFixed(2)} -> ${z1.toFixed(2)}`);
  check('on a phone, the top panels fit side by side', layout.gap > 0 && layout.fits, JSON.stringify(layout));
  // The shop is folder tabs over a low tray: open, it stays a small part of the screen and fits across.
  const dockFit = await tp.evaluate(() => {
    document.getElementById('navBuild').click();
    const d = document.getElementById('dock').getBoundingClientRect();
    const ok = document.getElementById('storeOk').getBoundingClientRect();
    const tray = document.getElementById('dockCenter').getBoundingClientRect();
    const tabs = document.getElementById('navBar').getBoundingClientRect();
    return { share: +(d.height / window.innerHeight).toFixed(2), okOn: ok.right <= window.innerWidth && ok.width > 0, tabsOnTray: Math.abs(tabs.bottom - tray.top) < 2 };
  });
  check('on a phone, the open shop (folder tabs over a tray) takes under a third of the screen and fits across', dockFit.share < 0.33 && dockFit.okOn && dockFit.tabsOnTray, JSON.stringify(dockFit));
  await phone.close();
}

check('no errors in the page', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
