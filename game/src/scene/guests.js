// ClubScene methods: getting to know the people in the club, like Nightclub
// City. Every guest has a name; click one to see their card (mood, fun,
// drinks, what they've spent, and what they're saying). A thought bubble
// over their head shows when they want a drink or are loving it. Click a
// bartender for their card and the Bottoms Up! move, which serves their
// whole line at once; the game suggests it when a bar is slammed.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PATRON_META, PATRON_SHEETS } from '../assets.js';
import { PROP_TYPES, VIP_BOOTHS } from '../catalog.js';
import { BOTTOMS_UP, CHARACTER_DISPLAY_HEIGHT, THIRST_INTERVAL } from '../config.js';
import { MOOD } from './mood.js';
import { SFX } from '../sfx.js';

const FIRST = ['Marsha', 'Trina', 'Dev', 'Jordan', 'Kai', 'Rosa', 'Marcus', 'Lena', 'Andre', 'Mia', 'Theo', 'Nina', 'Omar', 'Jade',
  'Rico', 'Tasha', 'Leo', 'Bree', 'Sam', 'Zoe', 'Ty', 'Gwen', 'Malik', 'Ivy', 'Cole', 'Dani', 'Rex', 'Luz', 'Benny', 'Kat'];
const LAST = ['High', 'Forest', 'Rivera', 'Nguyen', 'Brooks', 'Stone', 'Vega', 'Park', 'Lane', 'Cruz', 'Fox', 'Banks', 'Reed',
  'Diaz', 'Knight', 'Moss', 'Blaze', 'Starr', 'Wilde', 'Cole', 'Hart', 'Frost', 'Lux', 'Day', 'Rose'];
const CHAT = ['Nice place!', 'I love this song!', 'Have you seen the bartender\'s moves?', 'Who is that DJ? Amazing!',
  'My friends have to see this club.', 'Is it always this busy?', 'I could stay all night.', 'Love the brick walls.'];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export class GuestsMixin {
  guestName() {
    return `${pick(FIRST)} ${pick(LAST)}`;
  }

  // What a guest is saying right now, from how they feel. Small talk is
  // picked once and kept for a while so the card doesn't flicker.
  guestQuote(patron) {
    const now = this.time.now;
    const thirsty = now >= patron.thirstyAt;
    const c = patron.container;
    const dancing = typeof c.patronAnimState === 'string' && c.patronAnimState.startsWith('dance');
    if (patron.leaving) return patron.stormedOut ? 'I\'m out of here!' : 'Great night. See you next time!';
    if (thirsty && patron.thirstSince != null && now - patron.thirstSince > 8000) return 'Can I get a drink over here?';
    if (patron.mood < 35) return 'I don\'t feel so good...';
    if (thirsty) return 'I could go for a drink.';
    if (patron.fun < 20) return 'Kinda boring in here...';
    if (dancing) return 'This DJ is on fire!';
    if (patron.sitting) return 'My feet needed this seat.';
    if (patron.mood >= 85) return 'Best club in town!';
    if (!patron.chat || now > patron.chatUntil) {
      patron.chat = pick(CHAT);
      patron.chatUntil = now + 12000;
    }
    return patron.chat;
  }

  // --- Thought bubbles ------------------------------------------------------

  // Keeps a guest's bubble right: a drink when they're thirsty, heart eyes
  // when they're loving it, nothing otherwise. Called every patron tick.
  updateGuestBubble(patron) {
    const c = patron.container;
    const now = this.time.now;
    let icon = '';
    if (!patron.leaving && !patron.gone) {
      if (now >= patron.thirstyAt) icon = '🍹';
      else if (patron.mood >= 85) icon = '😍';
    }
    if (!icon) {
      if (c.bubble) c.bubble.setVisible(false);
      return;
    }
    if (!c.bubble) {
      c.bubble = this.add.text(0, -CHARACTER_DISPLAY_HEIGHT * 1.02, '', {
        fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '15px', backgroundColor: '#ffffffe6',
        padding: { left: 4, right: 4, top: 2, bottom: 2 },
      }).setOrigin(0.5, 1);
      c.add(c.bubble);
      this.unflipBubble(c);
    }
    if (c.bubble.text !== icon) c.bubble.setText(icon);
    c.bubble.setVisible(true);
  }

  // The bubble lives in the guest's container, which is mirrored to face
  // left; mirror the bubble back so it always reads the right way round.
  unflipBubble(container) {
    if (container.bubble) container.bubble.scaleX = container.scaleX < 0 ? -1 : 1;
  }

  // --- Clicking people --------------------------------------------------------

  // The guest or bartender drawn under a screen point, nearest the camera
  // first, or null. People are hit anywhere on their body, not their tile.
  personAt(screenX, screenY) {
    const x = (screenX - this.world.x) / this.world.scaleX;
    const y = (screenY - this.world.y) / this.world.scaleY;
    const h = CHARACTER_DISPLAY_HEIGHT * 0.9;
    const hit = (c) => Math.abs(x - c.x) < 16 && y < c.y + 2 && y > c.y - h;
    let best = null;
    const consider = (kind, target, c) => {
      if (hit(c) && (!best || c.depth > best.c.depth)) best = { kind, target, c };
    };
    for (const p of this.patrons) if (!p.gone) consider('guest', p, p.container);
    for (const rec of this.staffableRecords()) {
      if (rec.staff && rec.staff.kind === 'bartender') consider('bartender', rec, rec.staff.container);
    }
    return best;
  }

  // Opens the card of whoever was clicked. Returns true if someone was.
  clickPerson(pointer) {
    const found = this.personAt(pointer.x, pointer.y);
    if (!found) return false;
    SFX.unlock();
    this.openInfoCard(found.kind, found.target);
    return true;
  }

  // --- The info card ----------------------------------------------------------

  openInfoCard(kind, target) {
    this.infoCard = { kind, target };
    document.getElementById('infoCard')?.classList.add('open');
    this.refreshInfoCard();
  }

  closeInfoCard() {
    this.infoCard = null;
    document.getElementById('infoCard')?.classList.remove('open');
  }

  // A portrait for the card, cut from the character's sheet (standing,
  // facing front).
  setPortrait(el, character) {
    const url = PATRON_SHEETS[character];
    if (!el || !url) return;
    const k = 0.8;
    el.style.backgroundImage = `url(${url})`;
    el.style.backgroundSize = `${PATRON_META.frameWidth * PATRON_META.columns * k}px auto`;
    el.style.backgroundPosition = `${-PATRON_META.frameWidth * k * 0.12}px ${-24 * k}px`;
  }

  refreshInfoCard() {
    const card = this.infoCard;
    if (!card) return;
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el && el.textContent !== text) el.textContent = text;
    };
    const show = (id, on) => {
      const el = document.getElementById(id);
      if (el) el.style.display = on ? '' : 'none';
    };
    // A round action button: greyed out with the reason as its tip when it
    // can't be used right now.
    const action = (id, why, tip) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('disabled', !!why);
      el.dataset.tip = why ? `${tip} (${why})` : tip;
    };
    if (card.kind === 'guest') {
      const p = card.target;
      if (p.gone) { this.closeInfoCard(); return; }
      this.setPortrait(document.getElementById('infoPortrait'), p.container.patronCharacter);
      set('infoName', p.name || 'Guest');
      set('infoRole', p.leaving ? 'Heading home' : (p.vip ? `⭐ VIP · visit ${p.vip.visits}` : 'Guest'));
      set('infoQuote', `"${this.guestQuote(p)}"`);
      set('infoMoodIcon', this.vibeEmoji(p.mood));
      set('infoMood', `${Math.round(p.mood)}%`);
      set('infoFun', `${Math.round(p.fun)}%`);
      set('infoDrinks', `${p.drinks || 0}`);
      set('infoSpent', `$${Math.round(p.spent || 0)}`);
      action('seatGuest', this.seatBlocker(p), 'Seat this guest at one of your VIP booths');
      action('danceGuest', this.danceBlocker(p), 'Send this guest to the dance floor');
      action('drinkGuest', this.drinkBlocker(p), 'Give this guest a drink on the house');
      show('infoGuestStats', true);
      show('infoGuestActions', true);
      show('infoBarStats', false);
      this.refreshActionTip();
      return;
    }
    const rec = card.target;
    if (!rec.staff || !this.placed[`${rec.anchor[0]},${rec.anchor[1]}`]) { this.closeInfoCard(); return; }
    if (!rec.staff.name) rec.staff.name = this.guestName();
    this.setPortrait(document.getElementById('infoPortrait'), rec.staff.container.staffCharacter);
    const waiting = this.barGroupQueue(rec).length;
    set('infoName', rec.staff.name);
    set('infoRole', `Bartender · ${waiting} waiting for a drink`);
    set('infoQuote', waiting >= 3 ? '"The bar is slammed!"' : (waiting ? '"Coming right up!"' : '"Who\'s thirsty?"'));
    const ready = this.bottomsUpReady(rec);
    action('bottomsUp', !ready ? 'recovering' : (waiting ? null : 'nobody is waiting'), 'Bottoms Up! Serve everyone in this bartender\'s line at once');
    set('bottomsUpTimer', ready ? '' : `${Math.ceil((rec.staff.bottomsUpAt - this.time.now) / 1000)}s`);
    show('infoGuestStats', false);
    show('infoGuestActions', false);
    show('infoBarStats', true);
    this.refreshActionTip();
  }

  // The speech-bubble tip over whichever action button the mouse is on.
  showActionTip(el) {
    this.tipButton = el;
    this.refreshActionTip();
  }

  refreshActionTip() {
    const tip = document.getElementById('actionTip');
    const el = this.tipButton;
    if (!tip) return;
    if (!el || !this.infoCard || el.offsetParent === null) {
      tip.classList.remove('show');
      return;
    }
    if (tip.textContent !== el.dataset.tip) tip.textContent = el.dataset.tip;
    tip.classList.add('show');
    const card = document.getElementById('infoCard').getBoundingClientRect();
    const b = el.getBoundingClientRect();
    tip.style.left = `${Math.max(4, b.left - card.left + b.width / 2 - tip.offsetWidth / 2)}px`;
    tip.style.top = `${b.top - card.top - tip.offsetHeight - 10}px`;
  }

  // --- Guest actions -----------------------------------------------------------

  // Why a guest can't be seated at a VIP booth right now, or null.
  seatBlocker(patron) {
    if (patron.leaving) return 'they\'re heading home';
    if (patron.arguing) return 'they\'re in an argument';
    if (patron.sitting || patron.seat) return 'already seated';
    const booths = Object.values(this.placed).some((rec) => VIP_BOOTHS.has(rec.type));
    if (!booths) return 'you have no VIP booth yet';
    if (this.freeSeats(VIP_BOOTHS).length === 0) return 'every booth seat is taken';
    return null;
  }

  // Sends a guest to a free seat at a VIP booth, like Nightclub City's
  // "Seat a guest at one of your booths". Being shown to a booth cheers
  // them up.
  seatGuest(patron) {
    if (!patron || patron.gone || this.seatBlocker(patron)) { SFX.denied(); return false; }
    if (patron.queue) this.leaveBarQueue(patron);
    if (!this.claimSeat(patron, VIP_BOOTHS)) { SFX.denied(); return false; }
    patron.mood = Math.min(100, patron.mood + 10);
    patron.nextMoveAt = this.time.now;
    const c = patron.container;
    this.floatText(c.x, c.y - 80, 'THX!', '#ffffff');
    SFX.tip();
    if (!patron.moving) this.movePatronRandomly(patron);
    this.refreshInfoCard();
    return true;
  }

  // A free dance-floor tile, or null.
  danceBlocker(patron) {
    if (patron.leaving) return 'they\'re heading home';
    if (patron.arguing) return 'they\'re in an argument';
    if (!this.musicPlaying()) return 'the music is off';
    const anyFloor = Object.values(this.placed).some((rec) => this.isDanceFloorTile(rec.anchor[0], rec.anchor[1]));
    if (!anyFloor) return 'you have no dance floor yet';
    if (!this.freeDanceTile(patron)) return 'the dance floor is full';
    return null;
  }

  // Sends a guest to dance; they're glad of the invitation.
  danceGuest(patron) {
    if (!patron || patron.gone || this.danceBlocker(patron)) { SFX.denied(); return false; }
    if (patron.queue) this.leaveBarQueue(patron);
    if (patron.sitting) { SFX.denied(); this.showToast('💃 Let them finish sitting first.'); return false; }
    this.releaseSeat(patron);
    this.endChat(patron);
    patron.activity = { kind: 'dance' }; // a dance session (see activities.js)
    [patron.targetGx, patron.targetGy] = this.freeDanceTile(patron);
    patron.path = null;
    patron.nextMoveAt = this.time.now;
    patron.fun = Math.min(100, patron.fun + 10);
    const c = patron.container;
    this.floatText(c.x, c.y - 80, "Let's dance!", '#ff7ae0');
    SFX.tip();
    if (!patron.moving) this.movePatronRandomly(patron);
    this.refreshInfoCard();
    return true;
  }

  drinkBlocker(patron) {
    if (patron.leaving) return 'they\'re heading home';
    if (patron.arguing) return 'they\'re in an argument';
    if (patron.onTheHouse) return 'they already had one on the house';
    const bar = this.staffableRecords().find((rec) => rec.staff && rec.staff.kind === 'bartender');
    if (!bar) return 'you need a bar with a bartender';
    return null;
  }

  // A free drink, once a visit: it costs you the drink, and cheers them up.
  drinkGuest(patron) {
    if (!patron || patron.gone || this.drinkBlocker(patron)) { SFX.denied(); return false; }
    patron.onTheHouse = true;
    if (patron.queue) this.leaveBarQueue(patron);
    this.cheerPatron(patron, MOOD.drinkMood + 10);
    patron.drinks = (patron.drinks || 0) + 1;
    patron.thirstyAt = this.time.now + THIRST_INTERVAL[0];
    const c = patron.container;
    this.floatText(c.x, c.y - 80, '🍹 On the house!', '#7dffc4');
    SFX.tip();
    this.refreshInfoCard();
    return true;
  }

  // --- Bottoms Up! -----------------------------------------------------------

  bottomsUpReady(rec) {
    return !!rec.staff && this.time.now >= (rec.staff.bottomsUpAt || 0);
  }

  // The bartender serves everyone in line at once.
  bottomsUp(rec) {
    if (!rec || !rec.staff || !this.bottomsUpReady(rec) || !this.clubOpen()) { SFX.denied(); return 0; }
    const line = this.barGroupQueue(rec).filter((p) => !p.gone && !p.leaving);
    if (line.length === 0) {
      SFX.denied();
      this.showToast('🍹 Nobody is waiting at this bar right now.');
      return 0;
    }
    for (const p of line) this.serveDrink(p.queue || rec, p);
    for (const unit of this.barGroup(rec)) this.clearBarQueue(unit);
    rec.staff.bottomsUpAt = this.time.now + BOTTOMS_UP.cooldownMs;
    const { x, y } = rec.staff.container;
    this.floatText(x, y - CHARACTER_DISPLAY_HEIGHT * 1.1, 'SERVED!!', '#ff7ae0');
    SFX.levelUp();
    this.refreshInfoCard();
    return line.length;
  }

  // Suggests Bottoms Up when a bar's line gets long (once in a while).
  checkSlammedBars() {
    const now = this.time.now;
    if (now < (this.slammedHintAt || 0)) return;
    const slammed = this.staffableRecords().find((rec) => rec.staff && rec.staff.kind === 'bartender'
      && this.barGroupQueue(rec).length >= BOTTOMS_UP.slammedLine && this.bottomsUpReady(rec));
    if (!slammed) return;
    this.slammedHintAt = now + BOTTOMS_UP.hintEveryMs;
    this.showToast('🍹 Bottoms Up! The bar is slammed: click your bartender to serve everyone at once.', 5000);
  }

  // Wires up the card (see index.html) and its refresh.
  setupGuests() {
    document.getElementById('infoClose')?.addEventListener('click', () => this.closeInfoCard());
    const guestAction = (id, fn) => document.getElementById(id)?.addEventListener('click', () => {
      if (this.infoCard && this.infoCard.kind === 'guest') fn.call(this, this.infoCard.target);
    });
    guestAction('seatGuest', this.seatGuest);
    guestAction('danceGuest', this.danceGuest);
    guestAction('drinkGuest', this.drinkGuest);
    for (const el of document.querySelectorAll('#infoCard .actionButton')) {
      el.addEventListener('mouseenter', () => this.showActionTip(el));
      el.addEventListener('mouseleave', () => this.showActionTip(null));
    }
    document.getElementById('bottomsUp')?.addEventListener('click', () => {
      if (this.infoCard && this.infoCard.kind === 'bartender') this.bottomsUp(this.infoCard.target);
    });
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.refreshInfoCard() });
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.checkSlammedBars() });
  }
}
