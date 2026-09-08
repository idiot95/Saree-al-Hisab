/* The app's own database role.

   Row security is a no-op for a role with BYPASSRLS, and the Neon owner has
   it. So the app connects as `saree_app` — created by drizzle/0109_rls.sql
   with LOGIN and nothing else — and this script gives it a password and
   tells the app how to connect:

     node scripts/app-role.mjs              new password; APP_DATABASE_URL rewritten
                                            in .env.local and pushed to Vercel
     node scripts/app-role.mjs --no-vercel  the same, this machine only. Safe before
                                            the code that scopes its queries is
                                            deployed: the owner string Vercel holds
                                            keeps working, since only the app role's
                                            password changed
     node scripts/app-role.mjs --verify     touch nothing; connect as the app role
                                            and prove a policy bites

   A new password breaks every copy of the old string the moment it is set,
   which is why the default pushes to Vercel in the same breath. The password
   is 192 random bits and is never printed. The owner's string moves to
   OWNER_DATABASE_URL the first time through; migrations, tests and seeds
   read that, and the app reads APP_DATABASE_URL and nothing else. */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const ROLE = 'saree_app';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env.local');
let env = readFileSync(envPath, 'utf8');
const get = (k) => new RegExp(`^${k}="?([^"\\n]+)`, 'm').exec(env)?.[1];
const userOf = (u) => { try { return new URL(u).username; } catch { return null; } };
const args = new Set(process.argv.slice(2));

const appNow = get('APP_DATABASE_URL');
const ownerUrl = get('OWNER_DATABASE_URL') ?? (userOf(appNow) !== ROLE ? appNow : null);
if (!ownerUrl) throw new Error('No owner connection string: set OWNER_DATABASE_URL in .env.local');

async function prove(appUrl) {
  const owner = postgres(ownerUrl, { ssl: 'require', max: 1, onnotice: () => {} });
  const app = postgres(appUrl, { ssl: 'require', max: 1, onnotice: () => {} });
  try {
    const [me] = await app`select current_user as who, r.rolbypassrls as bypass, r.rolsuper as super
      from pg_roles r where r.rolname = current_user`;
    if (me.who !== ROLE || me.bypass || me.super) throw new Error(`connected as ${me.who}, bypass=${me.bypass}`);
    const [{ n: seen }] = await app`select count(*)::int as n from txn`;
    const [{ n: real }] = await owner`select count(*)::int as n from txn`;
    console.log(`  ${ROLE}: no BYPASSRLS · sees ${seen} of ${real} entries with no household set`);
    if (real > 0 && seen !== 0) throw new Error('the policy did not bite — is the migration applied?');
    const [{ bypass }] = await owner`select rolbypassrls as bypass from pg_roles where rolname = current_user`;
    console.log(`  owner: BYPASSRLS ${bypass ? 'yes — policies do not apply to migrations and tests' : 'no'}`);
  } finally { await app.end(); await owner.end(); }
}

if (args.has('--verify')) {
  if (userOf(appNow) !== ROLE) throw new Error(`APP_DATABASE_URL is not the ${ROLE} string yet; run without --verify`);
  await prove(appNow);
  process.exit(0);
}

// A new password, set as the owner.
const password = randomBytes(24).toString('base64url');   // [A-Za-z0-9_-], safe unquoted in a URL
const owner = postgres(ownerUrl, { ssl: 'require', max: 1, onnotice: () => {} });
const [{ n }] = await owner`select count(*)::int as n from pg_roles where rolname = ${ROLE}`;
if (!n) { await owner.end(); throw new Error(`role ${ROLE} does not exist — run the migration first`); }
await owner.unsafe(`alter role ${ROLE} with login password '${password}'`);
await owner.end();

const appUrl = new URL(ownerUrl);
appUrl.username = ROLE;
appUrl.password = password;
const app = appUrl.toString();

// The file: the owner string keeps its place under a new name, the app's is replaced.
if (!get('OWNER_DATABASE_URL')) env = env.replace(/\n?$/, `\nOWNER_DATABASE_URL="${ownerUrl}"\n`);
env = /^APP_DATABASE_URL=.*$/m.test(env)
  ? env.replace(/^APP_DATABASE_URL=.*$/m, `APP_DATABASE_URL="${app}"`)
  : env.replace(/\n?$/, `\nAPP_DATABASE_URL="${app}"\n`);
writeFileSync(envPath, env);
console.log(`  password set · .env.local: APP_DATABASE_URL is ${ROLE}, OWNER_DATABASE_URL is the owner`);
await prove(app);

if (args.has('--no-vercel')) {
  console.log('  Vercel not updated: it still connects as the owner until you run this without --no-vercel');
  process.exit(0);
}

/* Through stdin, never argv — a process list shows arguments to anyone on
   the machine. --force overwrites; production and preview hold it sealed. */
function push(name, value, target, sensitive) {
  const r = spawnSync('npx', ['vercel', 'env', 'add', name, target, '--force', '--yes', ...(sensitive ? ['--sensitive'] : [])],
    { cwd: root, input: value, encoding: 'utf8' });
  const said = (r.stdout + r.stderr).split('\n').filter((l) => /Added|Overrode|Error|error/.test(l)).join(' ').trim();
  console.log(`  vercel ${target}: ${name} ${r.status === 0 ? 'set' : 'FAILED'}${said ? ` — ${said}` : ''}`);
  if (r.status !== 0) process.exitCode = 1;
}
push('APP_DATABASE_URL', app, 'production', true);
push('APP_DATABASE_URL', app, 'preview', true);
push('APP_DATABASE_URL', app, 'development', false);
// So a `vercel env pull` brings the owner string back under the name the scripts read.
push('OWNER_DATABASE_URL', ownerUrl, 'development', false);
console.log('  A running deployment keeps its old string until it is redeployed.');
