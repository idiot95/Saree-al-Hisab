/* The one guard every script that writes to the books takes before it connects: the tap scripts, frames.check
   (which locks tables), drawers.check, and the end-to-end checks.

   On the owner's laptop `.env.local` names the production Neon store (CLAUDE.md, "Running it"), and these scripts
   make throwaway rows, change balances for a moment and delete what they made. They are for a local verification
   database only. So the owner URL the script connects with, and the app URL the server under test writes through,
   must both be on localhost or 127.0.0.1, or the script stops before it opens a connection: exit 2, and a line that
   says why. There is no override: point `.env.local` (or OWNER_DATABASE_URL) at a local copy instead.

     import { localOwnerUrl } from './local-only.mjs';
     const sql = postgres(localOwnerUrl(ROOT), …);                                                              */
import fs from 'node:fs';
import path from 'node:path';

export const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

const fromFile = (env, name) => new RegExp(`^${name}="?([^"\\n]+)`, 'm').exec(env)?.[1] ?? null;

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return null; }
}

function refuse(why) {
  console.error(`refusing to run: ${why}. This script writes to and deletes from the database; point .env.local at a local copy (localhost or 127.0.0.1).`);
  process.exit(2);
}

/** The owner URL to connect with (OWNER_DATABASE_URL from the environment, else from .env.local), once it and the
 *  app's URL are known to be local. Exits 2 otherwise. */
export function localOwnerUrl(root) {
  let env = '';
  try { env = fs.readFileSync(path.join(root, '.env.local'), 'utf8'); } catch { /* the environment may carry it */ }
  const owner = process.env.OWNER_DATABASE_URL || fromFile(env, 'OWNER_DATABASE_URL');
  if (!owner) refuse('no OWNER_DATABASE_URL in the environment or .env.local');
  const ownerHost = hostOf(owner);
  if (!LOCAL_HOSTS.includes(ownerHost)) refuse(`the owner database is on ${ownerHost ?? 'an unreadable URL'}`);
  /* The server under test writes through APP_DATABASE_URL (or DATABASE_URL); a remote one means the taps land there. */
  const app = process.env.APP_DATABASE_URL || fromFile(env, 'APP_DATABASE_URL') || process.env.DATABASE_URL || fromFile(env, 'DATABASE_URL');
  if (app) {
    const appHost = hostOf(app);
    if (!LOCAL_HOSTS.includes(appHost)) refuse(`the app's database is on ${appHost ?? 'an unreadable URL'}`);
  }
  return owner;
}

/** For a script that picks its URL its own way: exits 2 unless `url` is local. Returns it. */
export function assertLocal(url) {
  const host = hostOf(url);
  if (!LOCAL_HOSTS.includes(host)) refuse(`the database is on ${host ?? 'an unreadable URL'}`);
  return url;
}
