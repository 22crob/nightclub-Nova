// Club Nova — isometric nightclub tycoon (Phaser 3).
import Phaser from 'phaser';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-700.css';
import './style.css';
import { ClubScene } from './scene/ClubScene.js';

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: document.body,
  backgroundColor: '#0a0612',
  disableContextMenu: true, // right-click sells a placed prop instead of opening the browser menu
  scene: [ClubScene],
};

const game = new Phaser.Game(config);
// Exposed for the automated smoke test (tests/smoke.mjs) and for poking at
// the game from the browser console.
window.__clubNova = game;
