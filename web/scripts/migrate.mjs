/* Runs migrations in filename order: generated schema (00xx) first, then the
   hand-written views, functions and triggers (01xx). The 01xx files are
   idempotent, so re-running them is safe. */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

/* Split a migration into statements. Each runs on its own so it commits
   separately — Postgres refuses to USE a new enum value in the same
   transaction that ADDed it, which a whole-file send would do. Respects
   dollar-quoted function bodies ($$ … $$), strings and comments, so a
   semicolon inside a plpgsql body is not a statement boundary. */
function statements(sqlText) {
  const out = [];
  let buf = '', i = 0;
  let inS = false, inD = false, inLine = false, inBlock = false, tag = null;
  while (i < sqlText.length) {
    const c = sqlText[i], next = sqlText[i + 1];
    if (inLine) { if (c === '\n') inLine = false; buf += c; i++; continue; }
    if (inBlock) { if (c === '*' && next === '/') { inBlock = false; buf += '*/'; i += 2; continue; } buf += c; i++; continue; }
    if (tag) {
      if (sqlText.startsWith(tag, i)) { buf += tag; i += tag.length; tag = null; continue; }
      buf += c; i++; continue;
    }
    if (inS) { if (c === "'") inS = false; buf += c; i++; continue; }
    if (inD) { if (c === '"') inD = false; buf += c; i++; continue; }
    if (c === '-' && next === '-') { inLine = true; buf += '--'; i += 2; continue; }
    if (c === '/' && next === '*') { inBlock = true; buf += '/*'; i += 2; continue; }
    if (c === "'") { inS = true; buf += c; i++; continue; }
    if (c === '"') { inD = true; buf += c; i++; continue; }
    if (c === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(sqlText.slice(i));
      if (m) { tag = m[0]; buf += tag; i += tag.length; continue; }
    }
    if (c === ';') { if (buf.trim()) out.push(buf.trim()); buf = ''; i++; continue; }
    buf += c; i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = readFileSync(join(root, '.env.local'), 'utf8');
/* An explicit DATABASE_URL in the environment wins, so the same scripts can
   be pointed at a second database — which is how a region move is done
   without editing files and forgetting to put them back. */
const url = process.env.DATABASE_URL
  ?? /^APP_DATABASE_URL="?([^"\n]+)/m.exec(env)?.[1]
  ?? /^DATABASE_URL="?([^"\n]+)/m.exec(env)[1];
// NOTICEs are informational ("already exists, skipping") and drown the output.
const sql = postgres(url, { ssl: 'require', max: 1, onnotice: () => {} });

// --reset drops and rebuilds. Only safe while there is nothing to lose.
if (process.argv.includes('--reset')) {
  await sql.unsafe('drop schema public cascade; create schema public;');
  console.log('  schema reset\n');
}

await sql`create table if not exists _migration (
  file text primary key, applied_at timestamptz not null default now())`;
const done = new Set((await sql`select file from _migration`).map((r) => r.file));

const dir = join(root, 'drizzle');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

for (const f of files) {
  // The 01xx views and triggers are idempotent by construction and are
  // re-applied every run, so a changed view ships without a new file.
  const idempotent = f.startsWith('01');
  if (done.has(f) && !idempotent) { console.log(`  ${f} … already applied`); continue; }
  const body = readFileSync(join(dir, f), 'utf8');
  const stmts = statements(body);
  process.stdout.write(`  ${f} … ${String(stmts.length).padStart(2)} stmt `);
  for (const [n, stmt] of stmts.entries()) {
    try {
      await sql.unsafe(stmt);
    } catch (e) {
      console.log('FAILED');
      console.error(`\n  statement ${n + 1} of ${f}:\n  ${stmt.slice(0, 200)}\n\n  ${e.message}\n`);
      await sql.end();
      process.exit(1);
    }
  }
  await sql`insert into _migration ${sql({ file: f })} on conflict (file) do nothing`;
  console.log('ok');
}

const [{ count: tables }] = await sql`
  select count(*)::int from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE'`;
const [{ count: views }] = await sql`
  select count(*)::int from information_schema.views where table_schema='public'`;
const [{ count: checks }] = await sql`
  select count(*)::int from pg_constraint where contype='c'
  and connamespace='public'::regnamespace`;
const [{ count: triggers }] = await sql`
  select count(*)::int from information_schema.triggers where trigger_schema='public'`;
console.log(`\n  ${tables} tables · ${views} views · ${checks} check constraints · ${triggers} triggers`);
await sql.end();
