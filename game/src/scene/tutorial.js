// ClubScene methods: the How to play guide. A small card at the top of the
// screen walks a new club through the basics, one step at a time, glowing
// round the button it's talking about; each step moves on when the player
// does it (or with its button). Saved as `tutorial` ({ step, done }); a new
// club starts it once it's named and has had its daily gift, and the How to
// play button (?) runs it again. Clubs from before it count as done.
// After the guide, the same card gives one-time tips (HINTS) the first time
// something comes up (bars running dry, a troublemaker, a full club),
// each shown once per club (saved as `hintsSeen`).
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { DRINK_STOCK, PARTIES } from '../config.js';
import { SFX } from '../sfx.js';

// Each step: what it says, the button it points at (glows), when it's done
// (`done`, checked twice a second), and a button to move on without doing it.
const STEPS = [
  { text: 'Welcome to your club! Your DJ is playing, your bartender is ready, and guests are lining up outside.', next: "Let's go!" },
  { text: 'Tap Build to open the shop.', target: '#navBuild', done: (s) => s.dockTab === 'decor' },
  { text: 'Pick something you like and click the floor to place it. The first one of each thing you buy earns XP!', target: '#shopItems', done: (s) => s.tutorialFlags.placed, next: 'Skip' },
  { text: 'Click a guest to see how they feel, what they like and what they\'ve spent.', done: (s) => s.tutorialFlags.guestCard, next: 'Skip' },
  { text: 'Happy guests hold up a big gold $ coin now and then. Click it quick for cash!', done: (s) => s.tutorialFlags.bonus, next: 'Got it' },
  { text: 'Open Staff: hire bartenders and bouncers as you level up. When drinks run low, tap the drink meter on the right to restock.', target: '#navStaff', done: (s) => s.dockTab === 'staff' },
  // Parties unlock at level 5 (the House Party), so a new club hears about them for later.
  { text: (s) => (s.levelInfo().level >= PARTIES[0].unlockLevel
    ? 'Throw a party for a big crowd, bigger tips and lots of XP. It costs cash, and you can throw one every few minutes.'
    : `At level ${PARTIES[0].unlockLevel} you can throw parties here: a big crowd, bigger tips and lots of XP.`),
  target: '#partyButton', done: (s) => s.tutorialFlags.party, next: 'Later' },
  { text: 'Keep your guests happy: happy guests make your club Popular, and a popular club fits more guests. Have fun!', target: '#hudStats', next: 'Done!' },
];

// One-time tips: shown the first time `when` is true (checked twice a second,
// never during the guide, at most one every HINT_GAP_MS).
const HINTS = [
  { id: 'unworkedBar', text: 'A bar without a bartender can\'t sell drinks. Hire one in Staff (you can hire more bartenders as you level up).', target: '#navStaff',
    when: (s) => s.hireableRecords().some((r) => !s.isWorked(r)) },
  { id: 'lowStock', text: 'Your bars are running low on drinks! Tap the drink meter on the right to restock before they run dry.', target: '#drinkMeter',
    when: (s) => s.drinkStockLeft() <= s.maxDrinkStock() * DRINK_STOCK.lowShare },
  { id: 'troublemaker', text: 'A troublemaker just walked in! They upset the guests around them. Your bouncer will spot them and walk them out (more bouncers unlock in Staff as you level up).',
    when: (s) => s.patrons.some((p) => p.troublemaker && !p.gone && !p.leaving) },
  { id: 'full', text: 'Your club is full, so guests wait in line outside. Keep guests happy to raise your Popularity: a more popular club lets more in.', target: '#hudStats',
    when: (s) => s.guestCount() >= s.patronCapacity() },
  { id: 'barsFull', text: 'Your bar line is full! Thirsty guests wait their turn, but you could be selling more drinks: build more bar or hire another bartender in Staff.', target: '#navStaff',
    when: (s) => s.barsFull() && s.patrons.filter((p) => !p.gone && !p.queue && p.thirstyAt <= s.time.now).length >= 3 },
  { id: 'boothUpgrade', text: 'You can afford a better DJ booth! Pick one in Build: it goes right where your booth stands, and the old one goes into your inventory.', target: '#navBuild',
    when: (s) => { const b = s.clubBooth(); return !!b && s.levelInfo().level >= 3 && s.betterBoothAffordable(b); } },
];
const HINT_GAP_MS = 20000;

export class TutorialMixin {
  setupTutorial() {
    this.tutorialFlags = {};
    this.hintsSeen = this.hintsSeen || [];
    document.getElementById('tutorialNext')?.addEventListener('click', () => { SFX.unlock(); if (this.hint) this.closeHint(); else this.nextTutorialStep(); });
    document.getElementById('tutorialSkip')?.addEventListener('click', () => { SFX.unlock(); this.endTutorial(); });
    document.getElementById('tipsButton')?.addEventListener('click', () => { SFX.unlock(); this.startTutorial(); });
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.tickTutorial() });
  }

  startTutorial() {
    if (this.hint) this.closeHint();
    this.tutorial = { step: 0, done: false };
    this.tutorialFlags = {};
    this.showTutorialStep();
    this.saveGame();
  }

  // Starts the guide for a new club once nothing else is on screen.
  maybeStartTutorial() {
    if (this.tutorial) return;
    const busy = ['namePrompt', 'dailyBox', 'levelUp'].some((id) => document.getElementById(id)?.classList.contains('open'));
    if (busy) return;
    this.startTutorial();
  }

  tickTutorial() {
    if (!this.tutorial && this.freshClub) { this.maybeStartTutorial(); return; }
    const t = this.tutorial;
    if (!t || t.done) { this.tickHints(); return; }
    const step = STEPS[t.step];
    if (step && step.done && step.done(this)) this.nextTutorialStep();
  }

  // The first time a tip's moment comes, it shows (one at a time).
  tickHints() {
    if (this.hint || this.time.now < (this.nextHintAt || 0)) return;
    const busy = ['namePrompt', 'dailyBox', 'levelUp', 'partySummary'].some((id) => document.getElementById(id)?.classList.contains('open'));
    if (busy) return;
    const seen = new Set(this.hintsSeen || []);
    const hint = HINTS.find((h) => !seen.has(h.id) && h.when(this));
    if (hint) this.showHint(hint.id);
  }

  showHint(id) {
    const hint = HINTS.find((h) => h.id === id);
    const box = document.getElementById('tutorialBox');
    if (!hint || !box) return false;
    this.hintsSeen = [...new Set([...(this.hintsSeen || []), id])];
    this.hint = hint;
    document.querySelectorAll('.tutorialGlow').forEach((e) => e.classList.remove('tutorialGlow'));
    box.classList.add('open', 'hint');
    box.querySelector('.tutorialTitle').textContent = '💡 Tip';
    document.getElementById('tutorialCount').textContent = '';
    document.getElementById('tutorialText').textContent = hint.text;
    const next = document.getElementById('tutorialNext');
    next.textContent = 'Got it';
    next.style.display = '';
    if (hint.target) document.querySelector(hint.target)?.classList.add('tutorialGlow');
    SFX.tip();
    this.saveGame();
    return true;
  }

  closeHint() {
    this.hint = null;
    this.nextHintAt = this.time.now + HINT_GAP_MS;
    document.querySelectorAll('.tutorialGlow').forEach((e) => e.classList.remove('tutorialGlow'));
    const box = document.getElementById('tutorialBox');
    box?.classList.remove('open', 'hint');
    if (box) box.querySelector('.tutorialTitle').textContent = 'How to play';
  }

  nextTutorialStep() {
    const t = this.tutorial;
    if (!t || t.done) return;
    t.step += 1;
    if (t.step >= STEPS.length) { this.endTutorial(); return; }
    SFX.tip();
    this.showTutorialStep();
    this.saveGame();
  }

  endTutorial() {
    this.tutorial = { step: STEPS.length, done: true };
    this.showTutorialStep();
    this.saveGame();
  }

  showTutorialStep() {
    const box = document.getElementById('tutorialBox');
    document.querySelectorAll('.tutorialGlow').forEach((e) => e.classList.remove('tutorialGlow'));
    const t = this.tutorial;
    if (!box) return;
    if (!t || t.done) { box.classList.remove('open'); return; }
    const step = STEPS[t.step];
    document.getElementById('tutorialCount').textContent = `${t.step + 1} / ${STEPS.length}`;
    document.getElementById('tutorialText').textContent = typeof step.text === 'function' ? step.text(this) : step.text;
    const next = document.getElementById('tutorialNext');
    next.textContent = step.next || 'Next';
    next.style.display = step.next ? '' : 'none';
    if (step.target) document.querySelector(step.target)?.classList.add('tutorialGlow');
    box.classList.add('open');
  }

  // Things the guide watches for (called where they happen).
  noteTutorial(flag) {
    if (this.tutorialFlags) this.tutorialFlags[flag] = true;
  }
}
