#!/usr/bin/env node
/* A prefetch never writes (v3.1 P2 fix round 1): opening the screens whose links prefetch whole — Home, Loans, the
   household — and letting every prefetch finish makes no INSERT, UPDATE or DELETE.

   Wealth is prefetched again since v3.1 P5: its render no longer refreshes the day's rates (the screen asks
   POST /api/rates once it is on the phone). To prove a prefetch of it cannot write even on the first open of the
   day, every stored rate is made two days old for the run (fetched_at, put back afterwards whatever happens), so a
   render that still refreshed would fetch and write price_quote — and the log would show it.

     node scripts/prefetch-writes.check.mjs [--log /var/tmp/pg5433/log] [--state file]

   Env: NAV_BASE (default http://localhost:3000). Local databases only (local-only.mjs). It turns statement logging
   on for data-changing statements (`ALTER SYSTEM SET log_statement = 'mod'`, which needs the local superuser),
   reads what the server logged while the screens and their prefetches ran, and turns it back off
   (`ALTER SYSTEM RESET log_statement`) whatever happens. --log is the file the local cluster logs to (pg_ctl -l).
   A control proves the log can see a write: From SMS, which does purge message bodies after its response, must show
   up as an UPDATE. --debug prints what the control logged. */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localOwnerUrl } from './local-only.mjs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const postgres = require('postgres');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const BASE = (process.env.NAV_BASE || 'http://localhost:3000').replace(/\/$/, '');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const LOG = arg('--log', '/var/tmp/pg5433/log');
const STATE = arg('--state', path.join(ROOT, '.sweep-state.json'));
const SCREENS = ['/', '/people', '/household', '/entries'];

if (!fs.existsSync(LOG)) { console.error(`no server log at ${LOG} (pass --log)`); process.exit(2); }
const sql = postgres(localOwnerUrl(ROOT), { ssl: 'require', max: 1, onnotice: () => {} });
const { defaultBrowserType, ...pixel } = devices['Pixel 7']; void defaultBrowserType;

let failed = false;
let aged = [];
try {
  await sql`alter system set log_statement = 'mod'`;
  await sql`select pg_reload_conf()`;
  await new Promise((r) => setTimeout(r, 500));
  const [{ setting: on }] = await sql`select setting from pg_settings where name = 'log_statement'`;
  assert.equal(on, 'mod', 'statement logging is on');
  /* Every rate due, so a Wealth render that refreshed would write. Put back in the finally. */
  aged = await sql`select base, quote, as_of::text as as_of, source, fetched_at from price_quote`;
  await sql`update price_quote set fetched_at = fetched_at - interval '2 days'`;
  const from = fs.statSync(LOG).size;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...pixel, storageState: STATE, baseURL: BASE, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  /* Opening the app purges old message text (Housekeeping → POST /api/sms/purge, 2.5s after a load): a write a
     visit makes on purpose, never a prefetch. Held back here so the log holds only what the renders did. */
  await page.route('**/api/sms/purge', (r) => r.abort());
  const rsc = [];
  page.on('request', (r) => { if (/[?&]_rsc=/.test(r.url())) rsc.push(new URL(r.url()).pathname + (r.headers()['next-router-prefetch'] ? ' (tree)' : '')); });
  for (const s of SCREENS) {
    await page.goto(s, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);
  }
  await new Promise((r) => setTimeout(r, 500));
  /* Statements arrive as `statement: …` (simple protocol) or `execute <name>: …` (postgres.js prepares them), and
     run over several lines: split the log into entries at each timestamp. */
  const writesIn = (text) => text.split(/\n(?=\d{4}-\d\d-\d\d \d)/)
    .filter((e) => /LOG:\s+(statement|execute [^:]*):\s*(insert|update|delete|merge)\b/i.test(e))
    .map((e) => e.replace(/\s+/g, ' ').slice(0, 160));
  const writes = writesIn(fs.readFileSync(LOG).subarray(from).toString('utf8'));

  /* The control: From SMS purges message bodies after its response (an UPDATE), so the log must show it — proof the
     check can see a write at all. */
  const mark = fs.statSync(LOG).size;
  await page.goto('/entries?f=sms', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await browser.close();
  await new Promise((r) => setTimeout(r, 1500));
  if (argv.includes('--debug')) console.log(fs.readFileSync(LOG).subarray(mark).toString('utf8').slice(0, 2000));
  const control = writesIn(fs.readFileSync(LOG).subarray(mark).toString('utf8'));
  assert.ok(control.some((w) => /update sms_draft/i.test(w)), `the control write (From SMS purging message bodies) is in the log (${control.length} writes; ${page.url()})`);
  const prefetched = [...new Set(rsc)];
  console.log(`  prefetched: ${prefetched.join(', ') || 'nothing'}`);
  assert.ok(prefetched.some((p) => p.startsWith('/entries')), 'Activity was prefetched (the check means something)');
  assert.ok(prefetched.some((p) => p.startsWith('/worth')), 'Wealth was prefetched (with every rate due)');
  assert.deepEqual(writes, [], `no data-changing statement while ${SCREENS.join(', ')} and their prefetches ran`);
  console.log(`  ok   ${SCREENS.join(', ')} and ${prefetched.length} prefetch requests: no INSERT, UPDATE or DELETE logged, Wealth's among them with every rate due`);
} catch (e) {
  failed = true;
  console.error(`  FAIL ${e.message}`);
} finally {
  for (const r of aged) {
    await sql`update price_quote set fetched_at = ${r.fetched_at}
      where base = ${r.base} and quote = ${r.quote} and as_of = ${r.as_of}::date and source = ${r.source}`;
  }
  if (aged.length) console.log(`  ${aged.length} rates put back to when they were fetched`);
  await sql`alter system reset log_statement`;
  await sql`select pg_reload_conf()`;
  await new Promise((r) => setTimeout(r, 300));
  const [{ setting }] = await sql`select setting from pg_settings where name = 'log_statement'`;
  console.log(`  log_statement back to ${setting}`);
  await sql.end();
}
process.exit(failed ? 1 : 0);
