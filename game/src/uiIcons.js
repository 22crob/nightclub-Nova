// The HUD's drawn icons: small bold glyphs (24x24 SVG) used on buttons
// instead of words, like Nightclub City's round icon buttons. White shapes
// with a few accent colours; style.css gives them a dark outline. Any
// element with data-icon="name" gets its icon filled in by fillIcons().

const W = '#ffffff';
const GOLD = '#ffd24d';
const PINK = '#ff4fa8';
const CYAN = '#5fe3ff';
const INK = '#0a0d14';

const ICONS = {
  // Drop the Bass: a speaker with sound waves.
  bass: `<rect x="2.5" y="4" width="11" height="16" rx="2.2" fill="${W}"/>
    <circle cx="8" cy="14.2" r="3.4" fill="${INK}"/><circle cx="8" cy="14.2" r="1.4" fill="${PINK}"/>
    <circle cx="8" cy="7.8" r="1.5" fill="${INK}"/>
    <path d="M16.2 8.6a4.6 4.6 0 0 1 0 6.8M18.8 6a8.3 8.3 0 0 1 0 12" fill="none" stroke="${W}" stroke-width="2.1" stroke-linecap="round"/>`,
  // Throw a Party: a party popper bursting confetti.
  party: `<path d="M3 21.2 8.2 8.4l7.4 7.4Z" fill="${GOLD}"/>
    <path d="M5.2 15.8l3 3M6.8 11.7l5.5 5.5" stroke="${PINK}" stroke-width="1.6"/>
    <path d="M12.5 7.5c.6-2 2.4-2.6 3-4.6M16.4 11.6c2-.6 2.6-2.4 4.6-3" fill="none" stroke="${CYAN}" stroke-width="1.7" stroke-linecap="round"/>
    <circle cx="11" cy="3.2" r="1.3" fill="${PINK}"/><circle cx="20.6" cy="12.8" r="1.3" fill="${GOLD}"/>
    <circle cx="19.8" cy="4.2" r="1.5" fill="${W}"/><rect x="15.6" y="7.2" width="2" height="2" rx=".4" fill="${GOLD}" transform="rotate(30 16.6 8.2)"/>`,
  // Toolbar.
  shop: `<path d="M4.6 8.2h14.8l-1.3 12a1.6 1.6 0 0 1-1.6 1.4H7.5a1.6 1.6 0 0 1-1.6-1.4Z" fill="${W}"/>
    <path d="M8.8 10.6V6.6a3.2 3.2 0 0 1 6.4 0v4" fill="none" stroke="${W}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="8.8" cy="10.8" r="1.1" fill="${PINK}"/><circle cx="15.2" cy="10.8" r="1.1" fill="${PINK}"/>`,
  decorate: `<rect x="2.5" y="3" width="15" height="6.4" rx="2" fill="${PINK}"/>
    <path d="M17.5 6.2h3v5.2h-8.6v3" fill="none" stroke="${W}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="10.2" y="14" width="3.4" height="7.6" rx="1.4" fill="${W}"/>`,
  expand: `<path d="M4 9.5V4h5.5M14.5 4H20v5.5M20 14.5V20h-5.5M9.5 20H4v-5.5M4.6 4.6l4.6 4.6M19.4 4.6l-4.6 4.6M19.4 19.4l-4.6-4.6M4.6 19.4l4.6-4.6" fill="none" stroke="${W}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`,
  staff: `<circle cx="12" cy="7.2" r="3.9" fill="${W}"/>
    <path d="M4.5 21.5a7.5 7.5 0 0 1 15 0Z" fill="${W}"/>
    <path d="M12 15.6 8.6 13.8v3.6ZM12 15.6l3.4-1.8v3.6Z" fill="${PINK}"/><circle cx="12" cy="15.6" r="1" fill="${PINK}"/>`,
  vip: `<path d="M2.8 7.6 7.4 12 12 4.4l4.6 7.6 4.6-4.4-1.8 11.4H4.6Z" fill="${GOLD}"/>
    <rect x="4.6" y="19.6" width="14.8" height="2" rx=".8" fill="${GOLD}"/>
    <circle cx="12" cy="14.6" r="1.6" fill="${PINK}"/><circle cx="7.6" cy="15.4" r="1.1" fill="${CYAN}"/><circle cx="16.4" cy="15.4" r="1.1" fill="${CYAN}"/>`,
  door: `<path d="M5 21.5V4.2A1.4 1.4 0 0 1 6.4 2.8h11.2A1.4 1.4 0 0 1 19 4.2v17.3" fill="${W}"/>
    <path d="M8 21.5V6h8v15.5" fill="${PINK}"/><circle cx="14" cy="13.6" r="1" fill="${GOLD}"/>
    <path d="M3 21.6h18" stroke="${W}" stroke-width="2" stroke-linecap="round"/>`,
  // Stats.
  fans: `<path d="M12 21C5 15.6 2.4 12.2 2.4 8.7a4.7 4.7 0 0 1 9.6-1.9 4.7 4.7 0 0 1 9.6 1.9c0 3.5-2.6 6.9-9.6 12.3Z" fill="${PINK}"/>`,
  luxury: `<path d="M6.8 3.6h10.4l4.3 5.6L12 21.2 2.5 9.2Z" fill="${CYAN}"/>
    <path d="M2.5 9.2h19M9.2 3.6 7.4 9.2 12 21.2l4.6-12-1.8-5.6" fill="none" stroke="#1d6f88" stroke-width="1.1" stroke-linejoin="round"/>`,
  rating: `<path d="M12 2.4l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.3l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9Z" fill="${GOLD}"/>`,
  patrons: `<circle cx="8.4" cy="7.4" r="3.4" fill="${W}"/><path d="M2 20.5a6.4 6.4 0 0 1 12.8 0Z" fill="${W}"/>
    <circle cx="16.4" cy="8.6" r="2.8" fill="${CYAN}"/><path d="M13.6 20.5a5.4 5.4 0 0 1 8.4-4.5V20.5Z" fill="${CYAN}"/>`,
  // Songs, tips.
  next: `<path d="M3.5 5.5 11 12l-7.5 6.5ZM11 5.5 18.5 12 11 18.5Z" fill="${W}"/><rect x="18.6" y="5.5" width="2.4" height="13" rx=".8" fill="${W}"/>`,
  like: `<path d="M3 10.4h3.6v10.4H3Z" fill="${W}"/>
    <path d="M8.4 10.4 12.2 3.6c1.5 0 2.6 1.1 2.3 2.7l-.6 3.4h5.3a1.8 1.8 0 0 1 1.8 2.1l-1.3 7.2a2 2 0 0 1-2 1.8H8.4Z" fill="${W}"/>`,
  tips: `<circle cx="12" cy="12" r="9.5" fill="${CYAN}"/>
    <path d="M9.2 9.4a2.9 2.9 0 1 1 4.3 2.5c-1 .6-1.5 1.2-1.5 2.4" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="12" cy="17.6" r="1.4" fill="${INK}"/>`,
  // Shop categories.
  bars: `<path d="M3 4h18l-9 9.4Z" fill="${CYAN}"/><path d="M5.6 6.6h12.8" stroke="${W}" stroke-width="1.2"/>
    <path d="M12 13.2v6.4M8 20.6h8" stroke="${W}" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="15.4" cy="6" r="1.7" fill="#7be36b"/><path d="M15.4 6 19.4 1.8" stroke="${W}" stroke-width="1.3"/>`,
  booths: `<path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="${W}" stroke-width="2.4"/>
    <rect x="2.4" y="12.6" width="5.4" height="8.6" rx="2" fill="${PINK}"/><rect x="16.2" y="12.6" width="5.4" height="8.6" rx="2" fill="${PINK}"/>`,
  seating: `<rect x="4.2" y="5.6" width="15.6" height="8" rx="2.4" fill="${PINK}"/>
    <rect x="2" y="10.4" width="4.4" height="8.4" rx="1.8" fill="${W}"/><rect x="17.6" y="10.4" width="4.4" height="8.4" rx="1.8" fill="${W}"/>
    <rect x="5.6" y="12.4" width="12.8" height="5.4" rx="1.4" fill="${W}"/>
    <path d="M4.4 18.6v2.2M19.6 18.6v2.2" stroke="${W}" stroke-width="2" stroke-linecap="round"/>`,
  floors: `<path d="M12 3.5 22 8.6 12 13.7 2 8.6Z" fill="${W}"/>
    <path d="M2 8.6v4l10 5.1 10-5.1v-4L12 13.7Z" fill="#9aa6bb"/>
    <path d="M7 6.05 17 11.15M17 6.05 7 11.15" stroke="${INK}" stroke-width="1.1"/>
    <path d="M12 3.5 17 6.05 12 8.6 7 6.05ZM12 8.6 17 11.15 12 13.7 7 11.15Z" fill="#c9d3e3"/>`,
  dance: `<path d="M12 1.5v3" stroke="${W}" stroke-width="1.6"/><circle cx="12" cy="12" r="7.6" fill="#dfe6f0"/>
    <path d="M4.4 12h15.2M5.6 8h12.8M5.6 16h12.8M12 4.4v15.2M8.2 5.4c-1.6 4.2-1.6 9 0 13.2M15.8 5.4c1.6 4.2 1.6 9 0 13.2" fill="none" stroke="#7d8aa1" stroke-width=".9"/>
    <path d="M8.8 9.6h3.2v2.4H8.8Z" fill="${CYAN}"/><path d="M12 13.6h3.4V16H12Z" fill="${PINK}"/>
    <path d="M20 2.6l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7Z" fill="${GOLD}"/>`,
  decor: `<path d="M6.6 14h10.8l-1.6 7.4H8.2Z" fill="#ff9a5a"/><rect x="5.8" y="12.6" width="12.4" height="2.4" rx=".8" fill="#ffb27a"/>
    <path d="M12 13c0-3.6 0-6.2-.4-9.6M12 12.6c-2.6-1.2-5.6-1.8-7.6-5.2 3.6-.4 6 1.6 7.6 5.2ZM12 12.6c2.4-1.6 4.8-4 8-4.2-1.2 3.6-4.4 4.8-8 4.2ZM11.6 3.4c-2 1.2-2.4 3.4-1.6 5.2 2-.8 2.6-3 1.6-5.2Z" fill="#6fe36f" stroke="#2f7d2f" stroke-width=".6"/>`,
  wallpaper: `<rect x="3" y="3.5" width="18" height="17" rx="1.6" fill="${W}"/>
    <rect x="5" y="5.5" width="14" height="13" rx=".6" fill="#3a2a58"/>
    <path d="M5 16.4l4.2-4.6 3 3 2.8-2.6 4 4.2v2.1H5Z" fill="${PINK}"/><circle cx="15.4" cy="8.8" r="1.7" fill="${GOLD}"/>`,
};

export function iconSvg(name) {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="uiGlyph" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

// Fills every element with data-icon="name" (inside `root`) with its icon.
export function fillIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    if (ICONS[el.dataset.icon] && !el.querySelector('.uiGlyph')) el.insertAdjacentHTML('afterbegin', iconSvg(el.dataset.icon));
  }
}
