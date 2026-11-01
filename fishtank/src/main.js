// Reef & River: a fish tank tycoon. Keep fresh- and saltwater tanks, breed
// fish for new looks, sell them or keep them to show off.
import Phaser from 'phaser';
import './style.css';
import { TankScene } from './scene.js';
import * as state from './state.js';
import { UI } from './ui.js';
import * as genetics from './genetics.js';
import { fishThumb } from './fishArt.js';

const away = state.load();
if (!away) state.newGame();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: document.body,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  backgroundColor: '#1d1235',
  disableContextMenu: true, // right-click cancels placing a decoration
  scene: [TankScene],
});

setInterval(() => state.save(), 5000);
window.addEventListener('beforeunload', () => state.save());
setTimeout(() => UI.welcomeBack(away), 800);

// For the automated test and poking around in the browser console.
window.__reef = { game, state, UI, genetics, fishThumb };
