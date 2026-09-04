import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTheme } from './lib.mjs';
import { buildApp } from './app.mjs';
import { buildAuth } from './auth.mjs';
import { buildMore } from './more.mjs';
import { buildMoney } from './money.mjs';
import { buildTrends } from './trends.mjs';
import { buildLedger } from './ledger.mjs';
import { buildMethods } from './methods.mjs';
import { buildScan } from './scan.mjs';

const all = () => ({ ...buildApp(), ...buildAuth(), ...buildMore(), ...buildMoney(), ...buildTrends(), ...buildLedger(), ...buildMethods(), ...buildScan() });

// The dark set is chosen, not exhaustive: the screens where the palette has to
// carry real work — charts, the ledger, the lock screen.
const DARK_SET = [
  'Main.dc.html', 'Transactions.dc.html', 'Budget.dc.html', 'AddExpense.dc.html',
  'Trends.dc.html', 'CardControl.dc.html', 'Savings.dc.html', 'Accounts.dc.html',
  'Inbox.dc.html', 'NetWorth.dc.html', 'AuthLocked.dc.html', 'Dedupe.dc.html',
];

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..');
setTheme('light');
const light = all();
setTheme('dark');
const darkAll = all();
setTheme('light');

const files = { ...light };
for (const name of DARK_SET) files['Dark' + name] = darkAll[name];

for (const [name, src] of Object.entries(files)) writeFileSync(join(OUT, name), src);

// ── layout ──────────────────────────────────────────────────────────────────
const X = [0, 470, 940, 1410, 1880];
const boards = [];
const bandY = {};      // group id -> the y this band starts at
const bandTitle = [];  // heading notes, one per band
let cursor = 0;
const GAP = 900;       // between bands, so the break reads while scrolling

// Everything sits on ONE page. Pages are a desktop affordance — the menu is
// unreachable on a phone, and the whole point of a canvas is that you scroll it.
const place = (group, label, rows) => {
  bandY[group] = cursor;
  bandTitle.push({
    id: 'band-' + group, x: 0, y: cursor - 210, w: 900,
    text: label.toUpperCase(),
  });
  let bottom = cursor;
  rows.forEach(({ y, items }) => {
    items.forEach(([file, title, h, interactive], i) => {
      const b = { file, x: X[i], y: cursor + y, w: 390, h, title };
      if (interactive) b.is_interactive = true;
      boards.push(b);
      bottom = Math.max(bottom, cursor + y + h);
    });
  });
  cursor = bottom + GAP;
};

place('page-1', 'The app', [
  { y: 0, items: [
    ['Main.dc.html', 'Home', 1530],
    ['Transactions.dc.html', 'Activity', 1400],
    ['AddExpense.dc.html', 'Add — with keypad', 900, true],
    ['AddSheet.dc.html', 'The + sheet', 560],
    ['Budget.dc.html', 'Budget — the spine', 1880],
  ] },
  { y: 2120, items: [
    ['MoneyToGetBack.dc.html', 'Money to Get Back', 1240],
    ['ScheduledPayments.dc.html', 'Scheduled Payments', 1480],
    ['NetWorth.dc.html', 'Net Worth', 1430],
    ['MoreMenu.dc.html', 'More', 1180],
  ] },
  { y: 4000, items: [
    ['SetupHousehold.dc.html', 'Setup 1 — Household', 900],
    ['SetupAccounts.dc.html', 'Setup 2 — Accounts', 1000],
    ['SetupBudget.dc.html', 'Setup 3 — Budget', 1000],
  ] },
]);

place('page-2', 'Auth & lock', [
  { y: 0, items: [
    ['AuthWelcome.dc.html', '1 · Welcome', 844],
    ['AuthPhone.dc.html', '2 · Phone', 844],
    ['AuthCode.dc.html', '3 · Code', 844],
    ['AuthName.dc.html', '4 · Name & recovery', 844],
    ['AuthSetPin.dc.html', '5 · Set PIN', 844],
  ] },
  { y: 1244, items: [
    ['AuthConfirmPin.dc.html', '6 · Confirm PIN', 844],
    ['AuthBiometric.dc.html', '7 · Face ID', 844],
    ['AuthLocked.dc.html', '8 · Locked', 844],
    ['AuthReauth.dc.html', '9 · Re-auth', 560],
    ['AuthDevices.dc.html', '10 · Devices', 900],
  ] },
  { y: 2488, items: [
    ['AuthRecovery.dc.html', '11 · Recovery', 844],
  ] },
]);

place('page-3', 'Inbox, sharing & household', [
  { y: 0, items: [
    ['Inbox.dc.html', 'Inbox', 1240],
    ['ShareSettle.dc.html', 'Shared expense', 1080],
    ['ShareCompose.dc.html', 'Send the breakdown', 720],
    ['RecordPayment.dc.html', 'Payment received', 880],
  ] },
  { y: 1640, items: [
    ['HouseholdMembers.dc.html', 'Household members', 1040],
    ['HouseholdInvite.dc.html', 'Invite', 880],
    ['HouseholdRole.dc.html', 'Change role', 660],
  ] },
  { y: 3080, items: [
    ['Settings.dc.html', 'Settings', 1300],
    ['Vault.dc.html', 'Vault', 1000],
  ] },
]);

place('page-5', 'Budget, accounts & cards', [
  { y: 0, items: [
    ['BudgetEdit.dc.html', 'Set the month', 1240],
    ['Accounts.dc.html', 'Accounts & types', 1240],
    ['AccountEdit.dc.html', 'What an account is for', 1000],
    ['Savings.dc.html', 'Savings', 1140],
    ['Trends.dc.html', 'Trends', 1500],
  ] },
  { y: 1640, items: [
    ['CardControl.dc.html', 'Card control', 1510],
    ['Dedupe.dc.html', 'Possible duplicates', 1080],
  ] },
]);

place('page-7', 'Ledger, payment methods & scanning', [
  { y: 0, items: [
    ['LedgerCentre.dc.html', 'Ledger Centre', 1240],
    ['LedgerPerson.dc.html', "One person's khata", 1300],
    ['LedgerBook.dc.html', 'A book', 1180],
    ['LedgerAddEntry.dc.html', 'Add an entry', 1000],
    ['LedgerWriteOff.dc.html', 'Write off', 760],
  ] },
  { y: 1700, items: [
    ['PaymentMethods.dc.html', 'How you pay', 1300],
    ['MethodEdit.dc.html', 'Set one up', 1080],
    ['CardCycle.dc.html', 'A card cycle', 1360],
  ] },
  { y: 3300, items: [
    ['ScanReading.dc.html', 'Reading a receipt', 760],
    ['ScanReview.dc.html', 'Check it over', 1180],
    ['AssistKey.dc.html', 'Scanning setup', 1120],
  ] },
]);

place('page-4', 'Empty & first run', [
  { y: 0, items: [
    ['EmptyHome.dc.html', 'First run — Home', 1160],
    ['EmptyActivity.dc.html', 'Empty — Activity', 844],
    ['EmptyBudget.dc.html', 'Empty — Budget', 844],
    ['EmptyMoneyBack.dc.html', 'Empty — Money to Get Back', 844],
  ] },
]);

// ── the dark page, sized from what each file declares ─────────────────────
const hOf = (name) => Number(/"height":(\d+)/.exec(files[name])[1]);
const DARK_TITLES = {
  'Main.dc.html': 'Home', 'Transactions.dc.html': 'Activity', 'Budget.dc.html': 'Budget',
  'AddExpense.dc.html': 'Add', 'Trends.dc.html': 'Trends', 'CardControl.dc.html': 'Card control',
  'Savings.dc.html': 'Savings', 'Accounts.dc.html': 'Accounts', 'Inbox.dc.html': 'Inbox',
  'NetWorth.dc.html': 'Net Worth', 'AuthLocked.dc.html': 'Locked', 'Dedupe.dc.html': 'Duplicates',
};
{
  const rows = [];
  let y = 0;
  for (let i = 0; i < DARK_SET.length; i += 5) {
    const names = DARK_SET.slice(i, i + 5);
    rows.push({ y, items: names.map(n => ['Dark' + n, DARK_TITLES[n], hOf('Dark' + n)]) });
    y += Math.max(...names.map(n => hOf('Dark' + n))) + 400;
  }
  place('page-6', 'Dark', rows);
}

// ── annotations: the motion & gesture spec, plus what changed and why ───────
const N = (id, group, x, y, text, w = 430) => ({ id, group, x, y, w, text });
const annotations = [
  // page 1 — row 1
  N('colour-system', 'page-1', 0, -880,
`TWO SYSTEMS, KEPT APART
The last pass had one real fault: Pumpkin Spice was both the add button and the over-budget alarm. An action colour and a danger colour must never be the same — you cannot tell "do this" from "something is wrong". They are separated now.

BRAND — identity and navigation, never status.
Charcoal Blue: ink and headers, all 43 screens. Seagrass: every progress fill, the active tab, selections. Golden Pollen: the Inbox and informational highlights. Muted Olive: savings, the Shared tag, neutral positive surfaces. Pumpkin Spice: the add button, and the owed/scheduled header family — attention, never alarm.
Two needed a lighter step where 13px text sits on them, Seagrass to #81AFA1 and Pumpkin to #FE8C42. Bars and the add button keep your values exactly.

STATUS — reserved, and never reused for identity.
Good #12703F on #DCEFE4 · Warning #8A6510 on #FDF1D5 · Danger #B3261E on #F9E3E1. Dark gets its own steps.
Where they apply: over budget and overdue and duplicate charges are DANGER; close to a limit, part-paid and pending statements are WARNING; paid, received, settled and on-track are GOOD; income reads good because money in is genuinely good news.

NEVER COLOUR ALONE (WCAG 1.4.1).
Every status chip ships an icon and a word — an alert glyph with "Over", a clock with "Close", a check with "On track". The overdue rows carry the alert glyph and the words "3 days late" beside the red, so the screen still works in greyscale, for a colour-blind reader, and in a screenshot.
Every ink-on-fill pair was measured, not assumed: nothing below 4.5:1.`),
  N('motion-timing', 'page-1', 0, -420,
`MOTION SPEC — applies to every artboard
Durations 120ms press and toggle · 220ms sheets, expanding panels, row swipes · 320ms screen push and pop · 400ms number tweens.
Easing cubic-bezier(.2,.8,.2,1). Sheets and row swipes run on a spring, so a half-swipe rubber-bands back instead of snapping.
All 117 targets take a press state: scale(.97) plus a 6% ink overlay over 120ms. Nothing in v1 acknowledged a tap.
Numbers that change tween rather than jump — Left to spend after a save, category totals after an edit. The .n class already sets tabular-nums so digits do not jitter.
Progress bars animate their width on mount, staggered 40ms down the list.
Every one of the above sits inside @media (prefers-reduced-motion: reduce), which drops travel and leaves a cross-fade.`),
  N('home-nav', 'page-1', 470, -420,
`HOME — FEWER SECTIONS, ONE FEED
Six stacked sections became three, taking Home from 1,720px to 1,530px.
Four full-width cards (Inbox, Savings, Card, Owed) collapsed into one scrolling strip of four tiles. Same four destinations, a quarter of the height, and they read as a row of statuses rather than four competing announcements.
"Coming up" and "Recent" merged into one feed under a single heading, split by two rules — Still to pay, then Today. That is the Monzo idea worth taking: a home screen is a timeline, not a dashboard. The overdue row carries its Paid button inline, so the commonest action never needs a second screen.
Search moved into the header, where it is reachable on every visit rather than buried in Activity.
What was deliberately not copied: Monzo's look. The tile strip, the feed rules and the pace chart are its navigational ideas rebuilt in Quiet Ledger's own type, colour and density.`),
  N('home-changes-old', 'page-1', 940, 1800,
`HOME — the rest of what changed
F06 The four quick actions are gone. The + button is the only way to add, and it opens the sheet three frames right. That returned ~100px above the fold.
F04 The overdue maid salary now leads Coming up, in the red treatment, with Paid / Not yet / Skip on the card. In v1 it only existed on Scheduled.
F13 "Needs attention" is now "Inbox" — one name, matching More.
F07 "Transfers and card payments are not counted as spending" sits under Money out. The rule was already right; it was never stated.
F23 The accounts total says it converts $500 at ₹83.50.
F15 Cards are 150px, so the third peeks 48px instead of 12px.
The scope pill is gone; Home now also carries Savings and the card cycle, so the two questions asked most often are answered without leaving it.`),
  N('charts-spec', 'page-1', 1880, 1800,
`CHARTS — WHAT AND WHY
One axis, thin marks, solid hairline grid one shade off the surface, direct labels only where they earn it.
Every SINGLE-SERIES chart uses your palette directly, because nothing sits adjacent to confuse it: the pace line and all progress fills are Seagrass, over-budget is Pumpkin Spice, savings bars are Muted Olive, caution is Golden Pollen.
The two DONUTS are the exception and it is a real one. Six mutually-distinguishable hues is a harder problem than five harmonious ones, and the palette cannot do it — Muted Olive against Golden Pollen is ΔE 13.8 to normal vision, below the 15 floor, meaning full-colour readers struggle to tell them apart side by side. So the donuts use a validated six-step set drawn from the same hue families, passing every check in both themes with zero warnings.
Donuts appear exactly twice, where the story is genuinely part-to-whole: Where August went, and What is on the card. Six segments maximum, none under 9%, a 2px surface gap rather than a border, the total in the hole, every share in the legend. Anything comparative stays a bar.`),
  N('home-gestures', 'page-1', 940, -420,
`GESTURES — Home and Activity
Pull to refresh on both. Release at 64px, spinner in the header well.
Accounts carousel scrolls: overflow-x:auto with scroll-snap-type: x mandatory and scroll-snap-align: start on each card. v1 had overflow:hidden, so the fourth account was unreachable.
Filter chips on Activity and the category chips on Add scroll the same way, so the last chip is reachable rather than clipped.
Re-tapping the active tab scrolls that screen to top.
Long-press a transaction row to change its category without opening it.
Swipe a transaction row: left reveals Edit and Delete, right marks it To get back.
Haptics: light on Paid / Mark received / Save, warning tick when a save pushes a category over its limit.`),
  N('keypad-spec', 'page-1', 1410, -420,
`ADD — F02, the blocking one
v1 had a caret but no keypad, and Save was pinned to the bottom where the system keypad lands. This artboard is 390×900 and everything fits with the pad drawn in.
Save is the tall key in the pad, thumb-reachable, so entry is amount → category chip → Save. Three taps.
The type switcher (Expense / Income / Transfer) means a wrong start no longer needs backing out.
Category is a scrolling chip row of the budgeted six, with All categories at the end for anything else. Recents fill Paid to.
This artboard is live: tap More options, then Need this money back.
Motion: the pad slides up 220ms on mount. More options height-animates. Digits scale-pulse 90ms on press.`),
  N('sheet-spec', 'page-1', 1880, -420,
`THE + SHEET
Replaces Home's quick-action row. Four entries, one of them a capture path rather than a fourth transaction type — "Scan a receipt" lands in Add with the amount and merchant filled.
Gesture: drag-to-dismiss with a spring. Backdrop fades 0→44% over 220ms while the sheet travels; dismissing reverses both.
Tapping the backdrop dismisses. The grabber is decorative — the whole sheet is draggable.`),

  // page 1 — row 2
  N('one-ledger', 'page-1', 0, 1800,
`ONE LEDGER — THE PERSONAL / HOUSEHOLD PILL IS GONE
v1 had three different scope controls and two conflicting defaults. v2 unified them into one pill. This round removes the pill entirely, because a toggle makes the app modal: you could read "₹23,600 left" and not know whose it was until you checked the control above it, and it pushed a classification decision onto every single entry.
Now there is one set of books. Entries that belong to the household carry a Shared tag, set by one switch in Add. Reading a number never requires reading a mode first.
The cost, accepted deliberately: a household sees everything. SetupHousehold used to promise "your personal money stays private" — that copy is gone, and the invite and role screens now say plainly that everyone sees every entry.
Numbers merged accordingly: ₹1,51,400 + ₹64,200 = ₹2,15,600 spent, against ₹1,75,000 + ₹1,00,000 = ₹2,40,000 budgeted.`),

  N('swipe-rows', 'page-1', 470, 1800,
`SWIPE INSTEAD OF BUTTON ROWS
Money to Get Back and Scheduled carry Paid / Not yet / Skip and Remind / Mark received as visible buttons here so the comp reads. On device these also live behind a swipe, and the buttons stay for discoverability.
Swipe travel 220ms on a spring; past 40% it commits, under 40% it rubber-bands back. Committing collapses the row height over 220ms and shows a 5-second Undo snackbar.
F09 Scheduled now headlines ₹99,849 — what you actually need to cover — instead of ₹90,849, which quietly excluded the ₹9,000 overdue sitting right beneath it.
F10 Every person on Money to Get Back gets the same two actions. In v1 only Zenith Labs had any.
F11 Both screens now have a back arrow, plus edge-swipe-to-back.`),
  N('nav-fixes', 'page-1', 940, 1800,
`TAB BAR
F14 "Transactions" is now "Activity". Each slot is 72.4px — (390 − 20 padding − 8 gaps) ÷ 5 — and "Transactions" measured ~69px in Instrument Sans and wider in the Helvetica fallback. It also reads truer now that transfers and card payments live there.
F12 More keeps its teal pill on all of its children. In v1 the same tab rendered gold on Money to Get Back, blue on Scheduled, plum on Net Worth and teal on More — one tab, four colours. The domain colour now lives only in the header gradient.
F05 Inactive labels moved from #A39A8D (2.78:1) to #6E665C (5.65:1).`),
  N('contrast-pass', 'page-1', 1410, 1800,
`F05 — CONTRAST, EVERY SCREEN
#948B7F at 3.36:1 across 59 uses → #635B51 at 6.68:1. That token was already in the stylesheet, just unused for meta text.
#A39A8D at 2.78:1 across 32 uses → #6E665C at 5.65:1.
#B5ADA1 at 2.22:1 → #7A7268 at 4.74:1 for placeholders.
Header text is the harder half. A 150deg gradient puts its 0% stop at the top-left — exactly under the eyebrow — so the old measurement against the 58% stop was wrong. At the real stop, even pure white reached only 3.26:1 on gold and 4.42:1 on teal, so no opacity could fix it. The three light ramps were darkened at 0% (teal #158775→#127666, gold #B4872A→#85641F, blue #3A78AF→#356D9F) and all secondary header text set to rgba(255,255,255,.86) — 4.5:1 or better on every header.
F19 Text links — See all, Edit — now carry a 44px target instead of the ~18px they had.
F21 Account counts reconcile: 4 cash-and-bank accounts plus 1 credit card, said the same way in More and Net Worth.
F22 Vault now says what it holds.`),

  // page 1 — row 3
  N('setup-spec', 'page-1', 0, 3680,
`F17 — TWELVE STEPS CUT TO THREE
Every v1 step was skippable, which was the right instinct, but a skip is still a decision and a tap — twelve of them before a single number appeared. Account setup alone spanned two steps because opening balances had been split off.
Now: household or solo, accounts with opening balances inline, and a first budget. What they covered moved to the six-item "Finish setting up" checklist on the first-run Home (page 4), which dismisses when complete.
Motion: the progress bar animates its width 320ms on each advance; screens push horizontally 320ms with the outgoing one parallaxing at 30%.`),

  // page 2
  N('auth-order', 'page-2', 0, -420,
`F03 — AUTH, WHICH v1 HAD NONE OF
Setup opened at "Step 2 of 12" with no account concept ahead of it, and no lock at all despite net worth, partial account numbers and a Vault.
Order: Welcome → phone → 6-digit code → name and recovery email → set PIN → confirm → Face ID → into setup.
Phone OTP is primary: India-first, matching the ₹ / HDFC / ICICI world the app already lives in, and there is no password to design, recover or breach. Apple and Google sign-in are there for their own platforms.
The recovery email on frame 4 is optional but load-bearing — a solo user with no household has no other way back in.`),
  N('auth-motion', 'page-2', 940, -420,
`MOTION — AUTH
Code digits scale from .9 with a 90ms pop as each lands; a full code auto-submits after 180ms.
A wrong code or a mismatched PIN shakes ±6px over 300ms and the dots go red — no toast, no dialog.
Keypad keys take the same 120ms press as everywhere else, with a light haptic per digit.
Under prefers-reduced-motion the shake becomes a border-colour cross-fade.`),
  N('lock-rules', 'page-2', 470, 924,
`APP LOCK — REQUIRED, NOT OPTIONAL
Biometric with a 6-digit PIN fallback, on by default.
Locks on cold start, after 2 minutes backgrounded, and always before the Vault — a second prompt even inside an unlocked session.
Sensitive actions re-prompt: deleting an account that has transactions, changing a member's role, exporting data, opening the Vault. Everything else stays frictionless.
Privacy: balances blur in the app-switcher snapshot, and tapping the big number hides amounts — the gesture people already try.
The Locked screen unlocks with a 220ms scale-and-fade into Home, not a cut.`),
  N('recovery-note', 'page-2', 0, 2168,
`RECOVERY
OTP to the same number is the normal path. If the number is gone: the recovery email, or a household Owner re-inviting them.
This is why the optional email on frame 4 matters, and why the gold note here says plainly what happens without it.`),
  N('devices-note', 'page-2', 1880, 924,
`SESSIONS
One long-lived refresh token per device. Signing a device out ends its session immediately.
"Sign out everywhere else" is the one destructive action here, so it is the only red control on the screen.`),

  // page 3
  N('inbox-spec', 'page-3', 0, -420,
`THE INBOX — THE BIGGEST HOLE IN v1
It was badged "3" on Home and again in More, linked from both, and designed nowhere.
One card per decision, each carrying its own two answers, so the queue empties without leaving the screen. Nothing here has touched a balance yet — that line is the whole promise of the screen.
The three are real: an imported payment to confirm and categorise, an expected salary to mark received, and a detected recurring charge to schedule.
Motion: answering a card collapses it 220ms and the badge counts down. Emptying the queue fades in the closing line.`),
  N('share-spec', 'page-3', 940, -420,
`SHARE & SETTLE — REFERENCED THREE TIMES IN v1, DESIGNED NEVER
"Shared expense" was one of four kinds in Add Expense, Ahmed's card said "shared 26 Aug", and Zenith Labs offered "Share again".
Three frames: the shared expense itself with its items and split, the sheet that sends the breakdown, and recording what comes back.
The note on Payment received matters — money returned is not income, and saying so stops it double-counting in Money in.`),
  N('household-spec', 'page-3', 0, 1320,
`HOUSEHOLD & ROLES
SetupHousehold promises "your personal money stays private". That has to be enforced by a permission model, not just copy — hence three roles.
Owner: billing, removing members, deleting the household. Adult: full read and write on Household, own Personal private. Viewer: reads Household, writes only their own — for teens and helpers.
Invites go by phone number with a 7-day code. The invitee signs in with their own number and chooses to link.
Changing a role asks for Face ID first.`),
  N('settings-spec', 'page-3', 0, 2760,
`SETTINGS & VAULT
Everything More linked to and v1 never drew. Lock and privacy first, because that is what people come here for.
"Read payment messages" is opt-in and says what it does: it suggests entries in the Inbox and adds nothing on its own.
The Vault re-prompts on every open, even mid-session, and says so at the top rather than silently asking.`),

  // page 5
  N('budget-spine', 'page-5', 0, -460,
`THE BUDGET IS THE SPINE
Set the month, and every report measures against it. Monthly, carried forward: September starts as a copy of August, so you set it once and correct it as real months teach you.
Budget screen (page 1) now reconciles both ways, which v2's did not: eight categories hold ₹1,31,200 of ₹2,15,600 spent, with ₹84,400 "Not in a category" making up the rest; ₹1,47,000 of ₹2,40,000 is assigned, with ₹93,000 still loose. Both gaps are shown rather than left for the reader to notice.
"Not in a category" is a link, not a dead row — it opens those 14 entries so they can be given a budget. That is how the plan grows.`),
  N('accounts-spine', 'page-5', 470, -460,
`WHAT AN ACCOUNT IS FOR
Set once per account, and everything downstream keys off it.
Spending and Cash feed the budget. Savings is held out of it — so moving money there is a transfer, never an expense, and the savings figure is not competing with your spending figure. Credit is a balance owed rather than money held.
This is what makes "check my savings every once in a while" a two-tap job: Home carries a savings row, and the screen behind it shows six months, the month's contribution, and what share of income it represents.
August's ₹8,350 into Cash (USD) is the same transfer that appears in the Activity ledger — the savings figure is not a separate number, it is the ledger read a different way.`),
  N('card-dedupe', 'page-5', 940, 1180,
`CARD CONTROL AND DEDUPE
Three ways card spending goes wrong, all handled on these two frames.
Double counting: the purchase is the expense, the bill payment is not. The card screen states it in one line — all ₹42,850 is already counted on the day each purchase happened, and paying the bill will not count it again. Card payments also carry a Not an expense tag in the ledger.
Duplicates: the bank message arrives after you have already typed the expense in. Detection is same amount, same card, within three days. It surfaces as a decision card in the Inbox you already clear, and as a screen when there is more than one — both sources side by side with their timestamps, one button. Whichever you drop waits seven days in the Inbox before it goes.
Control: a limit ring rather than a bar, because a limit is not a budget; a warn-me threshold; and autopay stated in full so the bill never becomes a surprise.`),

  // page 7
  N('scan-model', 'page-7', 1880, -540,
`SCANNING — PROPOSE, NEVER POST
A photo produces a DRAFT. The reader will eventually turn ₹1,180 into ₹11,800, and a ledger that saves that silently is worse than no reader at all — so the amount is the largest thing on the review screen, and anything the model was unsure of wears a Check mark.
Category and account are GUESSED from the merchant, not read off the paper. The screen says so, because a guess presented with the same confidence as a reading is how wrong data gets confirmed.
Voice was dropped. Microphone access is documented as unreliable in an installed iPhone PWA — it works once from the home screen and then fails — and home-screen install is the mode push needs. A receipt photo has none of that risk: <input capture> hands off to the system camera app and returns a file, so it never touches getUserMedia.
Plain OCR was considered and rejected. It solves the easy half — turning pixels into text — and leaves the hard half: deciding which of six numbers on a thermal receipt is the total. It would also add megabytes of wasm to a PWA. One path, one call, structured output.
THE KEY. A browser cannot reach Gemini directly; CORS refuses it. So the key lives in this device's browser, travels with each request to our own route, and is forgotten — never written to a database, never at rest on a server. Each device enters its own, and each person spends their own quota.`),
  N('methods-model', 'page-7', 1410, -540,
`AN ACCOUNT HOLDS MONEY. A METHOD IS A RAIL.
GPay holds nothing. Paying by GPay moves money out of the bank account GPay draws on, so a method carries a funding account and the transaction still records that account. Without this, "where is my money" is wrong the moment UPI is involved — which in India is most of the time.
The database refuses the nonsense cases rather than trusting the form: a method can never draw on a person, a card rail must draw on a credit account, and UPI must draw on spending or cash. Savings is not offered, because savings is held out of the budget and therefore cannot be a way of paying.
CARD CYCLES, and what "auto offset" actually means. Give a card its statement day and every purchase files itself into the right cycle on write — a trigger derives the period from the date, opening the cycle if it does not exist yet. Paying the bill clears that cycle.
Nothing is counted twice, and now it is checkable rather than a claim in a caption: the purchases are expenses, counted on the day they happened; the payment is a card_payment, which invariant 1 keeps out of spending entirely. The two can never meet.
One case the cycle screen has to say out loud: ₹12,500 of that bill is Ahmed's. It is on your card and in your August budget, and it is also in his book — when he repays it comes off there, not off the bill.`),
  N('ledger-model', 'page-7', 0, -540,
`THE LEDGER CENTRE — A KHATA PER PERSON
A person is modelled as an ACCOUNT of kind 'person'. Lending is then a transfer, and every invariant already built applies free: it is not spending, it never touches the budget, a running balance is just an account balance, and Net Worth picks it up with no new sum. The UI never says account — it says Ahmed.
Person then Book then Entry. The book is optional and may span several people, which a folder nested inside one person could not express. Grouping only, no splits, by decision — every case here is one person owing the whole amount.
THREE KINDS OF MONEY, now structural rather than a convention:
Lending is NOT spending. A transfer out; it becomes money owed to you.
Paying for someone IS your spending, in that month, because it was on your card. It is marked to get back, and the repayment lands as money in, never as income.
A refund UNDOES spending. It carries the original purchase's category and reduces it in the month the refund lands, so it goes back into the category it came out of.
Writing a loan off is an expense dated today, never backdated — net worth falls by the full amount while the month you originally lent it stays exactly as it was.`),
  N('ledger-ux', 'page-7', 940, -540,
`WHY IT READS LIKE A PAPER LEDGER
Jakob — a khata is oldest-first with the running balance down the right edge. People already know how to read that, so it is not reinvented. The header row labels Date, Entry, Amount and balance, the way a passbook does.
Hick — two segments on the landing screen, People and Books, not five filter chips. Every extra choice costs a decision before any work happens.
Von Restorff — one figure is large per screen; everything else is deliberately secondary.
Fitts — the primary action is a 58px bar at the thumb, never a header icon. Remind and Settle sit in the header precisely because they are secondary to adding.
Common region — a book is a bordered card, so who is in it reads without words.
Add an entry leads with the FORK, not the amount. Which of the three kinds this is decides how it behaves, and it is the one thing a user cannot correct later without the arithmetic drifting.`),

  // page 6
  N('dark-spec', 'page-6', 0, -460,
`DARK IS SELECTED, NOT INVERTED
Every step was re-measured against the dark card (#16242D) rather than flipped. Body ink lands at 13.9:1, secondary 8.2:1, the faintest step 4.9:1 — all above AA, where a naive inversion would have put the two slate greys near 2:1.
The ground is a deep slate (#0D171E) drawn from the palette's own darkest colour, so night is the same product rather than a different one.
The nine category tints are a second, separate set — a pale wash that works on white becomes an unreadable smear on slate — and each disc was re-picked. Every icon clears 5.3:1 on its own tint.
Header gradients are their own dark ramps, not the light ones dimmed.
The chart palette is deliberately the SAME six steps in both themes — colour follows the entity, so a category does not change hue when the lights go out. It was validated separately against the dark surface.
Twelve screens are drawn dark: the ones where the palette does real work — every chart, the ledger, the card cycle and the lock screen.`),

  // page 4
  N('empty-spec', 'page-4', 0, -420,
`EMPTY & FIRST-RUN — v1 ASSUMED A MATURE ACCOUNT ON EVERY SCREEN
First-run Home carries what F17 moved out of the wizard, as a six-item checklist that dismisses when complete. Home, Activity and Budget read ₹— rather than ₹0, because nothing recorded is not the same as zero. Money to Get Back genuinely is ₹0 — all square — and says so.
Each empty state names one action and explains the mechanism in a sentence — Money to Get Back points back at the toggle in Add Expense, Budget offers to seed limits from last month's spending.
Motion: the checklist ticks with a 220ms draw-on check and the progress bar advances behind it.`),
];

const placed = annotations.map(({ id, group, x, y, w, text }) =>
  ({ id, x, y: (bandY[group] ?? 0) + y, w, text }));

const canvas = {
  artboards: boards,
  annotations: [...bandTitle, ...placed],
  // Open on the page most recently added or changed, so a re-seed lands the
  // reader on the new work rather than on page one.
  launch: { view: 'canvas' },
};

writeFileSync(join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2) + '\n');
console.log(`wrote ${Object.keys(files).length} artboards + canvas.json (${annotations.length} notes)`);
