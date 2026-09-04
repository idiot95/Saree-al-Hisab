@AGENTS.md

# Quiet Ledger — project brief

A household finance PWA. 55 screens are designed on a Claude Design canvas in
`../design-v2/` — that canvas is the spec, and `../design-v2/_build/lib.mjs` is
the single source of truth for the palette.

## Decisions already made (do not relitigate without asking)

- **PWA only.** No Play Store, no App Store for now. A Trusted Web Activity can
  wrap the deployed site later in about a day; nothing in the build depends on it.
- **No SMS import, ever.** No web API can read SMS. `WebOTP` reads only our own
  origin-bound login code and is worth wiring for the Enter-the-code screen.
- **No Account Aggregator.** FIU onboarding is not worth it at this size. This
  means **entry is manual**, so Add Expense is the most important screen in the
  app — three taps, no more.
- **One ledger, not two.** The Personal/Household toggle was removed after it
  proved modal. Everything lives in one set of books; household entries carry a
  `is_shared` flag. A household sees everything — Setup says so explicitly.
- **Monthly budgets, carried forward.** September starts as a copy of August.
  Editing September must never rewrite what August was.
- **Brand colour and status colour are separate systems.** Pumpkin Spice is the
  add button and attention, never alarm. Status is a reserved triad (ok / warn /
  danger) and always ships with an icon and a word, never colour alone.

## The four invariants — enforced in Postgres, not in components

The audit of v1 found the app disagreeing with itself on arithmetic. These live
in `drizzle/0001_ledger_views.sql` and in CHECK constraints on `txn`:

1. **Card payments never count as spend.** A `card_payment` moves money between
   two accounts and cannot carry a category.
2. **Transfers never count as spend.** Same shape rule.
3. **Savings accounts sit outside the budget.** A purchase *on* a credit card is
   spending on the day it happened; only the bill payment is excluded.
4. **Duplicates have two rules, because there are two kinds.**
   - *Same person, two entries* — same account, same amount, ±3 days.
   - *Two people, one purchase* — the household case. Deliberately **ignores
     the account**, since that is exactly what two people disagree on (he knows
     he paid by card, she assumes cash). Tolerates ±1% on amount, ±2 days, and
     requires the category or merchant to corroborate.
   Detected, never prevented — two identical coffees in a day is legitimate.
   A dismissed pair is recorded in `duplicate_dismissed` so it stops nagging.

**Read spend from the `spend_txn` view, never from `txn` directly.** That view is
where invariants 1–3 actually live. Same for `income_txn` and `savings_flow`.
A repayment is `kind = 'claim_receipt'` — money in, but explicitly not income.

## Conventions

- Money is a `bigint` in the currency's minor unit. No floats near the ledger.
- `src/app/tokens.css` is **generated**. Never hand-edit it; run
  `node scripts/gen-tokens.mjs` after any palette change on the canvas.
- Tap targets are 44px minimum. Every status carries an icon and a word.
- **Prevention beats detection for household duplicates.** Before Save, Add
  Expense must show what a household member already recorded that matches —
  one quiet line, at the moment of the decision. The Inbox card is the fallback
  for when that is missed, not the primary mechanism.

## Settled since

- **Domain: the default Vercel one.** Passkeys work with `rp.id` set to the
  FULL host (`yourapp.vercel.app`), never the parent — `vercel.app` is on the
  Public Suffix List and the browser refuses it. Preview deploys get their own
  subdomain, so sign-in can only be tested on the stable URL. Moving to a
  custom domain later resets every passkey, push subscription, install and
  stored Gemini key.
- **No share-to-app parser.** Dropped: Android-only, and a parser per bank.
- **Multi-currency is phase 4.** `currency` and `fx_rate` stay on `txn` and
  cost nothing to leave; phases 1–3 are INR only. NOTE: the only savings-kind
  account in the designs is Cash (USD), so seed an INR savings account or the
  Savings screen opens empty.
- **Scanning**: receipts and screenshots through the user's own Gemini key.
  Voice was dropped — microphone access is unreliable in an installed iPhone
  PWA. A scan always produces a DRAFT in the Inbox, never a posted entry, and
  `kind` is the highest-stakes field: anything below high confidence lands as
  `unknown` and blocks Confirm.

## Running it

    npm run migrate            # in filename order; --reset drops and rebuilds
    npm run test:invariants    # 38 assertions against real Postgres
    npm run tokens             # regenerate tokens.css from the canvas palette

Neon is provisioned through Vercel; `DATABASE_URL` lives in `.env.local`,
which is gitignored. Migrations are tracked in a `_migration` table — the
`00xx` files run once, the `01xx` views and triggers re-apply every run
because they are idempotent, so a changed view ships without a new file.

## Proven, not assumed

`npm run test:invariants` tries to BREAK each rule and expects Postgres to
refuse. 38 assertions currently pass, covering: a move can never look like
spending, `spend_txn` is the only definition of spending, refunds net off in
the month they land, a card purchase files itself into the right cycle, a
payment method is a rail and not a balance, lending never touches the budget,
duplicates are detected but never prevented, budgets are one row per
category per month keyed on the first, and an invitation admits only the
address it was sent to — never whoever holds the link.

    npm run seed               # the Mogul Household, INR only

## Where the slice reaches

`/add` is wired end to end: real categories, ways to pay and accounts come out
of Postgres, and Save writes a row through `saveEntry`. Paying by GPay leaves
HDFC Savings, because the METHOD decides the account — the client never names
one. Before Save, a debounced `checkDuplicate` shows what a household member
already recorded within ±1% and ±2 days, which is the prevention half of the
duplicate rule; the Inbox card is only the fallback.

A Server Action is reachable by direct POST, not just through the UI, so
`saveEntry` resolves the household and author on the SERVER and re-checks that
every id sent belongs to that household. The database would refuse a bad
foreign key, but it would not stop one household writing into another's.

## Who can see the books

Sign-in is Google, through Auth.js v5 with JWT sessions — no adapter tables.

**The token carries one fact: which `app_user` row this is.** Not the
household, not the role. Those are read from Postgres on every request in
`src/db/membership.ts`, because a JWT lives for weeks and being removed from a
household — or dropped to viewer — has to bite on the next tap, not at the
next sign-in.

Three roles: **owner** (also invites, changes roles, removes people),
**contributing member** (`adult` — adds, edits, budgets), **viewer**
(reads everything, changes nothing). A viewer is blocked inside `saveEntry`,
not by hiding the button, because a Server Action is reachable by direct POST.

**An invitation is bound to an email address, not to its link.** `/join/<token>`
only *shows* the invitation; what admits someone is an open, unexpired invite
addressed to the Google account they sign in with. So a link that is forwarded,
screenshotted or sitting in a chat backup gets a stranger a page and nothing
else. Ownership is never handed out by link. Invites last seven days, and a new
invite to the same address revokes the previous one.

Joining is never automatic. The first person to sign in claims the seeded
household (it is created with no members); everyone after that needs an invite,
or they land on `/no-household`, which shows them the address to have invited.

`/join` is excluded from the proxy matcher — an invitation has to open for
someone who is not signed in yet.

## Open

- Nothing is deployed yet beyond the slice. The Vercel project is
  `saree-al-hisab`, linked to `idiot95/Saree-al-Hisab` with root directory
  `web`. `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` still have to be set —
  redirect URIs `https://saree-al-hisab.vercel.app/api/auth/callback/google`
  and `http://localhost:3000/api/auth/callback/google`.
