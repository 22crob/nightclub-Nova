// Renders an SVG to PNG with headless Chromium, using the game's playwright
// (run `npm install` in game/ first):
//   node art/vector/svgshot.mjs IN.svg OUT.png [scale]
import { createRequire } from 'module';
const require = createRequire(new URL('../../game/package.json', import.meta.url));
const { chromium } = require('playwright');
import fs from 'fs';
const [,, inp, out, scale = '1'] = process.argv;
const svg = fs.readFileSync(inp, 'utf8');
const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
const w = +m[1], h = +m[2], s = +scale;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Math.round(w * s), height: Math.round(h * s) } });
await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg', `<svg width="${w * s}" height="${h * s}"`)}</body></html>`);
await page.screenshot({ path: out, omitBackground: true });
await browser.close();
