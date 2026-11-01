// Villagers: Elder Maren gives the Moonshard quest; the others potter about
// and have a line or two.
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { makePerson, animatePerson } from './character.js';
import { mulberry32 } from './noise.js';
import { QUEST } from './config.js';

const rand = mulberry32(77);

export const PEOPLE = [
  {
    id: 'maren', name: 'Elder Maren', x: 3.5, z: 4, wander: 1.5,
    look: { skin: '#e8bf9a', shirt: '#4b3f8f', pants: '#4b3f8f', hair: '#e8e6e0', beard: '#e8e6e0', robe: true, hat: 'wizard' },
  },
  {
    id: 'tobin', name: 'Tobin', x: -9, z: -4, wander: 5,
    look: { skin: '#c98e62', shirt: '#b5652a', pants: '#5a4630', hair: '#2c1d12', hat: 'straw' },
    lines: [
      'Slimes got into the turnips again. Bouncy little thieves.',
      'Follow the dirt paths and you\'ll find all sorts out there.',
      'They say the old watchtower was built before the village. Older than Maren, even!',
    ],
  },
  {
    id: 'wren', name: 'Wren', x: 9, z: -9, wander: 4.5,
    look: { skin: '#f5d2b3', shirt: '#3f8a5a', pants: '#2f3a4f', hair: '#9b3b2a', hat: 'hood' },
    lines: [
      'I hid a treasure chest in the woods once. Then I forgot where. Maybe you\'ll find it?',
      'At night the mushrooms in Glowcap Grove light up like lanterns.',
      'You can swim out to the little island in the lake. Mind the cold!',
    ],
  },
];

// What Maren says, by quest stage. Returns the lines and what happens after.
export function marenTalk(quest, shards) {
  if (quest === 'intro') {
    return {
      lines: [
        'Ah, a traveller! Welcome to Lumen Vale. Forgive the gloom.',
        `The Moonshards kept our lanterns lit for a hundred years. Last night a storm scattered all ${QUEST.shards} of them across the vale.`,
        'Each one shines a beam of light up into the sky. Follow the beams, and bring them home.',
        'Mind the slimes out there. Your sword will see them off. Now go!',
      ],
      then: 'collect',
    };
  }
  if (quest === 'collect' && shards < QUEST.shards) {
    return { lines: [`You have ${shards} of ${QUEST.shards} Moonshards. Look for the beams of light in the sky.`] };
  }
  if (quest === 'collect') {
    return {
      lines: [
        'You found them all! Listen... the lanterns are humming already.',
        `Please, take these ${QUEST.reward} coins. Lumen Vale won't forget you.`,
      ],
      then: 'done',
    };
  }
  return { lines: ['The lanterns have never shone brighter. Thank you, friend.', 'The vale is yours to roam. There are still chests out there, I hear.'] };
}

export class Villagers {
  constructor(scene) {
    this.list = PEOPLE.map((p) => {
      const model = makePerson(p.look);
      model.position.set(p.x, heightAt(p.x, p.z), p.z);
      scene.add(model);
      return { ...p, model, pos: new THREE.Vector3(p.x, 0, p.z), target: null, waitUntil: 0, facing: rand() * 6, t: rand() * 10, line: 0, talking: false };
    });
  }

  byId(id) { return this.list.find((v) => v.id === id); }

  update(dt, now, player) {
    for (const v of this.list) {
      v.t += dt;
      let move = 0;
      if (v.talking) {
        const want = Math.atan2(player.pos.x - v.pos.x, player.pos.z - v.pos.z);
        v.facing += Math.atan2(Math.sin(want - v.facing), Math.cos(want - v.facing)) * Math.min(1, dt * 6);
      } else if (v.target) {
        const dx = v.target.x - v.pos.x, dz = v.target.z - v.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.2) { v.target = null; v.waitUntil = now + 2000 + rand() * 5000; } else {
          const sp = 1.6 * dt;
          v.pos.x += dx / d * Math.min(sp, d); v.pos.z += dz / d * Math.min(sp, d);
          v.facing = Math.atan2(dx, dz);
          move = 0.45;
        }
      } else if (now > v.waitUntil) {
        const a = rand() * Math.PI * 2, r = rand() * v.wander;
        v.target = { x: v.x + Math.cos(a) * r, z: v.z + Math.sin(a) * r };
      }
      v.model.position.set(v.pos.x, heightAt(v.pos.x, v.pos.z), v.pos.z);
      v.model.rotation.y = v.facing;
      animatePerson(v.model, v.t, move, { stride: 7, talk: v.talking });
    }
  }
}
