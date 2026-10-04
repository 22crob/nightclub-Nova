// ClubScene methods: the VIP list. Nightclub City's VIP list was friends you
// invited; here it's your regulars. A guest who leaves very happy joins the
// list (by name and look), and VIPs come back later: they queue
// outside like anyone else, glow gold, and tip double. The dock's VIP tab
// shows them with how many times they've been.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PATRON_META, PATRON_SHEETS } from '../assets.js';
import { CELEB, VIP } from '../config.js';
import { SFX } from '../sfx.js';

export class VipsMixin {
  // A VIP to send to the line, or null: now and then, one who isn't
  // already in the club or waiting outside.
  pickReturningVip() {
    if (!this.vips || this.vips.length === 0 || Math.random() >= VIP.returnChance) return null;
    const here = new Set([
      ...this.patrons.filter((p) => p.vip).map((p) => p.vip.name),
      ...(this.streetQueue || []).filter((p) => p.vip).map((p) => p.vip.name),
    ]);
    const free = this.vips.filter((v) => !here.has(v.name) && v.character < PATRON_SHEETS.length);
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  // Makes a guest who just came in the VIP they are: their name, a visit
  // counted, and the gold glow under their feet.
  welcomeVip(patron, vip) {
    patron.vip = vip;
    patron.name = vip.name;
    vip.visits += 1;
    const shadow = patron.container.list[0];
    if (shadow && shadow.setFillStyle) shadow.setFillStyle(0xffd24d, 0.7);
    const c = patron.container;
    this.floatText(c.x, c.y - 80, `⭐ VIP ${vip.name}`, '#ffd24d');
    this.saveGame();
  }

  // A guest leaving very happy joins the list.
  maybeJoinVips(patron) {
    if (patron.vip || patron.stormedOut || patron.mood < VIP.joinMood || !patron.name) return;
    this.vips = this.vips || [];
    if (this.vips.length >= VIP.max || this.vips.some((v) => v.name === patron.name)) return;
    this.vips.push({ name: patron.name, character: patron.container.patronCharacter ?? 0, visits: 1 });
    SFX.levelUp();
    this.showToast(`⭐ ${patron.name} loved your club and joined your VIP list!`);
    if (this.dockTab === 'vip') this.renderVipCards();
    this.saveGame();
  }

  // VIPs and celebrities tip extra.
  vipTipFactor(patron) {
    return (patron.vip ? VIP.tipMultiplier : 1) * (patron.celeb ? CELEB.tip : 1);
  }

  // The dock's VIP tab: a card per regular, their face and how many times
  // they've been; name and status in the hover tip. Empty slots up to the
  // list's size show how many more can join.
  renderVipCards() {
    const el = this.shopItemsEl;
    if (!el) return;
    el.innerHTML = '';
    el.dataset.rendered = '';
    const vips = this.vips || [];
    for (const v of vips) {
      const inside = this.patrons.some((p) => p.vip && p.vip.name === v.name && !p.gone);
      const { slot, icon, cost } = this.makeCard(`⭐ ${v.name}`,
        `${v.visits} visit${v.visits === 1 ? '' : 's'}${inside ? ' · in the club now' : ''}. VIPs come back later and tip double.`, null);
      slot.classList.add('vipSlot');
      const url = PATRON_SHEETS[v.character];
      if (url) {
        // The head and shoulders from the first frame of their sheet.
        const k = 0.7;
        icon.style.backgroundImage = `url(${url})`;
        icon.style.backgroundSize = `${PATRON_META.frameWidth * PATRON_META.columns * k}px auto`;
        icon.style.backgroundPosition = `${-PATRON_META.frameWidth * k * 0.12}px ${-22 * k}px`;
      }
      if (inside) slot.classList.add('here');
      cost.textContent = `⭐ ${v.visits}`;
      el.appendChild(slot);
    }
    for (let i = vips.length; i < VIP.max; i++) {
      const { slot, cost } = this.makeCard('Empty VIP spot',
        'Guests who leave really happy join your VIP list, then come back later to tip double.', null);
      slot.classList.add('vipSlot', 'emptySlot');
      cost.textContent = `${i + 1}/${VIP.max}`;
      el.appendChild(slot);
    }
  }

  setupVips() {
    // Shown in the dock's VIP tab (see shop.js).
  }
}
