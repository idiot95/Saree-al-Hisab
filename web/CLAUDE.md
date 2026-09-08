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
- **One currency per household, chosen at setup.** `household.base_currency`
  is picked on `/setup` and can be changed on `/household` only until the first
  entry; `txn.currency` and `fx_rate` stay so a foreign entry with a rate is
  possible later. See "The household's currency" below for how it reaches the
  screen.
- **Scanning**: receipts and screenshots through the user's own Gemini key.
  Voice was dropped — microphone access is unreliable in an installed iPhone
  PWA. A scan always produces a DRAFT in the Inbox, never a posted entry, and
  `kind` is the highest-stakes field: anything below high confidence lands as
  `unknown` and blocks Confirm.

## Running it

    npm run migrate            # in filename order; --reset drops and rebuilds
    node scripts/app-role.mjs  # rotate the app role's password; --verify proves a policy bites
    npm run test:invariants    # 143 assertions against real Postgres
    npm run test:lib           # money, password hashing and link tokens
    npm run test:contrast      # every ink/ground pair, both themes, WCAG
    npm run tokens             # regenerate tokens.css from the canvas palette

Neon is provisioned through Vercel. `.env.local` (gitignored) holds the same
database under TWO roles and one stray store. `APP_DATABASE_URL` connects as
`saree_app` — the role the app runs as, which owns nothing and cannot bypass
a row policy (`src/db/client.ts` reads it, falling back to `DATABASE_URL`).
`OWNER_DATABASE_URL` connects as `neondb_owner` and is what `migrate`,
`test:invariants`, `seed` and `scripts/app-role.mjs` use, because creating a
table or a policy takes the owner. `DATABASE_URL` is a first-connected
marketplace store in the wrong region that nothing uses. The scripts prefer
`DATABASE_URL` when it is in the *environment*, so with the file sourced run
them as `env -u DATABASE_URL node scripts/migrate.mjs` (and the same for the
invariants) or the migration lands on the wrong store. Migrations are tracked
in a `_migration` table — the `00xx` files run once, the `01xx` views and
triggers re-apply every run because they are idempotent, so a changed view
ships without a new file.

Two things the runner learned the hard way. **Views come down before generated
migrations** and go back up on the same run, because Postgres will not alter a
column a view reads and a generated file has no way to know which views those
are. And **each file applies in one transaction**, so a failure part way leaves
nothing behind — a half-applied migration is not recorded, so it runs again, and
now its first statements fail because they already happened. The one exception
is a file that ADDs an enum value, which Postgres refuses to let the same
transaction USE; those still run statement by statement.

## Proven, not assumed

`npm run test:invariants` tries to BREAK each rule and expects Postgres to
refuse. 143 assertions currently pass, covering: a move can never look like
spending, `spend_txn` is the only definition of spending, refunds net off in
the month they land, a card purchase files itself into the right cycle, a
payment method is a rail and not a balance, lending never touches the budget,
duplicates are detected but never prevented, budgets are one row per
category per month keyed on the first, an invitation is single-use and its
plaintext is nowhere in the database, a password cannot exist without an
address to use it with, and an account that has recorded entries cannot be
deleted at all — the ledger holds it in place — and one person can keep
several sets of books without either set knowing about the other, and a
balance is only ever the sum of the entries beneath it whatever the entries
count as, a cost carried for someone else is never counted as spending while a
cost you bore and expect back still is, shares add back up to the paisa, a cost
laid out on a credit card still reaches that card's bill, a card due before its
statement day still takes a purchase and moving the days re-files the unpaid
ones, an entry delivered twice under one `client_ref` is one row, and —
connected as the app's own role with one household set — another household's
rows are not there to be read, written, moved into, or deleted, even when
asked for by primary key, through a view, or through a child table whose only
link to the household is its parent.

    npm run seed you@example.com   # fills YOUR books with the designs' data

## Where the slice reaches

`/add` is wired end to end: real categories, ways to pay and accounts come out
of Postgres, and Save writes a row through `saveEntry`.

**Every account is a way to pay, and every one of them is on screen.** The
first cut of `/add` offered only the *rails* — GPay, the card, net banking — so
a household whose recurring deposit or second savings account had no rail of
its own could never record money leaving it, and the ones it could reach sat in
a strip that scrolled sideways past the edge. Now `/add` is a two-step
wizard. **Step 1** — the header (kind tabs and the amount) plus "How did you
pay" and "When"; **Step 2** — "Category" (the household's four most-used
choices first, then a compact two-column parent grid; opening a parent reveals
only that family's children, and search finds and selects either level directly
with every child labelled as a subcategory), "Where",
"On a tab", Shared, and Save. Transfer has no category, so it is one step
with "To which account" under "From which account". Step 2's header is a one-line summary of step 1
with "Change", so nothing decided is out of sight. **There is no drawn
keypad**: the amount is a plain `<input inputMode="decimal">` that takes the
phone's own keyboard and formats as it is typed — `typed()` tidies what the
keyboard gave, `keysDisplay()` groups the rupees and leaves the paise exactly
as typed (`2,340.5` mid-entry), `settle()` fills the minor digits on blur
(`2,340.50`). Every choice is a wrapping row of chips — nothing scrolls
sideways, so what is offered can be counted. "How did you pay" is
`PayPicker`, **one question with one flat list of concrete answers** in the
words a person uses. It used to be two rows — accounts (a credit card beside a
savings account, which reads as two kinds of thing on one row) and then a
"via" row of apps — and nobody thinks of paying that way. Now `flatWays()` in
`src/lib/pay.ts` lays out, for each account, every rail that draws on it and
then the account itself; `describe()` in `PayPicker.tsx` turns each into a
`WayTile` — the rail's icon, its name in bold and small print saying what
stands behind it ("GPay / ICICI Savings", "Cash / Cash in hand", "ICICI
Savings / Debit card or NEFT", "ICICI Amazon Pay / Credit card"). One tap
settles both the account and the rail the ledger writes. **A credit card is
one tile, never two**: `ownRail()` treats a rail that shares the account's
name, a `card` rail on a `credit` account, or a `cash` rail on a `cash`
account as the account itself, so the tile's reference is that rail and the
card's cycle still files it. The default rail's tile leads; `isFlat()` keeps
a tile lit whether the stored reference names the account or its own rail.
The transfer form's "To which account" is the same tiles for accounts alone,
leaving out the one the money is leaving. The Accounts screen tells the same
story: each bank or cash row lists "Paid through GPay, PhonePe", the rails
live under "Ways to pay" with a plain-words explanation, and every string
says "way to pay", "linked to", "takes money from" — never "payment method".
Credit accounts are physical-proportion card faces rather than ledger rows.
Each stores its last four digits, issuing bank and network (`0025`), renders
the locally held bank and Visa/Mastercard/Amex/RuPay SVG marks, and keeps the
outstanding amount and bill dates on the face. The face itself swipes to reveal
Edit and Pay; cards stack vertically, so horizontal movement has only that one
meaning. The same account form opens in place, and Pay hands a prefilled
transfer to `/add`.

The client sends `paidWith`, a string reference from `src/lib/pay.ts`:
`a:<account id>` means paid straight from the account (`txn.account_id` set,
`payment_method_id` NULL) and `m:<rail id>` means paid over the rail, whose
account follows from it. A bare uuid is an old queued draft and is read as a
rail. `waysToPay(householdId)` in `src/db/payment.ts` is the one query that
lists accounts with their rails nested, and `resolvePayment(householdId, ref)`
is the one place a reference becomes `{ account_id, payment_method_id }` — it
returns null for anything that is not this household's, and every action that
takes a payment goes through it (`saveEntry`, `updateEntry`, `createSchedule`,
`settleTab`, `lend`, `recordRepayment`, `settleClaim`). The flat forms —
EditEntry, NewSchedule, the tab and person sheets — use the same `PayPicker`
(`src/app/PayPicker.tsx`), with a `name` so it carries the reference in a
hidden input; there is no `<select>` of payment modes anywhere, because one
listing every rail under every account showed "ICICI Amazon Pay" twice and
read as nonsense. Wrap it in a `<div role="group">`, never a `<label>` — a
label around buttons activates the first chip. The entries list shows the
rail when there is one and the account when there is not. `sw.js` is v16 for
the flat picker, compact searchable category picker and local brand artwork.
Before Save, a debounced
`checkDuplicate` shows what a household member already recorded within ±1% and
±2 days, which is the prevention half of the duplicate rule; the Inbox card is
only the fallback.

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

**What the owner sends is a message, not a link.** A bare link in a chat is
a puzzle — where does it go, what happens there, is it safe — so
`InviteForm` composes the whole thing: who is inviting, into which household,
the two steps that follow (open it; put in your name and a password, and you
are in), what to do if you already have an account, and what the link is and
when it dies — the expiry quoted from the row the database wrote, not
re-derived on the phone. Share hands it to whichever app the phone offers
(`navigator.share`, detected through `useSyncExternalStore` so the server
render matches); Copy message is for everywhere else; the link alone is one
tap further down.

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

## The household's currency

Every household keeps its books in one currency, chosen on `/setup` right after
the account is created (`/signup` asks for you; `/setup` asks for the books —
someone who was invited never sees the second screen). `CURRENCIES` in
`lib/money.ts` is the whole list — 57 of them, and **each carries its own
count of minor-unit digits**: two for nearly all, three for the dinars and the
Omani rial (1.500 KD is 1500 fils), none for the yen, won, dong and Ugandan
shilling. The ledger stores minor units whatever the currency, so **nothing
outside `money.ts` multiplies or divides by a hundred** — `digitsOf`, `unitOf`,
`toKeys`, `fromKeys` are the only way between a figure and its minor units,
and `useMoney()` binds them all to the household. A currency with no symbol
that reads on a phone uses its code, joined by a no-break space
(`AED 1,250`); the amount field shows the code beside the symbol only when
the symbol does not already spell it.

**Where the currency comes from depends on which side renders.** Client
components call `useMoney()` from `app/currency.tsx` and get `{ currency,
symbol, format, keysDisplay }` bound to the household — they render twice, so
context is the only hydration-safe path; never import a bare `format` into a
`'use client'` file. Server components call `format(minor)` bare: `db/queries`
installs a resolver backed by React's per-request `cache()`, set when
`currentActor`/`actorOrNull` resolve, so two households rendering at once on
one Fluid instance never share a symbol. Tests and the client bundle before a
provider fall back to rupees.

**The database fills `txn.currency`, so no insert path has to.** The column
has no default; trigger 0107 (`txn_currency_shape`) copies the household's
`base_currency` onto a NULL, and refuses a different currency without an
`fx_rate`. `household_currency_fixed` refuses changing `base_currency` once a
single entry exists — the UI says "fixed, the books hold entries". Accounts
carry `currency` explicitly on insert (starter kit, `/accounts`, person
accounts) from `actor.currency`. `PageContext`/`currentActor` expose
`currency`; `entryCount()` is what the settings row checks.

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
A rail is optional: an account with none is still a way to pay, and an entry
paid from it directly carries `account_id` with `payment_method_id` NULL.
`txn_apply_method()` only overwrites `account_id` from a rail when a non-null
rail is set on the row, so a direct payment is left alone and a later edit
that swaps the rail for an account moves the money (and clears the card cycle).

**A card's statement day is what does the work.** Punch it in and every
purchase files itself into the right billing cycle through `txn_apply_method()`.
Days 1–28 only: the 31st silently becomes the 28th for four months of the year
and nobody notices until the bill is late. The due day is turned into a date by
`cycle_due(statement_day, due_day, period_end)` (0103): a due day *after* the
statement day falls in the statement's month, one *before* it falls in the
next — a card that statements on the 25th and is due on the 10th could not
take a single purchase before this, because the trigger computed a due date
earlier than the statement and `due_after_statement` refused the cycle.

**An account is edited in place — same id, same kind.** Tap it on `/accounts`
and `EditAccount` opens: name, last four, the balance before the first entry,
and for a card its limit, statement day and due day (`editAccount`). The kind
is not editable, because the entries beneath it were recorded on the rails of
that kind. Moving a card's days re-files every purchase on an *unpaid* bill —
`update txn set occurred_on = occurred_on` is enough, since the filing trigger
runs on any UPDATE and reads the days fresh — then re-dates the unpaid cycles
and deletes any left empty. A **paid** bill keeps exactly what it had: the bank
has already been paid for those purchases. Archive lives in the same panel,
behind a second tap.

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

**Postgres refuses another household's rows itself** (`drizzle/0109_rls.sql`).
This is defence in depth, not a new boundary: every query was already scoped
by `household_id`, and the policies exist so that the one query that someday
forgets gets zero rows instead of somebody else's books. The finding that
made it necessary: Neon's `neondb_owner` carries `BYPASSRLS`, so a policy is a
no-op for it. The app therefore connects as **`saree_app`**, a plain login
role (no bypass, no ownership, no `_migration`), and every household-scoped
table has `ENABLE` + `FORCE ROW LEVEL SECURITY` with one policy:
`household_id = app_household()`, where `app_household()` reads the
transaction-local setting `app.household_id`. Children without their own
`household_id` (`book_member`, `card_cycle`, `claim_item`, `occurrence`,
`duplicate_dismissed`) reach it through `EXISTS` on their parent — the last
one through both of its entries. `household`, `member` and `invite` are open
*when unscoped* and pinned when scoped, because sign-in, choosing a household
and accepting an invitation happen before there is a household to scope by.
The set with no policy is exactly `_migration app_user device
password_reset rate_limit` — none has a `household_id`. Views run as the
caller (`security_invoker`); note that `CREATE OR REPLACE VIEW` without
options silently clears that flag, which is why `0109` runs last, re-applies
every run, and sets it on every view in a loop. The invariants test checks
all of it against the catalog, so a view file that forgets fails the run.

In code, `withHousehold(householdId, fn)` in `src/db/client.ts` opens a
transaction, sets the household, runs `fn`, and commits — every action and
every page query runs inside one. The `sql` the modules import is a proxy
that **throws outside `withHousehold()`** rather than running unscoped, and
its `sql.begin` becomes a savepoint. `identity` is the raw pool for the four
things that legitimately have no household yet — sign-in, membership,
`createHousehold` (which sets the household before the starter kit lands),
rate limiting. Two consequences worth knowing: `redirect()` inside the scope
commits first and then rethrows, so a successful action that redirects is
not rolled back; and a query that fails inside the scope aborts the whole
transaction even if the action catches it — the app's own answer is what
the user sees, but nothing before the failure is kept. Foreign-key checks
bypass policies by design, and trigger functions run as the caller, so the
card-cycle and occurrence triggers work inside the scope without any
`SECURITY DEFINER`.

`scripts/app-role.mjs` owns the role's password: the default run generates a
new one, rewrites `APP_DATABASE_URL` in `.env.local`, and pushes it to Vercel
(production and preview as sensitive, plus development); `--no-vercel` stops
after the file; `--verify` touches nothing and proves a policy bites — same
`count(*)` on `txn`, owner sees rows, app role unscoped sees none. Order
matters when the app role is new or the setting name changes: **deploy the
code that sets `app.household_id` first, then switch the string** — the old
code connected as `saree_app` would render every real household empty.
Rotating the password never touches the owner string, so the local step is
always safe on its own.

**`/terms` is the security posture in the user's words**, public (the proxy
lets it through), linked under the sign-up button and from Household. Every
line on it is a claim the code makes good on — scrypt, AES-256-GCM for the
Gemini key, TLS-only Postgres, the per-request membership check, revocable
sessions — and the two it cannot yet (no account deletion, no export) are
said as plainly. When one of those changes, change the page and its date.
The README at the repo root is the "run your own copy" the page points at.
The repo is public and has no LICENSE file; that choice is the owner's.

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
a race between disconnecting one store and connecting another. The scripts read
`OWNER_DATABASE_URL` — the same host and database as the app's string under
the owning role — so migrations and tests can never drift onto a different
database from the app, and `scripts/app-role.mjs` builds the app string from
the owner's so the two cannot drift apart either.

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

Four operations, deliberately distinct, because conflating them is how a
household ends up thinking it overspent:

1. **Lending** is a `transfer`. Money moved from your account into theirs. It
   never touches the budget, because you have not spent it.
2. **Getting it back** is also a `transfer`. Not income — it was never
   spending, so recovering it is not earning.
3. **Writing it off** is an `expense` on the person's account, and it **does**
   count, in the month you forgive it. That is when the money is actually gone.
4. **Paying for something they owe you back for** is a claim — the tab case
   below. Whether it also counted as your spending is a separate question the
   entry answers for itself.

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

### Tabs, and the two questions people conflate

`/tab/[id]` is a **tab**: a few people who owe you back — the flat, a trip, the
office petrol, the medical bills an insurer refunds. A cost put on it raises one
`claim` per person for their share the moment it is saved, in the same
transaction as the entry.

**"Is it owed back" and "was it my spending" are different questions**, and
conflating them is the whole reason this took two goes. Petrol you burn for work
is *both* — you consumed it, and the office pays you back. Rent you front for a
cousin is *neither* — the money left your account and was never yours to spend.
So the claim answers the first question and `txn.counts_as_spend` answers the
second, and `spend_txn` reads that flag. **The flag lives on the entry and
nowhere else** — a tab-level default was tried and dropped (0020), because the
same office tab carries the petrol you burned and the colleague's ticket you
fronted. Add Entry asks on every cost put on a tab, with two answers side by
side; `tabsForEntry.last_counts` (the last cost's answer on that tab) preselects
one, and the entry page lets you revisit it, but only on a cost somebody owes
for — untick it on a plain expense and it would simply vanish from the month.

**The reimbursement source is just a counterparty.** "Office" and "Insurer" are
people as far as the ledger is concerned, which is why none of this needed new
machinery. **Only part of a cost need come back**: `tabCoveredMinor` says how
much, absent meaning all of it.

Everything else follows the rules that were already there. A cost that counts is
in `spend_txn` and stays there — being paid back does not unspend it. Money back
is a `claim_receipt`, in neither `spend_txn` nor `income_txn`, spread across the
person's open claims on this tab **oldest first** so a part payment clears the
oldest entries whole. A balance is still the sum of the entries beneath it,
whatever they count as, so a cost carried for someone still empties the account
it left. Leaving a tab leaves what you already owe standing; closing is filing,
not settling; deleting takes only the tab.

**People are named, not picked from a list.** Opening a tab (and "Add someone"
on it) takes ticked existing people *and* typed names; `people/ensure.ts`
finds-or-creates each name inside the caller's transaction — case-insensitive
match on a non-archived counterparty, else a `person` account plus a `friend`
counterparty. A tab with no name and exactly one person is named after them.
The phone's address book comes through the Contact Picker API
(`navigator.contacts.select`), which exists on Chrome for Android and nowhere
else, so the "Contacts" button appears only when the API does
(`useSyncExternalStore`, server snapshot false) and the typed name is the
primary path, never a fallback.

**Money coming in can clear what is owed.** The income screen lists every open
claim (`openClaimsFor`); tick some and the amount is spread across them oldest
first as `claim_receipt` rows, and only what is left over is recorded as
`income` — which is why a category is required only when there *is* a leftover.
The same receipt path serves the tab page, where "Settle up" can be told which
entries (`claimId[]`) the money was for; none ticked means all of them.

**A charge on a card is a charge whoever bears it.** `txn_apply_method` filed
only expenses into a billing cycle, so a cost laid out on a credit card raised
the card's balance and never reached the statement. Transfers out of a credit
account are filed too now; money *into* one is a `card_payment` and excluded.

**A transfer may carry a category, but only into a person.** That is for the
`/people` lending path, where money is handed over rather than spent on
something. Held by the `txn_category_shape` trigger, since a CHECK cannot see
another table. Fifteen assertions cover the tab rules.

## The inbox

`/inbox` is where things that want a decision surface, and nothing else does.
An inbox that collects notices nobody can act on stops being read, and then the
one item that mattered is missed along with the rest.

**Possible duplicates**, from the `duplicate_candidate` view that has been
there since the ledger was built and had nothing showing it. Both entries are
put side by side whole, because what DIFFERS between them is the question —
rule B in particular flags entries on different accounts, which is exactly the
case where a pair looks least alike and is most likely to be one purchase. "They
are both real" is written to `duplicate_dismissed`, so a pair never asks twice.

**Card bills** as their due date approaches. This one needed a fix:
`card_open_cycle` returns the NEWEST open cycle per card, which is right for
"what is riding on this card now" and exactly wrong for "what do I owe soon" —
it hid a bill due in five days behind a cycle that had just opened. `billsDue`
goes over every unpaid cycle instead. Three assertions hold the two apart.

The home screen shows the count only when there is something in it.

## Scheduled payments, without a scheduler

`/schedules` holds the things that come round anyway — rent, fees, an EMI.

**Nothing is materialised ahead of time.** Upcoming dates are computed from the
rule when they are asked for, and an `occurrence` row is written only when
something HAPPENS to one: paid, or skipped. So there is no cron to run, nothing
to backfill, and a schedule created today is immediately right about next month
without a job having visited it.

Rules are a narrow but genuine subset of RFC 5545 —
`FREQ=MONTHLY;BYMONTHDAY=5` — so the column means what it says. `src/lib/recur.ts`
parses only the subset it writes and refuses everything else rather than
half-understanding it. Days cap at 28: the 31st silently becomes the 28th for
four months of the year, and a rent reminder that moves is worse than none.

**Nothing is recorded until you say so.** A schedule is a reminder with the
details filled in, not a standing instruction writing entries behind your back.
Recording writes the entry and the occurrence in one transaction, so a schedule
cannot show as paid with nothing in the ledger to show for it — `paid_has_txn`
refuses it. The amount can be overridden for a month that differed.

A schedule has a **kind**: rent goes out, a salary comes in. Same calendar,
opposite sign — `recordDue` writes an `income` entry for an income schedule,
the row says "expected" rather than "due", and the screen totals the two
separately. A transfer cannot be scheduled; it is a payment or a receipt.

Two things testing caught. `schedule.created_at` exists because without it a
schedule added today would immediately claim you had missed last month's rent —
dues before the schedule existed are history the app was not present for, not
failures. And "next" respects what has already been settled, or paying today's
rent leaves the screen still offering today.

**A schedule can end, and can keep Hijri time.** An end is always stored as a
date — `;UNTIL=20270110`, RFC 5545's DATE form — never as a count: "five
times" is turned into the fifth date in `createSchedule`, so the stored rule
says everything on its own and nothing has to count what has happened. A rule
whose UNTIL is before today is *finished*: it drops out of dues and the
monthly total, and `/schedules` lists it under "Finished" with a Remove rather
than a Stop. A past end date is refused at creation.

The same grammar is used on the Misri (Dawoodi Bohra) calendar, in its own
column: `schedule.hijri_rule` holds `FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=1` for
the 1st of Ramadaan, `schedule.rrule` stays NULL, and the table's CHECK
(`has_a_rule`) insists on exactly one of the two being present. UNTIL is a
Gregorian date on both calendars, because it is compared against the ledger's
dates and there must be one way to read it. `ruleOf(s)` in `recur.ts` is the
only place that decides which column applies; everything else — dues, next
date, description — takes the pair it returns. Day caps differ: Gregorian 28,
Hijri monthly 29, Hijri yearly 30 in an odd month (always 30 days) else 29.

The calendar itself is `src/lib/hijri/`, a typed integer port of
`@mygulamali/hijri_date` (MIT; the licence sits beside it). It is the tabular
Misri calendar — Kabisa years by remainder, odd months 30 days, even 29,
Zilhaj 30 in a Kabisa year — so every date ahead is already known, which is
what makes "the 1st of Ramadaan, until 2030" a rule and not a sighting.
`hijri.reference.tsv` is 2,961 dates 1900–2200 sampled from the original
library; the lib test checks every row, both directions, plus day-by-day
continuity over thirty years. The port deliberately differs from the
original on one point: the last day of a 30-year cycle stays in that cycle
rather than becoming day 0 of the next.

One convention that fell out of it: a lib module importing a sibling folder
writes the extension in full — `from './hijri/index.ts'` — because Turbopack
does not resolve `./x/index.js` to a `.ts` file. `allowImportingTsExtensions`
in `tsconfig.json` permits it, and `rewriteRelativeImportExtensions` in
`tsconfig.lib.json` rewrites it to `.js` in the Node emit that the lib tests
run against. App code keeps importing `@/lib/hijri` as before.

**The month is a calendar, drawn from the same rules.** `Calendar.tsx` on
`/schedules` is a client component that calls `datesInMonth` for every
schedule (finished ones included) and lays the results on a Monday-first grid,
each cell carrying its Hijri day and the 1st of a Hijri month naming it. Nothing
is fetched to draw a month; the page passes down the rule, the `since` date and
the schedule's occurrence rows, and the grid decides for itself. A dot per
item — out, in, overdue as a hollow ring, done faded. Tapping a day opens a
bottom drawer (`Sheet.tsx`: veil at z41, dialog at z42 above the tab bar,
Escape, scroll lock, focus to the handle) with a `DueRow` for anything still
open, or the status word and a link to the entry for anything settled. Recording
from the drawer is offered only within a fortnight of the date, so the calendar
cannot be used to pay November in September.

**A due can move, once or for good.** `occurrence.due_on` stays the date the
rule produced — it is the row's identity, unique with the schedule — and
`occurrence.shifted_to` is where it went. A `pending` row exists only to record
a move (CHECK `pending_is_a_move`) and a move is never to the same day (CHECK
`moved_elsewhere`); `recordDue` files the entry on `shifted_to` when set.
`outstandingDues` and `nextUnsettled` map through the moves, so a nudged due
appears on its new day everywhere and says "moved from 10 Sep". A move is
bounded: a month earlier to three months later. Choosing "make this the day,
every month" rewrites the rule through `rewriteRuleTo` (same calendar, same
UNTIL, refused past the day cap) and stamps `schedule.rule_since`; `since` in
`schedulesFor` is the greater of `created_at` and `rule_since`, so the new rule
does not retroactively owe dates it would have produced before the change. The
pending row is deleted in the same transaction — the new rule generates that
date itself. Home lists what is due today or overdue with the same row — "paid,
or moved?" — so the answer is a tap away without opening the schedules screen.

**A category may sit under one other, and no deeper.** `category.parent_id`
points at a parent in the same household — the FK is composite,
`(parent_id, household_id) → (id, household_id)` over the unique index
`category_household_key`, so a cross-household parent is impossible, and it
cascades. Two triggers in `0108` hold the shape: `category_one_level_check`
(a parent has no parent of its own; a category with children cannot move
under another) and `budget_on_parent_check` (a budget line belongs to the
parent — children roll up, they are never budgeted). `budgetFor` and
`categoryTrend` build a `fam` CTE (`array_prepend(c.id, array_agg(k.id))`)
and sum spend and budget over the family, so a budget row a child earned
before it moved under a parent still counts towards that parent's line;
`entriesFor` filtered by a parent includes its children; `BudgetRow.kids`
is the "of which Milk ₹500" line. Retiring a parent retires its children in
the same UPDATE (one `now()`), and restoring it brings back exactly the
children that share that timestamp — a child retired earlier on its own stays
retired; restoring a child restores its parent. `sort_order` runs among
siblings; `reorderCategories` takes the top-level set only and the family
drags as one block. Add Entry's step 2 is `CategoryGrid`
(`src/app/add/CategoryGrid.tsx`): the top level as compact tiles, only the
chosen family's children beneath, and a search box over the rows already in
memory that selects a matching child directly and labels it "Parent ·
Subcategory". **Categories has a
"Suggested" section** (`categories/Suggested.tsx`, `lib/taxonomy.ts`): a
Fold-style library of 28 groups and 150 sub-categories with the Bohra
household's own names (Wajebaat & sabeel, FMB thaali, Niyaz & majlis, Eidi…),
added one group at a time or all at once by `adoptSuggested`. Adoption never
renames or moves anything the household already has: a namesake that exists
is left alone (retired or nested ones too), only the missing parent and
children are inserted, and a group already fully owned is not offered.
Every other category field — NewSchedule, EditEntry, a write-off — is
`CategoryPick` (`src/app/CategoryPick.tsx`): one row showing the pick with
its icon that opens the same `CategoryFinder`, so a category is found by
typing and seen by its icon everywhere. Icons: the base set in
`Icon.tsx` is what every page pays for; the long tail lives in
`glyphs-more.tsx`, keyed by `glyph-names.ts` and loaded through
`next/dynamic` the first time a page shows one of its names, so a household
that never files Milk never downloads the bottle.

**A category is for spending, for income, or for both** (`category.scope`,
`0024` + triggers in `0108`, mirrored for pickers and actions by
`src/lib/scope.ts`). An income entry or schedule files only under
`income`/`both`; an expense, a refund, a write-off or a transfer with a
category only under `expense`/`both`; a budget line never under `income`
(a budget limits spending). `txn_category_scope` and
`schedule_category_scope` refuse the misfit at the row, and every action
re-checks with `fits()` first so the message is a sentence
(`misfit(kind, name)`). A child takes its parent's scope — set on insert,
cascaded on update — and a scope may narrow (`both` → one, or flip) only if
nothing filed under the family contradicts it; `editCategory` asks
`checkScope` first for a readable refusal, and the editor's Segmented control
is hidden under a parent. Pickers filter with `fits(c.scope, kind)`:
AddEntry's strip follows the kind tab, NewSchedule's list follows
Expense/Income, EditEntry's follows the entry's fixed kind. The starter kit
seeds six income categories (Salary, Business, Rent received, Interest &
dividends, Gifts received, Other income) and the `0108` backfill gave them to
every existing household, turning a category with income already filed into
`both`. `budgetFor`, `categoryTrend`, the budget form's list and the scan
hint all leave out `income`-only categories.

### Dates are tapped, not typed

There is no native date input left in the app. `src/app/DatePick.tsx` is the
one place a day is chosen: `DateChips` (a wrapping row of quick days —
"Today · Yesterday · Sun 6 Sep · Sat 5 Sep" going back for Add Entry, the
next three days going on for MoveDue, "In 6 months · In a year · In 2 years"
for a schedule's end — plus a dashed "Another day…" that opens `DateSheet`, a
`Sheet` around `MonthGrid`, a month with Gregorian numbers and the Hijri day
under each, bounded by `min`/`max`); `DayOfMonth` (1..28 or 1..30 in seven
columns) and `MonthOfYear` (twelve names in four) for a rule; `Segmented` for
the two-or-three-way choices (Every month / Once a year, English / Hijri,
Never / After a number / On a date). Segmented renders real hidden radios
under the labels and the pickers write hidden inputs, so `createSchedule`
still reads `kind, calendar, freq, month, day, ends, times, untilDate`
unchanged. The row wraps rather than scrolls so "Another day…" is always in
view. Every grid cell is 44px or more and sets `textAlign: 'center'`
explicitly (the global reset left-aligns buttons). Selected = seagrass fill
with `--c-on-primary` text; today in the month grid = an inset ring.

The words come from `src/lib/recur.ts`: `friendlyDay(iso, today)` → "Today",
"Tomorrow", "Yesterday", else "Sat 12 Sep" (the year only when it differs from
today's); `inWords(today, iso)` → "in 4 days" / "3 days ago"; `shiftDay` and
`daysBetween` for the arithmetic, UTC throughout so no DST day is lost;
`describeRule` now says "every month on the 5th", "every Hijri month on the
1st", "every year on 1 Ramadaan", ", until 5 Jan 2027" — lower-case, so a
sentence can hold it, and rows capitalise with a local `cap`. `DueRow`'s
second line is "Due Sat 12 Sep · in 4 days" / "Expected today" / "Due
yesterday · overdue", and a schedule row reads "Every month on the 12th" then
"Next Sat 12 Sep · 1 Rabi II 1448 · in 4 days". The schedule form is two
`Segmented` rows, the month and day grids, one summary sentence ("Every year
on 1 Ramadaan. First on Sat 6 Feb 2027 · 1 Ramadaan 1448.") and a collapsed
"Ends never · Change" that opens the end choices only when asked. `sw.js` was
v10 for this change.

## Net worth

`/worth` is everything held, plus what people owe you, less what you owe, in
one figure. Money lent to someone counts as yours because it is — a person's
account is in the sum like any other — and **outstanding claims count too**:
shares of costs you covered are your money in someone else's pocket, and
leaving them out understated a household that pays first and collects later.
Savings are called out separately, because they sit outside the monthly budget
and "can I check my savings" is a different question from "how am I doing
this month". The icon is a rising line, not a pig.

The line is labelled **"held in accounts"** rather than net worth, and that is
deliberate. An outstanding claim is money owed to you today and is in the
headline, but what was claimed and unsettled on a date months ago is not
something this app keeps. Drawing it into the line would imply a precision that
is not there.

## Scanning receipts

`/scan` sends a photo to Gemini and gets back a draft. Four things hold it up.

**The key belongs to the household, not the app.** Signing up is open, so one
shared key would let anyone who found the URL spend somebody else's quota. It
is sealed with AES-256-GCM under a key derived from `AUTH_SECRET`
(`src/lib/secretbox.ts`), so a copy of the database is not also a copy of
everybody's API keys. It is tried against Google before it is stored, so a typo
is caught then rather than at the first receipt.

**Nothing is written to the ledger by a scan.** The result is a draft carried
to Add Entry in the URL, where a person checks and saves it as they would any
entry. A wrong figure posted silently is worse than no figure.

**The model's answer is untrusted input.** `src/lib/receipt.ts` re-parses
everything: an amount must be a positive number in range, a date must be real
and this century, a category must match one the household already has, and the
KIND must be expense or income or it is `unknown`. Anything failing comes back
blank rather than coerced — and an unknown kind blocks the save outright,
because income booked as an expense is wrong in both directions at once. The
draft is re-validated again in `/add`, since by then it has been through a URL.

**503 is normal.** The very first real receipt this app scanned came back "this
model is experiencing high demand". It clears in seconds, so it is retried
three times with backoff before the person is told anything.

`gemini-flash-latest` on purpose: a pinned version disappears — the first key
test returned "models/gemini-2.0-flash is no longer available" — and a scanner
that stops working because a model was retired is worse than one whose wording
drifts.

## It is a PWA, and now actually installs

"PWA only" was the founding decision and the app had never been installable.
Two reasons, both mine: the manifest pointed at `/icons/*.png` files that had
never existed, and when the proxy was rewritten for CSP the manifest lost its
exclusion, so a browser asking for it got a 307 to `/signin` — HTML where JSON
was expected. Both fixed; every URL an installer needs now answers 200 with no
session.

The app is **Saree al-Hisab** — سريع الحساب, swift at reckoning. `Hisab` is the
home-screen label, because iOS truncates at about a dozen characters and that
is what anyone says out loud anyway.

The mark is **ح**, the first letter of حساب, in cream on the header's charcoal
blue. Icons are still generated by `npm run icons` — raw pixels and a
hand-written PNG encoder, because adding an image library to a finance app so
it can draw a letter is a poor trade. The letter's outline was traced ONCE from
Noto Naskh Arabic Bold (SIL OFL 1.1) and lives in `make-icons.mjs` as a 96-point
polygon in a 0..1 box, so the script needs no font at run time and draws the
same letter every time. Bold rather than regular: at 44px the thin joint between
the blade and the bowl closes up in the regular weight and the letter turns into
a smudge.

Filling it needed **nonzero winding, not even-odd**. The outline is a boundary
walk of the glyph's pixels, and where a stroke tapers to a point the walk goes
out and back along the same few pixels; even-odd reads those spurs as holes and
punches notches out of the terminals. The maskable variant draws the letter at
56% rather than 60%, so Android's circular crop cannot reach it. iOS ignores the
manifest's icons for the home screen, so `apple-touch-icon` is declared
separately — and **iOS will not re-icon or rename an app already installed**: it
has to come off the home screen and go back on.

**The service worker does not cache pages, on purpose.** Every screen is
server-rendered from a household's books, so a cached page is somebody's
finances sitting on disk for whoever picks the phone up next. Navigations go to
the network every time and fall back to `/offline`. Content-hashed assets are
cached, which is what makes a return visit instant.

### Recording without signal

`/offline` is the one page the worker keeps, and it is kept precisely because
it holds nothing: it is Add Entry with the pickers filled from the phone's own
storage after it opens. The design, in the order the pieces matter:

- **The device store** (`src/app/add/queue.ts`) is two localStorage keys:
  `ql.queue.v1`, the entries typed without signal, and `ql.pickers.v1`, the
  names needed to type them (categories, ways to pay, accounts), rewritten
  every time Add Entry is opened online. Reads and writes are wrapped —
  private browsing and a full disk are not worth a crash on a finance screen.
  `ForgetDevice` on `/signin` wipes both, so a shared handset carries nothing
  past a sign-out. The trade-off is stated: entries still waiting at the
  moment someone reaches `/signin` are lost with it.
- **Every queued entry carries a `clientRef`** — a UUID minted on the phone —
  and the household it was typed under. `txn.client_ref` (0015) is unique per
  household where set, and `saveEntry` selects before it inserts, inserts with
  `on conflict … do nothing`, and selects again if nothing came back. Sending
  the same entry twice — a retry after a reply that never arrived — yields one
  row and the same id, which is what makes it safe to try again on every
  reconnect without asking "did it go?". A `householdId` that is not the
  signed-in household is refused outright: an entry typed under one sign-in
  never lands in another's books.
- **`SyncQueue`** in the root layout drains the queue on mount and on
  `online`, single-flight, and never on the auth or offline screens. A
  network failure stops the drain and keeps everything; a server refusal
  ("that category was retired") marks the entry *stuck* with the reason, and
  it stays on the phone — surfaced as a snack with **Discard** — until the
  person decides. Stuck entries are never retried on their own.
- **`/offline` is `force-dynamic`** though it reads nothing, because every
  script tag carries the request's CSP nonce and a prerendered page ships
  with none. The worker (`public/sw.js`, `VERSION = 'v16'`) fetches it once at
  install, `credentials: 'omit'`, together with every `/_next/static/` script
  and stylesheet the markup names, so the cached copy is a self-consistent
  snapshot: the nonce in its cached headers is the nonce in its cached
  markup. **Bump `VERSION` whenever the offline screen changes**, or phones
  keep the old snapshot.
- `AddEntry` itself takes `offline`: it queues instead of posting, and also
  queues when `navigator.onLine` is false or the action throws mid-save, so
  a tunnel between tap and reply loses nothing.
- The pickers now carry the household's open tabs too (`pickers.tabs`,
  optional so an older snapshot still reads).

What is proven: idempotent delivery, the household check, the malformed
reference refusal (invariants + a call-level test), and the queue's drain
semantics (single flight, stop on network error, skip stuck) under a faked
localStorage. What is *not*: the worker's install-and-serve path on a real
phone with the radio off. Test that on a device before trusting it in a
tunnel.

## The icon set and the colour

**Tabler Icons** (MIT), imported by name so only the ~35 used are bundled;
`optimizePackageImports` rewrites the barrel into deep imports. Drawing them by
hand was a false economy — a set somebody maintains is more consistent than one
invented glyph by glyph, and it grows when a household wants a category nobody
thought of. The `Icon` wrapper stays, so call sites still ask for `'cart'`.

Categories have carried an icon name since the schema was written and every
screen was discarding it for two letters. `Chip` is the tinted tile a glyph
sits in and is the same component everywhere, so categories, accounts and rails
read as one kind of thing because one piece of code draws them. **People keep
their initials** — a person is not a category.

**Every section has its own header colour.** One dark teal across twelve
screens made each look like the last: you could not tell at a glance where you
were. Budget is gold, entries indigo, accounts blue, trends and net worth
green, people purple, inbox pumpkin, schedules cyan, household slate; home and
Add Entry keep the base teal. Each was measured against white — the worst is
6.32:1, past the 4.5:1 body text needs — and the hue carries meaning where
there is meaning: the inbox is the same pumpkin as over-budget.

Payment rails are tinted per rail, and budget rows carry a bar in their own
category's colour, so the row about to go over is visible without reading a
figure.

### Money has a direction, and the contrast is measured

`--c-in` and `--c-out` colour every signed figure — green for money arriving,
red for money leaving, and neither for a move between your own accounts, which
is the same money in a different pocket. They are deliberately NOT the status
triad: over-budget red is an alarm and an ordinary expense is not, so these are
quieter than `--c-danger` and `--c-ok`. Both live in `globals.css`, not the
generated `tokens.css`.

**`npm run test:contrast` measures all 82 pairs in both themes** rather than
taking anyone's word for it, and it found four real faults on its first run.
The primary button was dark ink on the brand green at **3.56:1**, so the ground
went darker and its label went white (`--c-on-primary`). The raised Add button
was a white glyph on pumpkin at 2.97:1 — darkening the orange enough for white
turned it brown, and Pumpkin Spice *is* the add button, so the glyph went dark
instead and measures 7:1. The Delete action in a swipe row and the inbox badge
both used the generated `--c-on-fill`, which is dark ink: right on pollen in
light, unreadable on the dark theme's deep red and amber, so both took an ink
that flips with the scheme. The sheen is part of the measurement — a highlight
that lifts a ground also eats the contrast under it — so the test composites
the lit corner and checks that too.

### Three surface weights, not one card repeated

A screen built from one card repeated has no foreground: everything asks for
attention equally, so nothing gets it. `.hero` is the one answer a screen
exists to give — its own ground washed towards the brand teal, a wider radius,
the deeper shadow. `.card` is the ordinary raised surface and the default.
`.quiet` is supporting material, recessed rather than raised. A screen should
rarely need more than two at once.

The month card on Home is the `.hero`, and it lost its Trends and Budget links:
Budget is a tab and Trends is a tile four inches below, so two more ways to
leave were competing with the one thing that card exists to say.

## Categories are editable

`/categories` renames, recolours, re-icons, reorders, adds and retires them,
from the 25-glyph picker and the 8 tints.

**Renaming is safe in a way deleting is not**: every entry points at the
category row, so they all follow the new name and no month changes value.
Retiring is the same idea — the category stops being offered for new entries
and nothing already filed under it moves.

That last part exposed a real bug. `budgetFor` and `categoryTrend` filtered
`archived_at is null`, so retiring a category with money in it made its row
vanish from the budget while `monthTotals` still counted it — **the rows would
stop adding up to the total on the same screen**, which is the exact class of
disagreement that destroys trust in a ledger. Both now keep a retired category
in any month it had a budget or spending, and the row says RETIRED. Four
assertions cover it.

Order matters because it is the order Add Entry offers them in, and `moveCategory`
rewrites the whole run rather than swapping two values, so a list that has
drifted into ties comes back tidy instead of refusing to move.

**A `'use server'` module may only export async functions.** Putting the icon
and tint lists in `actions.ts` passed the build and then failed at runtime with
`m.map is not a function`, because what reached the client was not an array.
They live in `options.ts` now.

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
- **Von Restorff** — Add is the only filled tab. Red now has two jobs and they
  are kept apart by weight: `--c-out` is an ordinary expense, `--c-danger` is
  over budget, and the second is the louder of the two.
- **Postel** — amount fields accept `₹`, commas and spaces and keep the digits.
- **Aesthetic-usability** — one token set, one header background, one card
  shape. The header's ruled-paper stripes were removed: on a phone they read as
  banding, and a texture that looks like a rendering fault costs more trust
  than it buys.

## Gestures, and the phone answering back

**Haptics** (`src/app/haptics.ts`): four feels — tap, select, success, warn —
on tab taps, keypad keys, a back swipe that took, a save, an error, and every
threshold of a swipe or drag. Android is `navigator.vibrate`; iOS has no such
API, so the fallback clicks a hidden `<input type="checkbox" switch>`, which
Safari 18+ ticks natively. Both need a user gesture, so a haptic is only ever
called from a pointer or click handler — never from an effect that could fire
on load.

**Going back** (`src/app/Back.tsx`, one `<Back to="…">` on every screen with a
header arrow): a swipe from the left edge, and a Back pill that floats in at
the top-left the moment the header's arrow scrolls out of view and leaves
when it returns — never two Backs on screen at once, and where the arrow
was, not at the thumb's end of the screen where it fought the tab bar. A
sticky bar marked `data-topbar` (the budget's month total) pushes the pill
below itself. Installed, there is no browser chrome and no system back
gesture, so without these the only way out of a scrolled screen was the far
top-left. The pill is fixed at z 34, under the veil (35) and the tab bar (40);
visibility is set from an IntersectionObserver, never in an effect body, so
the first paint carries no pill on either side. `to` is always our own
literal and is still checked (absolute, same-origin) before use.

**Swipe rows** (`src/app/SwipeRow.tsx`): drag a row left for its actions,
all the way across to fire the last one. Pointer Events with `touch-action:
pan-y` and an 8px axis lock, so a vertical scroll that starts on a row is a
scroll. One row open at a time, and a drag never turns into the row's tap.
**Closing is easier than opening**: a tap outside, a tap on the row, a
scroll, Escape, or an 18px nudge back to the right all close it, and a flick
(over 0.5 px/ms) decides by direction alone however short — an open row never
has to be dragged the whole way home. The tap that closes an open row is
swallowed (a capture-phase click listener, dropped 400ms later), so tapping
away never also opens the entry underneath. **A row that can be swiped says
so**: a chevron grip at its right edge (`grip`, on by default; the category
editor turns it off on parents that carry a reorder grip instead), which is
also the twin — tapping it opens the actions, tapping again closes — so
nothing is gesture-only and a row needs no second set of buttons repeating
what the swipe offers. The first swipe row a device sees peeks its actions
out and back once (`localStorage 'swipe-peeked'`, coarse pointers only,
reduced motion respected). Where a row's every action is in the swipe (a due
row, a schedule row), there are no buttons under it.

Where they live. Entries: Edit, Delete. Categories: Edit, Retire, plus a grip
to drag the order. Schedules: a due row swipes to Skip, Move or Record (Came
in for income), an every-month row to Stop — with `commit` off, so a long
swipe cannot silence rent by accident — and the month grid is folded to one
summary line until tapped (`localStorage 'calendar-open'`), with a swipe
across the days paging the month. Inbox: a card bill swipes to Pay, which opens
Add Entry as a transfer into that card for the charged amount. Lending: a tab
swipes to Add cost; an entry on a tab to Edit. Accounts: Edit, and Move (a
bank account) or Pay it (a card), both landing on Add Entry with the transfer
already pointed the right way — `/add` reads `kind=transfer`, `to=<account>`
and `from=<account>` and checks each against the household before using it.

**Server pages offer swipes through `Swipeable.tsx`**, which takes
serialisable actions only — an `href`, or a server action plus the `fields`
to post to it and the `done` line for the snack — and does the client work of
building the FormData, showing the error or the confirmation, and refreshing.
A card holding swipe rows uses `padding: 0 var(--pad)` with `overflow:
hidden`, because the row slides out past the card's own padding and the
revealed actions must stop at its rounded corner.

**Undo instead of "Are you sure"** (`src/app/Snack.tsx`): delete and retire
happen at once and can be taken back for fifteen minutes — `removeEntry` sets
`deleted_at`, `restoreEntry` clears it only inside that window. A dialog is
read by nobody; a bar that says what just happened, with Undo on it, is.
`reorderCategories` refuses any list that is not exactly the household's live
categories, so a stale screen cannot write a partial order.

**The loading skeletons draw a still tab bar** (`Skeleton.tsx`,
`StillTabBar`), not the real one. A client component inside a `loading.tsx`
boundary makes Next write its chunk as a plain `<script>` with no nonce
(`create-component-styles-and-scripts.js` never receives one), which the CSP
then refuses and logs on every page. Tab data lives in `tabs.ts` and the
glyph in `TabGlyph.tsx` — both plain modules — so the still and the live bar
are one drawing. Re-check with the crawl: every `<script>` on every dynamic
route carries the response's nonce.

**The plus button fans out its options** (`AddOptions.tsx`): type it in,
scan a receipt with the camera, or upload a photo or PDF already on the
phone. They float above the plus as see-through pills over the screen
blurred (`.veil`, `backdrop-filter`, a near-solid scrim where the browser
cannot blur), not in a drawer that covers it — what you were reading stays
put, and the choice is within reach of the thumb that asked for it. The veil
sits *under* the tab bar (z 35 against its 40), so the bar stays sharp, the
plus turns into the cross that closes it, and the other four tabs still
work: the open state remembers the path it was opened on, so leaving the
screen closes it without an effect. Cross, veil, Escape, or any choice
closes it; focus lands on the first choice and goes back where it was. The
two file choices post straight to the existing `scan` action and land on
`/add` prefilled only when nothing is missing; otherwise the reason floats
as a fourth pill. Without JavaScript the button is still a link to `/add`.
The offline page carries the bar, so this bumped the worker to v6; the keypad
losing its hardcoded INR chip took it to v7.

**A field is never under 16px** (`--field` in `globals.css`, and the rule on
`input, select, textarea`). iOS Safari zooms the whole page in when a field
smaller than that takes focus and never zooms it back out, so every screen
with a form ended a size too big and had to be pinched — reported as "zoom
out is possible". The scale puts body text at 14–15px on a phone, under the
line, so fields get their own floor; buttons keep the scale, the amount
fields set a larger size of their own. Measured with a probe over every form
at 390px rather than assumed. Pinch-to-zoom itself is deliberately left
alone — `maximum-scale` would hide the symptom and fail anyone who needs it.
`/add` changed, so this took the worker to v8.

**Light and dark live in a cookie**, `ql.theme`, read in the root layout and
stamped as `data-theme` on `<html>`; absent means follow the phone.
`tokens.css` already carries both palettes. The picker on `/household`
switches the document from the click handler, then the action makes it
stick. A device preference, not a household setting.

**Depth comes from composition tokens in `globals.css`**, not from the
generated palette: `--g-primary` and `--g-pumpkin` (a sheen over the brand
colours, on every primary button and the Add tab), `--shade` on `.card`
surfaces, `--g-fill` on progress bars, and a hairline `--edge` highlight
inside `.el`/`.el2`. Each has a dark-mode value under the same guards
`tokens.css` uses. `.card` is a separate class from `.el` on purpose:
`.el` also dresses buttons whose background is the gradient.

**Grey until chosen.** Every choice control — account and rail chips, date
chips, category tiles and chips, tab and role toggles — is drawn from one
rule in `src/app/choice.ts`: `OFF` (sunk grey, meta text) until selected,
`on(ink)` (the option's own ink) when it is. The colour *is* the
confirmation, so no eyebrow hint or "Chosen: …" caption repeats it. An action
that opens more ("Another day…") is dashed and grey, not a choice. The label
on a lit chip is `--c-on-tint` (`globals.css`): white in the light theme,
where the category inks are deep, and the dark ground itself in the dark one,
where they are pastel — white on `#DE93CC` measured 2:1. The brand green is
dark in both themes, so `on(PRIMARY)` keeps `--c-on-primary`. Chosen dates
wear the brand green, not seagrass (white on seagrass was 3.2:1).
`scripts/contrast.test.mjs` measures `--c-on-tint` on every category ink,
and every ink on its own wash, in both themes.

**Settings has a door**: the Home header — your initials, the household, a
cog — opens `/household`, and Sign out lives there under "Your account". A
tile at the bottom of the grid wearing Lending's icon was not a door.

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
