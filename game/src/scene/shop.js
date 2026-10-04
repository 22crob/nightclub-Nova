// ClubScene methods: The shop panel, item selection, unlocks and prices.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { FLOOR_DECAL_PROPS, PROP_TYPES, fameStars } from '../catalog.js';
import { SELL_REFUND_RATIO } from '../config.js';
import { realSpriteIconFor, renderIsoIcon } from '../icons.js';
import { SFX } from '../sfx.js';
import { hideTip } from '../tooltips.js';
import { fillIcons } from '../uiIcons.js';

// The shop is a glossy panel docked along the bottom of the screen, like
// Nightclub City's: three drawn tabs stand on its top edge (Decorations,
// Expand, VIP), and the panel shows that tab's cards in a scrolling row.
// Decorations also has a small grid of category buttons on the left.
// Everything is an icon; names and descriptions are in the hover tips.
const CATEGORIES = {
  Bars: { icon: 'bars', text: 'Bars sell drinks. Each long bar needs one bartender.' },
  Seating: { icon: 'seating', text: 'Couches and booths where guests sit down and relax.' },
  'Dance Floors': { icon: 'dance', text: 'Where your guests dance. More dance floor fits more guests.' },
  Floors: { icon: 'floors', text: 'Paint the floor, tile by tile.' },
  Wallpaper: { icon: 'wallpaper', text: 'Paper the walls, section by section.' },
  Decorations: { icon: 'decor', text: 'Plants, lights and statues to make the club fancier.' },
  'DJ Booths': { icon: 'booths', text: 'Upgrade your DJ booth. A better booth brings more fans.' },
  Staff: { icon: 'staff', text: 'Hire a bartender for each long bar.' },
};
const DECOR_CATEGORIES = Object.keys(CATEGORIES);

export class ShopMixin {
  // True once the player's level has reached this prop's unlockLevel
  // (defaults to 1 — available from the start — if a type doesn't set one).
  isUnlocked(type) {
    const unlockLevel = PROP_TYPES[type].unlockLevel || 1;
    return this.levelInfo().level >= unlockLevel;
  }

  // Picking the item you're already holding puts it down again.
  selectProp(key) {
    if (this.selectedProp === key) { this.deselectProp(); return; }
    if (!this.isUnlocked(key)) { SFX.denied(); return; } // can't select something you haven't unlocked yet
    this.selectedProp = key;
    this.updateGhost();
    this.updateShopUI();
  }

  deselectProp() {
    this.selectedProp = null;
    this.updateGhost();
    this.updateShopUI();
  }

  // Builds the dock once (see index.html): the three tabs, the category
  // grid and the scroll arrows. Opens on Decorations > Bars.
  buildShop() {
    this.shopItemsEl = document.getElementById('shopItems');
    this.dockGrid = document.getElementById('dockGrid');
    this.selectedChip = document.getElementById('selectedChip');
    if (!this.shopItemsEl || !this.dockGrid) return; // older/debug HTML — skip silently

    this.dockTabs = {};
    for (const tab of document.querySelectorAll('.dockTab')) {
      this.dockTabs[tab.dataset.tab] = tab;
      tab.addEventListener('click', () => { SFX.unlock(); this.setDockTab(tab.dataset.tab); });
    }
    this.dockGrid.innerHTML = '';
    this.subTabButtons = {};
    for (const category of DECOR_CATEGORIES) {
      const sub = document.createElement('div');
      sub.className = 'subTab';
      sub.dataset.icon = CATEGORIES[category].icon;
      sub.dataset.tipName = category;
      sub.dataset.tipText = CATEGORIES[category].text;
      sub.addEventListener('click', () => this.setShopCategory(category));
      this.dockGrid.appendChild(sub);
      this.subTabButtons[category] = sub;
    }
    fillIcons(this.dockGrid);

    // Arrows (and the mouse wheel) scroll the row of cards.
    const scrollBy = (dir) => this.shopItemsEl.scrollBy({ left: dir * this.shopItemsEl.clientWidth * 0.8, behavior: 'smooth' });
    document.getElementById('dockPrev')?.addEventListener('click', () => scrollBy(-1));
    document.getElementById('dockNext')?.addEventListener('click', () => scrollBy(1));
    this.shopItemsEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.shopItemsEl.scrollLeft += e.deltaY + e.deltaX;
    }, { passive: false });

    this.setShopCategory((PROP_TYPES[this.selectedProp] && PROP_TYPES[this.selectedProp].category) || DECOR_CATEGORIES[0]);
    this.updateSelectedChip();
  }

  // Switches the dock to one of its tabs: 'decor', 'expand' or 'vip'.
  setDockTab(tab) {
    this.dockTab = tab;
    for (const key in this.dockTabs || {}) this.dockTabs[key].classList.toggle('active', key === tab);
    document.getElementById('dock')?.setAttribute('data-tab', tab);
    hideTip();
    if (this.shopItemsEl) this.shopItemsEl.scrollLeft = 0;
    if (tab === 'decor') this.renderShopItems(this.activeShopCategory || DECOR_CATEGORIES[0]);
    else if (tab === 'expand') this.renderExpandCard();
    else if (tab === 'vip') this.renderVipCards();
  }

  // Shows one Decorations category (also used to jump to one from code).
  setShopCategory(category) {
    this.activeShopCategory = category;
    for (const cat in this.subTabButtons || {}) this.subTabButtons[cat].classList.toggle('active', cat === category);
    if (this.dockTab !== 'decor') {
      this.setDockTab('decor');
      return;
    }
    hideTip();
    if (this.shopItemsEl) this.shopItemsEl.scrollLeft = 0;
    this.renderShopItems(category);
  }

  // A card for the row: a picture on a dark panel and a strip under it
  // (the price); name and description go in its hover tip. Returns
  // { slot, button, cost }.
  makeCard(name, text, picture) {
    const slot = document.createElement('div');
    slot.className = 'propSlot';
    slot.dataset.tipName = name;
    if (text) slot.dataset.tipText = text;
    const button = document.createElement('div');
    button.className = 'propButton';
    const icon = document.createElement('div');
    icon.className = 'icon';
    if (picture) icon.style.backgroundImage = `url(${picture})`;
    button.appendChild(icon);
    const cost = document.createElement('div');
    cost.className = 'propCost';
    slot.append(button, cost);
    return { slot, button, icon, cost };
  }

  // Renders one Decorations category's items as cards — click one to hold
  // it, then click in the club to place it.
  renderShopItems(category) {
    if (!this.shopItemsEl) return;
    this.shopItemsEl.innerHTML = '';
    this.shopItemsEl.dataset.rendered = '';
    this.shopButtons = {};
    this.shopCosts = {};
    if (category === 'Staff') {
      this.renderStaffCard();
      return;
    }

    const keysInCategory = Object.keys(PROP_TYPES).filter((k) => PROP_TYPES[k].category === category);
    for (const key of keysInCategory) {
      const def = PROP_TYPES[key];
      // A qualitative "Fame" rating instead of raw stat numbers; dance
      // floors also say how many more guests they fit.
      const stars = fameStars(def.cost);
      let statsText = '✨ ' + '★'.repeat(stars) + '☆'.repeat(5 - stars);
      if (def.category === 'Dance Floors' && def.capacity) statsText += `  🧱 +${def.capacity} floor space`;
      const picture = realSpriteIconFor(key) || renderIsoIcon(def.color, FLOOR_DECAL_PROPS.has(key));
      const { slot, button, cost } = this.makeCard(def.label, `${CATEGORIES[category]?.text || ''} ${statsText}`.trim(), picture);
      cost.textContent = this.isUnlocked(key) ? `$${this.currentCost(key)}` : `🔒 Lv ${def.unlockLevel || 1}`;
      slot.addEventListener('click', () => {
        // DJ booths aren't placed: buying one swaps the club's booth.
        if (def.category === 'DJ Booths') {
          this.upgradeClubBooth(key);
          return;
        }
        this.selectProp(key);
      });
      this.shopItemsEl.appendChild(slot);
      this.shopButtons[key] = button;
      this.shopCosts[key] = cost;
    }
    this.updateShopUI();
  }

  // The Expand tab: one card for the next size up, bought on click.
  renderExpandCard() {
    if (!this.shopItemsEl) return;
    const tier = this.nextExpansion();
    // Only rebuild when the card would change (this runs often).
    const key = `expand:${this.gridSize}:${this.levelInfo().level}:${tier ? this.cash >= tier.cost : ''}`;
    if (this.shopItemsEl.dataset.rendered === key) return;
    this.shopItemsEl.innerHTML = '';
    this.shopItemsEl.dataset.rendered = key;
    const { slot, button, icon, cost } = this.makeCard('Expand the club', '', null);
    slot.classList.add('expandSlot');
    icon.dataset.icon = 'tabExpand';
    if (!tier) {
      button.classList.add('locked');
      cost.textContent = '🏆 Max';
      slot.dataset.tipText = `Your club is ${this.gridSize}×${this.gridSize}, the biggest it can be.`;
    } else {
      const unlocked = this.levelInfo().level >= tier.unlockLevel;
      button.classList.toggle('unaffordable', unlocked && this.cash < tier.cost);
      button.classList.toggle('locked', !unlocked);
      cost.textContent = unlocked ? `$${tier.cost}` : `🔒 Lv ${tier.unlockLevel}`;
      slot.dataset.tipText = `Grow from ${this.gridSize}×${this.gridSize} to ${tier.size}×${tier.size} tiles.`;
      slot.addEventListener('click', () => this.expandClub());
    }
    fillIcons(slot);
    this.shopItemsEl.appendChild(slot);
  }

  // Keeps the cards' selected / can't-afford / locked looks and prices
  // current whenever selection, cash, fans (level) or placed props change,
  // plus the "holding" chip.
  updateShopUI() {
    if (this.dockTab === 'expand' && this.shopItemsEl) this.renderExpandCard();
    if (this.dockTab === 'decor' && this.activeShopCategory === 'Staff' && this.shopItemsEl) this.renderStaffCard();
    if (this.dockTab === 'decor' && this.shopButtons) {
      for (const key in this.shopButtons) {
        const unlocked = this.isUnlocked(key);
        const cost = this.currentCost(key);
        // DJ booths are upgrades for the club's one booth: the current one is
        // marked, and the others show what the swap costs.
        const booth = PROP_TYPES[key].category === 'DJ Booths' ? this.clubBooth() : null;
        const current = !!booth && booth.type === key;
        const swapCost = booth ? cost - Math.round(PROP_TYPES[booth.type].cost * SELL_REFUND_RATIO) : cost;
        this.shopButtons[key].classList.toggle('selected', unlocked && (booth ? current : key === this.selectedProp));
        this.shopButtons[key].classList.toggle('unaffordable', unlocked && !current && this.cash < swapCost);
        this.shopButtons[key].classList.toggle('locked', !unlocked);
        if (this.shopCosts[key]) {
          let text = unlocked ? `$${cost}` : `🔒 Lv ${PROP_TYPES[key].unlockLevel || 1}`;
          if (unlocked && booth) text = current ? '🎧 Playing' : `⬆ $${Math.max(0, swapCost)}`;
          this.shopCosts[key].textContent = text;
        }
      }
    }
    this.updateSelectedChip();
  }

  // The small pill above the dock showing what you're about to place.
  updateSelectedChip() {
    if (!this.selectedChip) return;
    const key = this.selectedProp;
    const def = PROP_TYPES[key];
    if (!def) {
      this.selectedChip.textContent = '';
      return;
    }

    const icon = document.createElement('div');
    icon.className = 'chipIcon';
    const realIcon = realSpriteIconFor(key);
    if (realIcon) {
      icon.style.backgroundImage = `url(${realIcon})`;
    } else {
      icon.style.backgroundImage = `url(${renderIsoIcon(def.color, FLOOR_DECAL_PROPS.has(key))})`;
    }

    const text = document.createElement('span');
    const unlocked = this.isUnlocked(key);
    text.innerHTML = unlocked
      ? `${def.label} <span class="chipCost">$${this.currentCost(key)}</span>`
      : `${def.label} <span class="chipCost">🔒 Lv ${def.unlockLevel || 1}</span>`;

    this.selectedChip.innerHTML = '';
    this.selectedChip.appendChild(icon);
    this.selectedChip.appendChild(text);
  }

  // A prop's price is fixed forever, baked into its own definition
  // (PROP_TYPES[type].cost) — not dynamic, not tied to how many you own,
  // not tied to your current level. A $50 dance tile is $50 whether you
  // just started or you're level 24. The progression is meant to live in
  // WHICH props exist at which unlock tier (a level-1 starter item is
  // cheap; a "cool one" unlocked later costs more because it's defined
  // that way) — not in a formula that inflates existing items over time.
  // This wrapper exists as the one place that decision lives, so future
  // per-item unlock-tier pricing has a single hook instead of scattering
  // `PROP_TYPES[type].cost` through placeProp/updateShopUI/buildShopUI.
  currentCost(type) {
    return PROP_TYPES[type].cost;
  }
}
