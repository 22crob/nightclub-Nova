// ClubScene methods: the inventory and the Edit tab, like Nightclub City's.
// The inventory holds things you own but haven't placed (this.inventory,
// { type: count }, saved). The Edit tab has four tools; with one chosen,
// clicking a placed item in the club moves it (picks it up to place again
// for free), turns it, puts it away in the inventory, or sells it.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { FLOOR_DECAL_PROPS, PROP_TYPES } from '../catalog.js';
import { SELL_REFUND_RATIO } from '../config.js';
import { realSpriteIconFor, renderIsoIcon } from '../icons.js';
import { SFX } from '../sfx.js';
import { fillIcons } from '../uiIcons.js';

export const EDIT_TOOLS = {
  move: { icon: 'toolMove', name: 'Move', text: 'Click something in your club to pick it up, then click where it should go.' },
  rotate: { icon: 'toolRotate', name: 'Turn', text: 'Click something in your club to turn it.' },
  store: { icon: 'toolStore', name: 'Put away', text: 'Click something in your club to put it in your inventory, to place again later for free.' },
  sell: { icon: 'toolSell', name: 'Sell', text: `Click something in your club to sell it back for ${Math.round(SELL_REFUND_RATIO * 100)}% of its price.` },
};

export class InventoryMixin {
  inventoryCount(type) {
    return (this.inventory && this.inventory[type]) || 0;
  }

  addToInventory(type, n = 1) {
    this.inventory = this.inventory || {};
    this.inventory[type] = this.inventoryCount(type) + n;
    if (this.inventory[type] <= 0) delete this.inventory[type];
  }

  // Holds an item from the inventory, to place for free. Things you own
  // can always be placed, whatever your level.
  selectFromInventory(type) {
    if (this.inventoryCount(type) <= 0) { SFX.denied(); return; }
    if (this.selectedProp === type && this.holdingFromInventory) { this.deselectProp(); return; }
    if (this.movingBooth && type !== this.movingBooth.type) this.cancelBoothMove();
    this.selectedProp = type;
    this.holdingFromInventory = true;
    this.updateGhost();
    this.updateShopUI();
  }

  // Takes a placed item out of the club into the inventory. Returns its
  // record's bartender kind (so a moved bar can keep its bartender), or
  // false if it can't be picked up.
  // The DJ booth can only be picked up to move it (the club always has
  // one): pass `moving`.
  pickUpProp(rec, moving = false) {
    if (PROP_TYPES[rec.type].staff === 'dj' && !moving) {
      SFX.denied();
      this.showToast('🎧 Your DJ booth stays in the club! You can move it or turn it.');
      return false;
    }
    if (PROP_TYPES[rec.type].staff === 'dj') {
      // Remember where it was, to put it back if the move is called off.
      this.movingBooth = { type: rec.type, facing: rec.facing, anchor: [...rec.anchor] };
      this.removeProp(rec);
      this.addToInventory(rec.type);
      this.pushInventoryXp(rec.type, rec.xp);
      this.updateGhost();
      this.updateUI();
      return 'dj';
    }
    const staffKind = rec.staff && rec.staff.kind;
    // A bar in a long bar leaves its bartender with the rest of the bar.
    const keepsStaff = staffKind && this.barGroup(rec).length === 1 ? staffKind : null;
    this.removeProp(rec);
    this.addToInventory(rec.type);
    this.pushInventoryXp(rec.type, rec.xp); // moving or storing gives (and loses) no XP
    this.updateGhost();
    this.updateUI();
    this.saveGame();
    return keepsStaff;
  }

  // A click on the club floor while the Edit tab is open and nothing is
  // held: uses the chosen tool on whatever stands there. Returns true if
  // it did something.
  editClick(gx, gy) {
    const rec = this.placed[`${gx},${gy}`];
    if (!rec) return false;
    const tool = this.editTool || 'move';
    if (tool === 'rotate') {
      if (!PROP_TYPES[rec.type].rotatable) { SFX.denied(); return true; }
      this.rotatePlacedProp(`${gx},${gy}`);
      SFX.place();
    } else if (tool === 'sell') {
      this.sellProp(gx, gy);
    } else {
      const facing = rec.facing;
      const staff = this.pickUpProp(rec, tool === 'move');
      if (staff === false) return true;
      SFX.sell();
      if (tool === 'move') {
        // Hold it straight away, facing the way it was.
        this.carryStaff = staff;
        this.currentFacing = facing;
        this.selectFromInventory(rec.type);
      } else {
        this.showToast(`📦 ${PROP_TYPES[rec.type].label} put away in your inventory.`);
      }
    }
    this.refreshDock();
    return true;
  }

  // After placing from the inventory: one fewer in it, a moved bar gets its
  // bartender back, and the hand empties when there are none left.
  placedFromInventory(rec) {
    this.addToInventory(rec.type, -1);
    if (this.movingBooth && rec.type === this.movingBooth.type) this.movingBooth = null;
    if (this.carryStaff && !this.isWorked(rec) && PROP_TYPES[rec.type].staff === this.carryStaff) this.attachStaff(rec);
    this.carryStaff = null;
    if (this.inventoryCount(rec.type) <= 0) {
      this.holdingFromInventory = false;
      this.selectedProp = null;
    }
    this.refreshDock();
  }

  // Puts a DJ booth being moved back where it was (the move was called off:
  // Esc, or picking something else).
  cancelBoothMove() {
    const m = this.movingBooth;
    if (!m) return;
    this.movingBooth = null;
    this.addToInventory(m.type, -1);
    const xp = this.takeInventoryXp(m.type);
    const rec = this.restoreProp(m.type, m.facing, m.anchor) || (this.ensureClubBooth(), this.clubBooth());
    if (rec) rec.xp = xp;
    if (rec && !rec.staff) this.attachStaff(rec);
    if (this.selectedProp === m.type && this.holdingFromInventory) {
      this.selectedProp = null;
      this.holdingFromInventory = false;
      this.carryStaff = null;
    }
    this.updateGhost();
    this.updateUI();
    this.saveGame();
  }

  // The Inventory tab: a card per kind of item, with how many you have.
  renderInventoryCards() {
    const el = this.shopItemsEl;
    if (!el) return;
    el.innerHTML = '';
    el.dataset.rendered = '';
    this.shopButtons = {};
    this.shopCosts = {};
    const types = Object.keys(this.inventory || {}).filter((t) => PROP_TYPES[t] && this.inventoryCount(t) > 0);
    if (types.length === 0) {
      const { slot, icon, cost } = this.makeCard('Your inventory is empty', 'Things you put away with the Edit tab wait here, to place again for free.', null);
      slot.classList.add('emptySlot');
      icon.dataset.icon = 'tabInventory';
      fillIcons(slot);
      cost.textContent = '';
      el.appendChild(slot);
      return;
    }
    for (const type of types) {
      const def = PROP_TYPES[type];
      const picture = realSpriteIconFor(type) || renderIsoIcon(def.color, FLOOR_DECAL_PROPS.has(type));
      const { slot, button, cost } = this.makeCard(def.label, 'Yours to place again for free. Click it, then click in your club.', picture);
      cost.textContent = `×${this.inventoryCount(type)}`;
      slot.addEventListener('click', () => this.selectFromInventory(type));
      el.appendChild(slot);
      this.shopButtons[type] = button;
    }
    this.updateShopUI();
  }

  // The Edit tab: the four tools.
  renderEditTools() {
    const el = this.shopItemsEl;
    if (!el) return;
    el.innerHTML = '';
    el.dataset.rendered = '';
    this.editTool = this.editTool || 'move';
    for (const [key, tool] of Object.entries(EDIT_TOOLS)) {
      const { slot, button, icon } = this.makeCard(tool.name, tool.text, null);
      slot.classList.add('toolSlot');
      slot.dataset.tool = key;
      icon.dataset.icon = tool.icon;
      button.classList.toggle('selected', this.editTool === key);
      slot.addEventListener('click', () => {
        this.editTool = key;
        if (this.selectedProp) this.deselectProp();
        this.renderEditTools();
      });
      el.appendChild(slot);
    }
    fillIcons(el);
  }
}
