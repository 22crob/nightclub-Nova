// ClubScene methods: getting to know the people in the club, like Nightclub
// City. Every guest has a name; click one to see their card (mood, fun,
// drinks, what they've spent, and what they're saying). Click a
// bartender for their card and the Bottoms Up! move, which serves their
// whole line at once; the game suggests it when a bar is slammed.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { PATRON_META, PATRON_SHEETS, patronMetaOf } from '../assets.js';
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

  // The bubble lives in the guest's container, which is mirrored to face
  // left; mirror the bubble back so it always reads the right way round.
  unflipBubble(container) {
    if (container.bubble) container.bubble.scaleX = container.scaleX < 0 ? -1 : 1;
  }

  // --- Clicking people --------------------------------------------------------

  // Opens the card of whoever was clicked. Returns true if someone was.
  clickPerson(pointer) {
    const hit = this.objectAt(pointer.x, pointer.y); // what's drawn there (selection.js)
    const found = hit && (hit.kind === 'guest' || hit.kind === 'bartender') ? hit : null;
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
    // Framed like a drawn character at 0.8x: the head 10 px below the top
    // and the body centred where theirs is (sheets differ in grid and size).
    const meta = patronMetaOf(character);
    const drawn = PATRON_META;
    const k = 0.8 * drawn.standingHeight / meta.standingHeight;
    const first = meta.starts.idle_front;
    const cellX = (first % meta.columns) * meta.frameWidth;
    const cellY = Math.floor(first / meta.columns) * meta.frameHeight;
    const headTop = meta.originY * meta.frameHeight - meta.standingHeight;
    const centreX = (drawn.originX - 0.12) * drawn.frameWidth * 0.8;
    el.style.backgroundImage = `url(${url})`;
    el.style.backgroundSize = `${meta.frameWidth * meta.columns * k}px auto`;
    el.style.backgroundPosition = `${centreX - (cellX + meta.originX * meta.frameWidth) * k}px ${-(cellY + headTop - 10) * k}px`;
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
      set('infoRole', p.leaving ? 'Heading home' : (p.celeb ? `⭐ Celebrity · ${'★'.repeat(p.celeb.fame)} · likes your club ${this.celebRecord(p.celeb.key).liking}%` : 'Guest'));
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
    set('infoQuote', this.bartenderSpeed(rec.staff) > 1 ? '"Bottoms up!"' : waiting >= 3 ? '"The bar is slammed!"' : (waiting ? '"Coming right up!"' : '"Who\'s thirsty?"'));
    const ready = this.bottomsUpReady(rec);
    const fast = this.bartenderSpeed(rec.staff) > 1;
    action('bottomsUp', fast ? 'working twice as fast now' : (!ready ? 'recovering' : null), 'Bottoms Up! This bartender works twice as fast for 30 seconds.');
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

  // Bottoms Up!: the bartender works at BOTTOMS_UP.speed for durationMs
  // (mixing and walking along the bar), then recovers for cooldownMs.
  bottomsUp(rec) {
    if (!rec || !rec.staff || !this.bottomsUpReady(rec) || !this.clubOpen()) { SFX.denied(); return false; }
    const b = rec.staff;
    const now = this.time.now;
    b.fastUntil = now + BOTTOMS_UP.durationMs;
    b.bottomsUpAt = now + BOTTOMS_UP.durationMs + BOTTOMS_UP.cooldownMs;
    if (b.task && b.task.phase === 'serve') b.task.until = now + (b.task.until - now) / BOTTOMS_UP.speed;
    const { x, y } = b.container;
    this.floatText(x, y - CHARACTER_DISPLAY_HEIGHT * 1.1, 'Bottoms Up! x2', '#ff7ae0');
    SFX.levelUp();
    this.refreshInfoCard();
    return true;
  }

  // How fast a bartender works right now: BOTTOMS_UP.speed during Bottoms Up!, else 1.
  bartenderSpeed(b) {
    return b && this.time.now < (b.fastUntil || 0) ? BOTTOMS_UP.speed : 1;
  }

  // A bartender says something in a speech bubble over their head.
  staffSay(b, text, ms = BOTTOMS_UP.sayMs) {
    if (!b || !b.container) return;
    if (b.speech) b.speech.destroy();
    const c = b.container;
    const label = this.add.text(0, 0, text, {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '12px', color: '#2a1440',
      align: 'center', wordWrap: { width: 150 },
    }).setOrigin(0.5).setResolution(2);
    const w = label.width + 16, h = label.height + 10;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1).lineStyle(2, 0x2a1440, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 9).strokeRoundedRect(-w / 2, -h / 2, w, h, 9);
    g.fillTriangle(-6, h / 2 - 1, 6, h / 2 - 1, 0, h / 2 + 8);
    g.lineBetween(-6, h / 2, 0, h / 2 + 8).lineBetween(6, h / 2, 0, h / 2 + 8);
    const bubble = this.add.container(c.x, c.y - CHARACTER_DISPLAY_HEIGHT * 1.15 - h / 2, [g, label]);
    bubble.setDepth(1e6);
    this.world.add(bubble);
    b.speech = bubble;
    const lift = CHARACTER_DISPLAY_HEIGHT * 1.15 + h / 2;
    const follow = () => { if (bubble.active) bubble.setPosition(c.x, c.y - lift); };
    this.events.on('update', follow);
    bubble.once('destroy', () => this.events.off('update', follow));
    this.time.delayedCall(ms, () => { if (b.speech === bubble) b.speech = null; bubble.destroy(); });
  }

  // When a bar's line gets long, its bartender suggests Bottoms Up (once in a while).
  checkSlammedBars() {
    const now = this.time.now;
    if (now < (this.slammedHintAt || 0)) return;
    const slammed = this.staffableRecords().find((rec) => rec.staff && rec.staff.kind === 'bartender'
      && this.barGroupQueue(rec).length >= BOTTOMS_UP.slammedLine && this.bottomsUpReady(rec));
    if (!slammed) return;
    this.slammedHintAt = now + BOTTOMS_UP.hintEveryMs;
    this.staffSay(slammed.staff, "We're slammed! Click me for Bottoms Up!");
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
