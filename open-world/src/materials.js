// The painterly cartoon look shared by everything: soft banded "toon"
// shading, dark outlines around characters and buildings, and wind.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Light falls off in a few soft bands instead of a smooth gradient.
let ramp = null;
export function toonRamp() {
  if (ramp) return ramp;
  const steps = [70, 120, 175, 215, 240, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  ramp = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.LinearFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

export function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...extra });
}

// Shared clock for everything that moves in the wind.
export const timeUniform = { value: 0 };

// Makes the upper part of a mesh sway (trees, bushes). `from` is the height
// where the sway starts, `amount` how far it moves per metre above that.
export function windy(mat, amount = 0.05, from = 1) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeUniform;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 ip = vec2(modelMatrix[3][0], modelMatrix[3][2]);
      #endif
      float sway = max(0.0, position.y - ${from.toFixed(2)}) * ${amount.toFixed(3)};
      float gust = 0.6 + 0.4 * sin(uTime * 0.4 + ip.x * 0.02);
      transformed.x += sin(uTime * 1.4 + ip.x * 0.13 + ip.y * 0.07) * sway * gust;
      transformed.z += cos(uTime * 1.1 + ip.y * 0.11) * sway * 0.6 * gust;`);
  };
  mat.customProgramCacheKey = () => `wind${amount}_${from}`;
  return mat;
}

// Outlines: a slightly fattened copy drawn inside-out in a dark colour.
const outlineMats = new Map();
export function outlineMaterial(thickness) {
  const key = thickness.toFixed(3);
  if (outlineMats.has(key)) return outlineMats.get(key);
  const m = new THREE.MeshBasicMaterial({ color: '#2b1d24', side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed += normalize(normal) * ${key};`);
  };
  m.customProgramCacheKey = () => `outline${key}`;
  outlineMats.set(key, m);
  return m;
}

export function addOutline(mesh, thickness = 0.03) {
  const o = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness));
  o.raycast = () => {};
  o.userData.outline = true;
  mesh.add(o);
  return o;
}

// A mesh with toon shading, shadows and (optionally) an outline.
export function part(geo, material, { x = 0, y = 0, z = 0, outline = 0.03, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, typeof material === 'string' ? toon(material) : material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  if (outline) addOutline(m, outline);
  return m;
}

export const rbox = (w, h, d, r = 0.08) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
