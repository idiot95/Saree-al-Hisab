#!/usr/bin/env node
/* Figure under the production CSP: type digits into the Add-entry amount and
 * check that the rolling echo (NumberFlow) draws the same text format() does,
 * that its constructed stylesheets were adopted, and that nothing was blocked.
 *
 *   node scripts/sweep.mjs --login email:password   # writes the session state
 *   node scripts/figure.check.mjs [--engine chromium|webkit]
 *
 * Env: SWEEP_BASE (default http://localhost:3000), SWEEP_STATE (as the sweep).
 * The expected text is written out here, from the household's INR, rather
 * than imported: money.ts is TypeScript and this script is plain node.       */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.SWEEP_BASE || 'http://localhost:3000').replace(/\/$/, '');
const STATE = process.env.SWEEP_STATE || path.join(HERE, '..', '.sweep-state.json');
const engine = process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'chromium';

const CASES = [['2', '₹2.00'], ['2340', '₹2,340.00'], ['2340.50', '₹2,340.50']];

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
await page.goto('/add', { waitUntil: 'load' });
const input = page.getByLabel(/^Amount in /);
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) bad++; };

await input.click();
let typedSoFar = '';
for (const [full, want] of CASES) {
  await input.pressSequentially(full.slice(typedSoFar.length), { delay: 40 });
  typedSoFar = full;
  await page.waitForTimeout(900); // let the roll finish
  const got = await page.evaluate(() => {
    const el = document.querySelector('[data-figure-echo] number-flow-react');
    if (!el) return null;
    const root = el.shadowRoot;
    if (!root) return { sheets: -1 };
    /* What a person sees: the live (non-inert) numeral of each digit column,
       and each symbol, in order. The shadow root also holds the whole 0-9
       reel of every column, so textContent would say nothing useful. */
    const seen = [...root.querySelectorAll('.digit, .symbol__value')].map((n) =>
      n.classList.contains('digit') ? (n.querySelector('.digit__num:not([inert])')?.textContent ?? '?') : n.textContent).join('');
    const sheets = root.adoptedStyleSheets.length + root.styleSheets.length;
    return { sheets, adopted: root.adoptedStyleSheets.length, display: getComputedStyle(el).display,
      label: el.getAttribute('aria-label'), role: el.getAttribute('role'), text: seen.replace(/\u00a0/g, '\u00a0') };
  });
  check(got !== null, `${full}: the echo is on the page`);
  if (!got) continue;
  /* 0.6.2 puts NumberFlow's CSS in a <style> inside the shadow root, so the
     sheet shows up in styleSheets rather than adoptedStyleSheets. Either is
     the styling arriving; display:inline-block is proof it was applied. */
  check(got.sheets > 0 && got.display === 'inline-block', `${full}: shadow-root stylesheets ${got.sheets} (adopted ${got.adopted}), host display ${got.display}`);
  check(got.label === want, `${full}: aria-label ${JSON.stringify(got.label)} === format() ${JSON.stringify(want)}`);
  check(got.role === 'img', `${full}: role=${got.role} (read once, not digit by digit)`);
  check(got.text === want, `${full}: drawn text ${JSON.stringify(got.text)} === ${JSON.stringify(want)}`);
}
const violations = await page.evaluate(() => window.__csp);
check(violations.length === 0, `no securitypolicyviolation events (${violations.length}${violations.length ? ': ' + violations.join('; ') : ''})`);
await browser.close();
console.log(bad ? `\nfigure.check FAILED (${bad}) [${engine}]` : `\nfigure.check passed [${engine}]`);
process.exit(bad ? 1 : 0);
