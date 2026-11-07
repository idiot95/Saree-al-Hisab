#!/usr/bin/env node
/* Figure under the production CSP: switch Wealth's owner chips, which change
 * the net-worth headline in place, and check that the rolling figure
 * (NumberFlow) draws the same text its label — format()'s — says, that its
 * stylesheets were applied, and that nothing was blocked. (It typed into Add's
 * amount echo until v3.1 P1, when nothing rolls during entry any more.)
 *
 *   node scripts/sweep.mjs --login email:password   # writes the session state
 *   node scripts/figure.check.mjs [--engine chromium|webkit]
 *
 * Env: SWEEP_BASE (default http://localhost:3000), SWEEP_STATE (as the sweep).
 * The label is format()'s text (Figure's aria-label, held to format() by the
 * lib test); the drawn digits must read the same.                           */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.SWEEP_BASE || 'http://localhost:3000').replace(/\/$/, '');
const STATE = process.env.SWEEP_STATE || path.join(HERE, '..', '.sweep-state.json');
const engine = process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'chromium';


let browser;
try { browser = await (engine === 'webkit' ? webkit : chromium).launch(); }
catch (e) { console.log(`${engine} unavailable: ${String(e.message).split('\n')[0]}`); process.exit(2); }
const phone = { ...devices['iPhone 13'] };
delete phone.defaultBrowserType;
const ctx = await browser.newContext({ ...phone, baseURL: BASE, storageState: STATE, serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`));
});
const page = await ctx.newPage();
await page.goto('/worth', { waitUntil: 'load' });
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) bad++; };

const chips = page.getByRole('navigation', { name: 'Whose net worth' }).getByRole('link');
const names = (await chips.allInnerTexts()).map((t) => t.trim());
check(names.length >= 2, `Wealth offers ${names.length} owner chips to switch between`);
const seen = new Set();
/* Every chip, then back to the first, so the headline changes value at least once after first paint. */
for (const name of [...names.slice(1), names[0]]) {
  await chips.filter({ hasText: name }).first().click();
  await page.waitForTimeout(1100); // let the roll finish
  const got = await page.evaluate(() => {
    const el = document.querySelector('section.bg-hero number-flow-react');
    if (!el) return null;
    const root = el.shadowRoot;
    if (!root) return { sheets: -1 };
    /* What a person sees: the live (non-inert) numeral of each digit column,
       and each symbol, in order. The shadow root also holds the whole 0-9
       reel of every column, so textContent would say nothing useful. */
    const seen = [...root.querySelectorAll('.digit, .symbol__value')].map((n) =>
      n.classList.contains('digit') ? (n.querySelector('.digit__num:not([inert])')?.textContent ?? '?') : n.textContent).join('');
    const sheets = root.adoptedStyleSheets.length + root.styleSheets.length;
    /* A digit column is a <span>, inline unless the shadow sheet's `span { display: inline-block }` reached it. (The
       host's own display is no proof here: the hero is a flex column, which turns any child into a block.) */
    const digit = root.querySelector('.digit');
    return { sheets, adopted: root.adoptedStyleSheets.length, display: digit ? getComputedStyle(digit).display : null,
      label: el.getAttribute('aria-label'), role: el.getAttribute('role'), text: seen };
  });
  const full = name, want = got?.label;
  if (want) seen.add(want);
  check(got !== null, `${full}: the net-worth figure is on the page`);
  if (!got) continue;
  /* 0.6.2 puts NumberFlow's CSS in a <style> inside the shadow root, so the
     sheet shows up in styleSheets rather than adoptedStyleSheets. Either is
     the styling arriving; a digit drawn inline-block is proof it was applied. */
  check(got.sheets > 0 && got.display === 'inline-block', `${full}: shadow-root stylesheets ${got.sheets} (adopted ${got.adopted}), digit display ${got.display}`);
  check(/^[−-]?₹[\d,]+$/.test(got.label), `${full}: aria-label ${JSON.stringify(got.label)} is a rupee figure`);
  check(got.role === 'img', `${full}: role=${got.role} (read once, not digit by digit)`);
  check(got.text === want, `${full}: drawn text ${JSON.stringify(got.text)} === ${JSON.stringify(want)}`);
}
check(seen.size >= 2, `the headline changed value while watched (${[...seen].join(', ')})`);
const violations = await page.evaluate(() => window.__csp);
check(violations.length === 0, `no securitypolicyviolation events (${violations.length}${violations.length ? ': ' + violations.join('; ') : ''})`);
await browser.close();
console.log(bad ? `\nfigure.check FAILED (${bad}) [${engine}]` : `\nfigure.check passed [${engine}]`);
process.exit(bad ? 1 : 0);
