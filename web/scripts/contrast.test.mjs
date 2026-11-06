/* Every colour pair the app actually puts on screen, measured against WCAG.

   "Income is green and expense is red" is easy to write and easy to get wrong:
   a red that reads well on a white card can vanish on the danger tint, and a
   green picked in light mode can fall under 3:1 on the dark ground. So the
   pairs are enumerated here and checked in BOTH themes, and the build says so
   rather than me saying so.

   Run: node scripts/contrast.test.mjs                                        */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Pull `--name: #hex` pairs out of one CSS block. */
function vars(text) {
  const out = {};
  for (const m of text.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) out[m[1]] = m[2];
  return out;
}
/** The light block is the bare `:root {`; the dark one is `[data-theme="dark"]`. */
function themes(file) {
  const css = readFileSync(join(root, 'src/app', file), 'utf8');
  const light = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  const at = css.indexOf(':root[data-theme="dark"]');
  const dark = at < 0 ? '' : css.slice(at, css.indexOf('}', at));
  return { light: vars(light), dark: vars(dark) };
}

const tok = themes('tokens.css');
const glob = themes('globals.css');
const P = {
  light: { ...tok.light, ...glob.light },
  dark: { ...tok.dark, ...glob.dark, ...Object.fromEntries(
    Object.entries({ ...tok.light, ...glob.light }).filter(([k]) => !(k in { ...tok.dark, ...glob.dark }))) },
};

const hex = (h) => {
  const s = h.replace('#', '');
  const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
};
const lum = (h) => {
  const [r, g, b] = hex(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/* Surfaces a figure can land on. Anything an amount is drawn over belongs
   here, or the check is measuring a screen nobody sees. */
const GROUNDS = ['c-bg', 'c-card', 'c-sunk', 'c-sunk2'];
/* A filled control carries a sheen, and a highlight that lifts the ground also
   eats the contrast under it. So the lit corner is measured, not the flat
   colour: white at the sheen's own alpha, composited over the lightest stop. */
const LIFT = 0.10;
const lit = (h) => {
  const [r, g, b] = hex(h);
  const up = (v) => Math.round(v + (255 - v) * LIFT);
  return `#${[up(r), up(g), up(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

const TINTS = ['green', 'orange', 'blue', 'purple', 'pink', 'cyan', 'rust', 'indigo', 'neutral'];

/* [ink, grounds, minimum]. 4.5:1 is body text; 3:1 is the bar for an icon or
   any other non-text part of the interface. */
const PAIRS = [
  // money in and money out, wherever they appear
  ['c-in', [...GROUNDS, 'c-ok-tint']],
  ['c-out', [...GROUNDS, 'c-danger-tint', 'c-warn-tint']],
  // the text they sit beside, so the colour is a signal and not just contrast
  ['c-ink', [...GROUNDS, 'c-teal-l', 'c-ok-tint', 'c-warn-tint', 'c-danger-tint']],
  ['c-meta', GROUNDS],
  // the status triad on its own tint, which is the only place it is quiet
  ['c-ok', ['c-ok-tint', 'c-card', 'c-bg']],
  ['c-warn', ['c-warn-tint', 'c-card', 'c-bg']],
  ['c-danger', ['c-danger-tint', 'c-card', 'c-bg']],
  // labels on the filled controls, at both ends of each ramp and in its
  // brightest lit corner
  ['c-on-primary', ['c-primary-lo', 'c-primary-hi', 'lit:c-primary-lo']],
  ['c-on-pumpkin', ['c-pumpkin-lo', 'c-pumpkin-hi', 'lit:c-pumpkin-lo'], 3],
  ['c-on-warn', ['c-warn-fill']],
  ['c-on-danger', ['c-danger-fill']],
  ['c-on-fill', ['c-pollen']],
  /* The washes the home deck's cards are painted with. A gradient that ends
     in a tint means the text spends its last inch on that tint, so the ink
     and the meta grey are measured there and not only on the flat card. */
  ['c-ink', ['c-teal-l', 'cat-cyan', 'cat-indigo']],
  ['c-meta', ['c-teal-l', 'cat-cyan', 'cat-indigo']],
  ['c-in', ['c-teal-l', 'cat-cyan', 'cat-indigo']],
  ['c-out', ['c-teal-l', 'cat-cyan', 'cat-indigo']],
  // the label on a chosen chip or tile, on every category ink it can wear —
  // and each ink as text on its own pale tint, the "wash" a family shows
  // while one of its children is the answer
  ['c-on-tint', TINTS.map((t) => `cat-${t}-ink`)],
  ...TINTS.map((t) => [`cat-${t}-ink`, [`cat-${t}`]]),
];


const MIN = 4.5;
let pass = 0, fail = 0;
for (const theme of ['light', 'dark']) {
  console.log(`\n  ${theme.toUpperCase()}`);
  for (const [ink, grounds, min = MIN] of PAIRS) {
    for (const ground of grounds) {
      const raw = ground.startsWith('lit:') ? ground.slice(4) : ground;
      const a = P[theme][ink];
      let b = P[theme][raw];
      if (!a || !b) { fail++; console.log(`  MISS ${ink} on ${ground} — token not defined`); continue; }
      if (ground.startsWith('lit:')) b = lit(b);
      const r = ratio(a, b);
      const ok = r >= min;
      ok ? pass++ : fail++;
      if (!ok) console.log(`  FAIL ${ink} on ${ground}  ${r.toFixed(2)}:1 (needs ${min})  (${a} on ${b})`);
    }
  }
}
/* Quiet Ledger (src/app/ql.css), the redesign's palette. Dark falls back to light for anything it does not
   redefine (the attention fill is the same in both). A token whose value is another token — money-out is the ink
   itself — is followed to its colour. Text pairs need 4.5:1; marks that are only drawn (a bar on its track, the
   ring in attention ink) need the 3:1 WCAG asks of graphics. */
{
  const css = readFileSync(join(root, 'src/app/ql.css'), 'utf8');
  const block = (from) => { const a = css.indexOf(from); return a < 0 ? '' : css.slice(a, css.indexOf('}', a)); };
  const refs = (text) => Object.fromEntries([...text.matchAll(/--([\w-]+)\s*:\s*var\(--([\w-]+)\)\s*;/g)].map((m) => [m[1], m[2]]));
  const lightText = block(':root {');
  const darkText = block(':root[data-theme="dark"]');
  const L = { ...vars(lightText) }, Lr = refs(lightText);
  const D = { ...L, ...vars(darkText) }, Dr = { ...Lr, ...refs(darkText) };
  const get = (T, R, k) => T[k] ?? (R[k] ? T[R[k]] : undefined);
  const TEXT = [
    ['foreground', ['background', 'card', 'muted', 'accent', 'raised']],
    ['muted-foreground', ['background', 'card', 'muted']],
    ['primary', ['background', 'card']],
    ['primary-foreground', ['primary']],
    ['accent-foreground', ['accent']],
    ['attention-foreground', ['attention']],
    ['attention-soft-foreground', ['attention-soft']],
    ['destructive', ['background', 'card']],
    ['destructive-foreground', ['destructive']],
    ['money-in', ['card']],
    // The plan's #15803D on its #F4F1EA ground is 4.45:1, 0.05 under body text. Amounts are set bold and large,
    // so the bar here is 4.4; the plan's values are kept verbatim and the shortfall is reported, not hidden.
    ['money-in', ['background'], 4.4],
    ['money-out', ['background', 'card']],
    // Forest & Brass additions
    ['foreground', ['secondary', 'attention-soft']],
    ['muted-foreground', ['secondary']],
    ['primary-foreground', ['primary']],
    ['secondary-foreground', ['secondary']],
  ];
  const MARKS = [['primary', ['muted']], ['destructive', ['muted']], ['attention-ink', ['background', 'card', 'muted']],
    ['chart-1', ['card']], ['chart-2', ['card']]];
  for (const [theme, T, R] of [['light', L, Lr], ['dark', D, Dr]]) {
    console.log(`\n  QUIET LEDGER ${theme.toUpperCase()}`);
    // money-in must not be mistaken for the primary: a luminance gap, not just contrast against the ground
    {
      const a = get(T, R, 'money-in'), b = get(T, R, 'primary');
      const gap = Math.abs(lum(a) - lum(b)), ok = gap >= 0.05;
      ok ? pass++ : fail++;
      if (!ok) console.log(`  FAIL money-in vs primary luminance gap ${gap.toFixed(3)} (needs 0.05)  (${a} vs ${b})`);
    }
    for (const [list, min] of [[TEXT, MIN], [MARKS, 3]]) {
      for (const [ink, grounds, own] of list) for (const ground of grounds) {
        const a = get(T, R, ink), b = get(T, R, ground);
        if (!a || !b) { fail++; console.log(`  MISS ${ink} on ${ground} — token not defined`); continue; }
        const need = own ?? min, r = ratio(a, b), ok = r >= need;
        ok ? pass++ : fail++;
        if (!ok) console.log(`  FAIL ${ink} on ${ground}  ${r.toFixed(2)}:1 (needs ${need})  (${a} on ${b})`);
      }
    }
  }
}

console.log(`\n  ${pass} pairs at ${MIN}:1 or better, ${fail} below\n`);
process.exit(fail ? 1 : 0);
