// ClubScene methods: the Celebrity List. Each celebrity (CELEBRITIES in
// config.js) unlocks at a club level and has a fame rating of one to five
// stars. Once unlocked, they drop in on their own now and then, whenever
// they like (CELEB.visitEveryMs): they queue outside wearing a star, a big
// announcement shows their name and fame as they walk in, and they tip and
// bring fans by their fame. Higher levels bring more famous celebrities,
// and the earlier ones keep coming back. The dock's Celebrities tab lists them all with their
// portrait, name, fame, unlock level and whether they're locked, available,
// on their way or in the club.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PATRON_META, PATRON_SHEETS } from '../assets.js';
import { CELEB, CELEBRITIES } from '../config.js';
import { SFX } from '../sfx.js';
import { randRange } from '../util.js';

export const fameStars = (fame) => '★'.repeat(fame);

export class CelebritiesMixin {
  celebDef(key) {
    return CELEBRITIES.find((c) => c.key === key) || null;
  }

  // 'locked', 'available', 'coming' (in line outside) or 'inside'.
  celebStatus(def) {
    if (this.levelInfo().level < def.level) return 'locked';
    if (this.patrons.some((p) => !p.gone && p.celeb && p.celeb.key === def.key)) return 'inside';
    const waiting = (this.streetQueue || []).some((p) => p.info && p.info.celeb === def.key);
    return waiting ? 'coming' : 'available';
  }

  // Time for a celebrity to drop in? Returns { celeb } for the next arrival
  // (see scheduleNextPatronSpawn()), or null.
  celebDropIn() {
    const now = this.time.now;
    if (this.nextCelebAt === undefined) this.nextCelebAt = now + randRange(...CELEB.firstVisitMs);
    if (now < this.nextCelebAt) return null;
    if (this.streetQueue && this.streetQueue.length >= this.streetSpots().len) return null; // wait for room in line
    const [celeb] = this.pickCelebs(1);
    if (!celeb) return null; // none unlocked or free yet: try again next arrival
    this.nextCelebAt = now + randRange(...CELEB.visitEveryMs);
    return { celeb: celeb.key };
  }

  // Up to `count` unlocked celebrities who aren't already here or on their
  // way. More famous ones are a bit more likely to come.
  pickCelebs(count) {
    const pool = CELEBRITIES.filter((c) => this.celebStatus(c) === 'available');
    const picked = [];
    while (picked.length < count && pool.length) {
      const total = pool.reduce((s, c) => s + c.fame + 1, 0);
      let r = Math.random() * total;
      let i = 0;
      for (; i < pool.length - 1; i++) {
        r -= pool[i].fame + 1;
        if (r <= 0) break;
      }
      picked.push(pool.splice(i, 1)[0]);
    }
    return picked;
  }

  // A celebrity has walked in: the star over their head, a gold glow, and
  // a big announcement with their fame (see trySpawnPatron()).
  welcomeCelebrity(patron, key) {
    const def = this.celebDef(key);
    if (!def) return;
    patron.celeb = def;
    patron.name = def.name;
    this.bumpGoal('celebs');
    if (this.partyStats) this.partyStats.celebs.push(def.name); // came during a party
    const c = patron.container;
    this.addStarIcon(c);
    const shadow = c.list[0];
    if (shadow && shadow.setFillStyle) shadow.setFillStyle(0xffd24d, 0.8);
    this.showBigPopup('Celebrity Arrival!', `${def.name}  ${fameStars(def.fame)}`, 'celeb', 2600);
    this.popReaction(patron, 'excited', 200);
    SFX.levelUp();
    if (this.dockTab === 'celebs') this.renderCelebCards();
  }

  // The little star that marks a celebrity, in line outside or inside.
  addStarIcon(container) {
    if (container.starIcon) return;
    const star = this.add.text(0, -96, '⭐', { fontSize: '16px' }).setOrigin(0.5, 1);
    container.add(star);
    container.starIcon = star;
  }

  // Celebrities tip more the more famous they are.
  celebTipFactor(patron) {
    return patron.celeb ? 1 + CELEB.tipPerFame * patron.celeb.fame : 1;
  }

  // Fans a celebrity brings leaving happy (see patronLeaves()).
  celebFans(patron) {
    return patron.celeb ? CELEB.fansPerFame * patron.celeb.fame : 0;
  }

  // A celebrity's face, cut from their sheet like the guest card's.
  celebPortrait(el, character) {
    const url = PATRON_SHEETS[character];
    if (!el || !url) return;
    const k = 0.72;
    el.style.backgroundImage = `url(${url})`;
    el.style.backgroundSize = `${PATRON_META.frameWidth * PATRON_META.columns * k}px auto`;
    el.style.backgroundPosition = `${-PATRON_META.frameWidth * k * 0.03}px ${-14 * k}px`;
    el.style.backgroundRepeat = 'no-repeat';
  }

  // The dock's Celebrities tab: a card per celebrity, in unlock order.
  renderCelebCards() {
    const el = this.shopItemsEl;
    if (!el) return;
    const statuses = CELEBRITIES.map((c) => this.celebStatus(c));
    const key = `celebs:${statuses.join()}`;
    if (el.dataset.rendered === key) return;
    el.innerHTML = '';
    el.dataset.rendered = key;
    const label = { locked: '', available: 'Available', coming: 'On the way', inside: 'In Club' };
    const tip = {
      locked: (c) => `Unlocks at level ${c.level}. Then they'll drop in now and then.`,
      available: () => 'Available: they drop in now and then.',
      coming: () => 'On the way: waiting in line outside.',
      inside: () => 'In your club right now!',
    };
    CELEBRITIES.forEach((c, i) => {
      const status = statuses[i];
      const { slot, button, icon, cost } = this.makeCard(c.name,
        `${fameStars(c.fame)} fame · level ${c.level}. ${tip[status](c)}`, null);
      slot.classList.add('celebSlot', status);
      slot.dataset.celeb = c.key;
      this.celebPortrait(icon, c.character);
      const name = document.createElement('div');
      name.className = 'celebName';
      name.textContent = c.name;
      const stars = document.createElement('div');
      stars.className = 'celebStars';
      stars.textContent = fameStars(c.fame);
      button.append(name, stars);
      if (status === 'locked') button.classList.add('locked');
      cost.textContent = status === 'locked' ? `🔒 Lv ${c.level}` : label[status];
      el.appendChild(slot);
    });
  }
}
