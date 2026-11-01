// Day and night: the sky dome, sun and moon light, fog and stars.
import * as THREE from 'three';
import { DAY } from './config.js';
import { smoothstep, mulberry32 } from './noise.js';

const KEYS = [
  // time, sky top, horizon, sun colour, sun strength, ambient strength
  [0.0, '#070b22', '#141c3c', '#8fa6ff', 0.0, 0.32],
  [0.21, '#0b1233', '#22284a', '#8fa6ff', 0.0, 0.32],
  [0.26, '#4a5d9c', '#ff9d6b', '#ffb07a', 1.2, 0.6],
  [0.32, '#4f95e0', '#bfe0f7', '#fff1d6', 2.6, 1.0],
  [0.5, '#3f8ae0', '#c8e6fa', '#ffffff', 3.0, 1.1],
  [0.68, '#4f95e0', '#bfe0f7', '#fff1d6', 2.6, 1.0],
  [0.74, '#5a5a9c', '#ff8a55', '#ff9a5c', 1.2, 0.6],
  [0.79, '#0b1233', '#22284a', '#8fa6ff', 0.0, 0.32],
  [1.0, '#070b22', '#141c3c', '#8fa6ff', 0.0, 0.32],
].map(([t, top, hor, sun, s, a]) => ({ t, top: new THREE.Color(top), hor: new THREE.Color(hor), sun: new THREE.Color(sun), s, a }));

export class Sky {
  constructor(scene) {
    this.time = DAY.start;
    this.top = new THREE.Color();
    this.horizon = new THREE.Color();

    this.uniforms = {
      top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, night: { value: 0 },
    };
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform float night; varying vec3 vDir;
          void main(){
            float h = max(vDir.y, 0.0);
            vec3 col = mix(horizon, top, pow(h, 0.55));
            if (vDir.y < 0.0) col = horizon * (1.0 + vDir.y * 0.6);
            float d = dot(normalize(vDir), normalize(sunDir));
            col += vec3(1.0, 0.85, 0.6) * smoothstep(0.9965, 0.9985, d) * (1.0 - night);
            col += vec3(1.0, 0.8, 0.55) * pow(max(d, 0.0), 24.0) * 0.25 * (1.0 - night);
            col += vec3(0.85, 0.9, 1.0) * smoothstep(0.9975, 0.999, -d) * night;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.dome.renderOrder = -1;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // Stars.
    const rand = mulberry32(5);
    const pts = [];
    for (let i = 0; i < 1400; i++) {
      const u = rand() * 2 - 1, a = rand() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.05, r = Math.sqrt(1 - y * y);
      pts.push(Math.cos(a) * r * 850, y * 850, Math.sin(a) * r * 850);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    this.sun = new THREE.DirectionalLight('#ffffff', 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#cfe6ff', '#5b6b3a', 1);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog('#bfe0f7', 70, 330);
    this.scene = scene;
    this.night = 0;
  }

  // 0 = midnight ... 0.5 = noon.
  setTime(t) { this.time = ((t % 1) + 1) % 1; }
  clockText() {
    const mins = Math.floor(this.time * 24 * 60);
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  update(dt, center, camPos) {
    this.setTime(this.time + dt / DAY.lengthS);
    const t = this.time;
    let i = 0;
    while (KEYS[i + 1].t < t) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const k = (t - a.t) / (b.t - a.t);
    this.top.copy(a.top).lerp(b.top, k);
    this.horizon.copy(a.hor).lerp(b.hor, k);
    this.uniforms.top.value.copy(this.top);
    this.uniforms.horizon.value.copy(this.horizon);
    this.scene.fog.color.copy(this.horizon);

    // The sun goes round east to west; at night the moon (opposite) lights the land.
    const ang = (t - 0.25) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    this.uniforms.sunDir.value.copy(sunDir);
    const day = smoothstep(-0.08, 0.15, sunDir.y);
    this.night = 1 - day;
    this.uniforms.night.value = this.night;
    const lightDir = day > 0.02 ? sunDir : sunDir.clone().negate();
    lightDir.y = Math.max(lightDir.y, 0.25);
    this.sun.position.copy(center).addScaledVector(lightDir.normalize(), 120);
    this.sun.target.position.copy(center);
    this.sun.color.copy(a.sun).lerp(b.sun, k);
    this.sun.intensity = (a.s + (b.s - a.s) * k) + this.night * 0.5;
    this.hemi.intensity = a.a + (b.a - a.a) * k;
    this.hemi.color.set(day > 0.5 ? '#cfe6ff' : '#7f8fd0');
    this.stars.material.opacity = smoothstep(0.4, 0.9, this.night);
    this.dome.position.copy(camPos);
    this.stars.position.copy(camPos);
    this.stars.rotation.y = t * Math.PI * 2;
  }
}
