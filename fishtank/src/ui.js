// The HUD around the tank (HTML over the game): player panel, tank panel,
// tank strip, dock buttons, the shop, fish cards, the Fish Book, level-ups,
// help, and little messages.
import { SPECIES, TANKS, DECOR, WATER } from './config.js';
import {
  G, onEvent, currentTank, tankDef, tankById, fishById, fishIn, parentsIn, youngIn, tankHappiness, tankStars, tankTip,
  breedStatus, xpProgress, unlocksAt, buyFish, buyTank, canPlaceDecor, sellDecor, sellFish, moveFish,
  feed, clean, setCurrent, newGame, waterOf, roomFor,
} from './state.js';
import { fishName, fishValue, rarityOf, traitList, rarityTier } from './genetics.js';
import { fishThumb } from './fishArt.js';
import { decorThumb } from './decorArt.js';

const $ = (id) => document.getElementById(id);
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Only rewrite an element when its content really changed (keeps hover and
// clicks steady while the HUD refreshes).
function setHtml(el, html) {
  if (el._html !== html) {
    el._html = html;
    el.innerHTML = html;
  }
}

function stars(n) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="star ${n >= i ? 'on' : n >= i - 0.5 ? 'half' : ''}">★</span>`;
  return s;
}

function meter(label, value, color) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return `<div class="meter"><span class="mLabel">${label}</span><div class="mBar"><div class="mFill" style="width:${pct}%;--c:${color}"></div></div></div>`;
}

const sampleCache = {};
function speciesThumb(key) {
  if (!sampleCache[key]) {
    const sp = SPECIES[key];
    sampleCache[key] = fishThumb({ species: key, color: sp.colors[0], color2: sp.colors2[0], pattern: sp.patterns[0], fins: sp.fins, glow: false, size: 1, seed: 12345 });
  }
  return sampleCache[key];
}

function tankThumb(type) {
  const def = TANKS[type], w = WATER[def.water];
  const c = document.createElement('canvas');
  c.width = 120; c.height = 80;
  const ctx = c.getContext('2d');
  const tw = 30 + def.width * 85, x = (120 - tw) / 2;
  const g = ctx.createLinearGradient(0, 14, 0, 66);
  g.addColorStop(0, w.top); g.addColorStop(1, w.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(x, 16, tw, 50);
  ctx.fillStyle = w.sand[0];
  ctx.fillRect(x, 58, tw, 8);
  ctx.fillStyle = '#15151c';
  ctx.fillRect(x - 3, 11, tw + 6, 6);
  ctx.fillRect(x - 3, 65, tw + 6, 5);
  ctx.fillRect(x - 3, 11, 3, 59);
  ctx.fillRect(x + tw, 11, 3, 59);
  if (def.kind === 'breeding') {
    ctx.fillStyle = '#ffe9a8';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + tw / 2 - 8 + i * 4, 56, 2.5, 0, 7); ctx.fill(); }
  }
  ctx.fillStyle = '#6b4128';
  ctx.fillRect(x - 6, 70, tw + 12, 10);
  return c.toDataURL();
}

const tankThumbs = {};
const tankThumbCached = (type) => (tankThumbs[type] ||= tankThumb(type));

const waterBadge = (water) => `<span class="water ${water}">${WATER[water].short}</span>`;

export const UI = {
  scene: null,
  shopTab: 'fish',
  cardFor: null,

  bind(scene) {
    this.scene = scene;
    $('shopBtn').onclick = () => this.toggleShop();
    $('bookBtn').onclick = () => this.openBook();
    $('feedBtn').onclick = () => {
      const r = feed(currentTank().id);
      if (!r.ok) this.toast(r.msg);
      this.refresh();
    };
    $('cleanBtn').onclick = () => {
      const r = clean(currentTank().id);
      if (!r.ok) this.toast(r.msg);
      this.refresh();
    };
    $('helpBtn').onclick = () => this.openHelp();
    $('newBtn').onclick = () => this.confirmNewGame();
    $('shop').addEventListener('click', (e) => this.onShopClick(e));
    $('tankStrip').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tank]');
      if (b) {
        this.closeCard();
        if (b.dataset.tank === 'add') return this.openShop('tanks');
        setCurrent(Number(b.dataset.tank));
      }
    });
    $('card').addEventListener('click', (e) => this.onCardClick(e));
    $('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal' || e.target.closest('[data-close]')) this.closeModal();
      const ok = e.target.closest('[data-confirm-new]');
      if (ok) { this.closeModal(); this.closeCard(); newGame(); this.toast('A brand new fish room!'); }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.closeModal(); this.closeCard(); this.closeShop(); }
    });
    onEvent((e) => this.onGameEvent(e));
    setInterval(() => this.refresh(), 300);
    this.refresh();
  },

  // --- HUD ---
  refresh() {
    const t = currentTank();
    if (!t) return;
    const xp = xpProgress();
    $('lvlNum').textContent = G.level;
    $('xpFill').style.width = `${Math.round((xp.into / xp.need) * 100)}%`;
    $('xpText').textContent = xp.max ? 'Max level' : `${xp.into} / ${xp.need} XP`;
    $('cash').textContent = money(G.cash);

    const def = tankDef(t);
    const n = fishIn(t.id).length;
    const happy = tankHappiness(t);
    let html = `<div class="tpHead"><span class="tpName">${esc(t.name)}</span>${waterBadge(def.water)}</div>`;
    if (def.kind === 'display') {
      html += `<div class="tpRow"><span class="stars">${stars(tankStars(t))}</span><span class="tpCount">${n}/${def.cap} fish</span></div>`;
    } else {
      html += `<div class="tpRow"><span class="tpKind">Breeding tank</span><span class="tpCount">${parentsIn(t.id).length}/2 parents · ${youngIn(t.id).length}/${def.fry} babies</span></div>`;
    }
    html += meter('Food', t.food, t.food < 0.3 ? '#ff6b6b' : '#ffb347');
    html += meter('Clean', 1 - t.dirt, t.dirt > 0.6 ? '#ff6b6b' : '#5fd3ff');
    html += meter('Happy', happy, happy < 0.5 ? '#ff6b6b' : '#7dea6b');
    const bs = breedStatus(t);
    if (bs) {
      html += `<div class="breed"><div class="breedText">${bs.eggs ? '🥚 ' : ''}${esc(bs.text)}</div>`;
      if (bs.progress > 0) html += `<div class="mBar"><div class="mFill" style="width:${Math.round(Math.min(1, bs.progress) * 100)}%;--c:#ff8fd8"></div></div>`;
      if (bs.grown) html += `<div class="breedText grown">${bs.grown} grown-up ${bs.grown === 1 ? 'baby is' : 'babies are'} ready to move to a display tank or sell.</div>`;
      html += '</div>';
    } else {
      html += `<div class="tips">Visitors tip <b>${money(tankTip(t))}</b> every 10 s</div>`;
    }
    setHtml($('tankPanel'), html);

    let strip = '';
    for (const tk of G.tanks) {
      const d = tankDef(tk);
      const alert = tk.food < 0.3 || tk.dirt > 0.6 ? '<span class="alert">!</span>' : tk.eggs ? '<span class="alert egg">🥚</span>' : '';
      const count = d.kind === 'breeding' ? `${fishIn(tk.id).length}` : `${fishIn(tk.id).length}/${d.cap}`;
      strip += `<button class="tankTab ${tk.id === t.id ? 'on' : ''} ${d.water}" data-tank="${tk.id}" title="${esc(tk.name)}">
        <span class="ttIcon">${d.kind === 'breeding' ? '🥚' : d.water === 'salt' ? '🐠' : '🐟'}</span>
        <span class="ttName">${esc(shortName(tk))}</span><span class="ttCount">${count}</span>${alert}</button>`;
    }
    strip += '<button class="tankTab add" data-tank="add" title="Buy another tank">＋</button>';
    setHtml($('tankStrip'), strip);

    $('feedBtn').classList.toggle('needed', t.food < 0.35 && n > 0);
    $('cleanBtn').classList.toggle('needed', t.dirt > 0.55);
    if (!$('shop').classList.contains('hidden')) this.renderShop();
    if (this.cardFor) this.renderCard();
  },

  // --- shop ---
  toggleShop() {
    if ($('shop').classList.contains('hidden')) this.openShop(this.shopTab);
    else this.closeShop();
  },
  openShop(tab) {
    this.shopTab = tab;
    this.closeCard();
    $('shop').classList.remove('hidden');
    $('shopBtn').classList.add('on');
    this.renderShop();
  },
  closeShop() {
    $('shop').classList.add('hidden');
    $('shopBtn').classList.remove('on');
  },

  renderShop() {
    const tabs = [['fish', 'Fish'], ['tanks', 'Tanks'], ['decor', 'Decorations']]
      .map(([k, n]) => `<button class="shopTab ${this.shopTab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('');
    const t = currentTank();
    let items = '';
    const card = (key, kind, name, thumb, price, level, water, note = '') => {
      const locked = G.level < level;
      const broke = !locked && G.cash < price;
      return `<button class="item ${locked ? 'locked' : ''} ${broke ? 'broke' : ''}" data-buy="${kind}:${key}">
        <img src="${thumb}" alt="">
        <span class="iName">${esc(name)}</span>
        <span class="iMeta">${water ? waterBadge(water) : '<span class="water any">Any</span>'}${note}</span>
        ${locked ? `<span class="lock">🔒 Level ${level}</span>` : `<span class="price">${money(price)}</span>`}
      </button>`;
    };
    if (this.shopTab === 'fish') {
      for (const [k, sp] of Object.entries(SPECIES)) items += card(k, 'fish', sp.name, speciesThumb(k), sp.price, sp.level, sp.water);
    } else if (this.shopTab === 'tanks') {
      for (const [k, d] of Object.entries(TANKS)) {
        const note = d.kind === 'breeding' ? `<span class="iNote">Breeding · ${d.fry} babies</span>` : `<span class="iNote">${d.cap} fish</span>`;
        items += card(k, 'tank', d.name, tankThumbCached(k), d.price, d.level, d.water, note);
      }
    } else {
      for (const [k, d] of Object.entries(DECOR)) {
        if (d.water !== 'any' && d.water !== waterOf(t) && G.level >= d.level) continue;
        items += card(k, 'decor', d.name, decorThumb(k), d.price, d.level, d.water === 'any' ? null : d.water, `<span class="iNote">+${d.beauty} beauty</span>`);
      }
    }
    const hint = this.shopTab === 'decor' ? `<div class="shopHint">For ${esc(t.name)}: ${t.decor.length}/${tankDef(t).decor} decorations</div>`
      : this.shopTab === 'fish' ? `<div class="shopHint">New fish go into ${esc(t.name)} if they fit, otherwise another tank with the right water.</div>` : '';
    setHtml($('shop'), `<div class="shopTabs">${tabs}<button class="x" data-shop-close>✕</button></div>${hint}<div class="items">${items}</div>`);
  },

  onShopClick(e) {
    const tab = e.target.closest('[data-tab]');
    if (tab) { this.shopTab = tab.dataset.tab; this.renderShop(); return; }
    if (e.target.closest('[data-shop-close]')) return this.closeShop();
    const b = e.target.closest('[data-buy]');
    if (!b) return;
    const [kind, key] = b.dataset.buy.split(':');
    const t = currentTank();
    let r;
    if (kind === 'fish') {
      r = buyFish(key, t.id);
      if (r.ok && r.tank.id !== t.id) r.msg += ' (Your current tank had no room or the wrong water.)';
    } else if (kind === 'tank') {
      r = buyTank(key);
    } else {
      r = canPlaceDecor(t.id, key);
      if (r.ok) {
        this.closeShop();
        this.scene.startHolding(key);
        return;
      }
    }
    this.toast(r.msg, r.ok ? '' : 'bad');
    this.refresh();
  },

  showHolding(key) {
    const chip = $('holdChip');
    if (!key) return chip.classList.add('hidden');
    chip.innerHTML = `<img src="${decorThumb(key)}" alt=""> Placing <b>${esc(DECOR[key].name)}</b>: click on the tank floor · right-click or Esc to cancel`;
    chip.classList.remove('hidden');
  },

  // --- fish and decoration cards ---
  openFishCard(id) {
    this.cardFor = { kind: 'fish', id, confirmSell: false };
    this.closeShop();
    this.renderCard();
  },
  openDecorCard(tankId, index) {
    this.cardFor = { kind: 'decor', tankId, index };
    this.closeShop();
    this.renderCard();
  },
  closeCard() {
    this.cardFor = null;
    $('card').classList.add('hidden');
    $('card')._html = '';
  },

  renderCard() {
    const c = this.cardFor;
    let html = '';
    if (c.kind === 'fish') {
      const f = fishById(c.id);
      if (!f) return this.closeCard();
      const r = rarityOf(f.g);
      const value = fishValue(f.g, f.growth);
      const sp = SPECIES[f.g.species];
      const traits = traitList(f.g).map(([k, v]) => `<div class="trait"><span>${k}</span><b>${esc(v)}</b></div>`).join('');
      const others = G.tanks.filter((t) => t.id !== f.tankId && waterOf(t) === sp.water);
      const moves = others.map((t) => {
        const ok = roomFor(t, f.growth);
        return `<button class="moveBtn" data-move="${t.id}" ${ok ? '' : 'disabled'} title="${ok ? '' : 'No room'}">${tankDef(t).kind === 'breeding' ? '🥚' : '🐟'} ${esc(shortName(t))}</button>`;
      }).join('') || `<span class="none">No other ${sp.water === 'salt' ? 'saltwater' : 'freshwater'} tanks yet</span>`;
      html = `<button class="x" data-card-close>✕</button>
        <div class="cardTop"><img class="portrait" src="${fishThumb(f.g)}" alt="">
        <span class="rarity" style="--c:${r.color}">${r.name}</span></div>
        <div class="cardName">${esc(fishName(f.g))}</div>
        ${f.growth < 1 ? `<div class="grow"><span>Baby, growing up</span><div class="mBar"><div class="mFill" style="width:${Math.round(f.growth * 100)}%;--c:#7dea6b"></div></div></div>` : ''}
        <div class="traits">${traits}</div>
        <div class="cardMoveLabel">Move to</div><div class="moves">${moves}</div>
        <button class="sellBtn ${c.confirmSell ? 'confirm' : ''}" data-sell>${c.confirmSell ? `Really sell for ${money(value)}?` : `Sell for ${money(value)}`}</button>
        ${f.growth < 1 ? '<div class="cardNote">Babies sell for less. Grown up it\'s worth ' + money(fishValue(f.g, 1)) + '.</div>' : ''}`;
    } else {
      const t = tankById(c.tankId);
      const d = t && t.decor[c.index];
      if (!d) return this.closeCard();
      const def = DECOR[d.key];
      html = `<button class="x" data-card-close>✕</button>
        <div class="cardTop"><img class="portrait decor" src="${decorThumb(d.key)}" alt=""></div>
        <div class="cardName">${esc(def.name)}</div>
        <div class="traits"><div class="trait"><span>Beauty</span><b>+${def.beauty}</b></div>${def.bubbles ? '<div class="trait"><span>Extra</span><b>Bubbles</b></div>' : ''}</div>
        <button class="sellBtn" data-sell-decor>Sell for ${money(Math.floor(def.price / 2))}</button>`;
    }
    setHtml($('card'), html);
    $('card').classList.remove('hidden');
  },

  onCardClick(e) {
    const c = this.cardFor;
    if (!c) return;
    if (e.target.closest('[data-card-close]')) return this.closeCard();
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const r = moveFish(c.id, Number(mv.dataset.move));
      this.toast(r.msg, r.ok ? '' : 'bad');
      if (r.ok) this.closeCard();
      return this.refresh();
    }
    if (e.target.closest('[data-sell]')) {
      const f = fishById(c.id);
      if (f && rarityTier(f.g) >= 1 && !c.confirmSell) {
        c.confirmSell = true;
        return this.renderCard();
      }
      const r = sellFish(c.id);
      this.toast(r.msg, r.ok ? 'money' : 'bad');
      this.closeCard();
      return this.refresh();
    }
    if (e.target.closest('[data-sell-decor]')) {
      const r = sellDecor(c.tankId, c.index);
      this.toast(r.msg, r.ok ? 'money' : 'bad');
      this.closeCard();
    }
  },

  // --- dialogs ---
  openModal(html) {
    setHtml($('modal'), `<div class="dialog">${html}</div>`);
    $('modal').classList.remove('hidden');
  },
  closeModal() {
    $('modal').classList.add('hidden');
    $('modal')._html = '';
  },

  openBook() {
    let html = '<button class="x" data-close>✕</button><h2>Fish Book</h2><p class="sub">Every look you\'ve owned or bred. Breed fish to fill it up!</p>';
    const total = Object.keys(G.discovered).length;
    html += `<div class="bookTotal">${total} looks found</div>`;
    for (const [k, sp] of Object.entries(SPECIES)) {
      const found = Object.values(G.discovered).filter((g) => g.species === k).sort((a, b) => rarityTier(b) - rarityTier(a));
      html += `<div class="bookSpecies"><div class="bookHead">${waterBadge(sp.water)} <b>${sp.name}</b> <span class="bookCount">${found.length} found</span></div>`;
      if (G.level < sp.level && !found.length) html += `<div class="bookLocked">🔒 Unlocks at level ${sp.level}</div>`;
      else html += `<div class="bookGrid">${found.map((g) => `<div class="bookFish" style="--c:${rarityOf(g).color}" title="${esc(fishName(g))} (${rarityOf(g).name})"><img src="${fishThumb(g)}" alt=""></div>`).join('')}</div>`;
      html += '</div>';
    }
    this.openModal(html);
  },

  openHelp() {
    this.openModal(`<button class="x" data-close>✕</button><h2>How to play</h2>
      <ul class="help">
        <li><b>Feed</b> and <b>clean</b> your tanks. Happy fish breed faster and visitors tip more.</li>
        <li>Put <b>two grown-up fish of the same kind</b> in a <b>breeding tank</b>. They lay eggs, and the babies grow up there.</li>
        <li>Babies take after mum or dad, but sometimes something <b>new</b> shows up: a new colour, pattern, longer fins, or even a <b>glow</b>. Rarer fish are worth much more.</li>
        <li>Click a fish to see what it's worth, move it to another tank, or sell it.</li>
        <li>Display tanks earn tips from visitors. More fish, rarer fish and nicer decorations mean more stars and more tips.</li>
        <li><b>Saltwater</b> fish only live in saltwater tanks (from level 3), freshwater fish only in freshwater.</li>
        <li>Fill your <b>Fish Book</b> by collecting every look you can.</li>
      </ul>
      <button class="bigBtn" data-close>Got it!</button>`);
  },

  confirmNewGame() {
    this.openModal(`<h2>Start over?</h2><p class="sub">This throws away your tanks and fish and starts a brand new fish room.</p>
      <div class="row"><button class="bigBtn grey" data-close>Keep playing</button><button class="bigBtn red" data-confirm-new>Start over</button></div>`);
  },

  showLevelUp(level) {
    const u = unlocksAt(level);
    const items = [
      ...u.species.map((k) => [speciesThumb(k), SPECIES[k].name, WATER[SPECIES[k].water].short + 'water fish']),
      ...u.tanks.map((k) => [tankThumbCached(k), TANKS[k].name, 'Tank']),
      ...u.decor.map((k) => [decorThumb(k), DECOR[k].name, 'Decoration']),
    ];
    const list = items.length ? `<div class="unlocks">${items.map(([img, n, kind]) => `<div class="unlock"><img src="${img}" alt=""><b>${esc(n)}</b><span>${kind}</span></div>`).join('')}</div>`
      : '<p class="sub">Keep breeding: the next level unlocks more!</p>';
    this.openModal(`<div class="lvlBig">${level}</div><h2>Level up!</h2>${items.length ? '<p class="sub">New in the shop:</p>' : ''}${list}<button class="bigBtn" data-close>Great!</button>`);
  },

  welcomeBack(info) {
    if (!info || info.away < 60000) return;
    const mins = Math.round(info.away / 60000);
    const parts = [];
    if (info.earned > 0) parts.push(`visitors tipped ${money(info.earned)}`);
    if (info.babies > 0) parts.push(`${info.babies} ${info.babies === 1 ? 'baby' : 'babies'} hatched`);
    this.toast(`Welcome back! In ${mins} min away ${parts.join(' and ') || 'your fish missed you'}.`);
  },

  toast(msg, kind = '') {
    if (!msg) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 2800);
    setTimeout(() => el.remove(), 3300);
  },

  onGameEvent(e) {
    if (e.type === 'levelUp') this.showLevelUp(e.level);
    if (e.type === 'eggs') this.toast(`🥚 Eggs in ${tankById(e.tankId).name}!`);
    if (e.type === 'hatch') {
      this.toast(`${e.babies.length} ${e.babies.length === 1 ? 'baby' : 'babies'} hatched in ${tankById(e.tankId).name}!`);
      for (const f of e.newLooks) this.toast(`New look for the Fish Book: ${fishName(f.g)} (${rarityOf(f.g).name})`, rarityTier(f.g) >= 2 ? 'rare' : '');
    }
    if (e.type === 'change') this.refresh();
  },
};

function shortName(t) {
  const def = tankDef(t);
  const kind = def.kind === 'breeding' ? 'Breeding' : def.cap >= 20 ? 'Show' : def.cap >= 14 ? 'Big' : def.cap <= 6 ? 'Small' : 'Tank';
  const num = t.name.match(/ (\d+)$/);
  return `${kind}${num ? ' ' + num[1] : ''}`;
}
