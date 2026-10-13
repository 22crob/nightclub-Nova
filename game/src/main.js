// Club Nova — isometric nightclub tycoon (Phaser 3).
import Phaser from 'phaser';
import './style.css';
import { ClubScene } from './scene/ClubScene.js';
import { fillIcons } from './uiIcons.js';
import { setupTooltips } from './tooltips.js';
import { SHARP } from './config.js';

fillIcons();
setupTooltips();
// iPhone Safari zooms the whole page on a pinch even when told not to; the
// pinch is the club's own zoom instead (world.js).
for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });

// Words drawn in the game (floating money, speech bubbles) are made at the
// screen's sharpness too (see sharpScreen() in world.js).
const makeText = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function (x, y, text, style) {
  return makeText.call(this, x, y, text, { resolution: Math.min(Math.max(1, window.devicePixelRatio || 1), SHARP.maxDpr), ...style });
};

const config = {
  type: Phaser.AUTO,
  parent: document.body,
  // Fill the window and keep filling it when it's resized (the play link
  // can open in a small panel and then be made bigger or full screen).
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  backgroundColor: '#0a0612',
  disableContextMenu: true, // right-click sells a placed prop instead of opening the browser menu
  scene: [ClubScene],
};

const game = new Phaser.Game(config);
// Exposed for the automated smoke test (tests/smoke.mjs) and for poking at
// the game from the browser console.
window.__clubNova = game;
