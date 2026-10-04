// ClubScene methods: the VIP list. Nightclub City's VIP list was friends you
// invited; here it's your regulars. A guest who leaves very happy joins the
// list (by name and look), and VIPs come back on later nights: they queue
// outside like anyone else, glow gold, and tip double. The ⭐ VIPs button
// lists them with how many times they've been.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PATRON_META, PATRON_SHEETS } from '../assets.js';
import { VIP } from '../config.js';
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
    this.saveGame();
  }

  vipTipFactor(patron) {
    return patron.vip ? VIP.tipMultiplier : 1;
  }

  showVipList() {
    const box = document.getElementById('vipList');
    const list = document.getElementById('vipRows');
    if (!box || !list) return;
    list.innerHTML = '';
    const vips = this.vips || [];
    if (vips.length === 0) {
      list.innerHTML = '<div class="vipEmpty">No VIPs yet. Guests who leave really happy (😍) join this list, and come back to tip double.</div>';
    }
    for (const v of vips) {
      const row = document.createElement('div');
      row.className = 'vipRow';
      const face = document.createElement('div');
      face.className = 'vipFace';
      const url = PATRON_SHEETS[v.character];
      if (url) {
        const k = 0.45;
        face.style.backgroundImage = `url(${url})`;
        face.style.backgroundSize = `${PATRON_META.frameWidth * PATRON_META.columns * k}px auto`;
        face.style.backgroundPosition = `${-PATRON_META.frameWidth * k * 0.22}px ${-30 * k}px`;
      }
      const inside = this.patrons.some((p) => p.vip && p.vip.name === v.name && !p.gone);
      row.append(face);
      row.insertAdjacentHTML('beforeend', `<div class="vipName">⭐ ${v.name}${inside ? ' <span class="vipHere">in the club</span>' : ''}</div><div class="vipVisits">${v.visits} visit${v.visits === 1 ? '' : 's'}</div>`);
      list.appendChild(row);
    }
    document.getElementById('vipCount').textContent = `${vips.length} / ${VIP.max}`;
    box.classList.add('open');
  }

  setupVips() {
    document.getElementById('vipButton')?.addEventListener('click', () => { SFX.unlock(); this.showVipList(); });
    document.getElementById('vipClose')?.addEventListener('click', () => document.getElementById('vipList').classList.remove('open'));
  }
}
