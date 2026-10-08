// ClubScene methods: Popularity, the club's reputation (settings POPULARITY
// in config.js, saved as `popularity`). Every visit moves it, by how the
// guest felt leaving (noteVisitPopularity(), called from patronLeaves()).
// It sets how many guests fit (patronCapacity(), CAPACITY) and how fast new
// ones arrive (popularityArrivalFactor(), used in spawnDelayFactor()).
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { CAPACITY, POPULARITY } from '../config.js';

export class PopularityMixin {
  // A guest's visit is over: happy guests spread the word, unhappy ones complain.
  noteVisitPopularity(patron) {
    let delta;
    if (patron.ejected) delta = 0; // thrown out: nobody minds
    else if (patron.stormedOut) delta = POPULARITY.stormOut;
    else if (patron.mood >= 70) delta = POPULARITY.happy;
    else if (patron.mood >= 40) delta = POPULARITY.content;
    else delta = POPULARITY.unhappy;
    this.addPopularity(delta);
    return delta;
  }

  addPopularity(delta) {
    this.popularity = Math.max(0, Math.round((this.popularity || 0) + delta));
  }

  // How many guests fit: grows with popularity, but the room has to hold them.
  patronCapacity() {
    const byFame = CAPACITY.base + Math.floor(CAPACITY.perRootPopularity * Math.sqrt(this.popularity || 0));
    const byRoom = Math.max(CAPACITY.base, Math.floor((this.gridW * this.gridH) / CAPACITY.tilesPerGuest));
    return Math.min(byFame, byRoom);
  }

  // Guests arrive faster the more popular the club is (1 = normal).
  popularityArrivalFactor() {
    return 1 + Math.min(POPULARITY.arrivalMax, (this.popularity || 0) * POPULARITY.arrivalPer);
  }
}
