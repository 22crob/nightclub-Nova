// ClubScene methods: the Celebrity List. Each celebrity (CELEBRITIES in
// config.js) unlocks at a club level and has a fame rating of one to five
// stars. Their first visit is by invitation: pay their fee in the
// Celebrities panel and they turn up shortly (inviteCelebrity()). How good
// a time they have (their mood, a seat at a VIP booth, a drink on the
// house, the club's rating) adds to how much they like your club
// (celebVisitOver()). Once they've been, they come back on their own
// whenever they like, more often the more they like the club, until
// they're a VIP regular (celebDropIn()). They queue outside wearing a
// star; walking in, a big announcement shows their name and fame, and the
// guests inside get star eyes, go wild and throw tips (welcomeCelebrity()).
// What each one thinks of the club is saved (this.celebState, under
// `celebs`: { key: { visits, liking } }).
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PATRON_META, PATRON_SHEETS } from '../assets.js';
import { CELEB, CELEBRITIES, PATRON_POPUP_Y } from '../config.js';
import { SFX } from '../sfx.js';
import { randRange } from '../util.js';

export const fameStars = (fame) => '★'.repeat(fame);

export class CelebritiesMixin {
  celebDef(key) {
    return CELEBRITIES.find((c) => c.key === key) || null;
  }

  // What a celebrity thinks of the club: { visits, liking }.
  celebRecord(key) {
    this.celebState = this.celebState || {};
    return (this.celebState[key] = this.celebState[key] || { visits: 0, liking: 0 });
  }

  inviteCost(def) {
    return CELEB.inviteCost[def.fame] || CELEB.inviteCost[CELEB.inviteCost.length - 1];
  }

  isRegular(key) {
    return this.celebRecord(key).liking >= CELEB.regularLiking;
  }

  // 'locked', 'available' (can be invited), 'invited' (on their way),
  // 'coming' (in line outside) or 'inside'.
  celebStatus(def) {
    if (this.levelInfo().level < def.level) return 'locked';
    if (this.patrons.some((p) => !p.gone && p.celeb && p.celeb.key === def.key)) return 'inside';
    if ((this.streetQueue || []).some((p) => p.info && p.info.celeb === def.key)) return 'coming';
    if (this.celebInvites && this.celebInvites[def.key] !== undefined) return 'invited';
    return 'available';
  }

  // Pays a celebrity's fee to invite them; they turn up shortly. False if
  // they can't be invited now (locked, already coming, or too dear).
  inviteCelebrity(key) {
    const def = this.celebDef(key);
    if (!def || this.celebStatus(def) !== 'available') { SFX.denied(); return false; }
    const cost = this.inviteCost(def);
    if (this.cash < cost) {
      SFX.denied();
      this.showToast(`💸 Inviting ${def.name} costs $${cost}.`);
      return false;
    }
    this.cash -= cost;
    this.noteIncome('celebInvites', cost);
    this.celebInvites = this.celebInvites || {};
    this.celebInvites[key] = this.time.now + randRange(...CELEB.inviteArriveMs);
    SFX.tip();
    this.showToast(`💌 You invited ${def.name}! They'll be here soon.`);
    this.updateUI();
    this.refreshDock();
    this.saveGame();
    return true;
  }

  // How long until a celebrity who's been before comes back on their own,
  // by how much they like the club.
  celebReturnMs(key) {
    const t = Math.max(0, Math.min(1, this.celebRecord(key).liking / 100));
    const [slow, fast] = CELEB.returnEveryMs;
    return (slow + (fast - slow) * t) * randRange(1 - CELEB.returnJitter, 1 + CELEB.returnJitter);
  }

  // Asked by each street arrival (see scheduleNextPatronSpawn()): is a
  // celebrity turning up? Invited ones first, then ones who've been before
  // and like the club enough, once their time comes. Returns { celeb } or
  // null.
  celebDropIn() {
    const now = this.time.now;
    if (this.streetQueue && this.streetQueue.length >= this.streetSpots().len) return null; // wait for room in line
    for (const [key, at] of Object.entries(this.celebInvites || {})) {
      if (now < at) continue;
      delete this.celebInvites[key];
      return { celeb: key };
    }
    this.celebNextAt = this.celebNextAt || {};
    const returning = CELEBRITIES.filter((c) => {
      const rec = this.celebRecord(c.key);
      if (rec.visits === 0 || rec.liking < CELEB.minLikingToReturn || this.celebStatus(c) !== 'available') return false;
      if (this.celebNextAt[c.key] === undefined) this.celebNextAt[c.key] = now + this.celebReturnMs(c.key);
      return now >= this.celebNextAt[c.key];
    });
    if (returning.length === 0) return null;
    returning.sort((a, b) => this.celebRecord(b.key).liking - this.celebRecord(a.key).liking);
    const key = returning[0].key;
    this.celebNextAt[key] = now + this.celebReturnMs(key);
    return { celeb: key };
  }

  // A celebrity has walked in: the star over their head, a gold glow, a
  // big announcement with their fame, and the crowd goes wild: star eyes,
  // excitement and tips thrown (see trySpawnPatron()).
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
    const sub = `${def.name}  ${fameStars(def.fame)}${this.isRegular(key) ? '  · VIP regular' : ''}`;
    this.showBigPopup('Celebrity Arrival!', sub, 'celeb', 2600);
    this.popReaction(patron, 'excited', 200);
    this.celebFanfare(patron);
    SFX.levelUp();
    if (this.dockTab === 'celebs') this.renderCelebCards();
  }

  // The crowd reacts to a celebrity: everyone inside gets star eyes or goes
  // wild, and some throw a tip.
  celebFanfare(celebPatron) {
    const fans = this.patrons.filter((p) => p !== celebPatron && !p.gone && !p.leaving && !p.celeb);
    for (const p of fans) {
      p.reactingUntil = 0;
      const delay = randRange(150, 1300);
      this.popReaction(p, Math.random() < 0.6 ? 'stars' : 'excited', delay, randRange(1600, 2400));
      if (Math.random() >= CELEB.fanTipChance) continue;
      this.time.delayedCall(delay + 300, () => {
        if (p.gone) return;
        const amount = Math.round(randRange(...CELEB.fanTip));
        this.cash += amount;
        this.noteIncome('tips', amount);
        p.spent = (p.spent || 0) + amount;
        SFX.tip();
        this.floatMoney(p.container.x, p.container.y - PATRON_POPUP_Y, `$${amount}`, '#ff2a2a', false);
        this.updateUI();
      });
    }
  }

  // A celebrity is leaving: how good a time they had changes how much they
  // like the club (see CELEB.liking), shown in a message. Returns the change.
  celebVisitOver(patron) {
    const def = patron.celeb;
    if (!def) return 0;
    const rec = this.celebRecord(def.key);
    const L = CELEB.liking;
    let delta = (patron.mood - 50) * L.mood;
    if (patron.vipSeated) delta += L.vipSeat;
    if (patron.onTheHouse) delta += L.onTheHouse;
    const rating = this.clubRating();
    if (rating != null) delta += (rating - 3) * L.perStar;
    if (patron.stormedOut || patron.ejected) delta -= L.stormedOut;
    delta = Math.round(delta);
    const before = rec.liking;
    const wasRegular = this.isRegular(def.key);
    rec.liking = Math.max(0, Math.min(100, before + delta));
    rec.visits += 1;
    this.celebNextAt = this.celebNextAt || {};
    this.celebNextAt[def.key] = this.time.now + this.celebReturnMs(def.key);
    const verdict = delta >= 15 ? 'had an amazing night' : delta >= 5 ? 'had a good time' : delta > -5 ? 'thought it was OK' : 'didn\'t enjoy it';
    let msg = `⭐ ${def.name} ${verdict}! Likes your club: ${rec.liking}%`;
    if (!wasRegular && this.isRegular(def.key)) msg = `⭐ ${def.name} is now a VIP regular! They'll drop in often.`;
    else if (rec.liking < CELEB.minLikingToReturn) msg += '. Invite them again to win them over.';
    this.showToast(msg, 5000);
    if (this.dockTab === 'celebs') this.renderCelebCards();
    return delta;
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

  // The Celebrities panel: a card per celebrity, in unlock order, with
  // their portrait, name, fame, how much they like the club, and their fee
  // (click to invite) or where they are.
  renderCelebCards() {
    const el = this.shopItemsEl;
    if (!el) return;
    const statuses = CELEBRITIES.map((c) => this.celebStatus(c));
    const likings = CELEBRITIES.map((c) => this.celebRecord(c.key).liking);
    const afford = CELEBRITIES.map((c) => this.cash >= this.inviteCost(c));
    const key = `celebs:${statuses.join()}:${likings.join()}:${afford.join()}`;
    if (el.dataset.rendered === key) return;
    el.innerHTML = '';
    el.dataset.rendered = key;
    const label = { invited: 'Invited', coming: 'In line', inside: 'In Club' };
    CELEBRITIES.forEach((c, i) => {
      const status = statuses[i];
      const rec = this.celebRecord(c.key);
      const cost = this.inviteCost(c);
      const regular = this.isRegular(c.key);
      const about = rec.visits === 0
        ? 'Never been: invite them to win them over.'
        : `Been ${rec.visits} time${rec.visits === 1 ? '' : 's'}, likes your club ${rec.liking}%${regular ? ': a VIP regular who drops in often' : rec.liking >= CELEB.minLikingToReturn ? ', drops in now and then' : ', won\'t come back unless invited'}.`;
      const what = {
        locked: `Unlocks at level ${c.level}.`,
        available: `Click to invite them for $${cost}. Seat them at a VIP booth and give them a drink on the house so they love it.`,
        invited: 'Invited: on the way.',
        coming: 'Waiting in line outside.',
        inside: 'In your club right now! Seat them at a VIP booth and give them a drink on the house.',
      }[status];
      const { slot, button, icon, cost: strip } = this.makeCard(c.name, `${fameStars(c.fame)} fame. ${status === 'locked' ? '' : `${about} `}${what}`, null);
      slot.classList.add('celebSlot', status);
      slot.dataset.celeb = c.key;
      this.celebPortrait(icon, c.character);
      const name = document.createElement('div');
      name.className = 'celebName';
      name.textContent = c.name;
      const stars = document.createElement('div');
      stars.className = 'celebStars';
      stars.textContent = fameStars(c.fame);
      const liking = document.createElement('div');
      liking.className = 'celebLiking';
      liking.innerHTML = `<div style="width:${rec.liking}%"></div>`;
      button.append(name, stars, liking);
      if (regular) {
        const tag = document.createElement('div');
        tag.className = 'newTag regularTag';
        tag.textContent = 'VIP';
        slot.appendChild(tag);
      }
      if (status === 'locked') button.classList.add('locked');
      if (status === 'available' && !afford[i]) button.classList.add('unaffordable');
      strip.textContent = status === 'locked' ? `🔒 Lv ${c.level}` : status === 'available' ? `Invite $${cost}` : label[status];
      if (status === 'available') slot.addEventListener('click', () => this.inviteCelebrity(c.key));
      el.appendChild(slot);
    });
  }
}
