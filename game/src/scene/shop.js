// ClubScene methods: The shop panel, item selection, unlocks and prices.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { FLOOR_DECAL_PROPS, PROP_TYPES } from '../catalog.js';
import { LUXURY, SELL_REFUND_RATIO } from '../config.js';
import { realSpriteIconFor, renderIsoIcon } from '../icons.js';
import { SFX } from '../sfx.js';
import { hideTip } from '../tooltips.js';
import { fillIcons } from '../uiIcons.js';

// The shop is a glossy panel docked along the bottom of the screen, like
// Nightclub City's. Normally drawn tabs stand on its top edge
// (Decorations, Inventory, Edit, Staff, Expand, VIPs) and the panel shows that
// tab's cards. Decorations opens the store: the tabs make way for a row of
// drawn categories, the items sit on the panel with their prices, and OK
// goes back. Everything is a picture; names and descriptions are in the
// hover tips.
const CATEGORIES = {
  Bars: { icon: 'catBars', text: 'Bars sell drinks. Each long bar needs one bartender.' },
  Seating: { icon: 'catSeating', text: 'Couches and booths where guests sit down and relax.' },
  Floors: { icon: 'catFloors', text: 'Dance floors, where guests dance, and regular floors, painted tile by tile.', includes: ['Dance Floors', 'Floors'] },
  Wallpaper: { icon: 'catWallpaper', text: 'Paper the walls, section by section.' },
  Decorations: { icon: 'catDecor', text: 'Plants, lights and statues to make the club fancier.' },
  'DJ Booths': { icon: 'catBooths', text: 'Upgrade your DJ booth. A better booth brings more fans.' },
};
const STORE_CATEGORIES = Object.keys(CATEGORIES);

export class ShopMixin {
  // True once the player's level has reached this prop's unlockLevel
  // (defaults to 1 — available from the start — if a type doesn't set one).
  isUnlocked(type) {
    const unlockLevel = PROP_TYPES[type].unlockLevel || 1;
    return this.levelInfo().level >= unlockLevel;
  }

  // Picking the item you're already holding puts it down again.
  selectProp(key) {
    if (this.selectedProp === key && !this.holdingFromInventory) { this.deselectProp(); return; }
    if (!this.isUnlocked(key)) { SFX.denied(); return; } // can't select something you haven't unlocked yet
    this.cancelBoothMove();
    this.selectedProp = key;
    this.holdingFromInventory = false;
    this.carryStaff = null;
    this.updateGhost();
    this.updateShopUI();
  }

  deselectProp() {
    if (this.movingBooth) { this.cancelBoothMove(); this.refreshDock(); return; }
    this.selectedProp = null;
    this.holdingFromInventory = false;
    this.carryStaff = null;
    this.updateGhost();
    this.updateShopUI();
  }

  // Builds the dock once (see index.html): the main tabs, the store's
  // category row and OK, and the scroll arrows.
  buildShop() {
    this.shopItemsEl = document.getElementById('shopItems');
    this.dockEl = document.getElementById('dock');
    this.selectedChip = document.getElementById('selectedChip');
    if (!this.shopItemsEl || !this.dockEl) return; // older/debug HTML — skip silently

    this.dockTabs = {};
    for (const tab of document.querySelectorAll('.dockTab')) {
      this.dockTabs[tab.dataset.tab] = tab;
      tab.addEventListener('click', () => { SFX.unlock(); this.setDockTab(tab.dataset.tab); });
    }
    const row = document.getElementById('storeTabs');
    this.storeTabButtons = {};
    for (const category of STORE_CATEGORIES) {
      const sub = document.createElement('div');
      sub.className = 'storeTab';
      sub.dataset.icon = CATEGORIES[category].icon;
      sub.dataset.tipName = category;
      sub.dataset.tipText = CATEGORIES[category].text;
      sub.addEventListener('click', () => this.setShopCategory(category));
      row.appendChild(sub);
      this.storeTabButtons[category] = sub;
    }
    fillIcons(row);
    document.getElementById('storeOk')?.addEventListener('click', () => {
      if (this.selectedProp) this.deselectProp();
      this.setDockTab(this.lastMainTab || 'inventory');
    });

    // Arrows (and the mouse wheel) scroll the row of cards.
    const scrollBy = (dir) => this.shopItemsEl.scrollBy({ left: dir * this.shopItemsEl.clientWidth * 0.8, behavior: 'smooth' });
    document.getElementById('dockPrev')?.addEventListener('click', () => scrollBy(-1));
    document.getElementById('dockNext')?.addEventListener('click', () => scrollBy(1));
    this.shopItemsEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.shopItemsEl.scrollLeft += e.deltaY + e.deltaX;
    }, { passive: false });

    this.activeShopCategory = STORE_CATEGORIES[0];
    this.setDockTab('inventory');
    this.updateSelectedChip();
  }

  // Switches the dock to a tab: 'decor' (the store), 'inventory', 'edit',
  // 'staff', 'expand' or 'celebs'.
  setDockTab(tab) {
    if (tab !== 'decor') this.lastMainTab = tab;
    if (tab !== 'expand') { this.pendingExpand = null; this.clearExpandPreview?.(); }
    if (this.dockTab === 'edit' && tab !== 'edit' && this.selectedProp && this.holdingFromInventory) this.deselectProp();
    this.dockTab = tab;
    for (const key in this.dockTabs || {}) this.dockTabs[key].classList.toggle('active', key === tab);
    if (this.dockEl) {
      this.dockEl.dataset.tab = tab;
      this.dockEl.dataset.mode = tab === 'decor' ? 'store' : 'main';
    }
    document.body.classList.toggle('editing', tab === 'edit');
    hideTip();
    if (this.shopItemsEl) this.shopItemsEl.scrollLeft = 0;
    this.refreshDock();
  }

  // Redraws the open tab's cards.
  refreshDock() {
    const tab = this.dockTab;
    if (tab === 'decor') this.renderShopItems(this.activeShopCategory || STORE_CATEGORIES[0]);
    else if (tab === 'inventory') this.renderInventoryCards();
    else if (tab === 'edit') this.renderEditTools();
    else if (tab === 'staff') { if (this.shopItemsEl) this.shopItemsEl.dataset.rendered = ''; this.renderStaffCard(); }
    else if (tab === 'expand') { if (this.shopItemsEl) this.shopItemsEl.dataset.rendered = ''; this.renderExpandCard(); }
    else if (tab === 'celebs') { if (this.shopItemsEl) this.shopItemsEl.dataset.rendered = ''; this.renderCelebCards(); }
  }

  // Opens the store on one category (also used to jump to one from code).
  setShopCategory(category) {
    if (category === 'Dance Floors') category = 'Floors';
    this.activeShopCategory = category;
    for (const cat in this.storeTabButtons || {}) this.storeTabButtons[cat].classList.toggle('active', cat === category);
    if (this.dockTab !== 'decor') {
      this.setDockTab('decor');
      return;
    }
    hideTip();
    if (this.shopItemsEl) this.shopItemsEl.scrollLeft = 0;
    this.renderShopItems(category);
  }

  // A card for the row: a picture and a strip under it (the price); name
  // and description go in its hover tip. Returns { slot, button, icon, cost }.
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

  // The store's items in one category — click one to hold it, then click
  // in the club to place it. The tip gives its name and Luxury (and, for
  // floors, which kind it is), like Nightclub City's.
  renderShopItems(category) {
    if (!this.shopItemsEl) return;
    for (const cat in this.storeTabButtons || {}) this.storeTabButtons[cat].classList.toggle('active', cat === category);
    this.shopItemsEl.innerHTML = '';
    this.shopItemsEl.dataset.rendered = '';
    this.shopButtons = {};
    this.shopCosts = {};

    const kinds = CATEGORIES[category]?.includes || [category];
    // In unlock order, so mixed categories (Floors) interleave by level.
    const keysInCategory = Object.keys(PROP_TYPES).filter((k) => kinds.includes(PROP_TYPES[k].category))
      .sort((a, b) => (PROP_TYPES[a].unlockLevel || 1) - (PROP_TYPES[b].unlockLevel || 1));
    for (const key of keysInCategory) {
      const def = PROP_TYPES[key];
      const lines = [];
      if (def.category === 'Dance Floors') lines.push(`Dance floor: guests dance on it${def.capacity ? `, and ${def.capacity} more fit in your club` : ''}.`);
      if (def.category === 'Floors') lines.push('Regular floor: paint it tile by tile.');
      lines.push(`Luxury: ${Math.round((def.cost || 0) * LUXURY.perDollar)}`);
      const picture = realSpriteIconFor(key) || renderIsoIcon(def.color, FLOOR_DECAL_PROPS.has(key));
      const { slot, button, cost } = this.makeCard(def.label, lines.join(' '), picture);
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

  // The Expand tab: a card for each open edge of the room, each adding one
  // row of floor. Hovering or clicking a card shows the new row glowing
  // green in the club; a click picks it and a green confirm card buys it.
  renderExpandCard() {
    if (!this.shopItemsEl) return;
    const level = this.levelInfo().level;
    const tiers = { left: this.expansionFor('left'), right: this.expansionFor('right') };
    const pending = tiers[this.pendingExpand] ? this.pendingExpand : null;
    // Only rebuild when the cards would change (this runs often).
    const afford = ['left', 'right'].map((k) => (tiers[k] ? this.cash >= tiers[k].cost : '')).join();
    const key = `expand:${this.gridW}x${this.gridH}:${level}:${afford}:${pending}`;
    if (this.shopItemsEl.dataset.rendered === key) return;
    this.shopItemsEl.innerHTML = '';
    this.shopItemsEl.dataset.rendered = key;
    const wallName = { left: 'left', right: 'right' };
    for (const side of ['left', 'right']) {
      const tier = tiers[side];
      const { slot, button, icon, cost } = this.makeCard(`Add a row on the ${wallName[side]}`, '', null);
      slot.classList.add('expandSlot');
      slot.dataset.side = side;
      icon.dataset.icon = side === 'left' ? 'expandLeft' : 'expandRight';
      const wall = side === 'left' ? this.gridH : this.gridW;
      if (!tier) {
        button.classList.add('locked');
        cost.textContent = '🏆 Max';
        slot.dataset.tipText = `The ${side} wall is ${wall} tiles, as long as it gets.`;
      } else {
        const unlocked = level >= tier.unlockLevel;
        button.classList.toggle('unaffordable', unlocked && this.cash < tier.cost);
        button.classList.toggle('locked', !unlocked);
        button.classList.toggle('selected', pending === side);
        cost.textContent = unlocked ? `$${tier.cost}` : `🔒 Lv ${tier.unlockLevel}`;
        slot.dataset.tipText = `${tier.tiles} more floor tiles along the front-${side} edge: the ${side} wall grows from ${wall} to ${tier.newLen} tiles.`
          + (unlocked ? ' Click to see it, then confirm.' : ` Reach level ${tier.unlockLevel} to build it.`);
        slot.addEventListener('mouseenter', () => this.showExpandPreview(side));
        slot.addEventListener('mouseleave', () => this.showExpandPreview(this.pendingExpand));
        slot.addEventListener('click', () => {
          if (!unlocked) { SFX.denied(); return; }
          this.pendingExpand = this.pendingExpand === side ? null : side;
          this.showExpandPreview(this.pendingExpand || side);
          this.renderExpandCard();
        });
      }
      fillIcons(slot);
      this.shopItemsEl.appendChild(slot);
    }
    if (pending) {
      const tier = tiers[pending];
      const { slot, button, icon, cost } = this.makeCard('Build it!', `Add the row shown in green for $${tier.cost}.`, null);
      slot.classList.add('confirmSlot');
      icon.dataset.icon = 'check';
      button.classList.toggle('unaffordable', this.cash < tier.cost);
      cost.textContent = `Buy $${tier.cost}`;
      slot.addEventListener('click', () => {
        if (this.expandClub(pending)) this.pendingExpand = null;
        this.renderExpandCard();
      });
      fillIcons(slot);
      this.shopItemsEl.appendChild(slot);
    }
  }

  // Keeps the cards' selected / can't-afford / locked looks and prices
  // current whenever selection, cash, fans (level) or placed props change,
  // plus the "holding" chip.
  updateShopUI() {
    if (this.dockTab === 'expand' && this.shopItemsEl) this.renderExpandCard();
    if (this.dockTab === 'staff' && this.shopItemsEl) this.renderStaffCard();
    if (this.dockTab === 'celebs' && this.shopItemsEl) this.renderCelebCards();
    if (this.dockTab === 'inventory' && this.shopButtons) {
      for (const key in this.shopButtons) this.shopButtons[key].classList.toggle('selected', key === this.selectedProp && !!this.holdingFromInventory);
    }
    if (this.dockTab === 'decor' && this.shopButtons) {
      for (const key in this.shopButtons) {
        const unlocked = this.isUnlocked(key);
        const cost = this.currentCost(key);
        // DJ booths are upgrades for the club's one booth: the current one is
        // marked, and the others show what the swap costs.
        const booth = PROP_TYPES[key].category === 'DJ Booths' ? this.clubBooth() : null;
        const current = !!booth && booth.type === key;
        const swapCost = booth ? cost - Math.round(PROP_TYPES[booth.type].cost * SELL_REFUND_RATIO) : cost;
        this.shopButtons[key].classList.toggle('selected', unlocked && (booth ? current : key === this.selectedProp && !this.holdingFromInventory));
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
    text.innerHTML = this.holdingFromInventory
      ? `${def.label} <span class="chipCost">📦 ×${this.inventoryCount(key)}</span>`
      : unlocked
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
