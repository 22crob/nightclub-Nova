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
  // Bass Boost: a speaker with sound waves.
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
  xp: `<path d="M12 1.8l2.6 2.1 3.3-.4.9 3.2 3 1.5-1.2 3.1 1.2 3.1-3 1.5-.9 3.2-3.3-.4L12 22.2l-2.6-2.1-3.3.4-.9-3.2-3-1.5 1.2-3.1-1.2-3.1 3-1.5.9-3.2 3.3.4Z" fill="${GOLD}"/><text x="12" y="15.6" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="9" fill="#10233d">XP</text>`,
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
  // Utility buttons: sound on and off, start over, zoom.
  sound: `<path d="M3 9h4l5-4.5v15L7 15H3Z" fill="${W}"/>
    <path d="M15.4 8.6a4.6 4.6 0 0 1 0 6.8M18.2 5.8a8.6 8.6 0 0 1 0 12.4" fill="none" stroke="${W}" stroke-width="2.1" stroke-linecap="round"/>`,
  soundOff: `<path d="M3 9h4l5-4.5v15L7 15H3Z" fill="${W}"/>
    <path d="M15.5 9.2l5.6 5.6M21.1 9.2l-5.6 5.6" stroke="#ff6f7f" stroke-width="2.4" stroke-linecap="round"/>`,
  restart: `<path d="M18.4 8.2A7.6 7.6 0 1 0 19.6 13" fill="none" stroke="${W}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M20.6 3.4 20.4 9.6 14.4 8.6Z" fill="${W}"/>`,
  plus: `<path d="M12 4.5v15M4.5 12h15" stroke="${W}" stroke-width="3.6" stroke-linecap="round"/>`,
  minus: `<path d="M4.5 12h15" stroke="${W}" stroke-width="3.6" stroke-linecap="round"/>`,
  // The DJ desk's pads and the shop: one clean white style (the pads give
  // the colour).
  padShop: `<path d="M4.6 8h14.8l-1.2 12.4a1.6 1.6 0 0 1-1.6 1.4H7.4a1.6 1.6 0 0 1-1.6-1.4Z" fill="${W}"/>
    <path d="M8.8 10.2V6.8a3.2 3.2 0 0 1 6.4 0v3.4" fill="none" stroke="${W}" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 11.6l1.1 2.2 2.4.35-1.75 1.7.42 2.4L12 17.1l-2.17 1.15.42-2.4-1.75-1.7 2.4-.35Z" fill="${INK}"/>`,
  padEdit: `<g transform="rotate(-40 12 12)"><rect x="10.7" y="9" width="2.6" height="13.5" rx="1.2" fill="${W}"/>
    <path d="M6 4.2h9.6a1.4 1.4 0 0 1 1.4 1.4v2.6a1.4 1.4 0 0 1-1.4 1.4H6c-1.4 0-2.4-1.2-2.4-2.7S4.6 4.2 6 4.2Z" fill="${W}"/></g>`,
  padStorage: `<path d="M3 8.2 12 3.8l9 4.4v9.6l-9 4.4-9-4.4Z" fill="${W}"/>
    <path d="M3 8.2l9 4.4 9-4.4M12 12.6v9.6M7.5 6l9 4.4" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
  padCelebs: `<path d="M11 3.4l2.5 5.3 5.8.8-4.2 4 1 5.8L11 16.5l-5.1 2.8 1-5.8-4.2-4 5.8-.8Z" fill="${W}"/>
    <path d="M19.4 1.8l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7ZM19.6 15.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5Z" fill="${W}"/>`,
  newGlyph: `<rect x="1.4" y="6.4" width="21.2" height="11.2" rx="3" fill="${W}"/>
    <text x="12" y="15.4" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="7.6" fill="${INK}">NEW</text>`,
  lamp: `<path d="M9.2 2.8h5.6l2.6 13H6.6Z" fill="${W}"/><circle cx="11" cy="7.6" r="1.4" fill="${INK}"/><circle cx="13.2" cy="11.6" r="1.9" fill="${INK}"/>
    <path d="M6 16.4h12l1.6 5H4.4Z" fill="${W}"/>`,
  turntable: `<rect x="2.4" y="5" width="19.2" height="14" rx="2.2" fill="${W}"/><circle cx="10.4" cy="12" r="5.1" fill="${INK}"/><circle cx="10.4" cy="12" r="1.5" fill="${W}"/>
    <path d="M18.6 7.4v5.8l-2.8 2" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`,
  roller: `<rect x="2.5" y="3" width="15" height="6.4" rx="2" fill="${W}"/>
    <path d="M17.5 6.2h3v5.2h-8.6v3" fill="none" stroke="${W}" stroke-width="2" stroke-linejoin="round"/><rect x="10.2" y="14" width="3.4" height="7.6" rx="1.4" fill="${W}"/>`,
  toolMove: `<path d="M12 2.2l3.4 3.8h-2.2v4.8H18V8.6l3.8 3.4-3.8 3.4v-2.2h-4.8v4.8h2.2L12 21.8 8.6 18h2.2v-4.8H6v2.2L2.2 12 6 8.6v2.2h4.8V6H8.6Z" fill="${W}"/>`,
  toolRotate: `<path d="M18.4 8.2A7.6 7.6 0 1 0 19.6 13" fill="none" stroke="${W}" stroke-width="2.8" stroke-linecap="round"/><path d="M20.8 3.2 20.6 9.8 14.2 8.6Z" fill="${W}"/>`,
  toolStore: `<path d="M3 11.2 12 7l9 4.2v7.4L12 22.8l-9-4.2Z" fill="${W}"/><path d="M3 11.2l9 4.2 9-4.2M12 15.4v7.4" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M12 1.2v6M9.2 4.6 12 7.6l2.8-3" fill="none" stroke="${W}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  toolSell: `<path d="M2.8 12.4V4.2A1.4 1.4 0 0 1 4.2 2.8h8.2l9 9-9.4 9.4Z" fill="${W}"/><circle cx="7.4" cy="7.4" r="1.7" fill="${INK}"/>
    <text x="13" y="16.6" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="8.5" fill="${INK}">$</text>`,
  toolClear: `<path d="M20 2.4 12.4 10.8" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M10 9.4l4.8 4.4-3.4 7.6c-2.8.6-6.8-3-7.2-5.8Z" fill="${W}"/>
    <path d="M6.2 16.6l3.6-3.6M8.6 18.8l3.2-3.8" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M3.6 3.4l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z" fill="${W}"/>`,
  goalsGlyph: `<path d="M7 3h10v5.5a5 5 0 0 1-10 0Z" fill="${W}"/>
    <path d="M7 5H3.6v1.6A3.6 3.6 0 0 0 7.4 10M17 5h3.4v1.6A3.6 3.6 0 0 1 16.6 10" fill="none" stroke="${W}" stroke-width="2"/>
    <path d="M10.6 13.2h2.8v3.6h-2.8Z" fill="${W}"/><rect x="7.2" y="16.6" width="9.6" height="4.4" rx="1" fill="${W}"/>
    <path d="M12 4.6l.8 1.6 1.7.25-1.25 1.2.3 1.7-1.55-.8-1.55.8.3-1.7-1.25-1.2 1.7-.25Z" fill="${INK}"/>`,
  check: `<path d="M4.5 12.5l5 5L20 7" fill="none" stroke="${W}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`,
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


// Bigger, glossier drawings in Nightclub City's cartoon style (48x48): the
// dock's tabs and the money stack. Gradients, a white shine and dark
// outlines.
const O = '#10233d';
function expandArt(mirror) {
  const flip = mirror ? ' transform="translate(48 0) scale(-1 1)"' : '';
  return `<defs><linearGradient id="gRow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6ff8a"/><stop offset="1" stop-color="#2fae2a"/></linearGradient></defs>
    <g${flip}>
    <path d="M27 6 45 15 27 24 9 15Z" fill="#3a4a6e" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M18 10.5 36 19.5M36 10.5 18 19.5" stroke="#5a6d96" stroke-width="1.2"/>
    <path d="M9 15 27 24v3L9 18Z" fill="#26304a" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M27 24 45 15v3L27 27Z" fill="#1b2236" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M9 18 27 27 21 30 3 21Z" fill="url(#gRow)" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M9 18 27 27" stroke="#fff" stroke-width="1.2" stroke-dasharray="2 2" opacity=".8"/>
    <path transform="translate(10 35) rotate(-117)" d="M0-8 7 0H2.8v7H-2.8V0H-7Z" fill="url(#gRow)" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>
    </g>`;
}
const ART = {
  // Expand: a cardboard box with green arrows pointing out of each corner.
  tabExpand: `<defs><linearGradient id="gArrow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6ff8a"/><stop offset="1" stop-color="#2fae2a"/></linearGradient></defs>
    <path d="M24 13 37 19.5 24 26 11 19.5Z" fill="#f6dcaa" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M11 19.5 24 26v14.5L11 34Z" fill="#e0a95c" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M24 26 37 19.5V34L24 40.5Z" fill="#b97f36" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M17.5 16.25 30.5 22.75" stroke="#c99a52" stroke-width="2.2"/>
    ${[[9, 8, -45], [39, 8, 45], [41, 41, 135], [7, 41, -135]].map(([x, y, a]) => `<path transform="translate(${x} ${y}) rotate(${a})" d="M0-7.5 6.5 0H2.6v6.5h-5.2V0h-3.9Z" fill="url(#gArrow)" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>`).join('')}`,
  // Expand on the left / right: a floor with a new green row along its
  // front-left (or front-right) edge and an arrow pushing it out.
  expandLeft: expandArt(false),
  expandRight: expandArt(true),
  // VIPs: a gold star in shades, grinning.
  tabVip: `<defs><radialGradient id="gStar" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#fff6b0"/><stop offset=".5" stop-color="#ffcf2a"/><stop offset="1" stop-color="#e38a00"/></radialGradient></defs>
    <path d="M24.0 5.0 L29.6 18.2 L44.0 19.5 L33.1 29.0 L36.3 43.0 L24.0 35.6 L11.7 43.0 L14.9 29.0 L4.0 19.5 L18.4 18.2Z" fill="url(#gStar)" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M14.5 22.6h8.4l-.7 4.2c-.3 1.6-6.3 1.6-6.9 0ZM25.1 22.6h8.4l-.8 4.2c-.3 1.6-6.3 1.6-6.9 0ZM22.9 23.4h2.2" fill="#1b1b2b" stroke="${O}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M16.4 23.6l2.2 0M27 23.6l2.2 0" stroke="#8fd8ff" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M19.6 31.2c2.6 2.4 6.2 2.4 8.8 0" fill="none" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M17 14.6c1.6-2.6 3.4-4 5.4-4.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>`,
  // The Shop pad: a glossy pink shopping bag, seen a little from the side,
  // with rope handles, a gold star tag and tissue paper peeking out.
  artShop: `<defs><linearGradient id="gBagF" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9be6"/><stop offset=".5" stop-color="#ff3fb4"/><stop offset="1" stop-color="#c4127e"/></linearGradient>
    <linearGradient id="gBagS" x1="0" x2="1"><stop offset="0" stop-color="#a80c69"/><stop offset="1" stop-color="#7a0650"/></linearGradient>
    <radialGradient id="gTag" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff6b0"/><stop offset=".5" stop-color="#ffcf2a"/><stop offset="1" stop-color="#e38a00"/></radialGradient></defs>
    <path d="M15.5 17.5c0-9 3.4-12.6 7-12.6s7 3.6 7 12.6" fill="none" stroke="${O}" stroke-width="4.6" stroke-linecap="round"/>
    <path d="M15.5 17.5c0-9 3.4-12.6 7-12.6s7 3.6 7 12.6" fill="none" stroke="#e7b36a" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M17 16.5 21 8.8l5 1.4 5.6-2.6 2 9.4Z" fill="#7ef0ff" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M21 8.8l2.4 7.6M26 10.2l-1 6.2" stroke="#2ab8d6" stroke-width="1" fill="none"/>
    <path d="M34 15.5l8-3.4 1.4 27.6-8 4.3Z" fill="url(#gBagS)" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M7 15.5h27l1.4 28.5H5.6Z" fill="url(#gBagF)" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M7 15.5h27l.2 3.6H6.8Z" fill="#ffd0f2" stroke="${O}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M10 22.5l-.8 18" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>
    <path d="M28.5 17.3c0 0 .4 2 .4 3.8" fill="none" stroke="${O}" stroke-width="1.2"/>
    <circle cx="13" cy="17.3" r="1.3" fill="${O}"/><circle cx="28.5" cy="17.3" r="1.3" fill="${O}"/>
    <path d="M20.5 22.6l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8Z" fill="url(#gTag)" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M18.6 28.2c.5-1.4 1.2-2.4 2-3" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>
    <path d="M41 4.5l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1Z" fill="#fff"/>`,
  // The Edit pad: a hammer crossed over a wrench, wood and shiny steel.
  artEdit: `<defs><linearGradient id="gWood" x1="0" x2="1"><stop offset="0" stop-color="#f2b25c"/><stop offset=".5" stop-color="#c9772c"/><stop offset="1" stop-color="#8a4b17"/></linearGradient>
    <linearGradient id="gSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#c7d0de"/><stop offset="1" stop-color="#6d7a90"/></linearGradient>
    <linearGradient id="gSteel2" x1="0" x2="1"><stop offset="0" stop-color="#eef2f7"/><stop offset=".5" stop-color="#b6c0cf"/><stop offset="1" stop-color="#6d7a90"/></linearGradient></defs>
    <g transform="rotate(45 24 24)">
      <path d="M18.4 3.5v5.4a5.6 5.6 0 0 0 3.4 5.1V38h4.4V14a5.6 5.6 0 0 0 3.4-5.1V3.5l-3 3v3.2h-5.2V6.5Z" fill="url(#gSteel2)" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="24" cy="41.2" r="5" fill="url(#gSteel2)" stroke="${O}" stroke-width="1.8"/>
      <circle cx="24" cy="41.2" r="2.2" fill="#2a6fb0" stroke="${O}" stroke-width="1.2"/>
      <path d="M22.9 15.5v20" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".85"/>
    </g>
    <g transform="rotate(-45 24 24)">
      <rect x="21.4" y="13" width="5.2" height="31" rx="2.4" fill="url(#gWood)" stroke="${O}" stroke-width="1.8"/>
      <path d="M21.4 36h5.2M21.4 39h5.2" stroke="#5c2f0c" stroke-width="1.1"/>
      <path d="M22.9 16v16" stroke="#ffe0a8" stroke-width="1.2" stroke-linecap="round" opacity=".85"/>
      <path d="M14.5 5.5h15.5v8.5H14.5c-1.4 0-2.5-1.1-2.5-2.5v-3.5c0-1.4 1.1-2.5 2.5-2.5Z" fill="url(#gSteel)" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M30 6.2c3 0 5.6-1.6 7.2-3.6.4 3.4-.6 7.2-3 9.2-1.2 1-2.6 1.6-4.2 1.6Z" fill="url(#gSteel)" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M14 7.8h14.5" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".9"/>
    </g>`,
  // The Storage pad: an open cardboard box with tape, a lamp and a
  // record peeking out of it.
  artStorage: `<defs><linearGradient id="gBoxL" x1="0" x2="1"><stop offset="0" stop-color="#f3c47e"/><stop offset="1" stop-color="#d79a4c"/></linearGradient>
    <linearGradient id="gBoxR" x1="0" x2="1"><stop offset="0" stop-color="#b8792f"/><stop offset="1" stop-color="#94591d"/></linearGradient>
    <radialGradient id="gRec" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#5a5a72"/><stop offset="1" stop-color="#121220"/></radialGradient></defs>
    <path d="M6 18 24 26.5 42 18 24 9.5Z" fill="#5a3412" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="27" cy="13" r="7.5" fill="url(#gRec)" stroke="${O}" stroke-width="1.6"/>
    <circle cx="27" cy="13" r="2.6" fill="#ff4fa8" stroke="${O}" stroke-width="1"/>
    <path d="M22.4 9.6a6 6 0 0 1 3.4-2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".6" fill="none"/>
    <path d="M14 18.4 16.8 7l5 1.8-1.4 11.6Z" fill="#7ef0ff" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M16.4 9.4l.6.2" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M6 18v17.5L24 44V26.5Z" fill="url(#gBoxL)" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M42 18v17.5L24 44V26.5Z" fill="url(#gBoxR)" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M6 18 1.5 24.5l18 8.6L24 26.5Z" fill="#f7d39a" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M42 18l4.5 6.5-18 8.6L24 26.5Z" fill="#c98a3c" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M6 18 9.5 11 27.5 19.5 24 26.5Z" fill="#e6b06a" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M14.2 30.3v8.2l5.4 2.6v-8.2Z" fill="#fff3d6" stroke="#9a6524" stroke-width=".9" stroke-linejoin="round"/>
    <path d="M15.4 33.6l3 1.4M15.4 35.8l3 1.4" stroke="#9a6524" stroke-width=".8"/>
    <path d="M24 26.5V44" stroke="#c48a3e" stroke-width="3.4" opacity=".55"/>
    <path d="M24 26.5V44" stroke="${O}" stroke-width="1.2"/>`,
  // The Bass Boost button: a big speaker cabinet, woofer and tweeter
  // glowing pink, sound waves coming off it.
  artSpeaker: `<defs><linearGradient id="gCab" x1="0" x2="1"><stop offset="0" stop-color="#4a3f66"/><stop offset=".5" stop-color="#2a2340"/><stop offset="1" stop-color="#16122a"/></linearGradient>
    <radialGradient id="gCone" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#7a7a96"/><stop offset=".55" stop-color="#2c2c40"/><stop offset="1" stop-color="#0c0c18"/></radialGradient>
    <radialGradient id="gCap" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#ffd1f4"/><stop offset=".5" stop-color="#ff4fd8"/><stop offset="1" stop-color="#a0128a"/></radialGradient></defs>
    <path d="M35.5 7.5l4.8-2.2v35l-4.8 3.4Z" fill="#120e22" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <rect x="8" y="5" width="28" height="39" rx="3.4" fill="url(#gCab)" stroke="${O}" stroke-width="1.9"/>
    <rect x="10.4" y="7.4" width="23.2" height="34.2" rx="2.2" fill="none" stroke="#7d6bb0" stroke-width="1" opacity=".7"/>
    <circle cx="22" cy="14.2" r="5" fill="#0c0c18" stroke="#c9c2e6" stroke-width="1.6"/>
    <circle cx="22" cy="14.2" r="2.6" fill="url(#gCap)"/>
    <circle cx="22" cy="30.2" r="10.4" fill="#0c0c18" stroke="#c9c2e6" stroke-width="1.9"/>
    <circle cx="22" cy="30.2" r="8.6" fill="url(#gCone)"/>
    <circle cx="22" cy="30.2" r="6" fill="none" stroke="#5c5c78" stroke-width=".8"/>
    <circle cx="22" cy="30.2" r="3.6" fill="url(#gCap)" stroke="${O}" stroke-width=".8"/>
    <path d="M17 25.6a6.6 6.6 0 0 1 4-2.2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".55" fill="none"/>
    <circle cx="11.4" cy="8.4" r=".9" fill="#c9c2e6"/><circle cx="32.6" cy="8.4" r=".9" fill="#c9c2e6"/><circle cx="11.4" cy="40.6" r=".9" fill="#c9c2e6"/><circle cx="32.6" cy="40.6" r=".9" fill="#c9c2e6"/>
    <path d="M10.6 6.6v20" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".35"/>
    <path d="M42.6 22.6a8.6 8.6 0 0 1 0 15.2M45.4 18.6a14 14 0 0 1 0 23.2" fill="none" stroke="#7ef0ff" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M2.6 22.6a8.6 8.6 0 0 0 0 15.2" fill="none" stroke="#7ef0ff" stroke-width="2.4" stroke-linecap="round"/>`,
  // Money: a stack of green bills with a paper band.
  cash: `<defs><linearGradient id="gBill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8ffb8"/><stop offset=".55" stop-color="#6fd64f"/><stop offset="1" stop-color="#2f9b2a"/></linearGradient></defs>
    ${[12, 7, 2].map((dy, k) => `<g transform="translate(0 ${dy})">
      <path d="M3 22 27 31v4L3 26Z" fill="#2b8a27" stroke="#0d3a10" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M27 31 45 21v4L27 35Z" fill="#1d6a1d" stroke="#0d3a10" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M3 22 21 12 45 21 27 31Z" fill="url(#gBill)" stroke="#0d3a10" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M6.6 22.1 21 14.2 41.4 21.1 27 29.1Z" fill="none" stroke="#2f8f2f" stroke-width=".8" opacity=".7"/></g>`).join('')}
    <path d="M14 18.6 31.4 9.4l4 1.5L18 20.3Z" fill="#f6ecc4" stroke="#0d3a10" stroke-width="1" stroke-linejoin="round"/>
    <ellipse cx="29.5" cy="17.2" rx="4.2" ry="2.4" fill="#3aa336" stroke="#0d3a10" stroke-width=".8"/>
    <text x="29.5" y="18.9" font-family="Arial Black,Arial" font-weight="900" font-size="5" text-anchor="middle" fill="#eaffdf">$</text>`,

  catStaff: `<defs><linearGradient id="gSteelS" x1="0" x2="1"><stop offset="0" stop-color="#7f8aa0"/><stop offset=".45" stop-color="#eef2f7"/><stop offset="1" stop-color="#8d98ad"/></linearGradient></defs>
    <path d="M16 19h16l-2 22c-.3 2.6-11.7 2.6-12 0Z" fill="url(#gSteelS)" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M17.5 11h13l1.5 8H16Z" fill="url(#gSteelS)" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
    <rect x="20.5" y="5.5" width="7" height="5.5" rx="2" fill="url(#gSteelS)" stroke="${O}" stroke-width="1.4"/>
    <path d="M24 28.5 18.6 25.4v6.2ZM24 28.5l5.4-3.1v6.2Z" fill="#ff4fa8" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/><circle cx="24" cy="28.5" r="1.5" fill="#ff4fa8" stroke="${O}" stroke-width="1"/>
    <path d="M38 8l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1Z" fill="#ffd24d"/>`,
};

// Each copy of a drawing gets its own gradient/mask ids: a page can show
// the same drawing twice, and browsers skip ids defined inside a hidden
// copy (the level-up menu reuses the dock's drawings).
let copies = 0;
function uniqueIds(body) {
  const n = ++copies;
  return body.replace(/id="([\w-]+)"/g, `id="$1-${n}"`).replace(/url\(#([\w-]+)\)/g, `url(#$1-${n})`);
}

export function iconSvg(name) {
  if (ART[name]) return `<svg class="uiArt" viewBox="0 0 48 48" aria-hidden="true">${uniqueIds(ART[name])}</svg>`;
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="uiGlyph" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

// Fills every element with data-icon="name" (inside `root`) with its icon.
export function fillIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    const name = el.dataset.icon;
    if ((ICONS[name] || ART[name]) && !el.querySelector('.uiGlyph, .uiArt')) el.insertAdjacentHTML('afterbegin', iconSvg(name));
  }
}
