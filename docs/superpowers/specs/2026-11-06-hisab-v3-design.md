# Hisab v3 — redesign, Google sign-in, wealth, SMS capture

Status: **draft for review** · 6 Nov 2026 · Mockups: [Hisab redesign directions](https://claude.ai/artifact/3ds991bcdgi5GgJX788oGg) (private to the owner)

## 1. What was asked, and what is assumed

**Said by the owner**

- Completely redesign the UI/UX, checked against iPhone and Android.
- Do not touch the data. Agreed meaning: **additive schema only**. No existing row, balance or ledger rule changes, and every migration can be rolled back.
- Move sign-in to Google, with safe migration of existing users. Chosen: **Google only after a migration window**. Existing users sign in with their password once and link Google; after a cutoff, password sign-in is switched off.
- New: savings pots in other currencies and other assets, to give a personal and a household net worth. Chosen:
  - Assets: **foreign-currency pots and gold/silver** (property and investments are left for later).
  - Updated by **balance snapshots**, outside the spending ledger.
  - Prices **fetched daily, with a manual override**.
  - Net worth shown as **mine, each member's, joint, and the household total**.
- SMS scraping. Chosen: **iPhone Shortcut + Android forwarder → drafts**. No native app.
- Icons from Material Symbols. No hand-written CSS. Ready-made components from mature UI libraries.
- Picked from the mockups: **Direction A** (one adaptive design on shadcn/ui) and the tab bar **Home · Activity · + · Loans · Wealth**.
- Add entry on **one screen, three taps**.

**Assumed (correct me)**

- This reverses three recorded decisions in `web/CLAUDE.md`:
  - "no Google, no third party"
  - "No SMS import, ever"
  - "Five tabs" (Home · Activity · Plan · Loans · Money)

  CLAUDE.md is updated as each part lands, saying what changed and why.
- What "Me" counts: only accounts, pots and assets with `owner_user_id = me`. Joint items and money owed to the household (loans, tabs) count only in Joint and Household. Reason: a claim has no owner, and guessing one from `created_by` would misattribute it.
- Gold prices are **international spot**, converted to the household currency. Indian jewellers' rates include duty and GST and run several percent higher. The screen says "spot", and the override covers the rest.
- The PWA stays a PWA. Nothing here needs an app store.

**Success looks like**

- On an iPhone SE, an iPhone 15 Pro Max, a Pixel 7 and a 360-px Android:
  - Every screen works with nothing clipped, overlapped or truncated in either theme.
  - Add entry is three taps for the common case.
- Every existing user can get in with Google, and nobody loses access or data during the switch.
- Household and per-person net worth include foreign pots and gold, valued in the household currency, with the rate's date shown.
- A bank SMS on either phone becomes a draft in To review within seconds. It never becomes a posted entry without a tap.
- `test:invariants`, `test:lib` and `test:contrast` all pass. New assertions cover each new rule.

## 2. Sub-projects and order

Each gets its own implementation plan, branch commits and verification. The order lets the risky parts start early, so the migration window can run while the rest is built.

| # | Sub-project | Depends on | Why this place |
|---|---|---|---|
| 0 | **Spike: Google sign-in inside an installed iPhone PWA** | — | The biggest unknown (§4.6). It decides whether the auth plan stands. |
| 1 | **Google sign-in + account linking** | 0 | Starts the migration window early. |
| 2 | **Design foundations**: tokens, fonts, icons, tab bar, platform adaptivity | — | Everything after builds on it. |
| 3 | **Wealth**: data layer + Wealth tab | 2 | New screens are built once, in the new design. |
| 4 | **Add entry, one screen** | 2 | The most-used screen. |
| 5 | **SMS capture → drafts** | 2, 4 | Drafts open in the new Add entry. |
| 6 | **Remaining screens restyled**, then the cross-device sweep | 2–5 | Home, Activity, Plan, Loans, Household, auth screens, empty and loading states. |
| 7 | **Password cutoff** | 1, plus the window elapsed | Flips a flag. Nothing is deleted. |

## 3. Design (Direction A, nav option 2)

### 3.1 Navigation

- **Tabs:** Home · Activity · **+** · Loans · Wealth.
  - **+** is a 52-px rounded square *inside* the bar, between Activity and Loans. It never floats over content; this fixes the overlaps found in the audit (§6).
  - `ADD_FAB` goes; `TAB_BAR_SPACE` shrinks to the bar's height plus the safe area.
- **No segment switches.** Each tab is one scrolling screen:
  - **Activity:** the month's entries, with filter chips under the month pill: *All · To review (n) · Upcoming · From SMS (n)*.
  - **Plan** (Budget + Trends) is no longer a tab. It opens from Home's month card as a pushed screen with a back arrow. `OWNED_BY['/budget'] = '/'`, and the same for `/trends`.
  - **Loans:** owed to you, then tabs, then lent outside a tab. Same content as today's `/people`.
  - **Wealth** replaces **Money**: net worth and owner chips, then accounts & cards (the card deck stays), pots, gold & silver, and a row into Loans for owed-to-you. `/worth` becomes Wealth's own page and `/accounts` the pushed "Accounts & cards" screen. `MoneyNav` goes.
- One name per thing still holds:
  - "Money" becomes **"Wealth"** everywhere: tab, title and browser title.
  - "Net worth" is the figure; "Pots" are foreign-currency holdings; "Gold & silver" are metal holdings.

### 3.2 Visual system

- **Palette.** Token values are replaced in place in `src/app/ql.css`, the variables shadcn already reads, so no new stylesheet is needed:
  - Ground `#F6F6F3`; card `#FFFFFF`; ink `#15171C`; muted ink `#5B606B`.
  - **Primary indigo `#4338CA`**: Add, the selected state, links.
  - Attention amber: soft ground `#FFF7E6`, ink `#9A5B00`.
  - Money-in green `#15803D`; danger `#B91C1C`.
  - Dark-theme values are derived the same way. `test:contrast` gains every new pair, and nothing ships below 4.5:1 for text.
  - The status triad and "icon + word, never colour alone" rules stay.
- **Type.** Inter (variable) through `next/font/google`, self-hosted at build, with `font-variant-numeric: tabular-nums` for figures through Tailwind's `tabular-nums`. Instrument Serif is dropped.
- **Icons.** Material Symbols Rounded:
  - The woff2 is **subset to the names we use**, via the `icon_names=` parameter of the Google Fonts css2 API. `scripts/icons-font.mjs` downloads it, and it is committed under `src/app/fonts/`. It loads through `next/font/local`.
  - Self-hosting keeps it offline-safe, CSP-clean (`font-src 'self'`) and true to the `/terms` promise of no third parties at run time.
  - An `<Icon name="…" filled? />` component replaces the Tabler wrapper. `optimizePackageImports` for Tabler and the dependency itself are removed.
  - Category icons map to Material names in `glyph-names.ts`. `glyphs-more.tsx`, the lazily loaded long tail, goes, because the font subset carries the long tail at a few KB.
- **No hand-written CSS.** New UI uses Tailwind utilities and shadcn components only. Existing custom CSS in `globals.css` is *removed* where a component replaces it, never added to. The few rules that must stay are listed in the plan, not invented here: view-transition keyframes, `--field` 16 px minimum, safe-area padding.
- **Components** come from shadcn/ui (Radix), vaul, sonner and cmdk, which are already installed, plus registry additions:
  - **Chart** (Recharts) for Trends and the Wealth line
  - **Calendar** (react-day-picker), replacing `MonthGrid` in `DatePick.tsx`; the Hijri day under each date is a custom `DayButton`, a supported extension point
  - **Carousel** (Embla), replacing the card deck's hand-made scroll-snap
  - **Toggle Group** for the owner chips and the filter chips

  `Sheet.tsx` is replaced by the shadcn **Drawer** (vaul). `SwipeRow` stays: no mature library does the swipe row with a visible twin control, and it is tested.

### 3.2a Rolling figures

When a figure changes, its digits roll to the new value instead of jumping. Groupings and the currency symbol slide sideways as the number's width changes. This is the premium touch.

- **Library:** NumberFlow (`@number-flow/react`), a maintained component built for exactly this. It formats through `Intl.NumberFormat`, so Indian grouping (`₹1,47,000`), 0/2/3-digit currencies and `AED 1,250` work through the existing `money.ts` rules. No hand-written CSS.
- **Where it rolls** (only where a person sees a figure change in front of them; never in long lists, where it would be noise and cost frames):
  - Add entry: the amount as it is typed, and the Save label (`Save · ₹2,340 Groceries`).
  - Home: *Left to spend* and the pace line after a save, a delete or an Undo.
  - Wealth: the net-worth headline and the class legend when switching Household / Me / member / Joint, and a holding's value after *Update balance* or a rate override.
  - Plan: the month total and a budget row's figure while it is edited.
  - Loans: *Owed to you* after Money back.
- **On first paint** the figure renders static, server-side and correct. It rolls only on a change, never on page load, so screens don't feel slow and the server and client renders match.
- **Accessibility:** `prefers-reduced-motion` turns rolling off (the library respects it; the plan checks it). Screen readers get the final value once, not every intermediate digit.
- **One wrapper:** `<Figure minor={…} currency={…} />` is the only way a rolling amount is drawn. It reads `useMoney()`, so the currency rules stay in one place. Server pages pass the value to it as a prop.
- **Checked in the plan:** NumberFlow styles its shadow DOM with constructed stylesheets. The nonce-based CSP (`style-src`) is verified against it in Chromium and WebKit before adoption. If it is blocked, the fallback is the same effect from Motion's `AnimateNumber`.

### 3.3 Platform adaptivity (one design, tuned per OS)

- The root layout sets `data-platform="ios|android|other"` on `<html>`, from the request's `User-Agent` / `Sec-CH-UA-Platform` on the server, so the first paint is right.
- Differences are expressed with Tailwind data variants (`group-data-[platform=android]/app:…`), not separate components:

| | iPhone | Android |
|---|---|---|
| Active tab | filled icon + indigo label | filled icon in a 56×30 pill (`#E7E6F9`) + bold label |
| Icon buttons | 44 px | 48 px |
| Back | header arrow + left-edge swipe (existing) | header arrow; the system back gesture/button already pops history; edge swipe is off |
| Bottom padding | `env(safe-area-inset-bottom)` (home indicator) | the same env value; gesture-nav phones report it in standalone |
| Keyboard | Add entry pins Save above the keyboard with the `VisualViewport` API | the viewport meta adds `interactive-widget=resizes-content` |
| Haptics | existing `switch` checkbox trick | existing `navigator.vibrate` |
| Status bar | `apple-mobile-web-app-status-bar-style: default`, matching the ground | `theme-color` meta per theme |

### 3.4 Screens

As mocked in the canvas. In words:

- **Home:**
  - Large title (month) and household name; avatar into Household.
  - Hero card "Left to spend", with a pace tick, "Day n of N" and a status word + icon.
  - Two tiles: *To review* (amber when non-zero) and *Due this week* / *From SMS* (whichever has items).
  - A dark net-worth row into Wealth.
  - Today's entries.
  - Tapping the hero card opens Plan.
- **Add entry** (drawer over the current screen; full page on a direct link):
  - Kind switch: Expense · Income · Move.
  - The amount field, focused on open, using the phone's own keyboard.
  - **Eight most-used categories** for the kind, as a 4×2 grid, with *All* opening `CategoryFinder`.
  - "How you paid", defaulting to **the last one used** (a stored per-user preference; see §4.4), one row that opens `PayPicker`.
  - "When", defaulting to Today and opening the date chips.
  - A collapsed **More** row for note, bill, tab/claim, shared and the scan camera.
  - The duplicate warning line, then **Save · ₹amount Category**.
  - The common case is amount, category tile, Save. Income and Move keep their extra questions inside the same screen. The two-step wizard goes.
- **Activity:** month pill, search, filter chips; rows grouped by day; swipe to Edit/Delete as now. A *From SMS* row opens the draft in Add entry, prefilled.
- **Plan (pushed):** budget list with bars; Trends below on the same page as Chart cards; "Adjust this month only" stays.
- **Loans:** as now, restyled.
- **Wealth:**
  - Owner chips: *Household · Me · each other member · Joint*.
  - A dark net-worth card with a stacked bar by class (bank & cash, pots, gold & silver, owed to you) and a legend that carries each class's word and figure.
  - Sections: *Pots in other currencies* ("Rates 6 Nov"), *Gold & silver*, *Accounts & cards*, *Owed to you*. The last links to Loans.
  - **+** in the header adds a pot or asset. Each holding opens a detail with its snapshot history and *Update balance*.
- **Household:** members, with a **"Signed in with Google ✓ / Not linked yet"** badge each (owner view) during the migration window; invites; theme; *Your account* (Link Google, SMS capture, sign out).
- **Sign-in:** one "Continue with Google" button. During the window, a quiet "Sign in with your password" link below it.

Empty, loading and error states are drawn for every screen in the plan. `frameFor` skeletons are redrawn to match. `sw.js` `VERSION` is bumped with the offline screen.

## 4. Behaviour and data

All schema changes are **new tables or nullable columns**, in migrations `0034+`. The views and triggers they need are new `01xx` files, plus `0109_rls.sql` extended. No existing column changes type, meaning or default. **Before each production migration, a Neon branch of the database is taken** as the rollback point.

### 4.1 Ownership (for per-person net worth)

- `account.owner_user_id uuid NULL → app_user(id) ON DELETE SET NULL`. NULL means **joint**.
- Trigger `account_owner_is_member`: the owner must be a member of the account's household.
- Existing rows stay NULL (joint), so today's figures are unchanged. Owners can be assigned per account from its edit form.
- Person accounts (`kind = 'person'`) must stay NULL (CHECK).

### 4.2 Holdings: pots and metals

```
holding_kind enum: 'fx_cash', 'metal'
holding(
  id uuid pk, household_id fk, owner_user_id fk null,   -- null = joint
  kind holding_kind, name text,
  currency text null,          -- fx_cash: ISO code ≠ household base currency
  metal text null,             -- metal: 'gold' | 'silver'
  purity_permille int null,    -- metal: 999 (24k), 916 (22k), 750 (18k), 925 (sterling)…
  created_at, archived_at
)
CHECKs: fx_cash ⇒ currency set, metal/purity null; metal ⇒ metal, purity in 1..1000 set, currency null
holding_snapshot(
  id uuid pk, holding_id fk, household_id fk,
  as_of date, quantity bigint,  -- fx_cash: minor units of holding.currency; metal: milligrams
  note text null, created_by fk, created_at,
  unique (holding_id, as_of)    -- one figure per day; a second save that day replaces it
)
```

- **Snapshots, not transactions.** Holdings never touch `txn`, `spend_txn`, budgets or balances. So the four invariants are untouched by construction, and an assertion proves no view reads holdings.
- A holding's current quantity is its latest snapshot. Archiving hides it and keeps its history.
- Moving money from an INR account into a USD pot is two honest steps:
  1. The INR side is a normal entry: a transfer to a person or an expense, whichever it really was.
  2. Then *Update balance* on the pot.
- A future "link a pot to an account" is out of scope.
- RLS: both tables `household_id = app_household()`, FORCE, in `0109`.

### 4.3 Prices and valuation

```
price_quote(base text, quote text, as_of date, rate numeric(24,10), source text,
            fetched_at timestamptz, primary key (base, quote, as_of, source))   -- global, no household
price_override(household_id fk, base text, quote text, as_of date, rate numeric(24,10),
               set_by fk, set_at)  primary key (household_id, base, quote, as_of)
```

- `base` is an ISO currency, or `XAU`/`XAG` for metals, priced **per gram of pure metal**. `quote` is the household's base currency.
- `numeric` is exact decimal, not floating point, which keeps to the "no floats near the ledger" rule. Valuation rounds once, to the household currency's minor unit, half-even, in SQL.
- **Which rate applies:** the household's override for the latest date ≤ today, if it is newer than or equal to the latest fetched quote; otherwise the latest fetched quote.
- Value calculation:
  - Metals: quantity_mg / 1000 × purity / 1000 × rate.
  - fx_cash: quantity in minor units, converted with `digitsOf()` on both currencies.
- The view `holding_value` (security_invoker) returns each holding with `value_minor`, `rate`, `rate_as_of` and `rate_source`.
- **Fetching without a scheduler** (the app has none, on purpose):
  - When Wealth (or anything valuing holdings) renders and a needed pair's newest quote is older than 24 h, the server fetches it, inserts it with `on conflict do nothing`, and renders.
  - A failure renders with the last known rate and shows "Rate from 2 Nov — couldn't update" (icon + word).
  - One fetch per pair per day, via a `rate_limit` row.
  - Providers sit behind `lib/prices.ts`, so they can be swapped. Candidates, verified during the plan: open.er-api.com (FX, no key, covers AED/SAR/KWD/QAR/OMR, which ECB-based Frankfurter does not) and api.gold-api.com (XAU/XAG spot, no key).
  - Responses are untrusted input: a positive finite rate, the expected pair, otherwise discarded.
- The override is set from the rate line ("tap to override"). Owners and adults may set it; viewers may not.

### 4.4 Net worth

- `lib/worth.ts` `netWorth()` stays the one definition and gains `holdings` and an `owner` filter:
  - `household`: everything, exactly today's figure plus holdings.
  - `me` / `<member>`: owned accounts and holdings only.
  - `joint`: owner NULL, plus receivables.
- The headline adds a fourth part, `holdings`, to `assetTotal`. `/worth`'s "held in accounts" line stays accounts-only, with a second series for holdings from snapshots × the rate on each month-end.
- "Last used way to pay" for Add entry is `app_user.last_paid_with text NULL`, a preference written on save, never read for authorisation.

### 4.5 SMS capture

```
capture_token(id, user_id fk, household_id fk, token_hash text unique, label text,
              created_at, last_used_at, revoked_at)          -- 256-bit token, SHA-256 stored, shown once
sms_draft(id, household_id fk, user_id fk, sender text, body text, received_at timestamptz,
          body_hash text, parsed jsonb, status inbox_status default 'open',
          txn_id fk null, created_at,
          unique (household_id, body_hash))                  -- the same SMS forwarded twice is one draft
```

- **Endpoint:** `POST /api/capture/sms`, with `Authorization: Bearer <token>`. JSON `{ text, sender?, received_at? }`, max 2 KB.
  - Excluded from the session proxy matcher; rate-limited in Postgres (60/hour per token).
  - The token resolves user and household, and the user must still be a member with a non-viewer role.
  - Responds `202` with no body detail.
- **OTPs are never stored:** a body matching OTP / one-time password / verification-code patterns is dropped before insert.
- **Parsing** (`lib/sms.ts`, pure, tested on fixture messages):
  - Amount and currency, debit/credit direction, the account's last 4 matched to `account.last4`, merchant/VPA, date.
  - Patterns for the major Indian banks and UPI apps first, plus a generic `(Rs|INR|₹)\s?[\d,]+(\.\d{1,2})?` + "debited/credited/spent/sent/received" fallback.
  - If parsing leaves the kind unknown and the household has a Gemini key, the same untrusted-input path as receipts (`lib/receipt.ts` rules). Otherwise a draft with only what was found.
- **A draft is never posted on its own.** It appears under *To review* and *From SMS*. Accepting opens Add entry prefilled; Save goes through `saveEntry` with `client_ref = draft id`, so a double tap is one entry, then marks the draft accepted. *Dismiss* marks it dismissed.
- **Raw bodies are deleted** (set to NULL) once a draft is accepted or dismissed, and after 30 days regardless. `/terms` says so.
- **Setup screen** (Household → *SMS capture*): create a token per phone; copy it once; step-by-step guides:
  - **iPhone:** Shortcuts → Automation → *Message* → sender contains (bank names) → *Run Immediately* → *Get Contents of URL* (POST, header, JSON body with *Message* and *Sender*).
  - **Android:** an SMS-forwarding app (e.g. the open-source "SMS to URL Forwarder") with the same URL, header and body template.
  - The guides name no paid apps and say what each permission means.

### 4.6 Google sign-in and migration

- **Provider:** Auth.js `Google` beside the existing Credentials provider. Env `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, with a Google Cloud OAuth client whose redirect URI is the stable Vercel host.
- **Identity is keyed on Google's `sub`, never on email:**

  ```
  auth_identity(user_id fk, provider text, subject text, email_at_link text,
                linked_at timestamptz, primary key (provider, subject), unique (user_id, provider))
  ```

- **The JWT is unchanged:** it still carries only `userId`, and membership is still read per request. `sessions_valid_from` still revokes.
- **Sign-in decision** (the `signIn` + `jwt` callbacks):
  1. A known `(google, sub)` signs in as its user.
  2. Unknown `sub` while a session exists and the request came from *Link Google* (a signed, single-use `link_intent` cookie set by the action) links it to the signed-in user. Refused if that user already has a Google identity or the `sub` belongs to someone else.
  3. Unknown `sub` and no session:
     - If an `app_user` with that **verified** email exists, the person is **not** signed in or linked. They see "You already have books here. Sign in with your password once to link Google." No silent email-based takeover.
     - Otherwise, a new user and identity, and then `/setup` as today.
  4. `email_verified` false → refused.
- **Invites:** the Google account's email must equal the invite's address (case-insensitive), or the screen says which address was invited. This closes the "whoever opens the link takes the place" gap CLAUDE.md records.
- **Recovery for someone who never linked**, during or after the window: an owner issues the existing reset link. Opening it signs that person in for one purpose only, to link Google. After the cutoff it no longer sets a password.
- **Cutoff:** env `AUTH_PASSWORD_UNTIL=<ISO date>`.
  - Before it: the password form shows as a secondary link.
  - After it: the Credentials provider refuses everyone, and the form is gone.
  - `/signup` is Google-only from day one.
  - `password_hash` rows are **kept, not erased**. Removing them is a separate, later decision.
- **The owner sees progress:** Household lists each member with a linked/not-linked badge, so nobody is surprised at the cutoff.
- **CSP:** `form-action` gains `https://accounts.google.com`, because Chrome applies `form-action` to the redirect after Auth.js's sign-in POST. No script or connect source changes; this is a redirect flow, not the GIS script.
- **Risk to settle first (sub-project 0):** iOS gives a home-screen web app its own cookie jar, and an OAuth redirect to another origin can open in an in-app browser sheet. If the session cookie ends up in that sheet instead of the installed app, sign-in "works" and the app still shows signed out.
  - The spike installs the PWA on a real iPhone and an Android phone and signs in end to end.
  - If iOS fails: route the callback through a same-origin page that completes in the standalone context. If that also fails, keep password sign-in for iOS standalone until a fix is found, and record it.
  - **The cutoff never happens while any platform cannot sign in with Google.**

## 5. Error handling

- **Rate provider down / malformed:** use the last known rate and label its date. With no rate ever, the holding shows its native amount and "not valued yet", and is left out of the total with a visible note. Never zero.
- **SMS endpoint:**
  - Bad token, revoked token or a viewer → 401 with no detail.
  - Oversize or not JSON → 400.
  - Rate-limited → 429.
  - A duplicate body → 202 (idempotent).
  - Parser exceptions never fail the request: the draft is stored with what parsed.
- **OAuth:** every refusal in §4.6 lands on `/signin?e=<code>` with a plain sentence. Codes: `exists-link-first`, `already-linked`, `invite-mismatch`, `unverified`, `cutoff`. No stack traces or Google error text are shown.
- **Snapshots:** a negative quantity is refused (CHECK). A foreign pot in the household's own currency is refused (trigger, with a sentence: "Use an account for INR").
- **The existing rules stand:** `rethrowControlFlow` in every catch, constraint errors logged as code + name only, and Server Actions re-check household and role.

## 6. Audit fixes the redesign must close

These come from the baseline screenshots at iPhone 15 (393×852) and Pixel 7 (412×915) of the current build:

1. The floating + covers content: the Money balances, budget tiles and the invite form.
2. A swipe action peeks into view at rest ("✓ econcile" on Money).
3. Truncated text: "Setting u…" on Home, "Paid through GPay, Net …" on Money.
4. Two navigation layers (tabs + segments): about 13 places to look.
5. Net worth is duplicated on Money/Accounts and Money/Net worth.
6. Add entry is a 2-step wizard: 5+ taps for the common case.
7. Flat hierarchy: every block is the same white card.

## 7. Testing and verification

- **`test:invariants`**, new assertions:
  - Holdings and snapshots under RLS, and unreadable cross-household.
  - No ledger view references holdings.
  - The account owner must be a member; person accounts have no owner.
  - Snapshot uniqueness per day and non-negative quantities.
  - The valuation view's rounding on a 3-digit currency (KWD) and a 0-digit one (JPY).
  - Override precedence.
  - `auth_identity` uniqueness.
  - `sms_draft` per-household body dedupe.
  - A draft's acceptance is idempotent through `client_ref`.
- **`test:lib`:**
  - `lib/prices.ts` response validation
  - `lib/sms.ts` against a fixture corpus (one or more real-format messages per major bank/UPI app, plus OTPs that must be dropped)
  - `netWorth()` owner filters
  - the sign-in decision table in §4.6 as a pure function
- **`test:contrast`:** the new palette, both themes.
- **Device sweep (Playwright):**
  - Every route at 360×780, 375×667, 393×852, 412×915 and 430×932, in light and dark.
  - Emulated as iPhone (WebKit, once installed for the run) and Android (Chromium).
  - Asserts no element overflows the viewport horizontally, no fixed element overlaps another's text box, no text is ellipsized unless the element opts in, and every tap target is ≥ 44 px.
  - Screenshots are kept as before/after sets.
- **Real-device checks** before the cutoff: install on an iPhone and an Android phone; Google sign-in, link, invite, offline add and SMS forwarding end to end.

## 8. Out of scope

- Property, vehicles and investments as assets.
- Linking a pot to a ledger account.
- Erasing password hashes.
- A native Android app.
- Push notifications for SMS drafts.
- A custom domain (it would reset passkeys and installs; see CLAUDE.md).
