// ClubScene methods: the drink menu. Drinks (DRINKS in config.js) unlock
// with level; the player picks which ones the bars serve (#drinkMenu, opened
// from the Drink Menu card in the Staff panel). A guest orders one from the
// menu when a bartender comes to them (celebrities have the priciest);
// fancier drinks pay more and cheer guests up more but take longer to mix.
// New drinks go on the menu when they unlock; the ones taken off are saved
// as `drinksOff`.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { DRINKS } from '../config.js';
import { SFX } from '../sfx.js';
import { formatMoney } from '../util.js';

// Each drink's picture, drawn in code: a glass of its shape, filled with its
// colour. viewBox 0 0 48 48.
const GLASS = '#e8f4ff';
const LINE = '#1a1020';
const SHAPES = {
  mug: (c) => `<rect x="12" y="13" width="20" height="27" rx="3" fill="${c}"/><rect x="12" y="9" width="20" height="8" rx="4" fill="#fffbe8"/>
    <path d="M32 18h4a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-4" fill="none" stroke="${GLASS}" stroke-width="3.5"/>
    <rect x="12" y="9" width="20" height="31" rx="3" fill="none" stroke="${LINE}" stroke-width="2"/><path d="M16 20v15" stroke="#fff" stroke-opacity=".5" stroke-width="2.5"/>`,
  cocktail: (c) => `<path d="M9 12h30L24 28Z" fill="${c}" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M24 28v10M16 40h16" stroke="${LINE}" stroke-width="2.6" stroke-linecap="round"/><circle cx="33" cy="12" r="4" fill="#ff4f6a" stroke="${LINE}" stroke-width="1.5"/>`,
  shots: (c) => [10, 25].map((x) => `<path d="M${x} 16h13l-2 22h-9Z" fill="${GLASS}" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M${x + 1} 24h11l-1.2 13h-8.6Z" fill="${c}"/>`).join(''),
  highball: (c) => `<rect x="14" y="10" width="20" height="30" rx="2" fill="${GLASS}"/><rect x="14" y="17" width="20" height="23" rx="2" fill="${c}"/>
    <path d="M18 22l4 4M26 28l3-3" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M29 6l-4 30" stroke="#ff4fb8" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="14" y="10" width="20" height="30" rx="2" fill="none" stroke="${LINE}" stroke-width="2"/><path d="M15 15c4-4 8 1 12-3" stroke="#43e04a" stroke-width="3" fill="none"/>`,
  martini: (c) => `<path d="M8 11h32L24 27Z" fill="${GLASS}" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/><path d="M12 15h24L24 26Z" fill="${c}"/>
    <path d="M24 27v11M16 40h16" stroke="${LINE}" stroke-width="2.6" stroke-linecap="round"/><circle cx="21" cy="17" r="2.6" fill="#7bd84a" stroke="${LINE}" stroke-width="1.2"/>`,
  flute: (c) => `<path d="M18 6h12l-1 20a5 5 0 0 1-10 0Z" fill="${GLASS}" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/><path d="M18.6 12h10.8l-.9 14a4.3 4.3 0 0 1-9 0Z" fill="${c}"/>
    <path d="M24 31v8M17 40h14" stroke="${LINE}" stroke-width="2.6" stroke-linecap="round"/><circle cx="22" cy="18" r="1.2" fill="#fff"/><circle cx="25" cy="22" r="1" fill="#fff"/><circle cx="23" cy="25" r="1.1" fill="#fff"/>`,
  neon: (c) => `<circle cx="24" cy="24" r="18" fill="${c}" opacity=".25"/><path d="M10 12h28L24 30Z" fill="${c}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
    <path d="M24 30v8M16 40h16" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M30 4l2 4 4 1-4 2-1 4-2-4-4-1 4-2Z" fill="#ffe45c"/>`,
};

export function drinkIconSvg(drink) {
  return `<svg class="uiArt" viewBox="0 0 48 48" aria-hidden="true">${SHAPES[drink.glass](drink.color)}</svg>`;
}

export class DrinksMixin {
  unlockedDrinks() {
    const level = this.levelInfo().level;
    return DRINKS.filter((d) => d.unlockLevel <= level);
  }

  // What the bars serve: every unlocked drink not taken off (never empty).
  drinkMenu() {
    const off = new Set(this.drinksOff || []);
    const on = this.unlockedDrinks().filter((d) => !off.has(d.key));
    return on.length ? on : [this.unlockedDrinks()[0] || DRINKS[0]];
  }

  isOnMenu(key) {
    return this.drinkMenu().some((d) => d.key === key);
  }

  // Puts a drink on or takes it off. The last one can't come off.
  toggleDrink(key) {
    const d = DRINKS.find((x) => x.key === key);
    if (!d || d.unlockLevel > this.levelInfo().level) { SFX.denied(); return false; }
    const off = new Set(this.drinksOff || []);
    if (off.has(key)) off.delete(key);
    else {
      if (this.drinkMenu().length <= 1) { SFX.denied(); this.showToast('Keep at least one drink on the menu.'); return false; }
      off.add(key);
    }
    this.drinksOff = [...off];
    SFX.unlock();
    this.renderDrinkMenu();
    this.saveGame();
    return true;
  }

  // What a guest orders: a celebrity has the priciest on the menu, anyone
  // else a random one.
  pickDrink(patron) {
    const menu = this.drinkMenu();
    if (patron && patron.celeb) return menu.reduce((a, b) => (b.price > a.price ? b : a));
    if (patron && patron.type && patron.type.pricey && menu.length > 1) {
      const top = [...menu].sort((a, b) => b.price - a.price).slice(0, Math.ceil(menu.length / 2));
      return top[Math.floor(Math.random() * top.length)];
    }
    return menu[Math.floor(Math.random() * menu.length)];
  }

  drinkOf(key) {
    return DRINKS.find((d) => d.key === key) || this.drinkMenu()[0];
  }

  setupDrinkMenu() {
    const box = document.getElementById('drinkMenu');
    if (!box) return;
    document.getElementById('drinkMenuClose')?.addEventListener('click', () => box.classList.remove('open'));
  }

  openDrinkMenu() {
    this.renderDrinkMenu();
    document.getElementById('drinkMenu')?.classList.add('open');
  }

  renderDrinkMenu() {
    const list = document.getElementById('drinkList');
    if (!list) return;
    const level = this.levelInfo().level;
    list.innerHTML = '';
    for (const d of DRINKS) {
      const locked = d.unlockLevel > level;
      const on = !locked && this.isOnMenu(d.key);
      const card = document.createElement('div');
      card.className = `drinkCard${locked ? ' locked' : on ? ' on' : ''}`;
      card.dataset.drink = d.key;
      card.innerHTML = `<div class="drinkPic">${drinkIconSvg(d)}</div><div class="drinkName"></div><div class="drinkPrice"></div><div class="drinkInfo"></div><div class="drinkState"></div>`;
      card.querySelector('.drinkName').textContent = d.name;
      card.querySelector('.drinkPrice').textContent = formatMoney(d.price);
      card.querySelector('.drinkInfo').textContent = `${'★'.repeat(d.fun)} fun · ${d.mix <= 1 ? 'quick' : d.mix <= 1.4 ? 'takes a while' : 'slow'} to mix`;
      card.querySelector('.drinkState').textContent = locked ? `🔒 Level ${d.unlockLevel}` : on ? 'On the menu' : 'Off';
      if (!locked) card.addEventListener('click', () => this.toggleDrink(d.key));
      list.appendChild(card);
    }
  }
}
