// Renders the frames neon_rig.py laid out in OUT_DIR/sheet.html into
// OUT_DIR/patron_neon01.png (transparent), using the game's Playwright.
//   node art/characters/neon/render_neon.mjs OUT_DIR
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(path.join(here, '../../../game/node_modules/playwright/index.mjs'));
const dir = process.argv[2];
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'patron_neon01.json'), 'utf8'));
const [w, h] = meta.sheetSize;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.goto('file://' + path.resolve(dir, 'sheet.html'));
await page.screenshot({ path: path.join(dir, 'patron_neon01.png'), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
await browser.close();
console.log(`${dir}/patron_neon01.png ${w}x${h}`);
