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
  return { x: s.world.x + sx, y: s.world.y + sy };
}, [gx, gy]);
const state = () => page.evaluate(() => {
  const s = window.__clubNova.scene.getScene('club');
  return {
    cash: s.cash, fans: s.fans, placed: s.placedCount(), patrons: s.patrons.length,
    textures: ['bar_0', 'bar_90', 'bar_180', 'bar_270', 'dj_0', 'dj_90', 'dj_180', 'dj_270', 'patron_walk', 'patron_dance']
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
check('starts with $500 and an empty club', st.cash === 500 && st.placed === 0, `cash ${st.cash}, placed ${st.placed}`);
check('all sprites loaded', st.textures.length === 0, st.textures.join(', ') || 'none missing');

// Shop opens with every tab.
await page.click('#shopToggle');
const tabs = await page.locator('.shopTab').allTextContents();
check('shop opens with 6 tabs', tabs.length === 6, tabs.join(' / '));
check('bar shows its real sprite icon', await page.locator('.propButton .icon').first().evaluate((el) => el.style.backgroundImage.includes('data:image/png')));
await page.click('#shopClose');

// Place a bar (selected by default, $150) and a DJ booth ($250).
await clickTile(2, 5);
st = await state();
check('placing a bar costs $150', st.cash === 350 && st.placed === 1, `cash ${st.cash}`);

await page.click('#shopToggle');
await page.click('.shopTab:has-text("Booths")');
await page.locator('.propButton').first().click();
await clickTile(5, 5);
st = await state();
check('placing a DJ booth costs $250', st.cash === 100 && st.placed === 2, `cash ${st.cash}`);

// Placing on an occupied tile is refused.
await clickTile(5, 5);
st = await state();
check('occupied tile is refused', st.cash === 100 && st.placed === 2);

// Rotate the placed booth (hover + R).
const before = await page.evaluate(() => window.__clubNova.scene.getScene('club').placed['5,5'].facing);
const { x: rx, y: ry } = await tileXY(5, 5);
await page.mouse.move(rx, ry); await page.mouse.move(rx + 1, ry);
await page.keyboard.press('r');
const after = await page.evaluate(() => window.__clubNova.scene.getScene('club').placed['5,5'].facing);
check('R rotates a placed DJ booth', after === (before + 90) % 360, `${before} -> ${after}`);

// Patrons arrive, earn fans and tip.
await page.waitForTimeout(15000);
st = await state();
check('patrons arrive', st.patrons > 0, `${st.patrons} on the floor`);
check('fans grow over time', st.fans > 5, `${st.fans.toFixed(1)} fans`);
check('tips bring in cash', st.cash > 100, `cash ${st.cash}`);
await page.screenshot({ path: path.join(shotDir, 'club.png') });

// Right-click sells for half price.
const cashBeforeSell = st.cash;
await page.keyboard.press('Escape');
await clickTile(2, 5, 'right');
st = await state();
check('right-click sells the bar for $75', st.placed === 1 && st.cash - cashBeforeSell >= 75, `+$${st.cash - cashBeforeSell}`);

// Save survives a reload.
await page.evaluate(() => window.__clubNova.scene.getScene('club').saveGame());
const saved = await state();
await page.reload();
await waitForScene();
st = await state();
check('save restores after reload', st.placed === saved.placed && Math.floor(st.cash) === Math.floor(saved.cash), `placed ${st.placed}, cash ${st.cash}`);

check('no errors in the page', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
