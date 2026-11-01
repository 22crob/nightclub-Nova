// Chibi cartoon people: big round heads, soft shading and outlines. Used for
// the hero and the villagers. They face +Z.
import * as THREE from 'three';
import { toon, part } from './materials.js';

const OL = 0.022;   // outline thickness

const sphere = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 12);

function face(head, { skin, eyes = '#2a1b2e' }) {
  const dark = toon(eyes), white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const s of [1, -1]) {
    // Eyes are tall dark ovals with a white sparkle.
    const eye = new THREE.Mesh(sphere(0.07, 12, 10), dark);
    eye.scale.set(0.8, 1.2, 0.45);
    eye.position.set(s * 0.14, 0.34, 0.355);
    eye.rotation.y = s * 0.35;
    head.add(eye);
    const glint = new THREE.Mesh(sphere(0.026, 8, 6), white);
    glint.position.set(s * 0.14 + 0.022, 0.37, 0.39);
    head.add(glint);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.07, 2, 6), dark);
    brow.rotation.z = Math.PI / 2 + s * 0.15;
    brow.position.set(s * 0.14, 0.47, 0.35);
    head.add(brow);
    const blush = new THREE.Mesh(sphere(0.055, 10, 6), toon('#ff9a9a', { transparent: true, opacity: 0.75 }));
    blush.scale.set(1.2, 0.6, 0.3);
    blush.position.set(s * 0.25, 0.24, 0.31);
    blush.rotation.y = s * 0.6;
    head.add(blush);
    head.add(part(sphere(0.07, 10, 8), skin, { x: s * 0.4, y: 0.3, z: 0, outline: OL }));   // ears
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 4, 10, Math.PI), dark);
  mouth.position.set(0, 0.2, 0.385);
  mouth.rotation.z = Math.PI;
  head.add(mouth);
}

export function makePerson(look) {
  const {
    skin = '#f6cfaa', shirt = '#3d6fb6', pants = '#4a3b2e', boots = '#5a3a26', hair = '#5b3a1e',
    beard = null, robe = false, cape = null, hat = null, sword = false, shield = false, hairStyle = 'short',
  } = look;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const leg = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.13, 0.6, 0);
    g.add(part(capsule(0.1, 0.3), pants, { y: -0.25, outline: OL }));
    const boot = part(sphere(0.14), boots, { y: -0.52, z: 0.05, outline: OL });
    boot.scale.set(0.9, 0.62, 1.25);
    g.add(boot);
    body.add(g);
    return g;
  };
  const legL = leg(1), legR = leg(-1);

  const torso = new THREE.Group();
  torso.position.y = 0.6;
  body.add(torso);
  const chest = part(capsule(0.27, 0.22), shirt, { y: 0.3, outline: OL });
  chest.scale.set(1, 1, 0.82);
  torso.add(chest);
  const hips = part(sphere(0.27), pants, { y: 0.08, outline: OL });
  hips.scale.set(1, 0.55, 0.82);
  torso.add(hips);
  const belt = part(new THREE.TorusGeometry(0.255, 0.045, 6, 20), '#6b4226', { y: 0.15, outline: 0 });
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1, 0.82, 1);
  torso.add(belt);
  torso.add(part(new THREE.BoxGeometry(0.1, 0.08, 0.04), '#f2c95a', { y: 0.15, z: 0.215, outline: 0 }));
  if (robe) {
    const skirt = part(new THREE.CylinderGeometry(0.26, 0.42, 0.62, 18, 1), shirt, { y: -0.18, outline: OL });
    torso.add(skirt);
  }

  const head = new THREE.Group();
  head.position.y = 0.6;
  torso.add(head);
  head.add(part(sphere(0.4, 24, 18), skin, { y: 0.32, outline: OL }));
  face(head, { skin });
  // Hair: a cap over the top and back, plus a few tufts for a fringe.
  const cap = part(new THREE.SphereGeometry(0.43, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, { y: 0.34, outline: OL });
  cap.rotation.x = -0.42;
  head.add(cap);
  for (const [x, y, r] of [[-0.17, 0.6, 0.13], [0.0, 0.64, 0.14], [0.17, 0.6, 0.13]]) {
    const tuft = part(sphere(r, 12, 10), hair, { x, y, z: 0.26, outline: OL });
    tuft.scale.set(1.1, 0.75, 0.8);
    head.add(tuft);
  }
  if (hairStyle === 'long') {
    const back = part(capsule(0.3, 0.3), hair, { y: 0.05, z: -0.2, outline: OL });
    back.scale.set(1.2, 1, 0.6);
    head.add(back);
  }
  if (beard) {
    const b = part(sphere(0.3), beard, { y: 0.06, z: 0.2, outline: OL });
    b.scale.set(1, 0.95, 0.6);
    head.add(b);
    const tache = part(capsule(0.05, 0.16), beard, { y: 0.23, z: 0.37, outline: 0 });
    tache.rotation.z = Math.PI / 2;
    head.add(tache);
  }
  if (hat === 'wizard') {
    const cone = part(new THREE.ConeGeometry(0.4, 0.85, 18, 3), shirt, { y: 1.05, z: -0.05, outline: OL });
    cone.rotation.x = -0.25;
    head.add(cone);
    head.add(part(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 24), shirt, { y: 0.66, outline: OL }));
    head.add(part(new THREE.TorusGeometry(0.39, 0.035, 6, 20).rotateX(Math.PI / 2), '#f2c95a', { y: 0.71, outline: 0 }));
  } else if (hat === 'straw') {
    head.add(part(new THREE.CylinderGeometry(0.68, 0.68, 0.05, 24), '#e8c26a', { y: 0.66, outline: OL }));
    head.add(part(new THREE.CylinderGeometry(0.33, 0.36, 0.24, 20), '#e8c26a', { y: 0.78, outline: OL }));
    head.add(part(new THREE.CylinderGeometry(0.365, 0.365, 0.07, 20), '#c24b3a', { y: 0.7, outline: 0 }));
  } else if (hat === 'hood') {
    const hood = part(new THREE.SphereGeometry(0.47, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), shirt, { y: 0.32, outline: OL });
    hood.rotation.x = -0.55;
    head.add(hood);
  }

  const arm = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.33, 0.44, 0);
    g.add(part(capsule(0.085, 0.24), shirt, { y: -0.17, outline: OL }));
    g.add(part(sphere(0.095), skin, { y: -0.38, outline: OL }));
    torso.add(g);
    return g;
  };
  const armL = arm(1), armR = arm(-1);

  let blade = null;
  if (sword) {
    const s = new THREE.Group();
    s.position.set(0, -0.4, 0.04);
    s.rotation.x = Math.PI / 2;
    s.add(part(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), '#6b4226', { outline: OL }));
    s.add(part(sphere(0.05), '#f2c95a', { y: -0.12, outline: 0 }));
    s.add(part(new THREE.CapsuleGeometry(0.04, 0.26, 3, 8).rotateZ(Math.PI / 2), '#f2c95a', { y: 0.12, outline: OL }));
    const shape = new THREE.Shape();
    shape.moveTo(-0.055, 0); shape.lineTo(0.055, 0); shape.lineTo(0.05, 0.62); shape.lineTo(0, 0.74); shape.lineTo(-0.05, 0.62); shape.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 });
    bladeGeo.translate(0, 0.14, -0.0125);
    blade = part(bladeGeo, toon('#e9f1f7', { emissive: new THREE.Color('#3a5068') }), { outline: 0.012 });
    s.add(blade);
    armR.add(s);
  }
  if (shield) {
    const sh = part(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 24).rotateZ(Math.PI / 2), '#c23b45', { x: 0.1, y: -0.24, outline: OL });
    sh.add(part(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 20).rotateZ(Math.PI / 2), '#f2f0e6', { x: 0.005, outline: 0 }));
    sh.add(part(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 6).rotateZ(Math.PI / 2), '#f2c95a', { x: 0.01, outline: 0 }));
    armL.add(sh);
  }
  if (cape) {
    const geo = new THREE.CylinderGeometry(0.3, 0.46, 0.78, 14, 3, true, Math.PI * 0.62, Math.PI * 0.76).translate(0, -0.39, 0);
    const c = part(geo, toon(cape, { side: THREE.DoubleSide }), { y: 0.5, z: -0.03, outline: 0 });
    torso.add(c);
    root.userData.cape = c;
  }

  root.userData.rig = { body, legL, legR, armL, armR, torso, head, blade };
  return root;
}

// Moves the limbs. `move` 0..1 is how fast they're going, `t` is time in s.
export function animatePerson(person, t, move, opts = {}) {
  const r = person.userData.rig;
  const stride = opts.stride || 9;
  const swing = Math.sin(t * stride) * 0.75 * move;
  r.legL.rotation.x = swing;
  r.legR.rotation.x = -swing;
  r.armL.rotation.x = -swing * 0.9;
  r.armR.rotation.x = swing * 0.9;
  r.armL.rotation.z = 0.12 + (1 - move) * 0.05;
  r.armR.rotation.z = -0.12 - (1 - move) * 0.05;
  r.body.position.y = Math.abs(Math.sin(t * stride)) * 0.07 * move;
  // Breathing when standing still.
  const breathe = Math.sin(t * 2.2) * 0.015 * (1 - move);
  r.torso.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);
  r.torso.rotation.x = move * 0.08;
  r.head.rotation.y = opts.look || 0;
  r.head.rotation.x = -move * 0.06;
  if (person.userData.cape) person.userData.cape.rotation.x = 0.1 + move * 0.5 + Math.sin(t * 7) * 0.05 * move;
  if (opts.swim) {
    r.legL.rotation.x = Math.sin(t * 5) * 0.5;
    r.legR.rotation.x = -Math.sin(t * 5) * 0.5;
    r.armL.rotation.x = -1.2 + Math.sin(t * 5) * 0.6;
    r.armR.rotation.x = -1.2 - Math.sin(t * 5) * 0.6;
  }
  if (opts.air) {
    r.legL.rotation.x = -0.6; r.legR.rotation.x = 0.35;
    r.armL.rotation.x = -0.5; r.armR.rotation.x = -0.5;
    r.armL.rotation.z = 0.6; r.armR.rotation.z = -0.6;
  }
  if (opts.swing != null) {
    // A big overhead-to-forward slash with the right arm.
    const k = opts.swing;
    const a = k < 0.3 ? -2.6 * (k / 0.3) : -2.6 + 3.4 * Math.min(1, (k - 0.3) / 0.4);
    r.armR.rotation.x = a;
    r.armR.rotation.z = -0.25;
    r.torso.rotation.y = -0.4 + Math.min(1, k * 1.6) * 0.8;
  } else {
    r.torso.rotation.y = 0;
  }
  if (opts.talk) r.head.rotation.x = Math.sin(t * 6) * 0.06;
}
