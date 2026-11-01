// Starts Lumen Vale. The world takes a moment to grow, so the title screen
// shows first, then the game is loaded.
import { loadSave } from './save.js';

const $ = (id) => document.getElementById(id);
const newBtn = $('newBtn'), contBtn = $('continueBtn');
newBtn.disabled = true;

setTimeout(async () => {
  const { Game } = await import('./game.js');
  const game = new Game($('app'));
  window.__lumen = game;
  $('loading').classList.add('hidden');
  newBtn.disabled = false;
  if (loadSave()) contBtn.classList.remove('hidden');
  const begin = (fromSave) => { $('title').classList.add('hidden'); game.start(fromSave); };
  newBtn.addEventListener('click', () => begin(false));
  contBtn.addEventListener('click', () => begin(true));
}, 30);
