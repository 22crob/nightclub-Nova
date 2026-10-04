// Hover tips for the HUD: buttons show only an icon, and hovering one pops
// up its name and what it does. Any element with data-tip-name (and
// optionally data-tip-text, a description) gets one; the text is read on
// every hover, so code can change it to show live state ("Ready in 1:20").
// Touch screens get the same tip on a long press.

let tip = null;
let current = null;

function ensureTip() {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.id = 'hoverTip';
  tip.innerHTML = '<div class="tipName"></div><div class="tipText"></div>';
  document.body.appendChild(tip);
  return tip;
}

function show(el) {
  const t = ensureTip();
  const name = el.dataset.tipName || '';
  const text = el.dataset.tipText || '';
  t.querySelector('.tipName').textContent = name;
  const body = t.querySelector('.tipText');
  body.textContent = text;
  body.style.display = text ? '' : 'none';
  t.classList.add('show');
  // Above the element if it sits low on the screen, else below it; kept
  // inside the window.
  const r = el.getBoundingClientRect();
  const tw = t.offsetWidth;
  const th = t.offsetHeight;
  const below = r.top + r.height / 2 < window.innerHeight / 2;
  const x = Math.min(window.innerWidth - tw - 8, Math.max(8, r.left + r.width / 2 - tw / 2));
  const y = below ? r.bottom + 10 : r.top - th - 10;
  t.style.left = `${x}px`;
  t.style.top = `${Math.max(8, y)}px`;
  t.dataset.side = below ? 'below' : 'above';
  t.style.setProperty('--arrow-x', `${r.left + r.width / 2 - x}px`);
  current = el;
}

export function hideTip() {
  if (tip) tip.classList.remove('show');
  current = null;
}

// Refreshes the open tip (after code changes the hovered element's text).
export function refreshTip(el) {
  if (current && current === el) show(el);
}

export function setupTooltips() {
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest?.('[data-tip-name]');
    if (el === current) return;
    if (el) show(el);
    else hideTip();
  });
  document.addEventListener('mouseleave', hideTip);
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') { hideTip(); return; }
    const el = e.target.closest?.('[data-tip-name]');
    if (!el) { hideTip(); return; }
    const timer = setTimeout(() => show(el), 450);
    const cancel = () => clearTimeout(timer);
    el.addEventListener('pointerup', cancel, { once: true });
    el.addEventListener('pointercancel', cancel, { once: true });
  });
}
