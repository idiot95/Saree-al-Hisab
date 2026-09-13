// Loan centre redesign — the canvas, generated so every screen shares one
// vocabulary. Values are lifted from the live app, not the older design-v2
// lib: tokens.css, globals.css (--g-primary, --el, --shade), auth-ui.tsx
// (headerBg ramps), SwipeRow.tsx (78px actions, 36px grip), TabBar/TabGlyph,
// Sheet.tsx, Snack.tsx, and the type scale resolved at a 390px viewport.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── tokens (light) ─────────────────────────────────────────────────────────
const C = {
  bg: '#F2F5F0', ink: '#233D4D', meta: '#4A6472', faint: '#5E7885',
  rule: '#EAEFF0', border: '#DCE5E7', card: '#FFFFFF', sunk: '#EDF1F1', sunk2: '#F3F6F5',
  track: '#E6ECEC', dash: '#BCC9CE', teal: '#3F7F6E', tealPill: '#E3F5F1', seagrass: '#619B8A',
  in: '#126642', out: '#A2372B', ok: '#12703F', okTint: '#DCEFE4',
  dangerFill: '#F38B80', onDanger: '#3B120E', primaryHi: '#2A5C4E',
};
const CAT = {
  green: ['#EEF6E7', '#4A7C2A'], orange: ['#FFEEE4', '#A9541A'], blue: ['#E4F0F8', '#215F8C'],
  purple: ['#F7E8F3', '#8A3574'], pink: ['#FBE8ED', '#A32F4E'], cyan: ['#E3F5F1', '#1C7A63'],
  rust: ['#FAE9E2', '#9E3A12'], indigo: ['#EAEBF7', '#3F45A0'], neutral: ['#EEF0F1', '#4F5D66'],
};
// --step-* at 390px
const S = { m2: 11, m1: 12.6, s0: 14.1, s1: 15.7, s2: 17.2, s3: 22.5, s4: 28.9 };
const EL = 'inset 0 1px 0 rgba(255,255,255,.7), 0 1px 2px rgba(35,61,77,.05), 0 10px 26px -14px rgba(35,61,77,.20)';
const EL2 = 'inset 0 1px 0 rgba(255,255,255,.7), 0 2px 8px rgba(35,61,77,.10), 0 22px 44px -20px rgba(35,61,77,.42)';
const SHADE = 'linear-gradient(180deg, rgba(23,43,55,0) 55%, rgba(23,43,55,.06) 100%)';
const G_PRIMARY = 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 62%), linear-gradient(150deg,#35705F 0%,#2A5C4E 100%)';
const G_PUMPKIN = 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 62%), linear-gradient(150deg,#FE8C42 0%,#E86A1A 100%)';
const RAMP = {
  purple: ['#763D82', '#4B2754', '#2E1733'],
  green: ['#327C5C', '#215741', '#14392A'],
};
const headerBg = (a) => {
  const [x, y, z] = RAMP[a];
  return 'radial-gradient(115% 90% at 80% -16%, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 56%),'
    + 'radial-gradient(120% 70% at 20% 118%, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 60%),'
    + `linear-gradient(158deg,${x} 0%,${y} 54%,${z} 100%)`;
};
const money = (n) => '₹' + n.toLocaleString('en-IN');

// ── Tabler outline paths, as the app's Icon wrapper draws them ────────────
const P = {
  chevL: '<path d="M15 6l-6 6l6 6"/>',
  chevR: '<path d="M9 6l6 6l-6 6"/>',
  chevD: '<path d="M6 9l6 6l6 -6"/>',
  folder: '<path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2"/>',
  dots: '<path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>',
  plus: '<path d="M12 5l0 14"/><path d="M5 12l14 0"/>',
  check: '<path d="M5 12l5 5l10 -10"/>',
  x: '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
  pencil: '<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  bell: '<path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/>',
  clip: '<path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5"/>',
  camera: '<path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>',
  photo: '<path d="M15 8h.01"/><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12"/><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5"/><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"/>',
  book: '<path d="M20 6v12a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2"/><path d="M10 16h6"/><path d="M11 11a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 8h3"/><path d="M4 12h3"/><path d="M4 16h3"/>',
  back: '<path d="M17 7l-10 10"/><path d="M16 17l-9 0l0 -9"/>',
  share: '<path d="M3 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M15 6a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M15 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M8.7 10.7l6.6 -3.4"/><path d="M8.7 13.3l6.6 3.4"/>',
  plane: '<path d="M16 10h4a2 2 0 0 1 0 4h-4l-4 7h-3l2 -7h-4l-2 2h-3l2 -4l-2 -4h3l2 2h4l-2 -7h3l4 7"/>',
  car: '<path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5"/>',
  bed: '<path d="M5 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M22 17v-3h-20"/><path d="M2 8v9"/><path d="M12 14h10v-2a3 3 0 0 0 -3 -3h-7v5"/>',
  cutlery: '<path d="M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12m0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3"/>',
  fuel: '<path d="M14 11h1a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0v-7l-3 -3"/><path d="M4 20v-14a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v14"/><path d="M3 20l12 0"/><path d="M18 7v1a1 1 0 0 0 1 1h1"/><path d="M4 11l10 0"/>',
};
const ic = (n, size = 20, sw = 1.9) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="flex:none;display:block">${P[n]}</svg>`;
const TABD = {
  home: 'M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z',
  budget: 'M4.5 19.5V10M9.8 19.5V5M15.2 19.5v-6.5M20.5 19.5V8',
  add: 'M12 5v14M5 12h14',
  entries: 'M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v13.5L12 16l-7.5 3.5V6A1.5 1.5 0 0 1 6 4.5zM8.5 9h7M8.5 12.5h4',
  accounts: 'M3.5 9.5h17M4.5 6.5h15a1.6 1.6 0 0 1 1.6 1.6v7.8a1.6 1.6 0 0 1-1.6 1.6h-15a1.6 1.6 0 0 1-1.6-1.6V8.1a1.6 1.6 0 0 1 1.6-1.6z',
};

// ── sample books ───────────────────────────────────────────────────────────
const PEOPLE = {
  ahmed: { name: 'Ahmed Raza', short: 'Ahmed', tint: 'orange' },
  sara: { name: 'Sara Iyer', short: 'Sara', tint: 'blue' },
  zainab: { name: 'Zainab Merchant', short: 'Zainab', tint: 'green' },
  imran: { name: 'Imran Shaikh', short: 'Imran', tint: 'purple' },
};
const TABS = [
  { name: 'Dubai trip', tint: 'cyan', people: ['ahmed', 'sara', 'zainab'], costs: 4, put: 54000, back: 18000 },
  { name: 'Imran — flat deposit', tint: 'purple', people: ['imran'], costs: 1, put: 12000, back: 0 },
  { name: 'Office petrol', tint: 'orange', people: [], costs: 3, put: 7000, back: 0 },
];
const OWED = TABS.reduce((n, t) => n + t.put - t.back, 0); // 55,000

// ── furniture ──────────────────────────────────────────────────────────────
const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const doc = (w, h, body) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="crossorigin">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap">
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:${C.bg};color:${C.ink};font-family:"Instrument Sans","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:${S.s0}px;line-height:1.3;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums slashed-zero lining-nums}
    a{color:${C.teal};text-decoration:none} a:hover{color:${C.primaryHi}}
    button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-align:left}
    h1,h2,h3{margin:0;line-height:1.1;letter-spacing:-0.018em}
    p{margin:0;line-height:1.5}
    .t{font-weight:620;letter-spacing:-0.018em}
  </style>
</helmet>
<div style="position:relative;overflow:hidden;width:${w}px;height:${h}px;display:flex;flex-direction:column;background:${C.bg}">
${body}
</div>
</x-dc>
<script data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {}
</script>
</body>
</html>
`;

const header = (accent, inner, pad = '18px 18px 26px', gap = 12) =>
  `<header style="flex:none;background:${headerBg(accent)};color:#FFFFFF;border-radius:0 0 28px 28px;padding:${pad};display:flex;flex-direction:column;gap:${gap}px;box-shadow:${EL2}">
${inner}
</header>`;

const backBtn = (right = '') => `<div style="display:flex;align-items:center;justify-content:space-between">
  <span style="width:44px;height:44px;margin-left:-11px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.92)">${ic('chevL', 21, 2)}</span>
  ${right}
</div>`;

const head = (title, right = '') =>
  `<div style="display:flex;align-items:center;gap:10px;padding:0 20px 11px">
  <h2 style="font-size:${S.s1}px;font-weight:600;letter-spacing:-.012em">${title}</h2>
  <span style="flex:1;height:1px;background:${C.border}"></span>${right}
</div>`;

const card = (inner, margin = '0 18px 22px', pad = '0 16px') =>
  `<section style="margin:${margin};background:${C.card};background-image:${SHADE};border-radius:18px;padding:${pad};box-shadow:${EL};overflow:hidden">
${inner}
</section>`;

const chip = (icon, tint, size = 40, radius = 11) => {
  const [bg, ink] = CAT[tint];
  return `<span style="width:${size}px;height:${size}px;flex:none;border-radius:${radius}px;display:flex;align-items:center;justify-content:center;background:${bg};color:${ink}">${ic(icon, Math.round(size * 0.5), 1.9)}</span>`;
};

const face = (key, size = 40, ring = '') => {
  const p = PEOPLE[key]; const [bg, ink] = CAT[p.tint];
  return `<span style="width:${size}px;height:${size}px;flex:none;border-radius:999px;display:flex;align-items:center;justify-content:center;background:${bg};color:${ink};font-size:${size >= 36 ? S.m1 : 10}px;font-weight:700${ring ? `;box-shadow:0 0 0 2px ${ring}` : ''}">${initials(p.name)}</span>`;
};

const stack = (keys, size = 22) => keys.length === 0
  ? `<span style="display:flex;align-items:center;gap:5px;font-size:${S.m2}px;color:${C.meta}"><span style="width:${size}px;height:${size}px;border-radius:999px;border:1.5px dashed ${C.dash};flex:none"></span>No one named</span>`
  : `<span style="display:flex;align-items:center">${keys.map((k, i) => `<span style="display:flex;margin-left:${i ? -6 : 0}px">${face(k, size, C.card)}</span>`).join('')}</span>`;

const primary = (label, icon, extra = '') =>
  `<button style="min-height:54px;border-radius:15px;display:flex;align-items:center;justify-content:center;gap:8px;background:${G_PRIMARY};color:#FFFFFF;font-size:${S.s0}px;font-weight:600;box-shadow:${EL};${extra}">${icon ? ic(icon, 18, 2.2) : ''}${label}</button>`;
const quiet = (label, icon, extra = '') =>
  `<button style="min-height:54px;border-radius:15px;display:flex;align-items:center;justify-content:center;gap:8px;background:${C.card};border:1px solid ${C.border};color:${C.ink};font-size:${S.s0}px;font-weight:600;${extra}">${icon ? ic(icon, 18, 2) : ''}${label}</button>`;

function tabBar() {
  const item = (key, label, on) => key === 'add'
    ? `<span style="flex:1;min-height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:${C.meta}">
    <span style="width:46px;height:46px;border-radius:999px;margin-top:-14px;display:flex;align-items:center;justify-content:center;color:#12212A;background:${G_PUMPKIN};box-shadow:inset 0 1px 0 rgba(255,255,255,.35), 0 6px 16px -4px rgba(254,127,45,.55)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${TABD.add}"/></svg></span>
    <span style="font-size:${S.m2}px;font-weight:500">Add</span>
  </span>`
    : `<span style="flex:1;min-height:60px;padding-top:6px;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:${on ? C.teal : C.meta}">
    ${on ? `<span style="position:absolute;top:0;left:22%;right:22%;height:3px;border-radius:0 0 3px 3px;background:${C.teal};opacity:.45"></span>` : ''}
    <span style="height:26px;min-width:44px;border-radius:999px;display:flex;align-items:center;justify-content:center"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${on ? 2.2 : 1.8}" stroke-linecap="round" stroke-linejoin="round"><path d="${TABD[key]}"/></svg></span>
    <span style="font-size:${S.m2}px;font-weight:${on ? 700 : 500};letter-spacing:.01em">${label}</span>
  </span>`;
  return `<nav style="margin-top:auto;flex:none;display:flex;align-items:stretch;padding-bottom:14px;background:${C.card};border-top:1px solid ${C.border};box-shadow:0 -1px 12px rgba(35,61,77,.06)">
  ${item('home', 'Home', true)}${item('budget', 'Budget')}${item('add', 'Add')}${item('entries', 'Entries')}${item('accounts', 'Accounts')}
</nav>`;
}

// A swipe row, drawn resting or open. Mirrors SwipeRow: actions 78px each
// under the row, the row inset by the card's pad, a 36px chevron grip.
const TONE = { neutral: [C.sunk2, C.ink], primary: [C.primaryHi, '#FFFFFF'], danger: [C.dangerFill, C.onDanger] };
function swipe(content, actions, open = false) {
  const W = actions.length * 78;
  return `<div style="position:relative;overflow:hidden;margin:0 -16px">
  <div style="position:absolute;top:0;bottom:0;right:0;width:${W}px;display:flex">
${actions.map(([label, icon, tone]) => { const [bg, ink] = TONE[tone]; return `    <span style="flex:1 1 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:${bg};color:${ink};font-size:${S.m2}px;font-weight:600;letter-spacing:.01em">${ic(icon, 19, 2)}<span>${label}</span></span>`; }).join('\n')}
  </div>
  <div style="position:relative;background:${C.card};padding:0 36px 0 16px;transform:translateX(${open ? -W : 0}px)">
${content}
    <span style="position:absolute;top:0;bottom:0;right:0;width:36px;display:flex;align-items:center;justify-content:center;color:${C.meta};opacity:.8"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="${open ? 'transform:rotate(180deg)' : ''}"><path d="M15 6l-6 6 6 6"/></svg></span>
  </div>
</div>`;
}

// ── the loan centre ────────────────────────────────────────────────────────
const tabRow = (t, last) => {
  const owed = t.put - t.back;
  const pct = Math.round((t.back / t.put) * 100);
  return swipe(`    <div style="display:flex;flex-direction:column;gap:10px;padding:14px 0 13px${last ? '' : `;border-bottom:1px solid ${C.rule}`}">
      <div style="display:flex;align-items:center;gap:12px">
        ${chip('folder', t.tint)}
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
          <span style="font-size:${S.s0}px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</span>
          <span style="display:flex;align-items:center;gap:7px">${t.people.length ? `${stack(t.people)}<span style="font-size:${S.m2}px;color:${C.meta}">${t.costs} ${t.costs === 1 ? 'cost' : 'costs'}</span>` : `${stack([])}<span style="font-size:${S.m2}px;color:${C.meta}">· ${t.costs} costs</span>`}</span>
        </span>
        <span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:none">
          <span class="t" style="font-size:${S.s1}px">${money(owed)}</span>
          <span style="font-size:${S.m2}px;color:${C.meta}">${t.back ? `${money(t.back)} back` : 'none back yet'}</span>
        </span>
      </div>
      <div style="margin-left:52px;height:4px;border-radius:999px;background:${C.track};overflow:hidden"><div style="width:${pct}%;height:4px;border-radius:999px;background:${C.seagrass}"></div></div>
    </div>`, [['Remind', 'bell', 'neutral'], ['Add cost', 'plus', 'primary']]);
};

const loanHeader = header('purple', `${backBtn()}
  <h1 class="t" style="font-size:${S.s3}px">Loan centre</h1>
  <div style="display:flex;flex-direction:column;gap:3px;margin-top:2px">
    <span style="font-size:${S.m2}px;color:rgba(255,255,255,.66);letter-spacing:.04em">OWED TO YOU</span>
    <span class="t" style="font-size:${S.s4}px;letter-spacing:-.022em">${money(OWED)}</span>
  </div>
  <p style="font-size:${S.m1}px;line-height:1.45;color:rgba(255,255,255,.78)">across ${TABS.length} open tabs · ${money(18000)} came back in September</p>`);

const newTabBtn = `<button style="margin:0 18px 22px;min-height:56px;border-radius:16px;display:flex;align-items:center;gap:11px;padding:0 16px;background:${C.card};border:1px dashed ${C.dash};color:${C.ink};font-size:${S.s0}px;font-weight:600;box-shadow:${EL}">
  <span style="width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:${C.sunk};color:${C.meta}">${ic('plus', 16, 2.2)}</span>
  New tab
</button>`;

const settledRow = card(`  <div style="display:flex;align-items:center;gap:12px;min-height:60px;color:${C.meta}">
    <span style="width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:${C.sunk};color:${C.faint}">${ic('check', 19, 2.2)}</span>
    <span style="flex:1;font-size:${S.s0}px;font-weight:500">2 settled tabs</span>
    ${ic('chevD', 18, 2)}
  </div>`);

const loanBody = `${loanHeader}
<div style="padding-top:20px;display:flex;flex-direction:column">
${head('Open tabs')}
${card(TABS.map((t, i) => tabRow(t, i === TABS.length - 1)).join('\n'), '0 18px 14px')}
${newTabBtn}
${settledRow}
</div>`;

const files = {};
files['Main.dc.html'] = doc(390, 844, `${loanBody}\n${tabBar()}`);

// ── a sheet over a screen ──────────────────────────────────────────────────
const sheet = (under, inner) => `${under}
<div style="position:absolute;inset:0;background:rgba(242,245,240,.62);backdrop-filter:blur(18px) saturate(.8);-webkit-backdrop-filter:blur(18px) saturate(.8)"></div>
<div style="position:absolute;left:0;right:0;bottom:0;background:${C.card};color:${C.ink};border-radius:24px 24px 0 0;box-shadow:${EL2};display:flex;flex-direction:column">
  <span style="min-height:44px;display:flex;align-items:center;justify-content:center"><span style="width:40px;height:5px;border-radius:999px;background:${C.border}"></span></span>
  <div style="padding:0 18px 26px;display:flex;flex-direction:column;gap:16px">
${inner}
  </div>
</div>`;

const label = (txt, opt = false) =>
  `<span style="font-size:${S.m1}px;font-weight:600;color:${C.meta}">${txt}${opt ? ` <span style="font-weight:400">· optional</span>` : ''}</span>`;

const personChip = (key) => {
  const p = PEOPLE[key]; const [bg, ink] = CAT[p.tint];
  return `<span style="min-height:44px;padding:0 4px 0 7px;border-radius:999px;display:flex;align-items:center;gap:8px;background:${bg};color:${ink};font-size:${S.m1}px;font-weight:600">
      ${face(key, 30)}${p.name}
      <span style="width:44px;height:44px;margin:0 -4px 0 -8px;border-radius:999px;display:flex;align-items:center;justify-content:center;opacity:.75">${ic('x', 14, 2.2)}</span>
    </span>`;
};

files['NewTab.dc.html'] = doc(390, 844, sheet(`${loanBody}\n${tabBar()}`, `    <h2 style="font-size:${S.s2}px;font-weight:600">New tab</h2>
    <label style="display:flex;flex-direction:column;gap:6px">
      ${label('Name', true)}
      <span style="min-height:52px;border-radius:13px;border:1px solid ${C.seagrass};box-shadow:0 0 0 3px ${C.tealPill};display:flex;align-items:center;padding:0 14px;font-size:16px">Goa weekend<span style="width:1.5px;height:20px;background:${C.teal};margin-left:1px"></span></span>
    </label>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${label('Who owes on it', true)}
      <div style="display:flex;flex-wrap:wrap;gap:8px">
    ${['ahmed', 'sara', 'zainab'].map(personChip).join('\n    ')}
      </div>
      <div style="display:flex;gap:8px">
        <span style="flex:1;min-height:48px;border-radius:13px;border:1px solid ${C.border};display:flex;align-items:center;padding:0 14px;font-size:16px;color:#607985">Type a name</span>
        <button style="min-height:48px;padding:0 14px;border-radius:13px;display:flex;align-items:center;gap:7px;background:${C.sunk};color:${C.ink};font-size:${S.m1}px;font-weight:600">${ic('book', 18, 1.9)}Contacts</button>
      </div>
      <p style="font-size:${S.m2}px;line-height:1.45;color:${C.meta}">A cost on this tab splits equally between the people on it. Leave it empty and the tab still counts in what you are owed.</p>
    </div>
    <div style="display:flex;gap:9px">
      <button style="min-height:50px;padding:0 16px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:${C.sunk};color:${C.meta};font-size:${S.s0}px;font-weight:600">Cancel</button>
      ${primary('Open the tab', 'folder', 'flex:1;min-height:50px;border-radius:13px')}
    </div>`));

// ── one tab ────────────────────────────────────────────────────────────────
const tabHeader = header('purple', `${backBtn(`<span style="width:44px;height:44px;margin-right:-11px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.92)">${ic('dots', 22, 2)}</span>`)}
  <span style="align-self:flex-start;display:flex;align-items:center;gap:6px;font-size:${S.m2}px;font-weight:700;letter-spacing:.05em;padding:5px 10px;border-radius:7px;background:rgba(255,255,255,.16)">${ic('folder', 14, 2.2)}TAB</span>
  <h1 class="t" style="font-size:${S.s3}px;display:flex;align-items:center;gap:0">Dubai trip<span style="width:44px;height:44px;margin:-10px 0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.62)">${ic('pencil', 17, 2)}</span></h1>
  <span class="t" style="font-size:${S.s4}px;letter-spacing:-.022em">${money(36000)}</span>
  <p style="font-size:${S.m1}px;line-height:1.5;color:rgba(255,255,255,.82)">still to come back · ${money(54000)} put on across 4 costs · ${money(18000)} back</p>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:2px">
${[['ahmed', money(18000)], ['sara', null], ['zainab', money(18000)]].map(([k, v]) => `    <span style="min-height:40px;padding:0 12px 0 5px;border-radius:999px;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.2);font-size:${S.m1}px;font-weight:600">${face(k, 30)}${PEOPLE[k].short}<span style="font-weight:500;color:rgba(255,255,255,.8);display:flex;align-items:center;gap:3px">${v ?? `${ic('check', 13, 2.6)}settled`}</span></span>`).join('\n')}
    <span style="min-height:44px;padding:0 13px 0 10px;border-radius:999px;display:flex;align-items:center;gap:6px;border:1px dashed rgba(255,255,255,.42);font-size:${S.m1}px;font-weight:600;color:rgba(255,255,255,.9)">${ic('plus', 15, 2.2)}Contact</span>
  </div>`, '18px 18px 22px', 10);

const clipMeta = (n) => n
  ? `<span style="display:inline-flex;align-items:center;gap:3px;color:${C.teal};font-weight:600">${ic('clip', 12, 2.2)}${n} bill</span>`
  : `<span style="color:${C.faint}">no bill</span>`;

const entry = ({ icon, tint, what, meta, amt, incoming = false }, last) =>
  `    <div style="display:flex;align-items:center;gap:12px;min-height:66px${last ? '' : `;border-bottom:1px solid ${C.rule}`}">
      ${chip(icon, tint)}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:${S.s0}px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${what}</span>
        <span style="font-size:${S.m2}px;color:${C.meta};display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${meta}</span>
      </span>
      <span class="t" style="font-size:${S.s0}px;flex:none;color:${incoming ? C.in : C.out}">${incoming ? '+' : ''}${amt}</span>
    </div>`;

const COST_ACTIONS = (hasBill) => [['Remind', 'bell', 'neutral'], [hasBill ? 'View bill' : 'Attach bill', 'clip', 'primary'], ['Delete', 'trash', 'danger']];
const BACK_ACTIONS = [['Attach', 'clip', 'primary'], ['Delete', 'trash', 'danger']];

const E = {
  back: { icon: 'back', tint: 'green', what: 'Came back from Sara', meta: `2 Sep · GPay / ICICI Savings`, amt: money(18000), incoming: true },
  flight: { icon: 'plane', tint: 'cyan', what: 'Flight — Emirates', meta: `26 Aug · ${money(18400)} owed · ${clipMeta(1)}`, amt: money(27600) },
  hotel: { icon: 'bed', tint: 'purple', what: 'Hotel — Taj Dubai', meta: `27 Aug · ${money(12000)} owed · ${clipMeta(1)}`, amt: money(18000) },
  taxis: { icon: 'car', tint: 'blue', what: 'Taxis', meta: `28 Aug · ${money(3200)} owed · ${clipMeta(0)}`, amt: money(4800) },
  meals: { icon: 'cutlery', tint: 'orange', what: 'Meals', meta: `29 Aug · ${money(2400)} owed · ${clipMeta(0)}`, amt: money(3600) },
};

const tabBody = (openTaxis) => `${tabHeader}
<div style="padding-top:20px;display:flex;flex-direction:column">
${head('September')}
${card(swipe(entry(E.back, true), BACK_ACTIONS), '0 18px 20px')}
${head('August')}
${card([
  swipe(entry(E.flight), COST_ACTIONS(true)),
  swipe(entry(E.hotel), COST_ACTIONS(true)),
  swipe(entry(E.taxis), COST_ACTIONS(false), openTaxis),
  swipe(entry(E.meals, true), COST_ACTIONS(false)),
].join('\n'), '0 18px 20px')}
</div>
<div style="margin-top:auto;flex:none;display:flex;gap:9px;padding:14px 18px 24px;background:${C.bg};border-top:1px solid ${C.border}">
  ${quiet('Money back', 'back', 'flex:1')}
  ${primary('Add cost', 'plus', 'flex:1.3')}
</div>`;

files['Tab.dc.html'] = doc(390, 900, tabBody(true));

// ── attach the bill, right after saving ───────────────────────────────────
const tile = (icon, text) => `<button style="min-height:112px;border-radius:16px;border:1px solid ${C.border};background:${C.sunk2};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-size:${S.s0}px;font-weight:600;color:${C.ink}">
        <span style="width:46px;height:46px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:${C.card};color:${C.teal};box-shadow:${EL}">${ic(icon, 22, 1.9)}</span>${text}</button>`;

files['AttachBill.dc.html'] = doc(390, 844, sheet(tabBody(false), `    <div style="display:flex;align-items:center;gap:12px">
      <span style="width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:${C.okTint};color:${C.ok}">${ic('check', 20, 2.4)}</span>
      <span style="flex:1;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:${S.s1}px;font-weight:600">Saved on Dubai trip</span>
        <span style="font-size:${S.m1}px;color:${C.meta}">Desert safari · ${money(6000)} · all of it to come back</span>
      </span>
    </div>
    <span style="height:1px;background:${C.rule}"></span>
    <div style="display:flex;flex-direction:column;gap:4px">
      <h2 style="font-size:${S.s2}px;font-weight:600">Attach the bill?</h2>
      <p style="font-size:${S.m1}px;color:${C.meta}">It goes out with every reminder for this cost. A photo or a PDF.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px">
      ${tile('camera', 'Take a photo')}
      ${tile('photo', 'Choose a file')}
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <button style="min-height:46px;padding:0 18px;display:flex;align-items:center;justify-content:center;font-size:${S.s0}px;font-weight:600;color:${C.meta}">Not now</button>
      <span style="font-size:${S.m2}px;color:${C.meta}">Swipe the entry left to add it later.</span>
    </div>`));

// ── remind, with the bill ─────────────────────────────────────────────────
const receiptThumb = (w = 44, h = 56) => `<span style="width:${w}px;height:${h}px;flex:none;border-radius:7px;background:#FFFFFF;border:1px solid ${C.border};box-shadow:${EL};display:flex;flex-direction:column;gap:4px;padding:8px 7px">
          <span style="height:4px;width:70%;border-radius:2px;background:${C.dash}"></span>
          <span style="height:3px;border-radius:2px;background:${C.track}"></span>
          <span style="height:3px;border-radius:2px;background:${C.track}"></span>
          <span style="height:3px;width:60%;border-radius:2px;background:${C.track}"></span>
          <span style="margin-top:auto;height:4px;width:50%;align-self:flex-end;border-radius:2px;background:${C.dash}"></span>
        </span>`;

const pick = (key, amt, on) => {
  const p = PEOPLE[key]; const ink = CAT[p.tint][1];
  return on
    ? `<span style="min-height:44px;padding:0 14px 0 6px;border-radius:999px;display:flex;align-items:center;gap:8px;background:${ink};color:#FFFFFF;font-size:${S.m1}px;font-weight:600">${ic('check', 16, 2.6)}${p.short}<span style="font-weight:500;opacity:.9">${amt}</span></span>`
    : `<span style="min-height:44px;padding:0 14px 0 10px;border-radius:999px;display:flex;align-items:center;gap:6px;background:${C.sunk};color:${C.meta};font-size:${S.m1}px;font-weight:600">${p.short}<span style="font-weight:500">· settled</span></span>`;
};

files['Remind.dc.html'] = doc(390, 844, sheet(tabBody(false), `    <div style="display:flex;flex-direction:column;gap:4px">
      <h2 style="font-size:${S.s2}px;font-weight:600">Remind about Flight — Emirates</h2>
      <p style="font-size:${S.m1}px;color:${C.meta}">26 Aug · Dubai trip · ${money(18400)} still owed</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${label('Who')}
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${pick('ahmed', money(9200), true)}
        ${pick('zainab', money(9200), true)}
        ${pick('sara', '', false)}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${label('What they get')}
      <div style="border-radius:14px;background:${C.sunk2};border:1px solid ${C.border};padding:13px 14px;display:flex;flex-direction:column;gap:12px">
        <p style="font-size:${S.s0}px;line-height:1.45">Ahmed, a reminder about ${money(9200)} — your share of Flight — Emirates on 26 Aug 2026, from the Dubai trip.</p>
        <div style="display:flex;align-items:center;gap:11px;padding-top:11px;border-top:1px solid ${C.border}">
        ${receiptThumb()}
          <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
            <span style="font-size:${S.m1}px;font-weight:600">emirates-eticket.jpg</span>
            <span style="font-size:${S.m2}px;color:${C.meta}">The bill goes with it</span>
          </span>
          <span style="width:44px;height:26px;border-radius:999px;background:${C.teal};position:relative;flex:none"><span style="position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:999px;background:#FFFFFF"></span></span>
        </div>
      </div>
      <p style="font-size:${S.m2}px;line-height:1.45;color:${C.meta}">One message each, through your phone’s share sheet — WhatsApp, Messages, wherever you already talk.</p>
    </div>
    ${primary('Send 2 reminders', 'share', 'min-height:54px')}`));

// ── the swipe, state by state ─────────────────────────────────────────────
const step = (n, title, sub, body) => `<div style="display:flex;flex-direction:column;gap:8px;padding:0 0 20px">
  <div style="display:flex;align-items:baseline;gap:8px;padding:0 20px">
    <span style="font-size:${S.m2}px;font-weight:700;letter-spacing:.05em;color:${C.teal}">${n}</span>
    <span style="font-size:${S.s0}px;font-weight:600">${title}</span>
    <span style="font-size:${S.m2}px;color:${C.meta}">${sub}</span>
  </div>
${body}
</div>`;

files['SwipeActions.dc.html'] = doc(390, 900, `<div style="padding:26px 20px 20px;display:flex;flex-direction:column;gap:6px">
  <h1 class="t" style="font-size:${S.s3}px">Swipe an entry</h1>
  <p style="font-size:${S.m1}px;color:${C.meta}">Drag left for its actions. Tapping the chevron does the same, so nothing is gesture-only.</p>
</div>
${step('1', 'Resting', 'the chevron says it swipes', card(swipe(entry(E.taxis, true), COST_ACTIONS(false)), '0 18px'))}
${step('2', 'Open', 'no bill yet', card(swipe(entry(E.taxis, true), COST_ACTIONS(false), true), '0 18px'))}
${step('3', 'With a bill', 'the action becomes View bill', card(swipe(entry(E.flight, true), COST_ACTIONS(true), true), '0 18px'))}
${step('4', 'Money back', 'nothing to remind about', card(swipe(entry(E.back, true), BACK_ACTIONS, true), '0 18px'))}
${step('5', 'Deleted', 'a long swipe never deletes on its own', `${card([swipe(entry(E.hotel), COST_ACTIONS(true)), swipe(entry(E.meals, true), COST_ACTIONS(false))].join('\n'), '0 18px')}
  <div style="margin:4px 18px 0;min-height:52px;display:flex;align-items:center;gap:12px;padding:0 6px 0 16px;border-radius:14px;background:${C.ink};color:${C.bg};box-shadow:0 8px 24px -8px rgba(35,61,77,.45)">
    <span style="flex:1;font-size:${S.m1}px;font-weight:600;line-height:1.35">Taxis deleted · ${money(3200)} off the tab</span>
    <button style="min-height:44px;padding:0 14px;font-size:${S.m1}px;font-weight:700;color:inherit;text-decoration:underline;text-underline-offset:3px">Undo</button>
  </div>`)}`);

// ── home: the roll-up ──────────────────────────────────────────────────────
files['HomeLoanCard.dc.html'] = doc(390, 430, `<div style="padding:20px 18px">
  <div style="display:flex;flex-direction:column;gap:13px;border-radius:22px;padding:18px 17px;background:${C.card};background-image:linear-gradient(152deg, ${C.card} 8%, ${CAT.indigo[0]} 104%);border:1px solid ${C.border};box-shadow:${EL2}">
    <span style="display:flex;align-items:baseline;gap:8px">
      <span style="flex:1;font-size:${S.s2}px;font-weight:600">Loan centre</span>
      <span style="font-size:${S.m2}px;color:${C.meta}">Open ›</span>
    </span>
    <span class="t" style="font-size:${S.s4}px;line-height:1;color:${C.in}">${money(OWED)}</span>
    <span style="font-size:${S.m1}px;color:${C.meta};margin-top:-6px">owed to you across ${TABS.length} tabs</span>
    <div style="display:flex;flex-direction:column;border-radius:11px;background:${C.sunk2};padding:4px 11px">
${TABS.map((t, i) => `      <div style="display:flex;align-items:center;gap:9px;min-height:40px${i === TABS.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
        ${chip('folder', t.tint, 26, 7)}
        <span style="flex:1;min-width:0;font-size:${S.m1}px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</span>
        <span class="t" style="font-size:${S.m1}px">${money(t.put - t.back)}</span>
      </div>`).join('\n')}
    </div>
    <span style="padding-top:10px;border-top:1px solid ${C.rule};font-size:${S.m1}px;line-height:1.45;color:${C.meta}">Every cost on an open tab counts here — with or without a name on it.</span>
  </div>
</div>`);

// ── trends: by tab ────────────────────────────────────────────────────────
const maxOwed = Math.max(...TABS.map((t) => t.put - t.back));
files['TrendsByTab.dc.html'] = doc(390, 740, `${header('green', `${backBtn()}
  <h1 class="t" style="font-size:${S.s3}px">Trends</h1>
  <p style="font-size:${S.m1}px;line-height:1.5;color:rgba(255,255,255,.84)">${money(41200)} a month on average · ${money(3100)} less than last month</p>`, '18px 18px 26px', 11)}
<div style="padding:20px 0 0;display:flex;flex-direction:column">
${head('Owed to you, by tab')}
${card(`  <div style="display:flex;flex-direction:column;gap:16px">
${TABS.map((t) => { const owed = t.put - t.back; return `    <div style="display:flex;flex-direction:column;gap:7px">
      <div style="display:flex;align-items:center;gap:8px">
        ${chip('folder', t.tint, 22, 6)}
        <span style="flex:1;min-width:0;font-size:${S.m1}px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</span>
        <span style="font-size:${S.m1}px;font-weight:600;min-width:62px;text-align:right">${money(owed)}</span>
      </div>
      <div style="height:10px;border-radius:4px;background:${C.track};overflow:hidden"><div style="width:${((owed / maxOwed) * 100).toFixed(1)}%;height:10px;border-radius:0 4px 4px 0;background:${CAT[t.tint][1]}"></div></div>
      <span style="font-size:${S.m2}px;color:${C.meta}">${t.back ? `${money(t.back)} of ${money(t.put)} back` : `${money(t.put)} put on · none back yet`}${t.people.length ? '' : ' · no one named'}</span>
    </div>`; }).join('\n')}
    <div style="display:flex;align-items:baseline;gap:10px;padding-top:12px;border-top:1px solid ${C.rule};font-size:${S.m1}px">
      <span style="flex:1;color:${C.meta}">All open tabs</span>
      <span style="font-weight:600">${money(OWED)}</span>
    </div>
  </div>`, '0 18px 22px', '16px')}
${head('Came back, six months')}
${card(`  <div style="display:flex;align-items:flex-end;gap:14px;height:110px;padding:0 6px">
${[['Apr', 4200], ['May', 0], ['Jun', 9600], ['Jul', 4800], ['Aug', 2500], ['Sep', 18000]].map(([m, v]) => `    <div style="flex:1;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px">
      <div style="width:100%;height:${v ? Math.max(4, (v / 18000) * 78).toFixed(0) : 0}px;border-radius:4px 4px 0 0;background:${m === 'Sep' ? C.seagrass : C.dash}"></div>
      <span style="font-size:9.5px;color:${C.meta}">${m}</span>
    </div>`).join('\n')}
  </div>`, '0 18px 22px', '16px 16px 12px')}
</div>`);

// ── option B: tabs as folders ──────────────────────────────────────────────
const folderTile = (t) => {
  const owed = t.put - t.back;
  return `<div style="min-height:156px;border-radius:18px;padding:14px;background:${C.card};background-image:${SHADE};box-shadow:${EL};display:flex;flex-direction:column;gap:8px">
    <div style="display:flex;align-items:center;justify-content:space-between">${chip('folder', t.tint)}${t.people.length ? stack(t.people) : ''}</div>
    <span style="margin-top:4px;font-size:${S.s0}px;font-weight:600;line-height:1.25">${t.name}</span>
    <span style="margin-top:auto;display:flex;flex-direction:column;gap:6px">
      <span class="t" style="font-size:${S.s2}px">${money(owed)}</span>
      <span style="height:4px;border-radius:999px;background:${C.track};overflow:hidden"><span style="display:block;width:${Math.round((t.back / t.put) * 100)}%;height:4px;background:${C.seagrass}"></span></span>
      <span style="font-size:${S.m2}px;color:${C.meta}">${t.people.length ? `${t.costs} ${t.costs === 1 ? 'cost' : 'costs'}` : `No one named · ${t.costs} costs`}</span>
    </span>
  </div>`;
};
files['LoanCentreFolders.dc.html'] = doc(390, 844, `${loanHeader}
<div style="padding-top:20px;display:flex;flex-direction:column">
${head('Open tabs')}
<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px;padding:0 18px 22px">
  ${TABS.map(folderTile).join('\n  ')}
  <div style="min-height:156px;border-radius:18px;border:1px dashed ${C.dash};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:${C.ink};font-size:${S.s0}px;font-weight:600">
    <span style="width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:${C.sunk};color:${C.meta}">${ic('plus', 18, 2.2)}</span>New tab
  </div>
</div>
${settledRow}
</div>
${tabBar()}`);

// ── layout ─────────────────────────────────────────────────────────────────
const canvas = {
  artboards: [
    { file: 'Main.dc.html', x: 0, y: 0, w: 390, h: 844, title: 'Loan centre — tabs lead' },
    { file: 'NewTab.dc.html', x: 470, y: 0, w: 390, h: 844, title: 'New tab — name and contacts optional' },
    { file: 'Tab.dc.html', x: 940, y: 0, w: 390, h: 900, title: 'A tab — entries swipe' },
    { file: 'AttachBill.dc.html', x: 1410, y: 0, w: 390, h: 844, title: 'Right after saving a cost' },
    { file: 'Remind.dc.html', x: 1880, y: 0, w: 390, h: 844, title: 'Remind, with the bill' },
    { file: 'SwipeActions.dc.html', x: 0, y: 1400, w: 390, h: 900, title: 'Swipe: Remind · Bill · Delete' },
    { file: 'HomeLoanCard.dc.html', x: 470, y: 1400, w: 390, h: 430, title: 'Home — the roll-up' },
    { file: 'TrendsByTab.dc.html', x: 940, y: 1400, w: 390, h: 740, title: 'Trends — by tab, not by person' },
    { file: 'LoanCentreFolders.dc.html', x: 1410, y: 1400, w: 390, h: 844, title: 'Option B — tabs as folder tiles' },
  ],
  annotations: [
    { id: 'model', x: 0, y: -330, w: 390, text: 'THE MODEL\nA tab is a folder. It holds costs and money back, and it has a name if you give it one.\nContacts are optional labels on a tab, picked from the phone book. There is no People list to keep and no Add person screen — the People and Settled sections on today’s Lending page go away.' },
    { id: 'rollup', x: 470, y: -330, w: 390, text: 'WHAT COUNTS\nEvery cost on an open tab adds to Owed to you, whether or not anyone is named on it. Today a tab with nobody on it raises no claim, so it never reaches the total — that has to change underneath (a claim held by the tab itself).\nNo name typed? The tab takes its contacts’ names, or the first cost’s.' },
    { id: 'iphone', x: 940, y: -330, w: 390, text: 'IPHONE\nSafari has no contact picker. On an iPhone the Contacts button is not there, so typing a name stays the way in. A typed name is still only a label on the tab.' },
    { id: 'bill', x: 1410, y: -330, w: 390, text: 'BILLS AND REMINDERS\nAttaching is offered the moment a cost is saved, and any time after from the swipe. Remind uses the share sheet and carries the bill, as the person page already does. When nobody is named, Remind opens the share sheet with the message and no names.' },
    { id: 'swipe', x: 0, y: 1210, w: 390, text: 'SWIPE\nThe same SwipeRow as Budgets: commit off, so a long swipe never deletes. Delete undoes for 15 minutes. A tab row on the Loan centre swipes to Remind · Add cost.' },
    { id: 'optb', x: 1410, y: 1210, w: 390, text: 'OPTION B — FOLDER TILES\nFor: reads most like folders, and each tab gets more room.\nAgainst: amounts no longer share one right edge, and past about six tabs you scroll a grid, and a tile cannot swipe, so Remind and Add cost move inside the tab. The list (Main) is the recommendation.' },
  ],
  launch: { view: 'canvas' },
};

for (const [name, src] of Object.entries(files)) writeFileSync(join(OUT, name), src);
writeFileSync(join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2) + '\n');
console.log(`wrote ${Object.keys(files).length} artboards · owed ${money(OWED)}`);
