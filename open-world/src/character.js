// Low-poly people built from boxes: the hero and the villagers. Faces +Z.
import * as THREE from 'three';

const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function makePerson(look) {
  const {
    skin = '#f1c7a1', shirt = '#3d6fb6', pants = '#4a3b2e', boots = '#3a2a1e', hair = '#5b3a1e',
    beard = null, robe = false, cape = null, hat = null, sword = false, shield = false,
  } = look;
  const root = new THREE.Group();
  const body = new THREE.Group();      // everything but the root, so it can bob
  root.add(body);

  const leg = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.16, 0.92, 0);
    g.add(box(0.24, 0.62, 0.26, pants, 0, -0.31, 0));
    g.add(box(0.27, 0.3, 0.32, boots, 0, -0.77, 0.03));
    body.add(g);
    return g;
  };
  const legL = leg(1), legR = leg(-1);

  const torso = new THREE.Group();
  torso.position.y = 0.92;
  body.add(torso);
  torso.add(box(0.62, 0.66, 0.36, shirt, 0, 0.36, 0));
  torso.add(box(0.64, 0.1, 0.38, '#5a3b22', 0, 0.06, 0)); // belt
  torso.add(box(0.12, 0.1, 0.05, '#e3c062', 0, 0.06, 0.2)); // buckle
  if (robe) torso.add(box(0.66, 0.55, 0.4, shirt, 0, -0.22, 0));

  const head = new THREE.Group();
  head.position.y = 0.74;
  torso.add(head);
  head.add(box(0.5, 0.5, 0.48, skin, 0, 0.27, 0));
  head.add(box(0.54, 0.16, 0.52, hair, 0, 0.5, -0.01));
  head.add(box(0.54, 0.34, 0.14, hair, 0, 0.34, -0.2));
  for (const s of [1, -1]) {
    head.add(box(0.08, 0.1, 0.02, '#1d1a22', s * 0.11, 0.3, 0.245));
    head.add(box(0.03, 0.03, 0.01, '#ffffff', s * 0.11 + 0.02, 0.32, 0.256));
  }
  head.add(box(0.07, 0.07, 0.04, '#e0a985', 0, 0.22, 0.25)); // nose
  if (beard) head.add(box(0.46, 0.22, 0.12, beard, 0, 0.08, 0.22));
  if (hat === 'hood') {
    head.add(box(0.6, 0.3, 0.56, shirt, 0, 0.52, -0.03));
  } else if (hat === 'wizard') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.7, 6), mat(shirt));
    cone.position.set(0, 0.85, 0); cone.castShadow = true;
    head.add(cone);
    head.add(box(0.8, 0.06, 0.8, shirt, 0, 0.53, 0));
  } else if (hat === 'straw') {
    head.add(box(0.78, 0.05, 0.78, '#d9b45a', 0, 0.55, 0));
    head.add(box(0.48, 0.16, 0.48, '#d9b45a', 0, 0.64, 0));
  }

  const arm = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.41, 0.62, 0);
    g.add(box(0.19, 0.5, 0.21, shirt, 0, -0.22, 0));
    g.add(box(0.17, 0.16, 0.19, skin, 0, -0.54, 0));
    torso.add(g);
    return g;
  };
  const armL = arm(1), armR = arm(-1);

  let blade = null;
  if (sword) {
    const s = new THREE.Group();
    s.position.set(0, -0.58, 0.05);
    s.rotation.x = Math.PI / 2;
    s.add(box(0.06, 0.16, 0.06, '#5a3b22', 0, 0, 0));
    s.add(box(0.3, 0.05, 0.08, '#c9a74a', 0, 0.1, 0));
    blade = box(0.08, 0.86, 0.025, '#dfe7ee', 0, 0.55, 0);
    blade.material.emissive = new THREE.Color('#223344');
    s.add(blade);
    armR.add(s);
  }
  if (shield) {
    const sh = box(0.08, 0.5, 0.42, '#8b2f2f', 0.12, -0.36, 0);
    sh.add(box(0.02, 0.18, 0.18, '#e3c062', 0.05, 0, 0));
    armL.add(sh);
  }
  if (cape) {
    const c = box(0.58, 0.95, 0.05, cape, 0, -0.1, -0.21);
    c.geometry.translate(0, -0.35, 0);
    c.position.y = 0.66;
    torso.add(c);
    root.userData.cape = c;
  }

  root.userData.rig = { body, legL, legR, armL, armR, torso, head, blade };
  return root;
}

// Moves the limbs. `move` 0..1 is how fast they're going, `t` is time in s.
export function animatePerson(person, t, move, opts = {}) {
  const r = person.userData.rig;
  const swing = Math.sin(t * (opts.stride || 9)) * 0.8 * move;
  r.legL.rotation.x = swing;
  r.legR.rotation.x = -swing;
  r.armL.rotation.x = -swing * 0.8;
  r.armR.rotation.x = swing * 0.8;
  r.armL.rotation.z = 0.05;
  r.armR.rotation.z = -0.05;
  r.body.position.y = Math.abs(Math.sin(t * (opts.stride || 9))) * 0.08 * move + Math.sin(t * 2) * 0.01;
  r.head.rotation.y = opts.look || 0;
  if (person.userData.cape) person.userData.cape.rotation.x = 0.12 + move * 0.45 + Math.sin(t * 7) * 0.05 * move;
  if (opts.swim) {
    r.legL.rotation.x = Math.sin(t * 5) * 0.5;
    r.legR.rotation.x = -Math.sin(t * 5) * 0.5;
    r.armL.rotation.x = -1.2 + Math.sin(t * 5) * 0.6;
    r.armR.rotation.x = -1.2 - Math.sin(t * 5) * 0.6;
  }
  if (opts.air) {
    r.legL.rotation.x = -0.5; r.legR.rotation.x = 0.3;
    r.armL.rotation.x = -0.6; r.armR.rotation.x = -0.6;
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
