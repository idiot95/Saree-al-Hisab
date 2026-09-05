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
    npm run test:invariants    # 78 assertions against real Postgres
    npm run test:lib           # money, password hashing and link tokens
    npm run tokens             # regenerate tokens.css from the canvas palette

Neon is provisioned through Vercel; `DATABASE_URL` lives in `.env.local`,
which is gitignored. Migrations are tracked in a `_migration` table — the
`00xx` files run once, the `01xx` views and triggers re-apply every run
because they are idempotent, so a changed view ships without a new file.

## Proven, not assumed

`npm run test:invariants` tries to BREAK each rule and expects Postgres to
refuse. 78 assertions currently pass, covering: a move can never look like
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

**Plain.** Buttons say what they do — "Add account", "Create invitation",
"Sign in", "Save", "Archive". Labels are nouns, not jokes.

Descriptions earn their place or they are cut. A hint stays only when it
prevents a mistake ("Use a day between 1 and 28"), explains something the app
does invisibly ("Spending on this method is recorded against this account"), or
warns about consequence. Everything else was the app talking about itself.

The warnings stay blunt: "Anyone who opens this link can take that place in the
household." That is a fact the reader has to act on, so it is stated flatly and
bolded.

## Security posture

**Sessions are revocable, despite being JWTs.** `app_user.sessions_valid_from`
is a per-account epoch; the token's `iat` is passed through the session and
compared against it on every request. Changing a password, using a reset link,
or "Sign out everywhere" moves the epoch, and every cookie older than it stops
working on the next tap. Without this, a stolen cookie stayed good for 30 days
and changing your password was cosmetic.

**One round trip decides everything about the caller.** `contextFor(userId,
iat)` returns household, role, household name and staleness in a single query —
because the database is not always next door, and every extra round trip is
paid by whoever is furthest from it.

**Headers.** `next.config.ts` sets HSTS, `X-Content-Type-Options`,
`X-Frame-Options: DENY`, COOP/CORP, a closed `Permissions-Policy`, and
`Referrer-Policy: no-referrer` — that last one matters here specifically,
because `/join/<token>` and `/reset/<token>` put a credential in the URL.
`poweredByHeader` is off.

**CSP with a per-request nonce**, set in `src/proxy.ts`. Next inlines a
bootstrap script on every page, so a policy without a nonce would need
`'unsafe-inline'` and be worth very little. With one plus `'strict-dynamic'`,
`script-src` is genuinely closed. Verified: every script tag carries the nonce
from that response's header, and none are un-nonced.

**Rate limiting is in Postgres** (`rate_limit`), not in memory, for the same
reason the lockout is: a serverless process is torn down every few requests.
The account lockout stops grinding at one account; this stops the same effort
being spread across many. Sign-in 10/15min, sign-up 5/hour, reset and join
10/15min, keyed on a hash of the forwarded address — which is used for counting
only, never for authorisation, because it can be forged when nothing is in
front of us.

**`redirect()` works by throwing**, so every `catch` around an action helper
calls `rethrowControlFlow(e)` first. Without it, "you have been signed out"
arrives as "something went wrong".

Also: no `sql.unsafe` anywhere, every query scoped by `household_id` or a
user-derived id, no `dangerouslySetInnerHTML`, and constraint failures log the
error code and constraint name only — a Postgres error carries the offending
row in `detail`, which here means amounts and merchant names.

## Where it runs

**Both halves are in Singapore** — Neon `aws-ap-southeast-1`, Vercel functions
`sin1` — so the server sits next to the database and each query costs single
digits rather than a hop across the Pacific.

Mumbai would be closer still, and **Neon has no Mumbai region**: the choices are
`cle1, iad1, pdx1, fra1, lhr1, syd1, sin1, gru1`. Putting the functions in
`bom1` while the database stayed in Singapore would have split them and made
every extra query cost 35 ms instead of 2, so both went to `sin1` together.

Measured from a laptop in India: warm round trip **259 ms → 82 ms**, and page
loads **~550 ms → ~160-210 ms**.

`APP_DATABASE_URL` is what the app actually reads, falling back to
`DATABASE_URL`. A marketplace store cannot be renamed or moved between regions,
so the override is what makes changing region a configuration change instead of
a race between disconnecting one store and connecting another. Every script
resolves it the same way, so migrations and tests can never drift onto a
different database from the app.

The old `us-east-1` store is still connected and still holds an identical copy.
Delete it only once the new one has been lived in for a few days.

## The budget, which everything reports against

`/budget` sets an amount per category per month. Spending comes from
`spend_txn`, never `txn` — that view is where "a transfer is not spending" and
"a refund nets off" actually live, so the budget cannot disagree with the
ledger.

**Each month is its own set of figures.** Editing September never rewrites
August: every write is scoped to one month, and a new month can start as a copy
of the last (`on conflict do nothing`, so it can never overwrite work already
done). An amount of zero deletes the row rather than storing a zero, so
"unbudgeted" and "budgeted nothing" stay the same thing.

`MonthSoFar` on the home screen carries a **pace marker**: a tick on the bar for
how far through the month it is. Being 60% through the money is fine on the
20th and a problem on the 6th, and only one of those is visible from a total.

## The ledger

`/entries` lists a month at a time, newest first, grouped by day. Tap one to
correct the amount, the date, the category, the merchant, the note or how it
was paid. Deleting sets `deleted_at`; every view already filters on it, so the
figures move at once while the row stays on record.

**What an edit may NOT change is the kind.** Turning an expense into a transfer
changes which shape rules apply and which columns must be filled, and quietly
rewriting a row into a different shape is how a ledger starts disagreeing with
itself. The screen says so and offers delete-and-re-add instead.

**Correcting how something was paid moves the money.** That took a trigger fix:
`txn_apply_method` only stamped `account_id` when it was NULL, so on an UPDATE
it did nothing — "paid by GPay" corrected to "paid by the card" would have left
the money on the bank and the edit would have been cosmetic. It also never
cleared `card_cycle_id`, so a purchase moved off a card kept riding that card's
bill. Both are fixed and both have assertions.

A budget line drills into its own entries (`/entries?c=…`), which is what makes
a number answerable rather than just a number.

## Lending, and the three things that are not the same

`/people` is the khata. A person IS an account underneath — kind `person` —
which is what makes "what Ahmed owes" the same sort of figure as "what is in
the bank": computed from the same entries by the same view, rather than tallied
separately and left to drift. Person accounts never appear in a picker
(`real_account` excludes them) and no payment method may draw on one.

Three operations, deliberately distinct, because conflating them is how a
household ends up thinking it overspent:

1. **Lending** is a `transfer`. Money moved from your account into theirs. It
   never touches the budget, because you have not spent it.
2. **Getting it back** is also a `transfer`. Not income — it was never
   spending, so recovering it is not earning.
3. **Writing it off** is an `expense` on the person's account, and it **does**
   count, in the month you forgive it. That is when the money is actually gone.

The third one required changing `spend_txn`: it excluded person accounts
wholesale, which would have made forgiving a debt invisible. Lending is still
excluded — by KIND, since transfers never count — so the only thing an expense
on a person account can be is a write-off, which is exactly what should count.
Four assertions hold the three cases apart.

Proven end to end: lend ₹10,000, take ₹4,000 back, write off ₹6,000 — the
balance goes to zero, ₹6,000 is recorded as spending, and cash is down ₹6,000.
The money that never came back equals the money recorded as spent.

### Reimbursements are the fourth case, and not a loan

"I paid, they owe me half" is not lending. Lending moves money into someone's
account and never counts as spending. A reimbursement is spending that already
happened and **stays counted** — what is outstanding is a claim against a
person, not a balance in an account. That is why `claim` is its own table and
`counterparty_claims` sits beside `counterparty_balance` rather than feeding
into it. The person's screen says the two apart, because conflating them is
what makes a khata stop being trusted.

How much has come back is DERIVED in `claim_state` from the `claim_receipt`
entries pointing at the claim, never stored — a counter is a number that can
disagree with the entries beneath it. A `claim_receipt` carries a claim and
nothing else does, enforced by a CHECK, and it is in neither `spend_txn` nor
`income_txn`: money returning is not earning, and it does not reduce what the
month cost.

Proven end to end: a ₹2,000 dinner with ₹1,000 claimed, settled in two
payments. Month spending stays ₹2,000 throughout, income never moves, and cash
ends at −₹1,000 — what you actually bore.

`ledger_book` and `book_member` exist for grouping people into named books; the
screens for them are not built yet.

## The UX laws, and where each one shows up

- **Jakob** — a bottom tab bar, because every finance app people already use has
  one. Before it, you had to walk back to home to get anywhere.
- **Fitts** — tab targets are 60px in the thumb zone and Add is centre and
  raised. The budget's Save is sticky at the TOP, not the bottom, because a
  bottom bar sits under the phone keyboard the moment someone types a number.
- **Hick** — five tabs and no more. The home tiles were deleted once navigation
  became persistent: the same four choices twice is just more to read past.
- **Miller** — the month view shows the top four categories, not all eight;
  getting-started is five steps; the guide is six sections.
- **Tesler** — the irreducible complexity is absorbed by the app, not handed to
  the person: the payment method decides the account, a card files its own
  billing cycle, balances are derived from entries.
- **Doherty** — the budget total recalculates as you type rather than on submit,
  and pages went from three or four database round trips to two.
- **Gestalt** — common region (cards), proximity (a category's name, spend and
  amount on one row), similarity (one tint per category everywhere).
- **Serial position** — home leads with the month and ends with one quiet link.
- **Von Restorff** — over-budget is the only red; Add is the only filled tab.
- **Postel** — amount fields accept `₹`, commas and spaces and keep the digits.
- **Aesthetic-usability** — one token set, one header background, one card
  shape. The header's ruled-paper stripes were removed: on a phone they read as
  banding, and a texture that looks like a rendering fault costs more trust
  than it buys.

## Teaching the app

There is no coach-mark tour. Two things do the job instead:

- **`GettingStarted`** on the home screen — four steps that tick themselves off
  from real rows (`setupProgress`), not from a flag somebody has to remember to
  set, so it cannot drift out of step with what the household has actually
  done. It disappears when all four are complete.
- **`/guide`** — five short sections on how the app is meant to be used,
  reachable from home at any time, because the questions it answers come back
  weeks later.

Empty screens open the relevant form themselves rather than making someone tap
"add" first.

## Open

- The Vercel project is `saree-al-hisab`, linked to `idiot95/Saree-al-Hisab`
  with root directory `web`. `AUTH_SECRET` is set in all three environments and
  is the only secret sign-in needs.
- Auth.js trusts the host automatically on Vercel. Running `next start` by hand
  needs `AUTH_TRUST_HOST=true`, which is why it is not in the committed config.
- Deployment protection is still on. Claim the household through `/setup`
  before lifting it, or the first stranger to find the URL owns the books.
