// ClubScene methods: The shop panel, item selection, unlocks and prices.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { FLOOR_DECAL_PROPS, PROP_TYPES } from '../catalog.js';
import { LUXURY, SELL_REFUND_RATIO } from '../config.js';
import { realSpriteIconFor, renderIsoIcon } from '../icons.js';
import { SFX } from '../sfx.js';
import { hideTip } from '../tooltips.js';
import { fillIcons } from '../uiIcons.js';

// The dock along the bottom is the game's navigation: Build, Staff, Club,
// Inventory and VIP (the celebrities) in one bar, the open one glowing,
// with its panel above. Build shows a row of category keys on the panel's
// top edge (NEW first, then the store), with the items standing on the
// screen and their prices under them; Club's keys are Edit and Expand.
// (Goals are a tab on the left side, see goals.js.)
// Everything is a picture; names and descriptions are in the hover tips.
const CATEGORIES = {
  New: { icon: 'newGlyph', text: 'Everything you unlocked at your last two levels.', isNew: true },
  Bars: { icon: 'bars', text: 'Bars sell drinks. Each long bar needs one bartender.' },
  Seating: { label: 'Seats', icon: 'seating', text: 'Couches and booths where guests sit down and relax.' },
  Floors: { icon: 'floors', text: 'Dance floors, where guests dance, and regular floors, painted tile by tile.', includes: ['Dance Floors', 'Floors'] },
  Wallpaper: { label: 'Walls', icon: 'roller', text: 'Paper the walls, section by section.' },
  Decorations: { label: 'Decor', icon: 'lamp', text: 'Plants, lights and statues to make the club fancier.' },
  'DJ Booths': { label: 'DJ', icon: 'turntable', text: 'Upgrade your DJ booth. A better booth earns more XP.' },
};
// The Club panel's keys, each its own panel.
const CLUB_KEYS = {
  Edit: { icon: 'hammer', text: 'Move, turn, put away or sell the things in your club, or clear it out.', tab: 'edit' },
  Expand: { icon: 'expand', text: 'Make the club bigger, a row of floor at a time.', tab: 'expand' },
};
// Which nav pad each panel belongs to, and the panel each pad opens.
const NAV_OF = { decor: 'build', staff: 'staff', edit: 'club', expand: 'club', inventory: 'inventory', celebs: 'celebs' };
const NAV_OPENS = { build: 'decor', staff: 'staff', club: 'edit', inventory: 'inventory', celebs: 'celebs' };
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

  // Something unlocked at the last level or two, marked NEW in the store.
  isNewItem(type) {
    const unlockLevel = PROP_TYPES[type].unlockLevel || 1;
    const level = this.levelInfo().level;
    return unlockLevel > 1 && unlockLevel <= level && unlockLevel >= level - 1;
  }

  // Builds the dock once (see index.html): the corner buttons, the store's
  // category row, OK and the scroll arrows.
  buildShop() {
    this.shopItemsEl = document.getElementById('shopItems');
    this.dockEl = document.getElementById('dock');
    this.selectedChip = document.getElementById('selectedChip');
    this.inventoryBadge = document.getElementById('inventoryBadge');
    if (!this.shopItemsEl || !this.dockEl) return; // older/debug HTML — skip silently

    this.dockTabs = {};
    for (const pad of document.querySelectorAll('.dockTab')) {
      const nav = pad.dataset.nav;
      this.dockTabs[nav] = pad;
      // Clicking the open one again closes it; Club reopens where you were.
      pad.addEventListener('click', () => {
        SFX.unlock();
        if (this.dockTab && this.activeDockKey() === nav) this.closeDock();
        else this.setDockTab(nav === 'club' ? (this.lastClubTab || 'edit') : NAV_OPENS[nav]);
      });
    }
    fillIcons(this.dockEl);
    this.setupClearClub();
    this.setupBeatUI();
    const row = document.getElementById('storeTabs');
    this.storeTabButtons = {};
    const addKey = (name, def, nav, onClick) => {
      const key = document.createElement('div');
      key.className = 'storeTab';
      key.dataset.nav = nav;
      key.dataset.icon = def.icon;
      key.dataset.tipName = name;
      key.dataset.tipText = def.text;
      key.addEventListener('click', onClick);
      const label = document.createElement('span');
      label.className = 'keyLabel';
      label.textContent = def.label || name;
      key.appendChild(label);
      row.appendChild(key);
      this.storeTabButtons[name] = key;
    };
    for (const category of STORE_CATEGORIES) addKey(category, CATEGORIES[category], 'build', () => this.setShopCategory(category));
    for (const [name, def] of Object.entries(CLUB_KEYS)) addKey(name, def, 'club', () => this.setDockTab(def.tab));
    fillIcons(row);
    // The green check finishes what you're doing and closes the panel.
    document.getElementById('storeOk')?.addEventListener('click', () => { SFX.unlock(); this.closeDock(); });

    // Arrows (and the mouse wheel) scroll the row of cards.
    const scrollBy = (dir) => this.shopItemsEl.scrollBy({ left: dir * this.shopItemsEl.clientWidth * 0.8, behavior: 'smooth' });
    document.getElementById('dockPrev')?.addEventListener('click', () => scrollBy(-1));
    document.getElementById('dockNext')?.addEventListener('click', () => scrollBy(1));
    this.shopItemsEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.shopItemsEl.scrollLeft += e.deltaY + e.deltaX;
    }, { passive: false });

    this.activeShopCategory = STORE_CATEGORIES[1]; // Bars (NEW is first)
    this.closeDock(); // just the nav bar until one is opened
    this.updateSelectedChip();
  }

  // Which nav pad is lit: the one the open panel belongs to.
  activeDockKey() {
    return NAV_OF[this.dockTab] || null;
  }

  refreshDockButtons() {
    const key = this.dockTab ? this.activeDockKey() : null;
    for (const k in this.dockTabs || {}) this.dockTabs[k].classList.toggle('active', k === key);
  }

  // Switches the dock to a panel: 'decor' (Build), 'staff', 'edit' or
  // 'expand' (both in Club), 'inventory' or 'celebs' (VIP).
  setDockTab(tab) {
    if (NAV_OF[tab] === 'club') this.lastClubTab = tab;
    if (tab !== 'expand') { this.pendingExpand = null; this.clearExpandPreview?.(); }
    if (this.dockTab === 'edit' && tab !== 'edit' && this.selectedProp && this.holdingFromInventory) this.deselectProp();
    this.dockTab = tab;
    this.refreshDockButtons();
    if (this.dockEl) {
      this.dockEl.dataset.tab = tab;
      this.dockEl.dataset.nav = NAV_OF[tab] || '';
      this.dockEl.dataset.mode = ['build', 'club'].includes(NAV_OF[tab]) ? 'store' : 'main';
    }
    // The open panel's key is lit: the store category in Build, the panel in Club.
    const lit = NAV_OF[tab] === 'club' ? Object.keys(CLUB_KEYS).find((k) => CLUB_KEYS[k].tab === tab) : this.activeShopCategory;
    for (const cat in this.storeTabButtons || {}) this.storeTabButtons[cat].classList.toggle('active', cat === lit);
    document.body.classList.toggle('editing', tab === 'edit');
    if (this.drawSelectionFootprint) this.drawSelectionFootprint();
    hideTip();
    if (this.shopItemsEl) this.shopItemsEl.scrollLeft = 0;
    this.refreshDock();
  }

  // Finishes the current action (puts down whatever is held, calls off a
  // move or an expansion) and closes the panel: just the tab logos show.
  closeDock() {
    if (this.selectedProp || this.movingBooth) this.deselectProp();
    this.pendingExpand = null;
    this.clearExpandPreview?.();
    this.clearSelection?.();
    this.dockTab = null;
    this.refreshDockButtons();
    if (this.dockEl) {
      this.dockEl.dataset.tab = '';
      this.dockEl.dataset.nav = '';
      this.dockEl.dataset.mode = 'closed';
    }
    document.body.classList.remove('editing');
    if (this.drawSelectionFootprint) this.drawSelectionFootprint();
    hideTip();
  }

  // Redraws the open tab's cards.
  refreshDock() {
    const tab = this.dockTab;
    if (tab === 'decor') this.renderShopItems(this.activeShopCategory || STORE_CATEGORIES[1]);
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
    this.refreshDockButtons();
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
    const keysInCategory = Object.keys(PROP_TYPES)
      .filter((k) => (CATEGORIES[category]?.isNew ? this.isNewItem(k) : kinds.includes(PROP_TYPES[k].category)))
      .sort((a, b) => (PROP_TYPES[a].unlockLevel || 1) - (PROP_TYPES[b].unlockLevel || 1));
    if (keysInCategory.length === 0) {
      const { slot, icon, cost } = this.makeCard('Nothing new yet', 'Level up to unlock new things: they show up here, marked NEW.', null);
      slot.classList.add('emptySlot');
      icon.dataset.icon = 'newGlyph';
      cost.textContent = 'New things show up here when you level up';
      fillIcons(slot);
      this.shopItemsEl.appendChild(slot);
    }
    for (const key of keysInCategory) {
      const def = PROP_TYPES[key];
      const lines = [];
      if (def.category === 'Dance Floors') lines.push('Dance floor: guests dance on it.');
      if (def.category === 'Floors') lines.push('Regular floor: paint it tile by tile.');
      lines.push(`Luxury: ${Math.round((def.cost || 0) * LUXURY.perDollar)}`);
      const picture = realSpriteIconFor(key) || renderIsoIcon(def.color, FLOOR_DECAL_PROPS.has(key));
      const { slot, button, cost } = this.makeCard(def.label, lines.join(' '), picture);
      cost.textContent = this.isUnlocked(key) ? `$${this.currentCost(key)}` : `🔒 Lv ${def.unlockLevel || 1}`;
      if (this.isNewItem(key)) {
        const tag = document.createElement('div');
        tag.className = 'newTag';
        tag.textContent = 'NEW';
        slot.appendChild(tag);
      }
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
        slot.dataset.tipText = `${tier.tiles} more floor tiles along the front-${side} edge: the ${side} wall grows from ${wall} to ${tier.newLen} tiles: more room for a popular club's crowd.`
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
    // NEW pulses while there's something new; Inventory shows how many
    // things are in it.
    this.storeTabButtons?.New?.classList.toggle('hasNew', Object.keys(PROP_TYPES).some((k) => this.isNewItem(k)));
    if (this.inventoryBadge) {
      const total = Object.keys(this.inventory || {}).reduce((n, t) => n + (PROP_TYPES[t] ? this.inventoryCount(t) : 0), 0);
      this.inventoryBadge.textContent = total > 0 ? String(total) : '';
    }
    this.updateSelectedChip();
  }

  // The small pill at the top of the screen showing what you're about to
  // place (kept clear of the floor, so it never hides where it goes).
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
