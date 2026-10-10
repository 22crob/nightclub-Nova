// ClubScene methods: the club's hours and rating. Like Nightclub City, the
// club runs one endless night: the doors are always open and the DJ always
// plays. Every so often (RATING.sampleMs) the club is rated on how happy
// the crowd has been: stars, and a few bonus fans for a good crowd. The
// club rating is the average of the last few.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { RATING } from '../config.js';

export class RatingMixin {
  // The doors never close and the music never stops (kept as methods so the
  // rest of the game can still ask).
  doorsOpen() {
    return true;
  }

  clubOpen() {
    return true;
  }

  // Running totals of money in and out (drinks, tips, cover, wages, parties).
  noteIncome(kind, amount) {
    this.totals = this.totals || {};
    this.totals[kind] = (this.totals[kind] || 0) + amount;
  }

  noteStormOut() {
    this.stormedOut = (this.stormedOut || 0) + 1;
  }

  // Runs every second: samples the crowd's vibe, and every RATING.sampleMs
  // turns the average into stars.
  tickRating() {
    const vibe = this.clubVibe();
    if (vibe != null) {
      this.vibeSum = (this.vibeSum || 0) + vibe;
      this.vibeCount = (this.vibeCount || 0) + 1;
    }
    if (this.time.now - (this.ratedAt || 0) < RATING.sampleMs) return;
    this.ratedAt = this.time.now;
    if (!this.vibeCount) return; // nobody here yet
    const avg = this.vibeSum / this.vibeCount;
    this.vibeSum = 0;
    this.vibeCount = 0;
    const stars = RATING.starVibes.filter((v) => avg >= v).length + 1;
    this.fans += RATING.starFans[stars - 1];
    this.nightStars = [...(this.nightStars || []), stars].slice(-RATING.samples);
    this.updateUI();
    this.saveGame();
  }

  // The club's star rating: the average of the recent ratings, to the
  // nearest half star, or null before the first.
  clubRating() {
    const s = this.nightStars || [];
    if (s.length === 0) return null;
    return Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 2) / 2;
  }

  // A well-rated club draws guests faster.
  ratingArrivalFactor() {
    const r = this.clubRating();
    return r == null ? 1 : 1 + (r - 3) * RATING.arrivalsPerStar;
  }

  // Starts the club: the music and the rating clock.
  setupClubHours() {
    this.ratedAt = this.time.now;
    this.syncMusic();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickRating() });
  }
}
