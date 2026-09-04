// Quiet Ledger v2 — shared design vocabulary.
// Tokens lifted verbatim from design/_head.part, with the F05 contrast fixes:
//   #948B7F (3.36:1) -> #635B51 (6.68:1)      meta
//   #A39A8D (2.78:1) -> #6E665C (5.65:1)      faint
//   #B5ADA1 (2.22:1) -> #7A7268 (4.74:1)      placeholder
//   header eyebrow rgba(255,255,255,.60) -> .72

export const LIGHT = {
  bg: '#F2F5F0', ink: '#233D4D',
  meta: '#4A6472', faint: '#5E7885', ph: '#607985',
  off: '#CBD5D8', dash: '#BCC9CE', hair: '#C6D2D6',
  rule: '#EAEFF0', border: '#DCE5E7', card: '#FFFFFF',
  sunk: '#EDF1F1', sunk2: '#F3F6F5', track: '#E6ECEC', track2: '#DCE5E7',
  teal: '#3F7F6E', tealD: '#233D4D', tealL: '#E3F5F1', tealPill: '#E3F5F1',
  gold: '#8A6510', goldL: '#FDF1D5', goldInk: '#5A4208',
  red: '#C2551A', redL: '#FAE9E2', redDeep: '#A9440E',
  green: '#4A7C35', greenL: '#EEF6E7',
  blue: '#2F6382', blueL: '#E4F0F8',
  plum: '#8A3E70', plumL: '#F7E8F3',
  indigo: '#3F45A0', indigoL: '#EAEBF7',
  neut: '#EEF0F1', neutInk: '#4F5D66',
  grid: '#E6ECEC', axis: '#9DAFB6',
  // Charcoal Blue, Pumpkin Spice, Golden Pollen, Muted Olive, Seagrass —
  // used at full strength as surfaces, with Charcoal Blue as the ink on top.
  seagrass: '#619B8A', pollen: '#FCCA46', olive: '#A1C181', pumpkin: '#FE7F2D',
  seagrassT: '#81AFA1', pumpkinT: '#FE8C42',
  onFill: '#233D4D',
  ok: '#12703F', okFill: '#5FBE8A', okTint: '#DCEFE4',
  warn: '#8A6510', warnFill: '#FCCA46', warnTint: '#FDF1D5',
  danger: '#B3261E', dangerFill: '#F38B80', dangerTint: '#F9E3E1',
};

export const DARK = {
  bg: '#0D171E', ink: '#EAF1F2',
  meta: '#A8BEC7', faint: '#8CA5B0', ph: '#7A939F',
  off: '#31454F', dash: '#3B505B', hair: '#3F545F',
  rule: '#22343E', border: '#2B4049', card: '#16242D',
  sunk: '#1D2E37', sunk2: '#1A2A33', track: '#263A44', track2: '#263A44',
  teal: '#7FC2AF', tealD: '#4E9784', tealL: '#1A4344', tealPill: '#1A4344',
  gold: '#FCCA46', goldL: '#3E3418', goldInk: '#FBE7B0',
  red: '#FE7F2D', redL: '#412F2A', redDeep: '#FBA766',
  green: '#A1C181', greenL: '#2C4533',
  blue: '#7FB4D4', blueL: '#1B3B4F',
  plum: '#D390B8', plumL: '#3C2D48',
  indigo: '#9DA2E6', indigoL: '#25324E',
  neut: '#2D3B43', neutInk: '#A9B6BE',
  grid: '#22343E', axis: '#5F757F',
  seagrass: '#619B8A', pollen: '#FCCA46', olive: '#A1C181', pumpkin: '#FE7F2D',
  seagrassT: '#81AFA1', pumpkinT: '#FE8C42',
  onFill: '#12212A',
  ok: '#5FCB93', okFill: '#2C7A52', okTint: '#12331F',
  warn: '#FCCA46', warnFill: '#8A6510', warnTint: '#3A3218',
  danger: '#F58374', dangerFill: '#8E2B22', dangerTint: '#3B1F1C',
};

export const C = { ...LIGHT };

const glow = 'radial-gradient(130% 85% at 82% -12%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 62%),';
// Four families again, mapped to what a screen is asking of you:
// slate for your own money, deep for the ledger, teal for what you keep,
// ember for anything owed, overdue or on a card.
const G_LIGHT = {
  teal:   glow + 'linear-gradient(150deg,#2C5063 0%,#233D4D 58%,#172B37 100%)',
  char:   glow + 'linear-gradient(150deg,#1B303C 0%,#132630 60%,#0D1B23 100%)',
  indigo: glow + 'linear-gradient(150deg,#356F60 0%,#28564B 58%,#1C4038 100%)',
  plum:   glow + 'linear-gradient(150deg,#356F60 0%,#28564B 58%,#1C4038 100%)',
  gold:   glow + 'linear-gradient(150deg,#AC4711 0%,#8A390D 58%,#682B0A 100%)',
  blue:   glow + 'linear-gradient(150deg,#AC4711 0%,#8A390D 58%,#682B0A 100%)',
};
const G_DARK = {
  teal:   glow + 'linear-gradient(150deg,#1B3341 0%,#142832 58%,#0F1E26 100%)',
  char:   glow + 'linear-gradient(150deg,#111F28 0%,#0D1820 60%,#0A131A 100%)',
  indigo: glow + 'linear-gradient(150deg,#245348 0%,#1B4036 58%,#142F28 100%)',
  plum:   glow + 'linear-gradient(150deg,#245348 0%,#1B4036 58%,#142F28 100%)',
  gold:   glow + 'linear-gradient(150deg,#7C3410 0%,#61280C 58%,#471D09 100%)',
  blue:   glow + 'linear-gradient(150deg,#7C3410 0%,#61280C 58%,#471D09 100%)',
};
export const G = { ...G_LIGHT };

// Orange is the one hot thing on the screen: the add button, and nothing else.
export const TEAL_BTN = 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 60%),linear-gradient(145deg,#2C5063 0%,#1C3541 100%)';
export const TEAL_SM = 'linear-gradient(145deg,#2C5063 0%,#20404F 100%)';
export const BAR = 'linear-gradient(90deg,#7BB0A0 0%,#619B8A 100%)';
export const BAR_HOT = 'linear-gradient(90deg,#C93A2E 0%,#B3261E 100%)';
export const BAR_WARN = 'linear-gradient(90deg,#FCCA46 0%,#EDB524 100%)';
export const BAR_GOOD = 'linear-gradient(90deg,#5FBE8A 0%,#2C8A5A 100%)';
export const FAB = 'radial-gradient(120% 100% at 30% 10%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 60%),linear-gradient(145deg,#FE7F2D 0%,#F16B15 100%)';

// Marks need more chroma than chrome. Light and dark get their own steps from
// the same ramps — the dark band is much narrower, so one set cannot serve both.
// Four of six hues are shared; only blue and plum shift. Both sets validate
// with zero warnings against their own surface.
const SERIES_LIGHT = ['#218C73', '#B2591F', '#246D9C', '#B08D31', '#883574', '#64903B'];
const SERIES_DARK  = ['#218C73', '#B2591F', '#2777AA', '#B08D31', '#B24699', '#64903B'];
export const SERIES = [...SERIES_LIGHT];

const CAT_LIGHT = {
  green:   ['#EEF6E7', '#4A7C2A'],  orange: ['#FFEEE4', '#A9541A'],
  blue:    ['#E4F0F8', '#215F8C'],  purple: ['#F7E8F3', '#8A3574'],
  pink:    ['#FBE8ED', '#A32F4E'],  cyan:   ['#E3F5F1', '#1C7A63'],
  rust:    ['#FAE9E2', '#9E3A12'],  indigo: ['#EAEBF7', '#3F45A0'],
  neutral: ['#EEF0F1', '#4F5D66'],
};
const CAT_DARK = {
  green:   ['#2C4533', '#A9D07E'],  orange: ['#49382D', '#FBA766'],
  blue:    ['#1B3B4F', '#7FBCE4'],  purple: ['#3C2D48', '#DE93CC'],
  pink:    ['#432D3C', '#F094A9'],  cyan:   ['#1A4344', '#68D0B4'],
  rust:    ['#412F2A', '#F09270'],  indigo: ['#25324E', '#9DA2E6'],
  neutral: ['#2D3B43', '#A9B6BE'],
};
export const CAT = { ...CAT_LIGHT };

export const ACCT = {
  spending: { label: 'Spending', tint: C.tealL, ink: C.teal, icon: 'bank' },
  savings:  { label: 'Savings',  tint: C.greenL, ink: C.green, icon: 'up' },
  credit:   { label: 'Credit card', tint: C.redL, ink: C.red, icon: 'card2' },
  cash:     { label: 'Cash',     tint: C.neut, ink: C.neutInk, icon: 'briefcase' },
};

export function setTheme(name) {
  const d = name === 'dark';
  Object.assign(C, d ? DARK : LIGHT);
  Object.assign(G, d ? G_DARK : G_LIGHT);
  Object.assign(CAT, d ? CAT_DARK : CAT_LIGHT);
  SERIES.length = 0; SERIES.push(...(d ? SERIES_DARK : SERIES_LIGHT));
  Object.assign(ACCT, {
    spending: { label: 'Spending', tint: C.tealL, ink: C.teal, icon: 'bank' },
    savings:  { label: 'Savings',  tint: C.greenL, ink: C.green, icon: 'up' },
    credit:   { label: 'Credit card', tint: C.redL, ink: C.red, icon: 'card2' },
    cash:     { label: 'Cash',     tint: C.neut, ink: C.neutInk, icon: 'briefcase' },
  });
}

// ---- icons: exact path data carried over from v1 ----------------------------
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5"/>',
  swap: '<path d="M4 8h13"/><path d="M14 5l3 3-3 3"/><path d="M20 16H7"/><path d="M10 13l-3 3 3 3"/>',
  swap2: '<path d="M20 8H7"/><path d="M10 5 7 8l3 3"/><path d="M4 16h13"/><path d="M14 13l3 3-3 3"/>',
  pie: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v8.5h8.5"/>',
  dots: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  down: '<path d="M12 19V5"/><path d="M6.5 13.5 12 19l5.5-5.5"/>',
  up: '<path d="M12 19V5"/><path d="M6.5 10.5 12 5l5.5 5.5"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5.5 10.5v7.5"/><path d="M10 10.5v7.5"/><path d="M14 10.5v7.5"/><path d="M18.5 10.5v7.5"/><path d="M3 20.5h18"/>',
  bank2: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5.5 11v7"/><path d="M12 11v7"/><path d="M18.5 11v7"/><path d="M3 20.5h18"/>',
  card: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/>',
  card2: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8"/><path d="M17 14.2a6 6 0 0 1 4 5.3"/>',
  shield: '<path d="M12 3.2 5 6v6c0 4.4 3 7.4 7 8.8 4-1.4 7-4.4 7-8.8V6l-7-2.8Z"/>',
  cart: '<path d="M3 4h2l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h7.8a1.5 1.5 0 0 0 1.5-1.2L20 7.5H6"/><circle cx="9.5" cy="19.4" r="1.1" fill="currentColor" stroke="none"/><circle cx="17" cy="19.4" r="1.1" fill="currentColor" stroke="none"/>',
  fuel: '<path d="M4 20V6.5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2V20"/><path d="M2.8 20.5h11.4"/><path d="M13 10h3l2.2 2.2V17a1.6 1.6 0 0 0 3.2 0V9.4L19 6.6"/>',
  bag: '<path d="M4.5 8h15l-1.2 11.2a1.6 1.6 0 0 1-1.6 1.3H7.3a1.6 1.6 0 0 1-1.6-1.3Z"/><path d="M8.8 8V6.2a3.2 3.2 0 0 1 6.4 0V8"/>',
  receipt: '<path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4Z"/><path d="M9 8.5h6"/><path d="M9 12.5h6"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z"/><path d="M10 18.5a2 2 0 0 0 4 0"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
  house: '<path d="M4 20.5h16"/><path d="M5.5 20.5V9l6.5-4.5L18.5 9v11.5"/><path d="M9.5 20.5v-5.5h5v5.5"/>',
  house2: '<path d="M3 20.5h18"/><path d="M5 20.5V9l7-4.5L19 9v11.5"/><path d="M9.5 20.5v-5h5v5"/>',
  plane: '<path d="M3.5 13.5h4l1.5 3h6l1.5-3h4"/><path d="M5.2 5.5h13.6l2.7 8v4a2 2 0 0 1-2 2H4.5a2 2 0 0 1-2-2v-4Z"/>',
  car: '<path d="M4 16.5V11l1.8-4.2A2 2 0 0 1 7.6 5.5h8.8a2 2 0 0 1 1.8 1.3L20 11v5.5"/><path d="M3.5 16.5h17"/><circle cx="7.5" cy="18.8" r="1.4"/><circle cx="16.5" cy="18.8" r="1.4"/>',
  child: '<circle cx="12" cy="6.5" r="2.8"/><path d="M8 20.5v-4H6.5l2-6a3.5 3.5 0 0 1 7 0l2 6H16v4"/>',
  bulb: '<path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z"/><path d="M6.5 10.8V16c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-5.2"/>',
  cutlery: '<path d="M5.5 3.5v7a2.5 2.5 0 0 0 5 0v-7"/><path d="M8 10.5v10"/><path d="M17 3.5c-1.7 1-2.5 3-2.5 5.5s.8 3.5 2.5 3.5"/><path d="M17 12.5v8"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevD: '<path d="M5 9l7 7 7-7"/>',
  check: '<path d="M5 12.5 10 17.5 19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  alert: '<path d="M12 7.5v5.5"/><path d="M12 16.6v.1"/><circle cx="12" cy="12" r="8.5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.9v2.6M12 18.5v2.6M4.6 7.6l2.2 1.3M17.2 15.1l2.2 1.3M4.6 16.4l2.2-1.3M17.2 8.9l2.2-1.3"/>',
  vault: '<path d="M7 3.5h10l1.5 17H5.5Z"/><path d="M6.2 10h11.6"/>',
  doc: '<path d="M4 6.5h16"/><path d="M7 12h10"/><path d="M10 17.5h4"/>',
  inbox: '<path d="M12 15.5V4"/><path d="M8 7.5 12 3.5l4 4"/><path d="M5.5 13v6.5a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V13"/>',
  device: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8 20.5h8"/><path d="M12 16.5v4"/>',
  moon: '<path d="M19.2 14.6A8 8 0 0 1 9.4 4.8a8.2 8.2 0 1 0 9.8 9.8Z"/>',
  // v2 additions, drawn to the same 24-grid / 1.7-1.9 stroke language
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M10.5 18.6h3"/>',
  finger: '<path d="M8.5 20.5c-1-1.8-1.4-3.6-1.4-5.6V10a4.9 4.9 0 0 1 9.8 0v5"/><path d="M12 9.8v5.5c0 1.6.3 3.1 1 4.6"/><path d="M4.6 8.2a8.5 8.5 0 0 1 14.8 0"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9"/><path d="M17.5 12v3.2"/><path d="M20.5 12v2.2"/>',
  mail: '<rect x="2.8" y="5" width="18.4" height="14" rx="2.4"/><path d="M3.4 6.6 12 12.8l8.6-6.2"/>',
  share: '<circle cx="6" cy="12" r="2.6"/><circle cx="17.5" cy="6" r="2.6"/><circle cx="17.5" cy="18" r="2.6"/><path d="M8.3 10.8 15.2 7.2"/><path d="M8.3 13.2l6.9 3.6"/>',
  split: '<path d="M4 6h4l4 6 4 6h4"/><path d="M4 18h4l3-4.5"/><path d="M17 3l3 3-3 3"/><path d="M17 15l3 3-3 3"/>',
  camera: '<path d="M3 8.5h3.4l1.4-2.4h8.4l1.4 2.4H21a1 1 0 0 1 1 1v8.6a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 18.1V9.5a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.4" r="3.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  eyeOff: '<path d="M4 4l16 16"/><path d="M9.6 5.4A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7 0 .9-.6 2.1-1.6 3.3"/><path d="M6.4 7.1C4.2 8.6 3 10.7 3 12c0 2.5 4 7 9 7 1.5 0 2.9-.4 4.1-1"/><path d="M10.2 10.3a2.5 2.5 0 0 0 3.4 3.5"/>',
  del: '<path d="M9.5 5.5h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9L3 12Z"/><path d="M13 9.5l4 5"/><path d="M17 9.5l-4 5"/>',
  trash: '<path d="M4.5 6.5h15"/><path d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5"/><path d="M6.5 6.5 7.6 19a1.6 1.6 0 0 0 1.6 1.5h5.6a1.6 1.6 0 0 0 1.6-1.5L17.5 6.5"/>',
  filter: '<path d="M3.5 6h17"/><path d="M6.5 12h11"/><path d="M10 18h4"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>',
};

export function ic(name, size = 20, sw = 1.7) {
  const d = P[name];
  if (!d) throw new Error('unknown icon: ' + name);
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

// ---- document shell ---------------------------------------------------------
const helmet = () => `<helmet>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="crossorigin">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap">
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:${C.bg};color:${C.ink};font-family:"Instrument Sans","Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;font-size:15px;line-height:1.35}
    a{color:${C.teal};text-decoration:none}
    a:hover{color:#0A5049}
    button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-align:left}
    .n{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
    .t{font-family:"Instrument Serif",Georgia,"Times New Roman",serif;font-weight:400;letter-spacing:-0.004em}
    .el{box-shadow:0 1px 2px rgba(40,54,24,0.06),0 10px 26px -14px rgba(40,54,24,0.18)}
    .el2{box-shadow:0 2px 8px rgba(24,32,14,0.12),0 22px 44px -20px rgba(24,32,14,0.40)}
    .sec{margin:0;font-size:16.5px;font-weight:600;letter-spacing:-0.012em;color:${C.ink}}
    .eyebrow{font-size:11.5px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase}
  </style>
</helmet>`;

export function doc({ h, body, logic }) {
  const script = logic
    ? `<script data-dc-script data-props='{"$preview":{"width":390,"height":${h}}}'>\n${logic}\n</script>`
    : `<script data-dc-script data-props='{"$preview":{"width":390,"height":${h}}}'>\nclass Component extends DCLogic {}\n</script>`;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
${helmet()}

<div style="width:390px;min-height:${h}px;display:flex;flex-direction:column;background:${C.bg}">
${body}
</div>
</x-dc>
${script}
</body>
</html>
`;
}

// ---- tab bar ----------------------------------------------------------------
// F12: children of More keep More's teal pill — one tab, one colour, always.
// F14: "Transactions" (~69px in a 72.4px slot) renamed to "Activity".
export function nav(active) {
  const tab = (id, label, icon) => {
    const on = id === active;
    const bg = on ? C.seagrassT : 'transparent';
    const fg = on ? C.onFill : C.faint;
    return `    <a href="#" style="flex:1;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:15px;background:${bg};color:${fg}">
      ${ic(icon, 22, 1.8)}
      <span style="font-size:10.5px;font-weight:600">${label}</span>
    </a>`;
  };
  return `  <div style="margin-top:auto;display:flex;align-items:center;gap:2px;padding:8px 10px 24px;background:${C.card};border-top:1px solid ${C.border};box-shadow:0 -10px 30px -22px rgba(24,32,14,0.50)">
${tab('home', 'Home', 'home')}
${tab('tx', 'Activity', 'swap')}
    <div style="flex:1;display:flex;justify-content:center">
      <button style="width:56px;height:56px;border-radius:999px;background:${FAB};color:#233D4D;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px -6px rgba(221,95,20,0.45)">
        ${ic('plus', 26, 2.1)}
      </button>
    </div>
${tab('budget', 'Budget', 'pie')}
${tab('more', 'More', 'dots')}
  </div>`;
}

// ---- one ledger ------------------------------------------------------------
// The Personal/Household pill is gone. Every entry lives in one list; the ones
// that belong to the household carry a Shared tag. Nothing sits behind a mode,
// so no number has to be read together with a toggle to be understood.
export const sharedTag = () =>
  `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${C.onFill};background:${C.olive};border-radius:5px;padding:2px 6px;flex:none">Shared</span>`;

// A read-only badge for headers that used to carry the pill.
export const ledgerBadge = (txt = 'Mogul Household · one ledger') =>
  `    <div style="display:flex;align-items:center;gap:7px;align-self:flex-start;min-height:36px;padding:0 12px;border-radius:999px;background:rgba(0,0,0,0.20);color:rgba(255,255,255,0.90);font-size:12.5px;font-weight:600">
      ${ic('users', 15, 1.8)}
      ${txt}
    </div>`;

// Account type, set once per account — this is what savings and card control
// key off, and what keeps a bill payment from ever landing in the budget.
export const typeChip = (t) =>
  `<span style="font-size:10.5px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${ACCT[t].ink};background:${ACCT[t].tint};border-radius:5px;padding:2px 6px;flex:none">${ACCT[t].label}</span>`;

// Ring gauge — used for a card's limit, where a bar reads as a budget.
export function ring(pct, size = 92, stroke = 9, colour = '#A8523A', track = '#F1E1DC') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex:none;transform:rotate(-90deg)">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${colour}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}"/>
      </svg>`;
}

// ---- headers ----------------------------------------------------------------
const RULED = 'repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 26px),';
export function header(grad, inner, pad = '26px 20px 24px') {
  return `  <div class="el2" style="background:${RULED}${grad};color:#FFFFFF;border-radius:0 0 28px 28px;padding:${pad};display:flex;flex-direction:column;gap:18px">
${inner}
  </div>`;
}

// F11: every child screen gets a back affordance.
export function backRow(title, right = '') {
  return `    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <button style="width:44px;height:44px;margin-left:-10px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.92)">${ic('back', 21, 2)}</button>
      <h1 class="t" style="margin:0;font-size:20px;color:#FFFFFF">${title}</h1>
      ${right || '<span style="width:44px;height:44px"></span>'}
    </div>`;
}

export const eyebrow = (txt) => `<span class="eyebrow" style="color:rgba(255,255,255,0.86)">${txt}</span>`;
export const subline = (txt) => `<span class="n" style="font-size:13px;color:rgba(255,255,255,0.86)">${txt}</span>`;

export function bigNumber(label, value, extra = '') {
  return `    <div style="display:flex;flex-direction:column;gap:9px">
      ${eyebrow(label)}
      <span class="n" style="font-size:48px;font-weight:600;line-height:1;letter-spacing:-0.034em">${value}</span>
${extra}
    </div>`;
}

export function bar(pct, over = false) {
  const fill = over
    ? 'linear-gradient(90deg,#FE7F2D 0%,#FCCA46 100%)'
    : 'linear-gradient(90deg,#619B8A 0%,#A1C181 100%)';
  return `      <div style="height:8px;border-radius:999px;background:rgba(0,0,0,0.24);overflow:hidden;margin-top:3px">
        <div style="width:${pct}%;height:8px;border-radius:999px;background:${fill}"></div>
      </div>`;
}

export function splitStat(aL, aV, bL, bV, bColor = '') {
  return `    <div style="display:flex;border-top:1px solid rgba(255,255,255,0.18);padding-top:16px">
      <div style="flex:1;display:flex;flex-direction:column;gap:4px">
        <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.86)">${aL}</span>
        <span class="n" style="font-size:19px;font-weight:600">${aV}</span>
      </div>
      <div style="width:1px;background:rgba(255,255,255,0.18)"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:4px;padding-left:18px">
        <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.86)">${bL}</span>
        <span class="n" style="font-size:19px;font-weight:600${bColor ? ';color:' + bColor : ''}">${bV}</span>
      </div>
    </div>`;
}

// ---- body furniture ---------------------------------------------------------
export function sectionHead(icon, tint, tintInk, title, right = '', pad = '0 20px 12px') {
  return `  <div style="display:flex;align-items:center;gap:10px;padding:${pad}">
    <span style="width:26px;height:26px;border-radius:8px;background:${tint};display:flex;align-items:center;justify-content:center;color:${tintInk};flex:none">${ic(icon, 15, 1.9)}</span>
    <h2 class="sec" style="flex:none">${title}</h2>
    <span style="flex:1;height:1px;background:${C.border}"></span>
    ${right}
  </div>`;
}

// F19: text links carry a real 44px target instead of an 18px one.
export const link = (txt) => `<a href="#" style="min-height:44px;display:flex;align-items:center;padding:0 4px;margin-right:-4px;font-size:13px;font-weight:600">${txt}</a>`;

export const card = (inner, margin = '0 18px 26px', pad = '0 16px') =>
  `  <section class="el" style="margin:${margin};background:${C.card};border-radius:18px;padding:${pad}">
${inner}
  </section>`;

export function avatar(icon, tint, tintInk, size = 38, top = '') {
  const sw = size >= 40 ? 1.7 : 1.7;
  return `<span style="${top ? `margin-top:${top};` : ''}width:${size}px;height:${size}px;border-radius:999px;background:${tint};display:flex;align-items:center;justify-content:center;color:${tintInk};flex:none">${ic(icon, Math.round(size * 0.5), sw)}</span>`;
}

// A list row inside a card: icon rail + flexible body, hairline between rows.
export function row({ icon, tint, tintInk, title, sub, right, last = false, pad = 14, iconTop = '14px' }) {
  return `    <div style="display:flex;gap:13px">
      ${avatar(icon, tint, tintInk, 38, iconTop)}
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:${pad}px 0${last ? '' : `;border-bottom:1px solid ${C.rule}`}">
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span style="font-size:15px;font-weight:600">${title}</span>
          ${sub}
        </span>
        ${right}
      </div>
    </div>`;
}

// Rows that hold more than 390px of chips or cards. v2's notes claimed this
// was fixed; it was still overflow:hidden, so the last chip was unreachable.
export const HSCROLL = 'overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none';
export const SNAP = 'scroll-snap-align:start';

export const meta = (txt) => `<span style="font-size:12.5px;color:${C.meta}">${txt}</span>`;
export const amount = (txt, color = '') => `<span class="n" style="font-size:15.5px;font-weight:600${color ? ';color:' + color : ''}">${txt}</span>`;

// Status is never colour alone: each of these carries its own glyph and word.
export const statusChip = (kind, txt) => {
  const map = {
    ok:     [C.ok, C.okTint, 'check'],
    warn:   [C.warn, C.warnTint, 'clock'],
    danger: [C.danger, C.dangerTint, 'alert'],
  };
  const [ink, bg, icon] = map[kind];
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:${ink};background:${bg};border-radius:5px;padding:3px 7px;flex:none">${ic(icon, 12, 2.4)}${txt}</span>`;
};

export const tag = (txt, ink, bg) =>
  `<span style="font-size:10.5px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${ink};background:${bg};border-radius:5px;padding:2px 6px;flex:none">${txt}</span>`;

export const pillBtn = (txt, on) =>
  `<button style="min-height:44px;padding:0 15px;display:flex;align-items:center;border-radius:999px;font-size:13.5px;font-weight:600;${on ? `background:${TEAL_SM};color:#FFFFFF` : `background:${C.card};border:1px solid ${C.border};color:${C.meta}`}">${txt}</button>`;

export const primaryBtn = (txt, margin = '20px 18px 26px') =>
  `  <div style="margin-top:auto;padding:${margin.split(' ').length === 4 ? margin : margin}">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center">${txt}</button>
  </div>`;

export const dashedBtn = (txt, icon = 'plus', margin = '0 18px 26px') =>
  `  <button style="margin:${margin};display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;border-radius:15px;border:1.5px dashed ${C.dash};color:${C.teal};font-size:14.5px;font-weight:600">
    ${ic(icon, 18, 1.9)}
    ${txt}
  </button>`;

// Setup progress chrome — F17 cut 12 steps to 3.
export function stepHead(n, of, pct) {
  return `  <div style="display:flex;flex-direction:column;gap:14px;padding:22px 20px 0">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <button style="width:44px;height:44px;margin-left:-10px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:${C.meta}">${ic('back', 21, 2)}</button>
      <span style="font-size:12px;font-weight:700;color:${C.teal};background:${C.tealL};border-radius:999px;padding:5px 11px">Step ${n} of ${of}</span>
    </div>
    <div style="height:5px;border-radius:999px;background:${C.track2};overflow:hidden">
      <div style="width:${pct}%;height:5px;border-radius:999px;background:${C.seagrass}"></div>
    </div>
  </div>`;
}

export function titleBlock(title, body, pad = '26px 22px 22px') {
  return `  <div style="display:flex;flex-direction:column;gap:11px;padding:${pad}">
    <h1 class="t" style="margin:0;font-size:33px;line-height:1.1;letter-spacing:-0.02em;text-wrap:balance">${title}</h1>
    <p style="margin:0;font-size:15.5px;line-height:1.5;color:${C.meta}">${body}</p>
  </div>`;
}

/* ══════════════════════ charts ══════════════════════
   Built to the dataviz rules: one axis, thin marks, hairline solid grid,
   selective direct labels (never one per point), a legend whenever two
   series share a plot, and identity never carried by colour alone.        */

const money = (v) => '₹' + v.toLocaleString('en-IN');

// Cumulative spend against the straight-line plan. Two series, one axis, both
// direct-labelled at the endpoint, with the crossing day marked — the single
// most useful chart in a budgeting app.
export function paceChart({ actual, plan, days, over, w = 322, h = 150 }) {
  const max = Math.max(...actual, plan) * 1.06;
  const x = (i) => (i / (days - 1)) * w;
  const y = (v) => h - (v / max) * h;
  const pts = actual.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${pts} ${w},${h} 0,${h}`;
  const crossI = actual.findIndex((v, i) => v > (plan / (days - 1)) * i);
  const grid = [0.25, 0.5, 0.75, 1].map(f =>
    `<line x1="0" y1="${(h - h * f).toFixed(1)}" x2="${w}" y2="${(h - h * f).toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h + 2}" width="100%" height="${h + 2}" style="display:block;overflow:visible">
      ${grid}
      <line x1="0" y1="${y(plan).toFixed(1)}" x2="${w}" y2="${y(plan).toFixed(1)}" stroke="${C.axis}" stroke-width="1"/>
      <line x1="0" y1="${h}" x2="${w}" y2="${y(plan).toFixed(1)}" stroke="${C.axis}" stroke-width="1.5" stroke-linecap="round"/>
      <polygon points="${area}" fill="${C.teal}" opacity="0.12"/>
      <polyline points="${pts}" fill="none" stroke="${C.teal}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${crossI > 0 ? `<line x1="${x(crossI).toFixed(1)}" y1="0" x2="${x(crossI).toFixed(1)}" y2="${h}" stroke="${C.red}" stroke-width="1"/>
      <circle cx="${x(crossI).toFixed(1)}" cy="${y(actual[crossI]).toFixed(1)}" r="4" fill="${C.red}" stroke="${C.card}" stroke-width="2"/>` : ''}
      <circle cx="${w}" cy="${y(actual[actual.length - 1]).toFixed(1)}" r="4.5" fill="${C.teal}" stroke="${C.card}" stroke-width="2"/>
    </svg>`;
}

// Single-series bars. One hue, the latest bar emphasised, one direct label.
export function barChart({ data, labels, highlight = -1, w = 322, h = 120, colour, empty = '—' }) {
  const col = colour || C.teal;
  const max = Math.max(...data) || 1;
  const hi = highlight < 0 ? data.length - 1 : highlight;
  const gap = 9, bw = (w - gap * (data.length - 1)) / data.length;
  return `<div style="display:flex;align-items:flex-end;gap:${gap}px;height:${h}px">
${data.map((v, i) => {
  const pct = Math.max((v / max) * 100, v === 0 ? 0 : 4);
  return `      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:7px;height:100%;justify-content:flex-end">
        <span class="n" style="font-size:10.5px;font-weight:600;color:${i === hi ? col : C.faint}">${v === 0 ? empty : money(v)}</span>
        <div style="width:100%;height:${pct.toFixed(1)}%;min-height:${v === 0 ? 2 : 4}px;border-radius:4px 4px 2px 2px;background:${i === hi ? col : C.track}"></div>
        <span style="font-size:11px;font-weight:600;color:${C.meta}">${labels[i]}</span>
      </div>`;
}).join('\n')}
  </div>`;
}

// A category breakdown as a labelled bar list — the readable form on a 390px
// screen. Colour reinforces identity; the icon and name carry it.
export function catBars(rows, { w = 322 } = {}) {
  const max = Math.max(...rows.map(r => r.value));
  return rows.map((r, i) => `    <div style="display:flex;align-items:center;gap:11px;min-height:52px">
      <span style="width:30px;height:30px;border-radius:999px;background:${r.tint};display:flex;align-items:center;justify-content:center;color:${r.ink};flex:none">${ic(r.icon, 16, 1.8)}</span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
        <span style="display:flex;align-items:baseline;gap:8px">
          <span style="flex:1;min-width:0;font-size:14px;font-weight:600">${r.label}</span>
          <span class="n" style="font-size:13.5px;font-weight:600">${money(r.value)}</span>
          ${r.delta === undefined ? '' : `<span class="n" style="min-width:52px;text-align:right;font-size:11.5px;font-weight:700;color:${r.delta > 0 ? C.red : C.green}">${r.delta > 0 ? '▲' : '▼'} ${Math.abs(r.delta)}%</span>`}
        </span>
        <span style="height:6px;border-radius:999px;background:${C.track};overflow:hidden;display:block">
          <span style="display:block;width:${((r.value / max) * 100).toFixed(1)}%;height:6px;border-radius:999px;background:${r.colour}"></span>
        </span>
      </span>
    </div>`).join('\n');
}

// A cycle-to-date sparkline for a card. No axis, no labels — it sits beside a
// figure that already states the number.
export function spark({ data, w = 120, h = 34, colour }) {
  const col = colour || C.red;
  const max = Math.max(...data) || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 3) - 1.5).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block;flex:none;overflow:visible">
        <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${w}" cy="${(h - (data[data.length - 1] / max) * (h - 3) - 1.5).toFixed(1)}" r="3.5" fill="${col}"/>
      </svg>`;
}

// Legend — present whenever two series share a plot.
export const legend = (items) => `    <div style="display:flex;flex-wrap:wrap;gap:14px">
${items.map(([label, colour, dashed]) => `      <span style="display:flex;align-items:center;gap:7px">
        <span style="width:14px;height:${dashed ? 2 : 3}px;border-radius:2px;background:${colour}"></span>
        <span style="font-size:12px;font-weight:600;color:${C.meta}">${label}</span>
      </span>`).join('\n')}
    </div>`;

export const chartCard = (title, right, body, margin = '0 18px 22px') =>
  `  <section class="el" style="margin:${margin};background:${C.card};border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;align-items:baseline;gap:10px">
      <h3 style="margin:0;font-size:15px;font-weight:600;letter-spacing:-0.01em">${title}</h3>
      ${right ? `<span style="margin-left:auto">${right}</span>` : ''}
    </div>
${body}
  </section>`;

// Donut — part-to-whole at a glance only, capped at six segments, never for
// comparing close values. A 2px surface gap separates segments (a stroke gap,
// not a border), the hole carries the total, and the legend states every value
// so identity is never colour alone.
export function donut({ data, size = 168, stroke = 26, hero, heroLabel }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let acc = 0;
  const segs = data.map((d) => {
    const len = (d.value / total) * c;
    const draw = Math.max(len - 2, 1);
    const s = `      <circle cx="${size / 2}" cy="${size / 2}" r="${r.toFixed(1)}" fill="none" stroke="${d.colour}" stroke-width="${stroke}" stroke-dasharray="${draw.toFixed(1)} ${(c - draw).toFixed(1)}" stroke-dashoffset="${(-acc).toFixed(1)}"/>`;
    acc += len;
    return s;
  }).join('\n');
  return `    <div style="display:flex;align-items:center;gap:18px">
      <div style="position:relative;width:${size}px;height:${size}px;flex:none;display:flex;align-items:center;justify-content:center">
        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="display:block;transform:rotate(-90deg)">
${segs}
        </svg>
        <div style="position:absolute;display:flex;flex-direction:column;align-items:center;gap:2px">
          <span class="n" style="font-size:19px;font-weight:600;letter-spacing:-0.02em;line-height:1">${hero}</span>
          <span style="font-size:10.5px;font-weight:600;color:${C.meta};text-align:center;max-width:${size - stroke * 2 - 8}px;line-height:1.25">${heroLabel}</span>
        </div>
      </div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:9px">
${data.map(d => `        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:9px;height:9px;border-radius:3px;background:${d.colour};flex:none"></span>
          <span style="flex:1;min-width:0;font-size:12.5px;color:${C.meta};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.label}</span>
          <span class="n" style="font-size:12.5px;font-weight:600">${d.pct}%</span>
        </div>`).join('\n')}
      </div>
    </div>`;
}
