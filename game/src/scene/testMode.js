// ClubScene methods: Test mode, for trying out everything in the game.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
// Only does anything when TEST_MODE is on (the game opened at .../test/ or
// with ?test, see config.js); it then plays on its own save (save.js).
import { PROP_TYPES } from '../catalog.js';
import { CELEBRITIES, PARTIES, TEST, TEST_MODE } from '../config.js';

export class TestModeMixin {
  // The highest level anything unlocks at (items, parties, celebrities).
  topUnlockLevel() {
    const levels = [
      ...Object.values(PROP_TYPES).map((t) => t.unlockLevel || 1),
      ...PARTIES.map((p) => p.unlockLevel || 1),
      ...CELEBRITIES.map((c) => c.level || 1),
    ];
    return Math.max(...levels);
  }

  // Called after loading: a test club is at the top level and never short
  // of cash. Runs before the level-up baseline is set, so it doesn't pop up
  // a level-up menu.
  applyTestMode() {
    if (!TEST_MODE) return;
    this.fans = Math.max(this.fans, this.fansForLevel(this.topUnlockLevel()));
    this.cash = Math.max(this.cash, TEST.cash);
    this.popularity = Math.max(this.popularity || 0, TEST.popularity);
    const tag = document.createElement('div');
    tag.id = 'testModeTag';
    tag.textContent = 'TEST MODE';
    document.body.appendChild(tag);
  }
}
