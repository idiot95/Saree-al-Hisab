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
    npm run test:invariants    # 57 assertions against real Postgres
    npm run test:lib           # money, password hashing and link tokens
    npm run tokens             # regenerate tokens.css from the canvas palette

Neon is provisioned through Vercel; `DATABASE_URL` lives in `.env.local`,
which is gitignored. Migrations are tracked in a `_migration` table — the
`00xx` files run once, the `01xx` views and triggers re-apply every run
because they are idempotent, so a changed view ships without a new file.

## Proven, not assumed

`npm run test:invariants` tries to BREAK each rule and expects Postgres to
refuse. 57 assertions currently pass, covering: a move can never look like
spending, `spend_txn` is the only definition of spending, refunds net off in
the month they land, a card purchase files itself into the right cycle, a
payment method is a rail and not a balance, lending never touches the budget,
duplicates are detected but never prevented, budgets are one row per
category per month keyed on the first, an invitation is single-use and its
plaintext is nowhere in the database, a password cannot exist without an
address to use it with, and an account that has recorded entries cannot be
deleted at all — the ledger holds it in place — and one person can keep
several sets of books without either set knowing about the other, and a
balance is only ever the sum of the entries beneath it.

    npm run seed you@example.com   # fills YOUR books with the designs' data

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

Sign-in is an **address and a password we hold ourselves** — no Google, no
third party, no OAuth console to keep alive. Auth.js v5 with JWT sessions and a
credentials provider; the only environment variable it needs is `AUTH_SECRET`.

Passwords are hashed with **scrypt out of `node:crypto`** at OWASP's parameters
(N=2^17, r=8, p=1) — about a third of a second and 128 MB each, which is the
point. Stored as `scrypt$logN$r$p$salt$hash`, so the cost can be raised later
and old hashes still verify; a sign-in against a weaker hash quietly upgrades
it. No native module, so nothing to break on a serverless build.

Guessing gets slower in the database, not in memory: five wrong tries buys a
minute, doubling to a ceiling of thirty. An unknown address is checked against
a decoy hash so it costs the same as a known one — otherwise "no such account"
is measurable with a stopwatch.

**The token carries one fact: which `app_user` row this is.** Not the
household, not the role. Those are read from Postgres on every request in
`src/db/membership.ts`, because a JWT lives for weeks and being removed from a
household — or dropped to viewer — has to bite on the next tap. Proven: change
a role in the database and the very next page load says so, cookie untouched.

Three roles: **owner** (also invites, changes roles, removes people, issues
reset links), **contributing member** (`adult` — adds, edits, budgets),
**viewer** (reads everything, changes nothing). A viewer is blocked inside
`saveEntry`, not by hiding the button, because a Server Action is reachable by
direct POST.

### Links are credentials, and the copy says so

With no outside identity to prove, **whoever opens an invitation link can take
that place**. That is the honest cost of dropping Google, so it is mitigated
rather than hidden: 256-bit tokens, only the SHA-256 stored (a stolen database
yields no working links), single use, seven days for an invite and one day for
a reset. The screen that hands the owner a link says all of it. A link is shown
exactly once — losing it means revoking and reissuing.

Nobody here can send email, so a forgotten password is recovered the way
anything else in a household is: **you ask, and an owner hands you a link.**
Which does mean an owner can take over any account — already true of someone
who can change your role and remove you, and pretending otherwise would only
have added a mail provider to the bill. Changing your own password needs the
old one.

### Anyone can open books; nobody can open somebody else's

`/signup` is open to all comers, and that is safe precisely because signing up
gets you **your own empty household and nothing else**. There is no door here
into anyone's existing books — that still takes an invitation from them. New
households get a thin starter kit from `src/db/starter.ts`: cash, one way to
pay, eight categories. Thin on purpose — nobody wants to arrive and find eight
of somebody else's bank accounts — but not empty, because an entry needs a way
to pay and a way to pay needs an account behind it.

**A person can keep several sets of books**: their own, a sibling's, the shop.
`app_user.active_household_id` says which set is on screen. It is a preference,
not a permission — `membershipOf` joins through `member`, so a stale or forged
value returns a household you are genuinely in or nothing at all, and
`switchHousehold` refuses outright. Proven: POST a household id you have no
business with and you stay exactly where you were.

Removed from your only household? `/no-household` offers the way out that
matters — start your own — rather than leaving you stranded waiting to be
re-invited.

`/signin`, `/signup`, `/join` and `/reset` are excluded from the proxy matcher —
all four have to open for someone not signed in yet.

**Timestamps are written with `now()`, never a JS `Date`.** Expiry is compared
against `now()` in Postgres so it should be set by the same clock — and a Date
handed to the driver through a bundled build is not always recognised as one,
which turns into a serialisation error at the worst possible moment. It did.

**Actions take `(prevState, formData)`** so they can go straight into
`useActionState`. Not a formality: an action wrapped in a client closure loses
its no-JS fallback, and the form then does nothing until the bundle has
hydrated — a real window of vanishing taps on a slow phone.

## Where the money sits

`/accounts` is the screen that makes everything else possible — a new household
has one cash account, so nothing realistic can be recorded until this exists.

**Balances are derived, never stored.** `account_balance` (0104) adds the
opening balance to every entry that has touched it. A written-down balance is
one that can disagree with the entries underneath it, which is exactly what the
audit of v1 found. Sign convention: a **credit account goes negative as you
spend on it**, because that is what owing money is; paying the bill moves cash
from the bank into the card and walks it back towards zero. The UI says "you
owe ₹X"; the arithmetic stays honest.

**A way to pay empties exactly one account.** The rail rules live in the
`method_funding_is_valid()` trigger — a card must draw on a credit account, UPI
on a bank or cash account, nothing draws on a person. The form only offers
pairings the database will accept, and `railProblem()` says the same rule in
words, because being told off after the fact teaches the rule the hard way.

**A card's statement day is what does the work.** Punch it in and every
purchase files itself into the right billing cycle through `txn_apply_method()`.
Days 1–28 only: the 31st silently becomes the 28th for four months of the year
and nobody notices until the bill is late.

Accounts and ways to pay are **archived, never deleted** — entries keep
pointing at them, so the months they appear in still add up. An account with a
live way to pay cannot be retired, and neither can your last way to pay.

## The voice

Labels, hints and empty states are **dry and a bit fatalistic** — "Own up to
something", "Show them the door", "invited and dawdling", "Ideal for the
relative with opinions". Money apps are grim enough.

The one place the joke stops: **anything that warns about consequence stays
unmistakable.** "Whoever opens this link becomes them" is bolded and literal,
because a reader who is amused but unclear about who can now see their salary
has been badly served. Wit in the label, plain fact in the warning.

## Open

- The Vercel project is `saree-al-hisab`, linked to `idiot95/Saree-al-Hisab`
  with root directory `web`. `AUTH_SECRET` is set in all three environments and
  is the only secret sign-in needs.
- Auth.js trusts the host automatically on Vercel. Running `next start` by hand
  needs `AUTH_TRUST_HOST=true`, which is why it is not in the committed config.
- Deployment protection is still on. Claim the household through `/setup`
  before lifting it, or the first stranger to find the URL owns the books.
