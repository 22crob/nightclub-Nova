// Keyboard, mouse and touch. Dragging looks around; a click without a drag
// swings the sword. On touch screens there's a stick and buttons.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();     // keys pressed since the last frame
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.clicked = false;
    this.stick = { x: 0, z: 0 };
    this.enabled = true;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      this.pressed.add(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    let down = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      down = { x: e.clientX, y: e.clientY, moved: 0 };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!down || e.pointerType === 'touch') return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down.moved += Math.abs(dx) + Math.abs(dy);
      down.x = e.clientX; down.y = e.clientY;
      this.look.dx += dx; this.look.dy += dy;
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') return;
      if (down && down.moved < 6 && e.button === 0) this.clicked = true;
      down = null;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

    this.setupTouch(canvas);
  }

  setupTouch(canvas) {
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    if (!stick) return;
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (isTouch) { document.body.classList.add('touch'); document.getElementById('touch').classList.remove('hidden'); }

    let stickId = null, centre = null;
    const moveKnob = (x, z) => { knob.style.transform = `translate(${x * 40}px, ${z * 40}px)`; };
    stick.addEventListener('pointerdown', (e) => {
      stickId = e.pointerId;
      const r = stick.getBoundingClientRect();
      centre = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      stick.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId !== stickId) return;
      let x = (e.clientX - centre.x) / 55, z = (e.clientY - centre.y) / 55;
      const l = Math.hypot(x, z);
      if (l > 1) { x /= l; z /= l; }
      this.stick.x = x; this.stick.z = z;
      moveKnob(x, z);
    });
    const end = (e) => { if (e.pointerId === stickId) { stickId = null; this.stick.x = this.stick.z = 0; moveKnob(0, 0); } };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);

    // Dragging anywhere else on the screen looks around.
    const looks = new Map();
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') looks.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
    canvas.addEventListener('pointermove', (e) => {
      const l = looks.get(e.pointerId);
      if (!l) return;
      this.look.dx += (e.clientX - l.x) * 1.4; this.look.dy += (e.clientY - l.y) * 1.4;
      l.x = e.clientX; l.y = e.clientY;
    });
    const lend = (e) => looks.delete(e.pointerId);
    canvas.addEventListener('pointerup', lend);
    canvas.addEventListener('pointercancel', lend);

    const btn = (id, key) => {
      const b = document.getElementById(id);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.keys.add(key); this.pressed.add(key); });
      const up = () => this.keys.delete(key);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    };
    btn('tAttack', 'f');
    btn('tJump', ' ');
    btn('tUse', 'e');
  }

  down(...ks) { return ks.some((k) => this.keys.has(k)); }
  tapped(...ks) { return ks.some((k) => this.pressed.has(k)); }

  // Wanted movement in camera space: x right, z back (so W is z = -1).
  move() {
    let x = (this.down('d', 'arrowright') ? 1 : 0) - (this.down('a', 'arrowleft') ? 1 : 0);
    let z = (this.down('s', 'arrowdown') ? 1 : 0) - (this.down('w', 'arrowup') ? 1 : 0);
    x += this.stick.x; z += this.stick.z;
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    return { x, z };
  }

  endFrame() {
    this.pressed.clear();
    this.look.dx = this.look.dy = 0;
    this.zoom = 0;
    this.clicked = false;
  }
}
