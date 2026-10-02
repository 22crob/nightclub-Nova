// ClubScene methods: The shop panel, item selection, unlocks and prices.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { FLOOR_DECAL_PROPS, PROP_TYPES, SHOP_CATEGORIES, fameStars } from '../catalog.js';
import { SELL_REFUND_RATIO } from '../config.js';
import { realSpriteIconFor, renderIsoIcon } from '../icons.js';
import { SFX } from '../sfx.js';

export class ShopMixin {
  // True once the player's level has reached this prop's unlockLevel
  // (defaults to 1 — available from the start — if a type doesn't set one).
  isUnlocked(type) {
    const unlockLevel = PROP_TYPES[type].unlockLevel || 1;
    return this.levelInfo().level >= unlockLevel;
  }

  // Selecting the item that's already selected is how you back out of
  // build mode — clicking it again in the shop deselects rather than doing
  // nothing, since otherwise there was no way to stop holding an item short
  // of buying/picking a different one.
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

  // Builds the categorized shop once: a tab per SHOP_CATEGORIES entry (a
  // real one right now is just Bars/Booths/Floors — Decorations and
  // Wallpaper are empty placeholders until there's content for them), plus
  // wiring for the toggle button that opens the panel and the close
  // button/backdrop that dismiss it. The panel starts open on whichever
  // category the currently selected prop belongs to.
  buildShop() {
    this.shopToggle = document.getElementById('shopToggle');
    this.shopOverlay = document.getElementById('shopOverlay');
    this.shopClose = document.getElementById('shopClose');
    this.shopTabsEl = document.getElementById('shopTabs');
    this.shopItemsEl = document.getElementById('shopItems');
    this.selectedChip = document.getElementById('selectedChip');
    if (!this.shopToggle || !this.shopOverlay || !this.shopTabsEl || !this.shopItemsEl) return; // older/debug HTML — skip silently

    this.shopTabsEl.innerHTML = '';
    this.shopTabButtons = {};
    for (const category of SHOP_CATEGORIES) {
      const tab = document.createElement('div');
      tab.className = 'shopTab';
      tab.textContent = category;
      tab.addEventListener('click', () => this.setShopCategory(category));
      this.shopTabsEl.appendChild(tab);
      this.shopTabButtons[category] = tab;
    }

    this.shopToggle.addEventListener('click', () => this.openShop());
    // Toolbar shortcuts into specific shop tabs.
    const decorate = document.getElementById('decorateButton');
    const expand = document.getElementById('expandButton');
    const staff = document.getElementById('staffButton');
    if (decorate) decorate.addEventListener('click', () => this.openShop('Floors'));
    if (expand) expand.addEventListener('click', () => this.openShop('Expand'));
    if (staff) staff.addEventListener('click', () => this.openShop('Staff'));
    if (this.shopClose) this.shopClose.addEventListener('click', () => this.closeShop());
    // Clicking the dark backdrop (but not the panel itself) also closes it.
    this.shopOverlay.addEventListener('click', (e) => {
      if (e.target === this.shopOverlay) this.closeShop();
    });

    this.setShopCategory((PROP_TYPES[this.selectedProp] && PROP_TYPES[this.selectedProp].category) || SHOP_CATEGORIES[0]);
    this.updateSelectedChip();
  }

  // Opens the shop, optionally on a given tab.
  openShop(category) {
    if (category) this.setShopCategory(category);
    if (this.shopOverlay) this.shopOverlay.classList.add('open');
  }

  closeShop() {
    if (this.shopOverlay) this.shopOverlay.classList.remove('open');
  }

  // Switches the active tab and re-renders that category's items. Item
  // buttons only exist in the DOM for whichever category is currently
  // showing — updateShopUI() below only needs to keep those in sync.
  setShopCategory(category) {
    this.activeShopCategory = category;
    if (this.shopTabButtons) {
      for (const cat in this.shopTabButtons) {
        this.shopTabButtons[cat].classList.toggle('active', cat === category);
      }
    }
    this.renderShopItems(category);
  }

  // Renders one category's items as the same circular icon buttons the old
  // flat build bar used (dark circle, gold ring, cost pill) — click one to
  // select it, no keyboard shortcut involved.
  renderShopItems(category) {
    if (!this.shopItemsEl) return;
    this.shopItemsEl.innerHTML = '';
    this.shopButtons = {};
    this.shopCosts = {};

    // The Expand tab isn't a set of placeable props at all — it's a single
    // instant-purchase upgrade card for growing the club's grid size. See
    // renderExpandCard()/expandClub().
    if (category === 'Expand') {
      this.renderExpandCard();
      return;
    }
    if (category === 'Staff') {
      this.renderStaffCard();
      return;
    }

    const keysInCategory = Object.keys(PROP_TYPES).filter((k) => PROP_TYPES[k].category === category);
    if (keysInCategory.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'emptyCategory';
      empty.textContent = 'No items yet — coming soon!';
      this.shopItemsEl.appendChild(empty);
      return;
    }

    for (const key of keysInCategory) {
      const def = PROP_TYPES[key];

      const slot = document.createElement('div');
      slot.className = 'propSlot';

      const button = document.createElement('div');
      button.className = 'propButton';

      const icon = document.createElement('div');
      icon.className = 'icon';
      const realIcon = realSpriteIconFor(key);
      if (realIcon) {
        icon.style.backgroundImage = `url(${realIcon})`;
      } else {
        // Non-sprite props get a little rendered iso-box chip instead of a
        // flat color swatch, so the shop matches the shaded boxes the
        // props actually appear as once placed in the world.
        // NOTE: `background` is a shorthand — setting it here would reset
        // backgroundImage (just set above) back to none, leaving an empty
        // circle. Use backgroundColor instead so it only fills in behind
        // the icon's transparent PNG margins without wiping the image out.
        icon.style.backgroundImage = `url(${renderIsoIcon(def.color, FLOOR_DECAL_PROPS.has(key))})`;
        icon.style.backgroundColor = '#120a1f';
      }
      button.appendChild(icon);

      const label = document.createElement('div');
      label.className = 'propLabel';
      label.textContent = def.label;

      const cost = document.createElement('div');
      cost.className = 'propCost';
      cost.textContent = this.isUnlocked(key) ? `💰 ${this.currentCost(key)}` : `🔒 Lv ${def.unlockLevel || 1}`; // overwritten immediately by updateShopUI() below too, but correct from the first frame

      button.addEventListener('click', () => {
        // DJ booths aren't placed: buying one swaps the club's booth.
        if (def.category === 'DJ Booths') {
          if (this.upgradeClubBooth(key)) this.closeShop();
          return;
        }
        const wasSelected = this.selectedProp === key;
        this.selectProp(key);
        // Only get out of the way once something was actually just picked.
        // selectProp() silently no-ops (just a denied blip) on a locked
        // item, and clicking the CURRENT selection again is a deselect, not
        // a pick — closing the whole shop in either case used to leave the
        // player having to reopen it just to try a different item, or to
        // keep browsing after clearing their selection.
        if (!wasSelected && this.selectedProp === key) this.closeShop();
      });
      slot.appendChild(button);
      slot.appendChild(label);
      slot.appendChild(cost);

      // A qualitative "Fame" rating instead of raw stat numbers — how cool
      // the item is, not a spreadsheet of exactly what it does. Only a
      // Floors item also gets a plain-language capacity note, since
      // capacity is strictly a flooring thing (see patronCapacity()).
      const stats = document.createElement('div');
      stats.className = 'propStats';
      const stars = fameStars(def.cost);
      let statsText = '✨ ' + '★'.repeat(stars) + '☆'.repeat(5 - stars);
      if (def.category === 'Floors' && def.capacity) statsText += `  🧱 +${def.capacity} floor space`;
      stats.textContent = statsText;
      slot.appendChild(stats);

      this.shopItemsEl.appendChild(slot);
      this.shopButtons[key] = button;
      this.shopCosts[key] = cost;
    }
    this.updateShopUI();
  }

  // Renders the Expand tab's single card: current floor size, the next
  // tier's size/cost/lock state, and a buy button that fires expandClub()
  // directly — there's no "select then place" step here, buying IS the
  // action. Re-rendered wholesale (rather than patched in place like the
  // prop buttons) any time it needs to refresh, since it's cheap and only
  // exists while this one tab is open.
  renderExpandCard() {
    // This gets called both from renderShopItems() (opening/switching to
    // the tab) AND from updateShopUI() (refreshing it while it's already
    // open, e.g. every second from the passive fan-rate tick) — clearing
    // the container here, rather than relying on the caller to have done
    // it, is what keeps a repeat call from stacking a second/third/Nth
    // card on top of the first instead of replacing it.
    this.shopItemsEl.innerHTML = '';
    const tier = this.nextExpansion();

    const card = document.createElement('div');
    card.className = 'expandCard';

    const current = document.createElement('div');
    current.className = 'expandCurrent';
    current.textContent = `Current floor: ${this.gridSize}×${this.gridSize}`;
    card.appendChild(current);

    if (!tier) {
      const maxed = document.createElement('div');
      maxed.className = 'expandMaxed';
      maxed.textContent = '🏆 Maximum club size reached!';
      card.appendChild(maxed);
      this.shopItemsEl.appendChild(card);
      return;
    }

    const unlocked = this.levelInfo().level >= tier.unlockLevel;
    const afford = this.cash >= tier.cost;

    const next = document.createElement('div');
    next.className = 'expandNext';
    next.textContent = `Next size: ${tier.size}×${tier.size}`;
    card.appendChild(next);

    const button = document.createElement('div');
    button.className = 'expandButton';
    button.classList.toggle('unaffordable', unlocked && !afford);
    button.classList.toggle('locked', !unlocked);
    button.textContent = unlocked ? `💰 Expand for ${tier.cost}` : `🔒 Unlocks at Lv ${tier.unlockLevel}`;
    button.addEventListener('click', () => {
      if (this.expandClub()) this.closeShop(); // successful purchase — get out of the way so the player can see the new floor
    });
    card.appendChild(button);

    this.shopItemsEl.appendChild(card);
  }

  // Keeps the active tab's "selected" highlight, "can't afford it" dim
  // state, "locked until you level up" state, and the displayed price/
  // unlock text all in sync — called whenever selection, cash, fans
  // (level), or placed props change, since any of those can affect what's
  // shown. Also keeps the always-visible "currently holding" chip current,
  // since that one has to reflect the selection even while the shop panel
  // (and thus these buttons) is closed.
  updateShopUI() {
    // The Expand tab has no prop buttons to patch — just re-render its one
    // card so its price/lock state stays current with cash/level changes
    // while it's the open tab.
    if (this.activeShopCategory === 'Expand' && this.shopItemsEl) {
      this.renderExpandCard();
    }
    if (this.activeShopCategory === 'Staff' && this.shopItemsEl && this.shopOverlay.classList.contains('open')) {
      this.renderStaffCard();
    }
    if (this.shopButtons) {
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
          let text = unlocked ? `💰 ${cost}` : `🔒 Lv ${PROP_TYPES[key].unlockLevel || 1}`;
          if (unlocked && booth) text = current ? '🎧 Playing now' : `⬆ ${Math.max(0, swapCost)}`;
          this.shopCosts[key].textContent = text;
        }
      }
    }
    this.updateSelectedChip();
  }

  // The small pill above the shop button showing what you're about to
  // place — the shop panel itself is only open while picking, so this is
  // the only persistent reminder of the current selection.
  updateSelectedChip() {
    if (!this.selectedChip) return;
    const key = this.selectedProp;
    const def = PROP_TYPES[key];
    if (!def) {
      this.selectedChip.textContent = 'Nothing selected — open the shop to build';
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
