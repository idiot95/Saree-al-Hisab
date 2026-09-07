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
    npm run test:invariants    # 118 assertions against real Postgres
    npm run test:lib           # money, password hashing and link tokens
    npm run test:contrast      # every ink/ground pair, both themes, WCAG
    npm run tokens             # regenerate tokens.css from the canvas palette

Neon is provisioned through Vercel. `.env.local` (gitignored) holds TWO
stores: `APP_DATABASE_URL` is the real app database (`src/db/client.ts`
prefers it); `DATABASE_URL` is a first-connected marketplace store nothing
uses. The scripts prefer `DATABASE_URL` when it is in the *environment*, so
with the file sourced run them as `env -u DATABASE_URL node scripts/migrate.mjs`
(and the same for the invariants) or the migration lands on the wrong store. Migrations are tracked in a `_migration` table — the
`00xx` files run once, the `01xx` views and triggers re-apply every run
because they are idempotent, so a changed view ships without a new file.

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
refuse. 111 assertions currently pass, covering: a move can never look like
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
ones, and an entry delivered twice under one `client_ref` is one row.

    npm run seed you@example.com   # fills YOUR books with the designs' data

## Where the slice reaches

`/add` is wired end to end: real categories, ways to pay and accounts come out
of Postgres, and Save writes a row through `saveEntry`.

**Every way to pay is on screen at once**, as a strip of chips tinted and
iconed per rail. It used to be a row that advanced to the NEXT method on each
tap, which meant a household with six of them could only reach the sixth by
tapping five times past the others — and could not see that it had six at all.
The same row also swapped itself for "Into" on a transfer, so a transfer could
only ever be recorded as happening today; the date is its own row now and the
destination account is a strip of its own, minus the account the chosen method
already empties, since an account cannot transfer to itself. Paying by GPay leaves
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
`lib/money.ts` is the whole list: two-decimal currencies only, because the
ledger stores minor units and everything divides by a hundred. A currency with
no symbol that reads on a phone uses its code, joined by a no-break space
(`AED 1,250`), and the keypad shows the code chip only when the symbol does not
already spell it.

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
  with none. The worker (`public/sw.js`, `VERSION = 'v3'`) fetches it once at
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

**Swipe rows** (`src/app/SwipeRow.tsx`): drag a row left for its actions,
all the way across to fire the last one. Pointer Events with `touch-action:
pan-y` and an 8px axis lock, so a vertical scroll that starts on a row is a
scroll. One row open at a time, and a drag never turns into the row's tap.
**Closing is easier than opening**: a tap outside, a tap on the row, a
scroll, Escape, or an 18px nudge back to the right all close it, and a flick
(over 0.5 px/ms) decides by direction alone however short — an open row never
has to be dragged the whole way home. **Nothing is gesture-only**: every row
still opens on tap, and the edit panel offers Move up / Move down / Retire as
buttons, because a gesture nobody discovers is a feature nobody has.

Where they live. Entries: Edit, Delete. Categories: Edit, Retire, plus a grip
to drag the order. Schedules: a due row swipes to Skip or Record (Came in for
income), an every-month row to Stop — with `commit` off, so a long swipe
cannot silence rent by accident. Inbox: a card bill swipes to Pay, which opens
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
