# What the owner should know (known limits after v3)

Each item: what happens, who it affects, and what would fix it. None of them loses data. Each one is a choice for
you to make; nothing here was changed without asking.

## 1. Forms do not work with JavaScript off

**What happens.** With JavaScript turned off (or before the page's script has loaded on a very slow line), sending
any form — sign-in, the Google button, sign-up, Add Entry's full page, every in-place form — fails with an error
instead of saving. With JavaScript on, which is every normal visit, all of it works.

**Why.** `next.config.ts` sends `Referrer-Policy: no-referrer` on every page. That is deliberate: `/join/<token>` and
`/reset/<token>` carry a credential in the address, and the policy stops it ever leaving in a `Referer` header. But
under `no-referrer` the browser also sends `Origin: null` on a plain form POST, and Next.js refuses a Server Action
whose Origin does not match the host ("does not match origin null"). Found in Task 4; true before v3 too.

**The two ways to fix it** (either is a one-line header change plus a re-check of `/join` and `/reset`):
- **A. `Referrer-Policy: same-origin` everywhere.** The browser then sends the real Origin to our own server, and no
  Referer at all to any other site, so the token in a `/join` or `/reset` address still never leaves the app. The
  cost: our own server sees the token page's address as the Referer of the next request from it, which it already
  knows. Recommended.
- **B. Keep `no-referrer` on `/join/*` and `/reset/*` only, `same-origin` everywhere else.** The strictest; the forms
  on those two pages (accepting with a password, setting a new one) then stay JavaScript-only, which is how they
  behave today.

(`serverActions.allowedOrigins` cannot help: the Origin is the literal string `null`, and allowing it would allow
every opaque origin.)

## 2. `invite` can be read across households from outside a household scope

**What happens.** Row security on `invite` is open when no household is set, because accepting an invitation has
to find it before there is a household to scope by. So any query made outside `withHousehold()` — the `identity`
pool, used for sign-in and membership — can read, change or delete every household's invitations. Nothing in the
app does that today; it is the "one query that someday forgets" that row security exists for.

**Why it matters.** `capture_token` had exactly this pattern until Task 19, when review found it allowed listing and
un-revoking every household's SMS keys. It was fixed by making the table household-only and finding a token through
one `SECURITY DEFINER` function, `capture_lookup(hash)`, that returns at most one row.

**Recommended follow-up.** The same for `invite`: policy `household_id = app_household()` with no unscoped branch,
and an `invite_lookup(token_hash)` definer function (execute for `saree_app` only) returning the one open invite's
id, household, address, role and expiry. Accepting then runs inside `withHousehold` of the household it returns.
`household` and `member` keep their open branch (sign-in needs them). It is a migration plus the join page's lookup;
the invariants test should then check `invite` is household-only. (Like `capture_lookup`, it would rely on the
database owner bypassing row security: Neon's `neondb_owner` does.)

## 3. SMS parsing: what it does not catch

The parser (`src/lib/sms.ts`) is tested on 38 bank and UPI messages, 89 OTPs and promotions. A draft is never posted
without your tap, so a misread costs a correction, not a wrong entry. Known limits, each ruled acceptable:
- **"OTP. 482913"** (a full stop, a space, then a bare code) is **not** treated as an OTP. It cannot be told apart
  from footers like "OTP. 18002662" that end real debit messages. Such a message would become a draft you dismiss.
- **A footer in the same sentence as a reference number** — "never share OTP, ref no is 48291312" — is read as an
  OTP, so that **real debit is dropped** and makes no draft. Add it by hand.
- **Dashed codes** ("482-913") and "OTP for 2 days 482913" are not recognised as OTPs.
- **"Use code 4829 for 10% off"** is read as an OTP (a promotion), so it is dropped — which is what you want.
- **The first date in the message wins**, even when it belongs to another clause ("…on 05-11 … due 12-11"): check the
  date on Review.

## 4. "Today" for Wealth is the database's day (UTC), not India's

The holding values (`drizzle/0110_views_holdings.sql`) take the latest balance and rate dated on or before
`current_date`, the database's date, which is UTC on Neon. Between **00:00 and 05:30 IST** that is still yesterday:
a balance or a rate override entered then and dated today counts from 05:30 IST, and until then Wealth shows the
previous figure. Nothing is lost; it catches up by itself. A fix would pass the household's date into the view (or
use `(now() at time zone 'Asia/Kolkata')::date`), which is a view change worth its own review.

## 5. Smaller things

- **The home-screen icon** was redrawn in Task 30 (fix round): ح in rose gold on the hero plum, from
  `scripts/make-icons.mjs` (`npm run icons`), with the browser-tab favicon (until then Next's default triangle).
  **iOS will not re-icon an installed app**: take Hisab off the home screen and add it again to see the new one.
  Android usually updates it within a day, or on reinstall.
- **Loading frames on Home and Plan** draw the "Left to spend" card a budgeted month has. A household with no budget
  sees the page settle about 100px higher when it arrives. Accepted (most households budget); a no-budget frame
  would need the frame to know the household's state before the page does.
- **WebKit (Safari's engine) was not available to the automated sweep** here; it ran in Chromium with iPhone and
  Pixel emulation. The real-device checklist (`devices.md`) covers the iPhone.
