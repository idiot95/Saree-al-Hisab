# Real-device checklist (owner)

The Playwright sweep emulates phones in Chromium; it cannot prove what only a real phone does: the installed app's
own cookie jar, the keyboard, a finger, the radio. Do this on **one iPhone and one Android phone**, both with the app
**installed to the home screen** from the stable production URL (not a preview deploy: Google sign-in only works on
the stable host). It comes from the spec, §7 ("Real-device checks before the cutoff"), plus the items the build left
for a real phone.

**Do all of it before `AUTH_PASSWORD_UNTIL` is set to a date.** The cutoff never happens while either phone cannot
sign in with Google.

Mark each line ✅ / ❌ with the phone and the date. A ❌ is worth a screenshot and one sentence of what happened.

| # | Check | iPhone | Android |
|---|---|---|---|
| 1 | **Install.** Add to Home Screen; the icon is ح in cream on charcoal blue (not yet redrawn in plum — see owner-notes.md), the label "Hisab"; it opens standalone (no browser bar), and the status bar matches the screen in light and in dark. | | |
| 2 | **Google sign-in in the installed app.** Sign out, tap "Continue with Google", finish at Google. You land back **in the installed app, signed in** — not signed in only in a Safari/Chrome sheet while the app still shows Sign in. Close the app fully and reopen: still signed in. | | |
| 3 | **Link Google** (an account that has a password): sign in with the password once, Household → Link Google, finish at Google; Household shows the account as linked. Sign out and back in with Google. | | |
| 4 | **Invite link.** From Household, create an invitation for the other phone's Google address; send the message with Share. On the other phone, open the link, Accept with Google using that address: you land in the household. Then try the same link again: it says it has been used. Try a fresh invite opened with a *different* Google account: it says which address was invited and does not let you in. | | |
| 5 | **Offline add.** Turn on airplane mode, open the app (it shows Add Entry with "No connection"), add an expense: it says it is kept on this phone, "Waiting for signal · 1". Turn signal back on with the app open: the snack says it is in the books, and Activity lists it once. | | |
| 6 | **SMS capture, iPhone.** Household → SMS capture → make a key for this phone; follow the Shortcuts guide on that screen (Automation → Message → sender contains your bank → Run Immediately → Get Contents of URL). Have the bank send a real debit SMS (or a small UPI payment): within seconds a draft appears under Activity → From SMS. Review → Save makes one entry. An OTP message from the same bank makes **no** draft. | | — |
| 7 | **SMS capture, Android.** Same, with the forwarder app the guide names (URL, header and body template as shown). A debit becomes a draft; an OTP does not. | — | |
| 8 | **Drawer fields above the keyboard.** Open a drawer with a field (Add Entry's amount; Wealth → + → Add to Wealth; a holding's Update balance; New tab): tap the field. The field and its Save stay **above the keyboard**, nothing jumps under it, and the drawer's top grip still closes it. | | |
| 9 | **Carousel by finger.** Wealth → Accounts: swipe the credit-card wallet left and right with a finger; it snaps a card at a time and the dots follow. | | |
| 10 | **Swipe rows.** Loans: swipe a tab row left to show Remind and Add cost; it stays open, a tap elsewhere or a scroll closes it. Activity: swipe an entry. Categories: swipe a row to Retire, then Undo. | | |
| 11 | **Hijri calendar.** Add Entry → When → the month grid: every day shows its Hijri date under it, the 1st names its Hijri month, days after today cannot be picked. Upcoming → a regular payment "Once a year · Hijri" shows on the right Hijri date. | | |
| 12 | **Back.** iPhone: swipe from the left edge to go back; Android: the system back gesture. Both return to the same month and scroll you left. | | |
| 13 | **Dark mode** on both phones (system setting, then Household → Theme → Dark and Light): every screen above is readable, nothing invisible. | | |
| 14 | **After deploy, once: "Sign out everywhere"** (Household). Every other signed-in phone and browser is signed out on its next tap; this one is signed out too. Sign in again with Google on each. | | |

What the emulated sweep already covers, so these are not needed by hand: horizontal overflow, bars over text, cut-off
text and tap-target sizes on every screen at five phone sizes in both themes (`final.txt`). WebKit itself (Safari's
engine) was not available to the sweep here, so check 1, 2 and 8 on the iPhone matter more than they look.
