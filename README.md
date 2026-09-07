# Saree al-Hisab

A set of books for one household, kept by the people in it. A budget for the
month, every entry reported against it, accounts whose balances are worked out
from the entries rather than typed, credit cards that file themselves into the
right statement, and a khata for what is lent, fronted and owed back. It is a
PWA, built for a phone, and it works without signal.

The live copy is at https://saree-al-hisab.vercel.app. What it does with your
data is written down, in the app, at `/terms` — and every claim on that page is
one you can check here, because this is all of the code.

## Running your own

Then nobody but you holds the books. You need a Postgres database (Neon's free
tier is fine; so is one on your own machine) and Node 24.

```bash
cd web
npm install

# .env.local — never committed
echo 'DATABASE_URL=postgresql://user:pass@host/db?sslmode=require' >> .env.local
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
echo 'AUTH_TRUST_HOST=true' >> .env.local      # only when not on Vercel

npm run migrate      # creates every table, view and trigger, in order
npm run build
npm start            # http://localhost:3000
```

Open it, create your account, name your household and pick its currency. That
is the whole setup: there is no admin console and no seed step. Receipt
scanning is per household and needs a Google AI key, added inside the app
under Household; it is stored encrypted and used for nothing else.

`APP_DATABASE_URL` overrides `DATABASE_URL` if both are set, which is how the
live copy points at a store in a different region from the one Vercel attached
first. The database connection must be TLS; the app refuses a plain one.

## Layout

| Path | What |
| --- | --- |
| `web/` | The app: Next.js, App Router, Postgres through Drizzle. Its `CLAUDE.md` is the long-form record of every decision. |
| `web/drizzle/` | Migrations. `00xx` are generated from `src/db/schema.ts`; `01xx` are hand-written views and triggers, idempotent, re-applied every run. |
| `web/scripts/` | The migration runner, the invariants suite (118 assertions against a real database), the token generator and the contrast check. |
| `design/`, `design-v2/` | The canvases the screens were designed on, and the palette the tokens are generated from. |

## Checking it

```bash
npm run test:lib          # money, hashing, link tokens
npm run test:invariants   # needs DATABASE_URL; leaves nothing behind
npm run test:contrast     # every ink/ground pair, both themes
```
