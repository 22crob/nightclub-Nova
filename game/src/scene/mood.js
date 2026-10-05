// ClubScene methods: patron needs (thirst, fun) and mood.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
//
// Every patron has:
//   - thirst: after THIRST_INTERVAL they want a drink (see joinBarQueue() in bars.js).
//     Going without one for MOOD.thirstGrace makes them unhappy.
//   - fun (0-100): drains while they're bored; dancing to a live DJ fills it
//     fast, hanging out somewhere lively fills it slowly.
//   - mood (0-100): rises with drinks and fun, falls with thirst and boredom.
// Mood sets how much they tip, how many fans they bring when they leave,
// and whether they storm out early. The club's vibe (average mood) speeds
// up or slows down new arrivals.
import { PATRON_POPUP_Y } from '../config.js';

export const MOOD = {
  start: 60,
  startFun: 40,
  boredomPerSec: 0.9,      // fun lost per second (the DJ is always playing, so the room itself is a little fun)
  danceFunPerSec: 9,       // fun gained per second dancing to a live DJ
  livelyFunPerSec: 2.5,    // fun gained per second somewhere lively
  seatedFunPerSec: 3,      // fun gained per second sitting down
  seatedMoodPerSec: 0.8,   // mood gained per second sitting down
  thirstGrace: 12000,      // ms a thirsty patron waits before getting upset
  thirstMoodPerSec: 3.5,   // mood lost per second while thirsty past the grace
  boredMoodPerSec: 1.5,    // mood lost per second while fun < 20
  funMoodPerSec: 1.0,      // mood gained per second while fun > 60
  drinkMood: 15,           // mood from a drink
  queuePatience: 0.35,     // thirst hurts this much less while in line at a bar
  stormOutBelow: 20,       // a patron this unhappy leaves early
  bubbleEveryMs: 9000,     // how often a patron repeats a need bubble
};

// What a departing patron is worth in fans, by mood.
export const LEAVING_FANS = [
  { min: 70, fans: 3, emoji: '😍' },
  { min: 40, fans: 1, emoji: '🙂' },
  { min: 0, fans: 0, emoji: '😕' },
];
export const STORM_OUT_FANS = -2;

const clamp = (v) => Math.max(0, Math.min(100, v));

export class MoodMixin {
  // Called every patron tick (dt in seconds) for patrons inside the club.
  updatePatronMood(patron, dt) {
    const now = this.time.now;
    const c = patron.container;
    const dancing = typeof c.patronAnimState === 'string' && c.patronAnimState.startsWith('dance');

    // Fun.
    let fun = patron.fun - MOOD.boredomPerSec * dt;
    if (dancing) fun += MOOD.danceFunPerSec * dt;
    else if (patron.sitting) fun += MOOD.seatedFunPerSec * dt;
    else if (!patron.moving && this.isNearRevenueProp(patron.gx, patron.gy)) fun += MOOD.livelyFunPerSec * dt;
    patron.fun = clamp(fun);

    // Mood.
    let mood = patron.mood;
    if (patron.fun < 20) mood -= MOOD.boredMoodPerSec * dt;
    if (patron.fun > 60) mood += MOOD.funMoodPerSec * dt;
    if (patron.sitting) mood += MOOD.seatedMoodPerSec * dt;
    const thirsty = now >= patron.thirstyAt;
    // A thirsty patron gets up from their seat soon to go and order.
    if (thirsty && patron.sitting) patron.nextMoveAt = Math.min(patron.nextMoveAt, now + 2000);
    if (thirsty) {
      if (patron.thirstSince == null) patron.thirstSince = now;
      if (now - patron.thirstSince > MOOD.thirstGrace) {
        // In line for a drink, they're more patient.
        mood -= MOOD.thirstMoodPerSec * dt * (patron.queue ? MOOD.queuePatience : 1);
        this.moodBubble(patron, '🍹?');
      }
    } else {
      patron.thirstSince = null;
    }
    if (patron.fun < 20 && !thirsty) this.moodBubble(patron, '💤');
    patron.mood = clamp(mood);

    if (patron.mood < MOOD.stormOutBelow) {
      patron.stormedOut = true;
      this.floatText(c.x, c.y - PATRON_POPUP_Y, '😠', '#ffffff');
      this.startPatronDeparture(patron);
    }
  }

  // A drink cheers a patron up and quenches their thirst.
  cheerPatron(patron, amount) {
    patron.mood = clamp(patron.mood + amount);
    patron.fun = clamp(patron.fun + 5);
    patron.thirstSince = null;
  }

  // A small thought bubble over a patron's head, at most every
  // MOOD.bubbleEveryMs per patron.
  moodBubble(patron, text) {
    const now = this.time.now;
    if (patron.lastBubbleAt && now - patron.lastBubbleAt < MOOD.bubbleEveryMs) return;
    patron.lastBubbleAt = now;
    const c = patron.container;
    this.floatText(c.x, c.y - PATRON_POPUP_Y, text, '#ffffff');
  }

  // Fans from a patron as they leave, by mood; a patron who stormed out
  // costs fans. Shows their verdict over the door.
  patronLeaves(patron) {
    let fans;
    let emoji;
    if (patron.ejected) {
      fans = 0; // thrown out by security
      emoji = '🚫';
    } else if (patron.stormedOut) {
      fans = STORM_OUT_FANS;
      this.noteStormOut();
      emoji = '😠';
    } else {
      const tier = LEAVING_FANS.find((t) => patron.mood >= t.min);
      fans = Math.round(tier.fans * this.partyEffect('fans', 1));
      if (tier.fans > 0) fans += this.celebFans(patron); // a happy celebrity tells everyone
      emoji = tier.emoji;
    }
    this.fans = Math.max(0, this.fans + fans);
    this.guestsServed = (this.guestsServed || 0) + 1;
    const c = patron.container;
    const label = fans > 0 ? `${emoji} +${fans}★` : (fans < 0 ? `${emoji} ${fans}★` : emoji);
    this.floatText(c.x, c.y - PATRON_POPUP_Y, label, fans < 0 ? '#ff8a8a' : '#ffe27a');
    this.updateUI();
  }

  // The club's vibe: average mood of patrons inside, or null when empty.
  clubVibe() {
    const inside = this.patrons.filter((p) => !p.leaving && !p.gone);
    if (inside.length === 0) return null;
    return inside.reduce((sum, p) => sum + p.mood, 0) / inside.length;
  }

  // New patrons arrive faster when the vibe is good: 0.6x the wait at 100,
  // 1.4x at 0, normal when the club is empty.
  // A party brings them faster still.
  spawnDelayFactor() {
    const vibe = this.clubVibe();
    const party = this.partyEffect('arrivals', 1) * this.ratingArrivalFactor();
    if (vibe == null) return 1 / party;
    return (1.4 - (vibe / 100) * 0.8) / party;
  }

  vibeEmoji(vibe) {
    if (vibe == null) return '😶';
    if (vibe >= 70) return '😍';
    if (vibe >= 40) return '🙂';
    return '😕';
  }
}
