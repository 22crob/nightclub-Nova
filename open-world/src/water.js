// Cartoon water: clear and turquoise in the shallows, deep blue further out,
// white foam along the shore, gentle ripples and sun sparkles.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { HEIGHT_GLSL, heightUniforms } from './terrain.js';
import { timeUniform } from './materials.js';

export function buildWater() {
  const geo = new THREE.PlaneGeometry(WORLD.size * 1.5, WORLD.size * 1.5, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const uniforms = {
    ...heightUniforms(),
    uTime: timeUniform,
    uWater: { value: WORLD.waterLevel },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSky: { value: new THREE.Color('#bfe0f7') },
    uLight: { value: new THREE.Color(1, 1, 1) },
    uSun: { value: 1 },
    uFogColor: { value: new THREE.Color() },
    uFogNear: { value: 60 }, uFogFar: { value: 300 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      varying vec3 vWorld; varying float vDepth;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vec4 mv = viewMatrix * w;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      ${HEIGHT_GLSL}
      uniform float uTime; uniform float uWater; uniform vec3 uSunDir; uniform vec3 uSky; uniform vec3 uLight; uniform float uSun;
      uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
      varying vec3 vWorld; varying float vDepth;
      void main() {
        vec2 p = vWorld.xz;
        float depth = uWater - groundHeight(p);
        float d = smoothstep(0.0, 3.2, depth);
        vec3 col = mix(vec3(0.16, 0.72, 0.7), vec3(0.015, 0.16, 0.42), d);
        // Ripples.
        float a = p.x * 0.35 + uTime * 1.1, b = p.y * 0.42 - uTime * 0.8, c = (p.x + p.y) * 0.7 + uTime * 1.6;
        vec3 n = normalize(vec3(cos(a) * 0.08 + cos(c) * 0.05, 1.0, cos(b) * 0.08 + cos(c) * 0.05));
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        col = mix(col, uSky * 0.8, fres * 0.3);
        // Little bright ripple lines.
        float lines = sin(p.x * 1.3 + sin(p.y * 0.7 + uTime) * 2.0 + uTime * 0.9) * sin(p.y * 1.1 - uTime * 0.6);
        col += vec3(0.12) * smoothstep(0.82, 0.95, lines) * (1.0 - d * 0.5);
        col *= uLight;
        // Sun sparkles.
        vec3 R = reflect(-normalize(uSunDir), n);
        float spec = pow(max(dot(R, V), 0.0), 200.0);
        col += vec3(1.0, 0.95, 0.8) * smoothstep(0.35, 0.6, spec) * uSun;
        // Foam along the shore.
        float edge = 0.4 + 0.18 * sin(uTime * 1.4 + p.x * 0.9 + p.y * 0.7);
        float foam = 1.0 - smoothstep(edge * 0.55, edge, depth);
        col = mix(col, vec3(1.0) * max(uLight, vec3(0.35)), foam * 0.9);
        float alpha = clamp(mix(0.5, 0.92, d) + foam, 0.0, 1.0);
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vDepth));
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WORLD.waterLevel;
  mesh.name = 'water';
  mesh.userData.uniforms = uniforms;
  return mesh;
}
