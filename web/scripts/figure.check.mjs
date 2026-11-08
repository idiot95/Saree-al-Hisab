#!/usr/bin/env node
/* Figure under the production CSP: switch Wealth's owner chips, which change
 * the net-worth headline in place, and check that the rolling figure
 * (NumberFlow) draws exactly the text format() writes for the figure the
 * database holds, that its stylesheets were applied, and that nothing was
 * blocked. (It typed into Add's amount echo until v3.1 P1, when nothing rolls
 * during entry any more.)
 *
 *   node scripts/sweep.mjs --login email:password   # writes the session state
 *   node scripts/figure.check.mjs [--engine chromium|webkit] [--email ammar@example.com]
 *   (webkit cannot run against a local http build: the CSP's upgrade-insecure-requests sends its script loads to
 *   https://localhost, which Chromium exempts and WebKit does not. Run webkit against an https deploy.)
 *
 * Env: SWEEP_BASE (default http://localhost:3000), SWEEP_STATE (as the sweep).
 * Reads OWNER_DATABASE_URL from .env.local (local only), and picks two members
 * of the signed-in person's books whose net worth differs: a member's figure is
 * what they own — their accounts' balances (no person accounts) and their
 * valued holdings, nothing archived — the member branch of lib/worth.ts
 * netWorth(). The expected text is written out here (en-IN grouping, whole
 * rupees, U+2212 minus), not imported: money.ts is TypeScript and this script
 * is plain node.                                                            */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localOwnerUrl } from './local-only.mjs';

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require('playwright');
const postgres = require('postgres');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.SWEEP_BASE || 'http://localhost:3000').replace(/\/$/, '');
const STATE = process.env.SWEEP_STATE || path.join(HERE, '..', '.sweep-state.json');
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const engine = arg('--engine', 'chromium');
const EMAIL = arg('--email', 'ammar@example.com');
const rupees = (minor) => `${minor < 0 ? '\u2212' : ''}₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(minor) / 100)}`;

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

/* After the page has loaded (it refreshes rates first), what each member owns, from the database. */
const sql = postgres(localOwnerUrl(path.join(HERE, '..')), { ssl: 'require', max: 1, onnotice: () => {} });
const [me] = await sql`select id, active_household_id as hh from app_user where email = ${EMAIL}`;
const members = await sql`
  select u.id, u.name,
    coalesce((select sum(b.balance) from account_balance b where b.household_id = m.household_id and b.archived_at is null
              and b.kind <> 'person' and b.owner_user_id = u.id), 0)::bigint
  + coalesce((select sum(v.value_minor) from holding_value v where v.household_id = m.household_id and v.archived_at is null
              and v.owner_user_id = u.id and v.value_minor is not null), 0)::bigint as worth
  from member m join app_user u on u.id = m.user_id where m.household_id = ${me.hh}`;
await sql.end();
const chipOf = (m) => (m.id === me.id ? 'Me' : (m.name.trim().split(/\s+/)[0] || m.name));
const a = members[0], b = members.find((m) => Number(m.worth) !== Number(a?.worth));
check(!!(a && b), `two members of these books own different totals (${members.map((m) => `${chipOf(m)} ${rupees(Number(m.worth))}`).join(', ')})`);

const chips = page.getByRole('navigation', { name: 'Whose net worth' }).getByRole('link');
const seen = new Set();
/* A, then B (the headline rolls from one to the other in place), then A again. */
for (const m of a && b ? [a, b, a] : []) {
  const name = chipOf(m), want = rupees(Number(m.worth));
  await chips.filter({ hasText: new RegExp(`^${name}$`) }).first().click();
  await page.waitForTimeout(1100); // let the roll finish
  const got = await page.evaluate(() => {
    const el = document.querySelector('section.bg-hero number-flow-react');
    if (!el) return null;
    const root = el.shadowRoot;
    if (!root) return { sheets: -1 };
    /* What a person sees: the live (non-inert) numeral of each digit column,
       and each symbol, in order. The shadow root also holds the whole 0-9
       reel of every column, so textContent would say nothing useful. */
    const shown = [...root.querySelectorAll('.digit, .symbol__value')].map((n) =>
      n.classList.contains('digit') ? (n.querySelector('.digit__num:not([inert])')?.textContent ?? '?') : n.textContent).join('');
    const sheets = root.adoptedStyleSheets.length + root.styleSheets.length;
    /* A digit column is a <span>, inline unless the shadow sheet's `span { display: inline-block }` reached it. (The
       host's own display is no proof here: the hero is a flex column, which turns any child into a block.) */
    const digit = root.querySelector('.digit');
    return { sheets, adopted: root.adoptedStyleSheets.length, display: digit ? getComputedStyle(digit).display : null,
      label: el.getAttribute('aria-label'), role: el.getAttribute('role'), text: shown };
  });
  check(got !== null, `${name}: the net-worth figure is on the page`);
  if (!got) continue;
  seen.add(got.text);
  /* 0.6.2 puts NumberFlow's CSS in a <style> inside the shadow root, so the
     sheet shows up in styleSheets rather than adoptedStyleSheets. Either is
     the styling arriving; a digit drawn inline-block is proof it was applied. */
  check(got.sheets > 0 && got.display === 'inline-block', `${name}: shadow-root stylesheets ${got.sheets} (adopted ${got.adopted}), digit display ${got.display}`);
  check(got.label === want, `${name}: aria-label ${JSON.stringify(got.label)} === format() of the database's ${m.worth} paise ${JSON.stringify(want)}`);
  check(got.role === 'img', `${name}: role=${got.role} (read once, not digit by digit)`);
  check(got.text === want, `${name}: drawn text ${JSON.stringify(got.text)} === ${JSON.stringify(want)}`);
}
check(seen.size >= 2, `the headline rolled between different values while watched (${[...seen].join(' → ')})`);
const violations = await page.evaluate(() => window.__csp);
check(violations.length === 0, `no securitypolicyviolation events (${violations.length}${violations.length ? ': ' + violations.join('; ') : ''})`);
await browser.close();
console.log(bad ? `\nfigure.check FAILED (${bad}) [${engine}]` : `\nfigure.check passed [${engine}]`);
process.exit(bad ? 1 : 0);
