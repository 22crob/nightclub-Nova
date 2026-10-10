// ClubScene methods: the club's hours and rating. Like Nightclub City, the
// club runs one endless night: the doors are always open and the DJ always
// plays. Every so often (RATING.sampleMs) the crowd's mood earns a few
// bonus fans (kept in nightStars). The club rating shown in the HUD is
// steady: stars for how good the club itself is (clubRating(): luxury,
// variety of decorations, seats, dance floor and DJ booth), changing only
// when you build (the owner wanted it consistent, not swinging with the
// crowd, which popularity already follows). Mixed into ClubScene (see
// ClubScene.js); `this` is the scene.
import { PROP_TYPES } from '../catalog.js';
import { DJ, RATING } from '../config.js';

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

  // The club's star rating, 1 to 5 in half stars, from the club itself
  // (RATING.quality: how many points each part is worth, and what earns
  // them all).
  clubRating() {
    const Q = RATING.quality;
    const cap = Math.max(8, this.patronCapacity ? this.patronCapacity() : 8);
    let seats = 0, dance = 0;
    const decor = new Set();
    const seen = new Set();
    for (const key in this.placed || {}) {
      const rec = this.placed[key];
      if (seen.has(rec)) continue;
      seen.add(rec);
      const def = PROP_TYPES[rec.type];
      if (!def) continue;
      if (def.seats) seats += def.seats.length;
      if (def.floorStyle) dance += 1;
      if (def.category === 'Decorations') decor.add(rec.type);
    }
    for (const type of Object.values(this.wallDecor || {})) decor.add(type);
    const dj = this.djQuality ? (this.djQuality() - DJ.qualityMin) / Math.max(0.0001, DJ.qualityMax - DJ.qualityMin) : 0;
    const points = Q.luxury * Math.min(1, this.luxury() / Q.fullLuxury)
      + Q.variety * Math.min(1, decor.size / Q.fullVariety)
      + Q.seats * Math.min(1, seats / (cap * Q.seatsPerGuest))
      + Q.dance * Math.min(1, dance / (cap * Q.danceTilesPerGuest))
      + Q.dj * Math.max(0, Math.min(1, dj));
    return Math.max(1, Math.min(5, Math.round((1 + points / 25) * 2) / 2));
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
