// Thick, swaying grass drawn by the graphics card. The blades fill a square
// around the hero and wrap round as they walk, so the grass seems endless;
// how thick it grows and its colour come from the ground texture.
import * as THREE from 'three';
import { terrainTextures, HEIGHT_GLSL, heightUniforms } from './terrain.js';
import { timeUniform } from './materials.js';
import { mulberry32 } from './noise.js';

export const GRASS = { count: 70000, size: 64 };

export function buildGrass() {
  const rand = mulberry32(8);
  // One blade: a tapered strip in 4 segments, 0..1 tall.
  const segs = 4, pos = [], uv = [], index = [];
  for (let k = 0; k <= segs; k++) {
    const t = k / segs, w = 0.5 * (1 - Math.pow(t, 1.4));
    pos.push(-w, t, 0, w, t, 0);
    uv.push(0, t, 1, t);
  }
  for (let k = 0; k < segs; k++) {
    const a = k * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  const off = new Float32Array(GRASS.count * 2), prm = new Float32Array(GRASS.count * 4);
  for (let i = 0; i < GRASS.count; i++) {
    off[i * 2] = rand() * GRASS.size;
    off[i * 2 + 1] = rand() * GRASS.size;
    const tall = rand() < 0.08;
    prm.set([rand() * Math.PI * 2, tall ? 0.6 + rand() * 0.3 : 0.25 + rand() * 0.3, 0.07 + rand() * 0.05, rand()], i * 4);
  }
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 2));
  geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(prm, 4));
  geo.instanceCount = GRASS.count;

  const t = terrainTextures();
  const uniforms = {
    ...heightUniforms(),
    uGround: { value: t.groundTex },
    uTime: timeUniform,
    uCenter: { value: new THREE.Vector2() },
    uPlayer: { value: new THREE.Vector3() },
    uSize: { value: GRASS.size },
    uLight: { value: new THREE.Color(1, 1, 1) },
    uFogColor: { value: new THREE.Color() },
    uFogNear: { value: 60 }, uFogFar: { value: 300 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide,
    vertexShader: `
      ${HEIGHT_GLSL}
      attribute vec2 aOffset; attribute vec4 aParams;
      uniform sampler2D uGround; uniform float uTime; uniform vec2 uCenter; uniform vec3 uPlayer; uniform float uSize;
      varying float vT; varying vec3 vColor; varying float vDepth; varying float vRand;
      void main() {
        vec2 wp = uCenter + (fract((aOffset - uCenter) / uSize + 0.5) - 0.5) * uSize;
        vec4 g = texture2D(uGround, ((wp + uHalf) / uCell + 0.5) / (uN + 1.0));
        float dist = length(wp - uCenter);
        float fade = 1.0 - smoothstep(uSize * 0.3, uSize * 0.48, dist);
        float keep = step(aParams.w, g.a * 1.15);
        float h = aParams.y * (0.6 + 0.5 * g.a) * fade * keep;
        float t = position.y;
        float c = cos(aParams.x), s = sin(aParams.x);
        vec3 p = vec3(position.x * aParams.z * c, t * h, position.x * aParams.z * s);
        vec2 wind = vec2(sin(uTime * 1.6 + wp.x * 0.13 + wp.y * 0.05), cos(uTime * 1.2 + wp.y * 0.12)) * 0.22
                  + vec2(0.18, 0.08) * sin(uTime * 2.7 + wp.x * 0.45 + wp.y * 0.3);
        vec2 away = wp - uPlayer.xz; float pd = length(away);
        vec2 push = pd < 1.3 ? normalize(away + 1e-4) * (1.3 - pd) * 1.1 : vec2(0.0);
        vec3 world = vec3(wp.x, groundHeight(wp) - 0.04, wp.y) + p;
        world.xz += (wind + push) * t * t * h;
        world.y -= length(push) * t * t * h * 0.5;
        vec4 mv = viewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mv;
        vT = t; vColor = g.rgb; vDepth = -mv.z; vRand = aParams.w;
      }`,
    fragmentShader: `
      uniform vec3 uLight; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
      varying float vT; varying vec3 vColor; varying float vDepth; varying float vRand;
      void main() {
        vec3 base = vColor * 0.62;
        vec3 tip = vColor * (1.18 + vRand * 0.25) + vec3(0.05, 0.06, 0.0);
        vec3 col = mix(base, tip, smoothstep(0.0, 1.0, vT)) * uLight;
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vDepth));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.name = 'grass';
  mesh.userData.uniforms = uniforms;
  return mesh;
}
