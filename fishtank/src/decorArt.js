// Decorations drawn in code, cartoon style with dark outlines. Each one is
// drawn standing on the bottom-centre of its picture, sized for a tank
// about 400 px tall (the game scales them to the tank).
import { seededRand } from './genetics.js';

const OUT = '#1e2a2a';

function outlined(ctx, fill, lw = 3) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function leaf(ctx, x, y, len, lean, width, fill) {
  ctx.beginPath();
  ctx.moveTo(x - width / 2, y);
  ctx.bezierCurveTo(x - width + lean * 0.3, y - len * 0.5, x + lean - width * 0.6, y - len * 0.8, x + lean, y - len);
  ctx.bezierCurveTo(x + lean + width * 0.6, y - len * 0.8, x + width + lean * 0.3, y - len * 0.5, x + width / 2, y);
  ctx.closePath();
  outlined(ctx, fill, 2.5);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 0.4, y - len * 0.6, x + lean, y - len);
  ctx.stroke();
}

function rock(ctx, x, y, w, h, fill) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.bezierCurveTo(x - w / 2, y - h * 0.9, x - w * 0.2, y - h, x + w * 0.05, y - h);
  ctx.bezierCurveTo(x + w * 0.4, y - h, x + w / 2, y - h * 0.6, x + w / 2, y);
  ctx.closePath();
  outlined(ctx, fill);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.12, y - h * 0.7, w * 0.16, h * 0.1, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

const ART = {
  plant: { w: 120, h: 190, draw(ctx, W, H) {
    const greens = ['#3fae55', '#58c96a', '#2f8f45'];
    [[-26, 150, -30], [-10, 175, -8], [8, 165, 18], [24, 140, 34], [-2, 120, 4]].forEach(([dx, len, lean], i) =>
      leaf(ctx, W / 2 + dx, H - 4, len, lean, 20, greens[i % 3]));
  } },
  redplant: { w: 120, h: 170, draw(ctx, W, H) {
    const reds = ['#d8473f', '#ef6b4a', '#b8334a'];
    for (let i = 0; i < 7; i++) {
      const dx = (i - 3) * 9;
      leaf(ctx, W / 2 + dx, H - 4, 110 + (i % 3) * 18, dx * 1.2, 13, reds[i % 3]);
    }
  } },
  rock: { w: 150, h: 90, draw(ctx, W, H) {
    rock(ctx, W / 2 - 30, H - 3, 80, 62, '#8a8f99');
    rock(ctx, W / 2 + 34, H - 3, 66, 46, '#a4a1a0');
    rock(ctx, W / 2 + 4, H - 3, 46, 30, '#767c88');
  } },
  bubbler: { w: 70, h: 70, draw(ctx, W, H) {
    ctx.beginPath();
    ctx.moveTo(W / 2 - 26, H - 3);
    ctx.lineTo(W / 2 - 18, H - 40);
    ctx.lineTo(W / 2 + 18, H - 40);
    ctx.lineTo(W / 2 + 26, H - 3);
    ctx.closePath();
    outlined(ctx, '#5a6b7c');
    ctx.beginPath();
    ctx.ellipse(W / 2, H - 42, 20, 7, 0, 0, Math.PI * 2);
    outlined(ctx, '#7f93a8');
    ctx.fillStyle = '#23303a';
    ctx.beginPath();
    ctx.ellipse(W / 2, H - 42, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } },
  driftwood: { w: 220, h: 130, draw(ctx, W, H) {
    ctx.beginPath();
    ctx.moveTo(20, H - 3);
    ctx.bezierCurveTo(60, H - 50, 90, H - 70, 120, H - 110);
    ctx.lineTo(136, H - 104);
    ctx.bezierCurveTo(118, H - 70, 150, H - 60, 190, H - 70);
    ctx.lineTo(196, H - 58);
    ctx.bezierCurveTo(150, H - 40, 120, H - 30, 110, H - 3);
    ctx.closePath();
    outlined(ctx, '#8a5a34');
    ctx.strokeStyle = 'rgba(40,20,5,0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(40 + i * 16, H - 10 - i * 4);
      ctx.quadraticCurveTo(80 + i * 10, H - 50, 115 + i * 4, H - 92 + i * 8);
      ctx.stroke();
    }
  } },
  castle: { w: 160, h: 170, draw(ctx, W, H) {
    const stone = '#c9b48f', dark = '#a18c6a';
    const tower = (x, w, h) => {
      ctx.beginPath();
      ctx.moveTo(x - w / 2, H - 3);
      ctx.lineTo(x - w / 2, H - h);
      for (let i = 0; i < 3; i++) {
        const bx = x - w / 2 + (i * w) / 3;
        ctx.lineTo(bx, H - h - 12);
        ctx.lineTo(bx + w / 6, H - h - 12);
        ctx.lineTo(bx + w / 6, H - h);
        ctx.lineTo(bx + w / 3, H - h);
      }
      ctx.lineTo(x + w / 2, H - 3);
      ctx.closePath();
      outlined(ctx, stone);
    };
    tower(W / 2 - 46, 44, 120);
    tower(W / 2 + 46, 44, 120);
    tower(W / 2, 70, 92);
    ctx.beginPath();
    ctx.moveTo(W / 2 - 16, H - 3);
    ctx.lineTo(W / 2 - 16, H - 36);
    ctx.arc(W / 2, H - 36, 16, Math.PI, 0);
    ctx.lineTo(W / 2 + 16, H - 3);
    outlined(ctx, '#2a2420');
    ctx.fillStyle = dark;
    for (const [x, y] of [[-46, 80], [46, 80], [-46, 40], [46, 40], [0, 70]]) {
      ctx.fillStyle = '#2a2420';
      ctx.fillRect(W / 2 + x - 5, H - y - 16, 10, 16);
    }
    ctx.beginPath();
    ctx.moveTo(W / 2 + 46, H - 132);
    ctx.lineTo(W / 2 + 46, H - 162);
    ctx.lineTo(W / 2 + 70, H - 154);
    ctx.lineTo(W / 2 + 46, H - 146);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.fillStyle = '#ff5c7a';
    ctx.fill();
    ctx.stroke();
  } },
  starfish: { w: 90, h: 60, draw(ctx, W, H) {
    ctx.save();
    ctx.translate(W / 2, H - 22);
    ctx.scale(1, 0.55);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 15 : 40;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.restore();
    outlined(ctx, '#ff7a45');
    ctx.fillStyle = '#ffd0a0';
    const r = seededRand(3);
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(W / 2 + (r() - 0.5) * 50, H - 22 + (r() - 0.5) * 22, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  } },
  coral: { w: 150, h: 180, draw(ctx, W, H) {
    const branch = (x, y, len, ang, w, depth) => {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      ctx.strokeStyle = OUT;
      ctx.lineWidth = w + 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = depth % 2 ? '#ff6f9c' : '#ff8fb3';
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (depth > 0) {
        branch(x2, y2, len * 0.72, ang - 0.5, w * 0.78, depth - 1);
        branch(x2, y2, len * 0.72, ang + 0.45, w * 0.78, depth - 1);
      }
    };
    branch(W / 2, H - 4, 52, -Math.PI / 2, 16, 3);
  } },
  braincoral: { w: 130, h: 90, draw(ctx, W, H) {
    ctx.beginPath();
    ctx.ellipse(W / 2, H - 3, 58, 72, 0, Math.PI, 0);
    ctx.closePath();
    outlined(ctx, '#d9b25a');
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(110,70,20,0.6)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      for (let x = -60; x <= 60; x += 6) ctx.lineTo(W / 2 + x, H - 12 - i * 12 + Math.sin(x * 0.18 + i) * 5);
      ctx.stroke();
    }
    ctx.restore();
  } },
  chest: { w: 130, h: 110, draw(ctx, W, H) {
    ctx.beginPath();
    ctx.rect(W / 2 - 50, H - 58, 100, 55);
    outlined(ctx, '#8b5a2b');
    ctx.save();
    ctx.translate(W / 2 - 50, H - 58);
    ctx.rotate(-0.45);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -28);
    ctx.quadraticCurveTo(50, -50, 100, -28);
    ctx.lineTo(100, 0);
    ctx.closePath();
    outlined(ctx, '#a06a33');
    ctx.restore();
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(W / 2 - 36 + i * 9, H - 60 - (i % 3) * 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a07400';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(W / 2 - 50, H - 40, 100, 7);
    ctx.fillRect(W / 2 - 6, H - 46, 12, 16);
  } },
  anemone: { w: 130, h: 130, draw(ctx, W, H) {
    for (let i = 0; i < 13; i++) {
      const t = i / 12;
      const ang = -Math.PI + 0.2 + t * (Math.PI - 0.4);
      const x0 = W / 2 + (t - 0.5) * 50;
      const len = 70 + Math.sin(t * Math.PI) * 30;
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, H - 20);
      ctx.quadraticCurveTo(x0 + Math.cos(ang) * len * 0.3, H - 20 - len * 0.6, x0 + Math.cos(ang) * len * 0.6, H - 20 + Math.sin(ang) * len);
      ctx.stroke();
      ctx.strokeStyle = i % 2 ? '#c77dff' : '#e9a3ff';
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.fillStyle = '#ffe0ff';
      ctx.beginPath();
      ctx.arc(x0 + Math.cos(ang) * len * 0.6, H - 20 + Math.sin(ang) * len, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(W / 2, H - 12, 34, 12, 0, 0, Math.PI * 2);
    outlined(ctx, '#8c4fc0');
  } },
  clam: { w: 140, h: 100, draw(ctx, W, H) {
    ctx.beginPath();
    ctx.ellipse(W / 2, H - 22, 62, 22, 0, 0, Math.PI * 2);
    outlined(ctx, '#5bb3b0');
    ctx.beginPath();
    ctx.moveTo(W / 2 - 62, H - 26);
    ctx.quadraticCurveTo(W / 2, H - 120, W / 2 + 62, H - 26);
    ctx.closePath();
    outlined(ctx, '#7fd3cf');
    ctx.strokeStyle = 'rgba(0,60,60,0.35)';
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 4, H - 28);
      ctx.lineTo(W / 2 + i * 17, H - 70 + Math.abs(i) * 7);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(W / 2, H - 28, 10, 0, Math.PI * 2);
    outlined(ctx, '#f5f2ff', 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(W / 2 - 3, H - 31, 3, 0, Math.PI * 2);
    ctx.fill();
  } },
  seafan: { w: 160, h: 190, draw(ctx, W, H) {
    ctx.beginPath();
    ctx.moveTo(W / 2 - 6, H - 3);
    ctx.lineTo(W / 2 - 4, H - 40);
    ctx.bezierCurveTo(W / 2 - 80, H - 60, W / 2 - 80, H - 185, W / 2, H - 185);
    ctx.bezierCurveTo(W / 2 + 80, H - 185, W / 2 + 80, H - 60, W / 2 + 4, H - 40);
    ctx.lineTo(W / 2 + 6, H - 3);
    ctx.closePath();
    outlined(ctx, '#ff9f45');
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(150,50,0,0.45)';
    ctx.lineWidth = 2;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2, H - 40);
      ctx.quadraticCurveTo(W / 2 + i * 14, H - 110, W / 2 + i * 20, H - 190);
      ctx.stroke();
    }
    for (let y = 60; y < 190; y += 16) {
      ctx.beginPath();
      ctx.arc(W / 2, H - 30, y, Math.PI, 0);
      ctx.stroke();
    }
    ctx.restore();
  } },
  ship: { w: 300, h: 200, draw(ctx, W, H) {
    ctx.save();
    ctx.translate(W / 2, H - 6);
    ctx.rotate(-0.12);
    ctx.beginPath();
    ctx.moveTo(-130, -70);
    ctx.lineTo(120, -80);
    ctx.lineTo(95, 0);
    ctx.lineTo(-110, 0);
    ctx.closePath();
    outlined(ctx, '#6b4428');
    ctx.strokeStyle = 'rgba(30,15,5,0.45)';
    ctx.lineWidth = 2;
    for (let y = -60; y < 0; y += 14) {
      ctx.beginPath();
      ctx.moveTo(-120, y);
      ctx.lineTo(110, y - 6);
      ctx.stroke();
    }
    ctx.fillStyle = '#1f1610';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-70 + i * 45, -42, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.rect(-12, -190, 12, 112);
    outlined(ctx, '#5a3a20');
    ctx.beginPath();
    ctx.moveTo(0, -180);
    ctx.quadraticCurveTo(55, -150, 40, -105);
    ctx.lineTo(0, -110);
    ctx.closePath();
    outlined(ctx, 'rgba(230,220,190,0.85)');
    ctx.beginPath();
    ctx.moveTo(-120, -72);
    ctx.lineTo(-150, -110);
    ctx.lineTo(-138, -114);
    ctx.lineTo(-110, -74);
    outlined(ctx, '#5a3a20');
    ctx.restore();
  } },
};

export const decorSize = (key) => ({ w: ART[key].w, h: ART[key].h });

export function drawDecorCanvas(key) {
  const a = ART[key];
  const c = document.createElement('canvas');
  c.width = a.w;
  c.height = a.h;
  a.draw(c.getContext('2d'), a.w, a.h);
  return c;
}

export function decorTexture(scene, key) {
  const tk = `decor_${key}`;
  if (!scene.textures.exists(tk)) scene.textures.addCanvas(tk, drawDecorCanvas(key));
  return tk;
}

const thumbs = new Map();
export function decorThumb(key) {
  if (!thumbs.has(key)) thumbs.set(key, drawDecorCanvas(key).toDataURL());
  return thumbs.get(key);
}
