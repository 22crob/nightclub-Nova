// ClubScene methods: the club's name and its big neon sign outside.
// A new club (or an old save without a name) is asked for one first
// (#namePrompt); the name goes up in lights on a sign standing on top of the
// right wall, at the wall's angle (the left wall is kept clear for the line
// outside). Clicking the sign renames the club. Saved as `clubName`.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
import { CLUB_SIGN, TILE_H, TILE_W, WALL_HEIGHT, WALL_THICKNESS } from '../config.js';
import { SFX } from '../sfx.js';

// Tidies what the player typed: single spaces, at most CLUB_SIGN.maxLength.
export function cleanClubName(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, CLUB_SIGN.maxLength);
}

// The sign, flat: a dark board with a purple frame, chasing bulbs round the
// edge, and the name in pink neon. Returns { canvas, w, h }.
function flatSign(name, lit, postsTall) {
  const R = CLUB_SIGN.resolution;
  const font = `900 ${CLUB_SIGN.fontSize * R}px 'Arial Black', 'Arial Rounded MT Bold', Arial, sans-serif`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const textW = probe.measureText(name).width;
  const pad = 26 * R;
  const boardH = CLUB_SIGN.fontSize * R * 1.75;
  const legs = postsTall * R;
  const w = Math.ceil(textW + pad * 2);
  const h = Math.ceil(boardH + legs);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  // Two short posts down to the wall top, with a little shine and a foot each.
  for (const x of [w * 0.2, w * 0.8]) {
    g.fillStyle = '#1b1324';
    g.fillRect(x - 4 * R, boardH - 2, 8 * R, legs + 2);
    g.fillStyle = '#4b3a63';
    g.fillRect(x - 2 * R, boardH, 2 * R, legs - 4 * R);
    g.fillStyle = '#1b1324';
    g.fillRect(x - 9 * R, h - 4 * R, 18 * R, 4 * R);
  }
  // Board and frame.
  const r = 14 * R;
  const round = (x, y, bw, bh, rad) => {
    g.beginPath();
    g.moveTo(x + rad, y);
    g.arcTo(x + bw, y, x + bw, y + bh, rad);
    g.arcTo(x + bw, y + bh, x, y + bh, rad);
    g.arcTo(x, y + bh, x, y, rad);
    g.arcTo(x, y, x + bw, y, rad);
    g.closePath();
  };
  round(2 * R, 2 * R, w - 4 * R, boardH - 4 * R, r);
  g.fillStyle = '#140b20';
  g.fill();
  g.lineWidth = 5 * R;
  g.strokeStyle = '#7b30e2';
  g.stroke();
  round(9 * R, 9 * R, w - 18 * R, boardH - 18 * R, r * 0.6);
  g.lineWidth = 2 * R;
  g.strokeStyle = '#ff4fd8';
  g.shadowColor = '#ff4fd8';
  g.shadowBlur = lit ? 10 * R : 4 * R;
  g.stroke();
  g.shadowBlur = 0;
  // Bulbs along the top and bottom, every other one lit (they chase).
  const n = Math.max(6, Math.round(w / (22 * R)));
  for (let i = 0; i < n; i++) {
    const x = 16 * R + (i * (w - 32 * R)) / (n - 1);
    for (const [y, k] of [[5.5 * R, i], [boardH - 5.5 * R, i + 1]]) {
      const on = (k % 2 === 0) === lit;
      g.beginPath();
      g.arc(x, y, 2.6 * R, 0, Math.PI * 2);
      g.fillStyle = on ? '#fff2a8' : '#7a5a22';
      g.shadowColor = '#ffd84a';
      g.shadowBlur = on ? 8 * R : 0;
      g.fill();
    }
  }
  g.shadowBlur = 0;
  // The name in neon: a wide pink glow, a pink tube, a white-hot core.
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const tx = w / 2;
  const ty = boardH / 2 + R;
  g.shadowColor = '#ff2fc8';
  g.shadowBlur = (lit ? 22 : 12) * R;
  g.lineWidth = 7 * R;
  g.strokeStyle = '#ff4fd8';
  g.strokeText(name, tx, ty);
  g.shadowBlur = (lit ? 10 : 5) * R;
  g.fillStyle = '#ffd6f6';
  g.fillText(name, tx, ty);
  g.shadowBlur = 0;
  g.lineWidth = 1.5 * R;
  g.strokeStyle = '#ffffff';
  g.strokeText(name, tx, ty);
  return { canvas: c, w, h };
}

// The flat sign slanted onto the right wall's plane: going right along the
// sign goes along the wall toward the front, which drops half as fast on
// screen.
function slantedSign(name, lit) {
  const { canvas, w, h } = flatSign(name, lit, CLUB_SIGN.postsTall);
  const drop = w * (TILE_H / TILE_W);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = Math.ceil(h + drop);
  const g = c.getContext('2d');
  g.setTransform(1, TILE_H / TILE_W, 0, 1, 0, 0);
  g.drawImage(canvas, 0, 0);
  return { canvas: c, footY: h };
}

export class ClubNameMixin {
  setupClubName() {
    const box = document.getElementById('namePrompt');
    const input = document.getElementById('clubNameInput');
    if (!box || !input) return;
    // Typing a name mustn't turn furniture or zoom the club.
    for (const type of ['keydown', 'keyup', 'keypress']) input.addEventListener(type, (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.confirmClubName(); });
    document.getElementById('clubNameOk')?.addEventListener('click', () => this.confirmClubName());
    document.getElementById('clubNameCancel')?.addEventListener('click', () => box.classList.remove('open'));
    this.drawClubSign();
    if (!this.clubName) this.promptClubName(true);
  }

  // Opens the name box: `first` for a club that has no name yet (it can't
  // be skipped), otherwise to rename it.
  promptClubName(first = false) {
    const box = document.getElementById('namePrompt');
    const input = document.getElementById('clubNameInput');
    if (!box || !input) return;
    box.classList.toggle('first', first);
    document.getElementById('namePromptTitle').textContent = first ? 'Name your club!' : 'Rename your club';
    input.value = this.clubName || '';
    box.classList.add('open');
    setTimeout(() => { input.focus(); input.select(); }, 50);
  }

  confirmClubName() {
    const input = document.getElementById('clubNameInput');
    this.setClubName(cleanClubName(input && input.value) || CLUB_SIGN.defaultName);
    document.getElementById('namePrompt')?.classList.remove('open');
    SFX.levelUp();
    this.showBigPopup?.(this.clubName, 'Now open!', 'celeb');
    this.time.delayedCall(2000, () => this.showDaily?.()); // a new club's first gift, once the name has had its moment
  }

  setClubName(name) {
    this.clubName = cleanClubName(name) || CLUB_SIGN.defaultName;
    document.title = this.clubName;
    this.drawClubSign();
    this.saveGame();
  }

  // Puts the sign up (again): standing on the right wall's top, from near
  // the back corner toward the front, sized to fit the wall. Redrawn when
  // the club grows (see buildWalls()).
  drawClubSign() {
    if (this.clubSign) { this.clubSign.destroy(); this.clubSign = null; }
    if (this.signFlicker) { this.signFlicker.remove(); this.signFlicker = null; }
    if (!this.clubName || !this.wallLayer) return;
    let footY = 0;
    for (const lit of [true, false]) {
      const key = `clubSign_${lit ? 'on' : 'off'}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      const made = slantedSign(this.clubName, lit);
      footY = made.footY;
      this.textures.addCanvas(key, made.canvas);
    }
    const R = CLUB_SIGN.resolution;
    const tex = this.textures.get('clubSign_on').getSourceImage();
    const start = CLUB_SIGN.fromBack;                        // the sign's back end, along the wall (gx)
    const room = (this.gridW - 0.5 - start) * (TILE_W / 2) * 0.92; // how wide it may be on screen
    const scale = Math.min(1 / R, room / tex.width);
    const gy = -0.5 - WALL_THICKNESS / 2;                     // the middle of the wall's top
    const [sx, sy] = this.gridPoint(start, gy, WALL_HEIGHT);
    // Its bottom-left corner (the back end, at the foot of the posts) sits on the wall top.
    const img = this.add.image(sx, sy + 2, 'clubSign_on').setOrigin(0, footY / tex.height).setScale(scale);
    img.setInteractive({ pixelPerfect: true, useHandCursor: true });
    img.on('pointerup', (p) => { if (!this.selectedProp && !p.event.defaultPrevented) this.promptClubName(false); });
    this.wallLayer.add(img);
    this.clubSign = img;
    // The bulbs chase.
    this.signFlicker = this.time.addEvent({
      delay: CLUB_SIGN.chaseMs, loop: true,
      callback: () => { if (this.clubSign) this.clubSign.setTexture(this.clubSign.texture.key === 'clubSign_on' ? 'clubSign_off' : 'clubSign_on'); },
    });
  }
}
