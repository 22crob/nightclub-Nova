// ClubScene methods: the How to play guide. A small card at the top of the
// screen walks a new club through the basics, one step at a time, glowing
// round the button it's talking about; each step moves on when the player
// does it (or with its button). Saved as `tutorial` ({ step, done }); a new
// club starts it once it's named and has had its daily gift, and the How to
// play button (?) runs it again. Clubs from before it count as done.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { SFX } from '../sfx.js';

// Each step: what it says, the button it points at (glows), when it's done
// (`done`, checked twice a second), and a button to move on without doing it.
const STEPS = [
  { text: 'Welcome to your club! Your DJ is playing, your bartender is ready, and guests are lining up outside.', next: "Let's go!" },
  { text: 'Tap Build to open the shop.', target: '#navBuild', done: (s) => s.dockTab === 'decor' },
  { text: 'Pick something you like and click the floor to place it. The first one of each thing you buy earns XP!', target: '#shopItems', done: (s) => s.tutorialFlags.placed, next: 'Skip' },
  { text: 'Click a guest to see how they feel, what they like and what they\'ve spent.', done: (s) => s.tutorialFlags.guestCard, next: 'Skip' },
  { text: 'Happy guests hold up a gold high five now and then. Click it quick for cash!', done: (s) => s.tutorialFlags.bonus, next: 'Got it' },
  { text: 'Open Staff: restock the bars when drinks run low, and hire bartenders and bouncers as you level up.', target: '#navStaff', done: (s) => s.dockTab === 'staff' },
  { text: 'Throw a party for a big crowd and bigger tips (it costs a little).', target: '#partyButton', done: (s) => s.tutorialFlags.party, next: 'Later' },
  { text: 'Keep your guests happy: happy guests make your club Popular, and a popular club fits more guests. Have fun!', target: '#hudStats', next: 'Done!' },
];

export class TutorialMixin {
  setupTutorial() {
    this.tutorialFlags = {};
    document.getElementById('tutorialNext')?.addEventListener('click', () => { SFX.unlock(); this.nextTutorialStep(); });
    document.getElementById('tutorialSkip')?.addEventListener('click', () => { SFX.unlock(); this.endTutorial(); });
    document.getElementById('tipsButton')?.addEventListener('click', () => { SFX.unlock(); this.startTutorial(); });
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.tickTutorial() });
  }

  startTutorial() {
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
    if (!t || t.done) return;
    const step = STEPS[t.step];
    if (step && step.done && step.done(this)) this.nextTutorialStep();
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
    document.getElementById('tutorialText').textContent = step.text;
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
