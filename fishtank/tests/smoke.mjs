// Smoke test: opens the built game (dist/index.html, straight from disk like
// a player double-clicking it) in headless Chromium and plays through the
// main loop: feeding, cleaning, breeding, growing up, buying, selling,
// moving fish between tanks, saltwater rules, decorations and saving.
// Run with `npm test` (builds first).
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

// Use the machine's pre-installed Chromium when Playwright's own isn't there.
const preinstalled = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(fs.existsSync(preinstalled) ? { executablePath: preinstalled } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const ready = async () => {
  await page.waitForFunction(() => {
    const s = window.__reef && window.__reef.game.scene.getScene('tank');
    return s && s.tank && s.sys.settings.status >= 5;
  });
  // The level-up menu would cover the buttons; it's checked on its own below.
  await page.evaluate(() => { window.__reef.UI._levelUp = window.__reef.UI.showLevelUp; window.__reef.UI.showLevelUp = () => {}; });
};
const run = (fn, arg) => page.evaluate(fn, arg);

await page.goto(gameUrl);
await page.evaluate(() => localStorage.clear());
await page.reload();
await ready();

// --- a new game ---
let s = await run(() => {
  const { state } = window.__reef;
  const G = state.G;
  return { cash: G.cash, level: G.level, tanks: G.tanks.map((t) => t.type), fish: G.fish.length, decor: G.tanks[0].decor.length,
    sprites: window.__reef.game.scene.getScene('tank').fishObjs.size };
});
check('new game starts with $300 at level 1', s.cash === 300 && s.level === 1, `${s.cash} / ${s.level}`);
check('starts with a display tank and a breeding tank', s.tanks.join() === 'fresh_small,fresh_breed', s.tanks.join());
check('starts with four fish', s.fish === 4);
check('starter tank is decorated', s.decor === 4);
check('fish in the shown tank are drawn', s.sprites === 2, `${s.sprites}`);

// --- feeding and cleaning ---
s = await run(() => {
  const { state } = window.__reef;
  const t = state.currentTank();
  state.tick(400000);
  const hungry = { food: t.food, dirt: t.dirt, happy: state.tankHappiness(t) };
  document.getElementById('feedBtn').click();
  document.getElementById('cleanBtn').click();
  const flakes = window.__reef.game.scene.getScene('tank').flakes.length;
  return { hungry, food: t.food, dirt: t.dirt, flakes, xp: state.G.xp };
});
check('food runs out and the water gets dirty over time', s.hungry.food < 0.5 && s.hungry.dirt > 0.2, JSON.stringify(s.hungry));
check('Feed fills the food back up and drops flakes', s.food === 1 && s.flakes > 0, `${s.food}, ${s.flakes} flakes`);
check('Clean makes the water clean', s.dirt === 0);
check('feeding a hungry tank gives XP', s.xp > 0, `${s.xp}`);

// --- breeding ---
s = await run(() => {
  const { state } = window.__reef;
  const G = state.G;
  const nursery = G.tanks.find((t) => t.type === 'fresh_breed');
  for (let i = 0; i < 400 && !nursery.eggs; i++) { nursery.food = 1; nursery.dirt = 0; state.tick(250); }
  const eggs = !!nursery.eggs;
  const status = state.breedStatus(nursery).text;
  for (let i = 0; i < 100 && nursery.eggs; i++) state.tick(250);
  const babies = state.fryIn(nursery.id);
  return { eggs, status, babies: babies.length, bred: G.stats.bred, book: Object.keys(G.discovered).length, babyIds: babies.map((f) => f.id) };
});
check('a happy pair lays eggs', s.eggs, s.status);
check('eggs hatch into babies', s.babies >= 2 && s.bred === s.babies, `${s.babies} babies`);
check('babies are recorded in the Fish Book', s.book >= 3, `${s.book} looks`);

s = await run((ids) => {
  const { state } = window.__reef;
  const f = state.fishById(ids[0]);
  const babyValue = window.__reef.genetics.fishValue(f.g, f.growth);
  const nursery = state.tankById(f.tankId);
  for (let i = 0; i < 2000 && f.growth < 1; i++) { nursery.food = 1; nursery.dirt = 0; state.tick(250); }
  return { growth: f.growth, babyValue, grownValue: window.__reef.genetics.fishValue(f.g, f.growth) };
}, s.babyIds);
check('babies grow up', s.growth === 1);
check('grown fish are worth more than babies', s.grownValue > s.babyValue, `${s.babyValue} -> ${s.grownValue}`);

s = await run(() => {
  const { state } = window.__reef;
  const G = state.G;
  const nursery = G.tanks.find((t) => t.type === 'fresh_breed');
  const parents = state.parentsIn(nursery.id).length;
  const status = state.breedStatus(nursery);
  // Move the old pair out: their grown-up babies take over as parents.
  const show = G.tanks[0];
  for (const f of state.parentsIn(nursery.id)) { show.food = 1; f.tankId = show.id; }
  nursery.eggs = null;
  state.tick(250);
  return { parents, status: status.text, grown: status.grown || 0, promoted: state.parentsIn(nursery.id).length };
});
check('grown-up babies stay babies while their parents are there', s.parents === 2 && !/different kinds/.test(s.status) && s.grown > 0, `${s.parents} parents, ${s.grown} grown babies: ${s.status}`);
check('grown-up babies become the parents when the pair moves out', s.promoted === 2, `${s.promoted}`);

// --- genetics ---
s = await run(() => {
  const { genetics } = window.__reef;
  const a = { ...genetics.shopGenome('guppy'), color: 'orange' }, b = { ...genetics.shopGenome('guppy'), color: 'blue' };
  let fromParents = 0, unusual = 0, glow = 0;
  for (let i = 0; i < 2000; i++) {
    const g = genetics.breed(a, b, 1);
    if (g.color === 'orange' || g.color === 'blue') fromParents++;
    if (genetics.rarityScore(g) > 0) unusual++;
    if (g.glow) glow++;
  }
  const glowy = genetics.breed({ ...a, glow: true }, { ...b, glow: true }, 1);
  const legendary = { ...a, color: 'rainbow', color2: 'blue', pattern: 'starry', fins: 'veil', glow: true, size: 1.3 };
  return { fromParents, unusual, glow, legendary: genetics.rarityOf(legendary).name, valueRatio: genetics.fishValue(legendary) / genetics.fishValue(a), name: genetics.fishName(legendary) };
});
check('babies mostly take after their parents', s.fromParents > 1600, `${s.fromParents}/2000`);
check('some babies come out unusual', s.unusual > 150 && s.unusual < 1200, `${s.unusual}/2000`);
check('glowing fish are very rare from plain parents', s.glow < 60, `${s.glow}/2000`);
check('rare looks are Legendary and worth far more', s.legendary === 'Legendary' && s.valueRatio > 20, `${s.legendary}, x${s.valueRatio.toFixed(1)}`);
check('fish get descriptive names', s.name === 'Glowing Giant Rainbow & Blue Starry Veiltail Guppy', s.name);

// --- buying, selling, moving ---
s = await run(() => {
  const { state } = window.__reef;
  const G = state.G;
  G.cash = 1000;
  const show = G.tanks[0];
  const bought = state.buyFish('guppy', show.id);
  const salty = state.buyFish('clownfish', show.id);
  const lockedTank = state.buyTank('salt_medium');
  const before = G.cash;
  const sold = state.sellFish(bought.fish.id);
  return { bought: bought.ok, inShow: bought.tank.id === show.id, salty: salty.msg, lockedTank: lockedTank.msg, soldFor: sold.price, cashUp: G.cash - before };
});
check('buying a fish puts it in the tank', s.bought && s.inShow);
check("saltwater fish can't be bought before level 3", /level 3/.test(s.salty), s.salty);
check("saltwater tanks unlock at level 3", /level 3/.test(s.lockedTank), s.lockedTank);
check('selling a fish pays its value', s.soldFor > 0 && s.cashUp === s.soldFor, `$${s.soldFor}`);

s = await run(() => {
  const { state } = window.__reef;
  const G = state.G;
  G.cash = 5000;
  state.addXp(state.G.xp < 300 ? 300 - G.xp : 0);
  const level = G.level;
  const salt = state.buyTank('salt_medium');
  const clown = state.buyFish('clownfish', salt.tank.id);
  const fresh = G.tanks[0];
  const wrongWater = state.moveFish(clown.fish.id, fresh.id);
  const guppy = state.adultsIn(fresh.id)[0];
  const wrongWater2 = state.moveFish(guppy.id, salt.tank.id);
  const nursery = G.tanks.find((t) => t.type === 'fresh_breed');
  const full = state.moveFish(guppy.id, nursery.id);
  const scene = window.__reef.game.scene.getScene('tank');
  return { level, salt: salt.ok, current: G.current === salt.tank.id, clown: clown.ok && clown.tank.id === salt.tank.id, wrongWater: wrongWater.msg, wrongWater2: wrongWater2.msg, full: full.msg, drawn: scene.tank.id === salt.tank.id && scene.fishObjs.size === 1 };
});
check('XP raises the level', s.level >= 3, `level ${s.level}`);
check('a saltwater tank can be bought at level 3 and is shown', s.salt && s.current);
check('clownfish go into the saltwater tank', s.clown);
check('the new tank and its fish are drawn', s.drawn);
check("saltwater fish can't move to freshwater", /can't live/.test(s.wrongWater), s.wrongWater);
check("freshwater fish can't move to saltwater", /can't live/.test(s.wrongWater2), s.wrongWater2);
check('a breeding tank only holds two grown-ups', /two grown-up/.test(s.full), s.full);

// --- decorations ---
s = await run(() => {
  const { state } = window.__reef;
  const t = state.currentTank();
  const plant = state.canPlaceDecor(t.id, 'plant');
  const before = window.__reef.game.scene.getScene('tank').decorSprites.length;
  const coral = state.placeDecor(t.id, 'coral', 0.5);
  const after = window.__reef.game.scene.getScene('tank').decorSprites.length;
  const sold = state.sellDecor(t.id, 0);
  return { plant: plant.msg, coral: coral.ok, before, after, refund: sold.refund };
});
check("freshwater plants don't go in saltwater tanks", /only goes in freshwater/.test(s.plant), s.plant);
check('placing coral draws it in the tank', s.coral && s.after === s.before + 1, `${s.before} -> ${s.after}`);
check('selling a decoration refunds half', s.refund === 40, `$${s.refund}`);

// --- placing a decoration by clicking ---
await run(() => window.__reef.state.setCurrent(window.__reef.state.G.tanks[0].id));
await page.click('#shopBtn');
await page.click('.shopTab[data-tab="decor"]');
await page.click('[data-buy="decor:rock"]');
s = await run(() => ({ holding: !!window.__reef.game.scene.getScene('tank').holding, chip: !document.getElementById('holdChip').classList.contains('hidden') }));
check('choosing a decoration picks it up', s.holding && s.chip);
const spot = await run(() => { const L = window.__reef.game.scene.getScene('tank').L; return { x: L.inner.x + L.inner.w * 0.3, y: L.sandTop + 10 }; });
const decorBefore = await run(() => window.__reef.state.currentTank().decor.length);
await page.mouse.move(spot.x, spot.y);
await page.mouse.click(spot.x, spot.y);
s = await run(() => ({ decor: window.__reef.state.currentTank().decor.length, holding: !!window.__reef.game.scene.getScene('tank').holding }));
check('clicking in the tank places it', s.decor === decorBefore + 1 && !s.holding, `${decorBefore} -> ${s.decor}`);

// --- clicking a fish opens its card ---
const fishSpot = await run(() => {
  const scene = window.__reef.game.scene.getScene('tank');
  const o = [...scene.fishObjs.values()][0];
  scene.update = () => {}; // hold still for the click
  return { x: o.c.x, y: o.c.y, id: o.f.id };
});
await page.mouse.click(fishSpot.x, fishSpot.y);
await page.waitForTimeout(200);
s = await run(() => ({ open: !document.getElementById('card').classList.contains('hidden'), text: document.getElementById('card').textContent, cardFor: window.__reef.UI.cardFor }));
check('clicking a fish opens its card', s.open && s.cardFor && s.cardFor.id === fishSpot.id && /Sell for/.test(s.text), s.text.slice(0, 60));
await page.screenshot({ path: path.join(shotDir, 'card.png') });
await run(() => window.__reef.UI.closeCard());
await page.reload();
await ready();

// --- level-up menu, Fish Book, shop ---
await run(() => window.__reef.UI._levelUp(3));
s = await run(() => document.getElementById('modal').textContent);
check('level-up menu lists what it unlocks', /Clownfish/.test(s) && /Saltwater Tank/.test(s));
await page.screenshot({ path: path.join(shotDir, 'levelup.png') });
await run(() => window.__reef.UI.closeModal());
await page.click('#bookBtn');
s = await run(() => document.querySelectorAll('.bookFish').length);
check('Fish Book shows the looks found', s >= 3, `${s}`);
await page.screenshot({ path: path.join(shotDir, 'fishbook.png') });
await run(() => window.__reef.UI.closeModal());
await page.click('#shopBtn');
await page.click('.shopTab[data-tab="fish"]');
s = await run(() => document.querySelectorAll('#shop .item').length);
check('shop lists every fish', s === 6, `${s}`);
await page.screenshot({ path: path.join(shotDir, 'shop.png') });

// --- saving ---
s = await run(() => ({ fish: window.__reef.state.G.fish.length, tanks: window.__reef.state.G.tanks.length, level: window.__reef.state.G.level }));
check('the game reloads where it was', s.tanks === 3 && s.level >= 3, JSON.stringify(s));
s = await run(() => {
  const { state } = window.__reef;
  const before = { cash: state.G.cash, bred: state.G.stats.bred };
  state.G.savedAt = Date.now() - 10 * 60 * 1000;
  localStorage.setItem('reefRiverSave_v1', JSON.stringify(state.G));
  const away = state.load();
  return { away: Math.round(away.away / 60000), earned: away.earned };
});
check('time away is caught up', s.away === 10 && s.earned > 0, `${s.away} min, +$${s.earned}`);

await run(() => window.__reef.UI.closeShop());
await page.screenshot({ path: path.join(shotDir, 'tank.png') });
check('no errors in the page', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
