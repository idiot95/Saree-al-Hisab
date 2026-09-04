import {
  C, G, CAT, TEAL_BTN, ic, doc, nav, header, backRow, eyebrow, subline,
  sectionHead, link, card, avatar, meta, amount, tag, statusChip, dashedBtn,
  titleBlock, HSCROLL, SNAP,
} from './lib.mjs';

export function buildLedger() {
  const ledger = {};

/* ══════════════════ THE LEDGER CENTRE ══════════════════
   A khata per person. UX laws doing the work here:
   · Jakob — a paper ledger reads oldest-first with the running balance down
     the right edge. People already know how to read this; do not reinvent it.
   · Hick — two segments (People, Books), not five filter chips. Every extra
     choice on a landing screen costs a decision before any work happens.
   · Von Restorff — one figure is large. The rest are secondary by design.
   · Fitts — the primary action is a 58px bar at the thumb, not a header icon.
   · Common region — a book is a bordered card, so membership is visible
     without reading a word.                                                */

const person = (initials, tintKey, name, sub, amt, right = '') =>
`    <a href="#" style="display:flex;align-items:center;gap:12px;min-height:72px;color:${C.ink};border-bottom:1px solid ${C.rule}">
      <span style="width:42px;height:42px;border-radius:999px;background:${CAT[tintKey][0]};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:${CAT[tintKey][1]};flex:none">${initials}</span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <span style="display:flex;align-items:center;gap:8px">
          <span style="font-size:15.5px;font-weight:600">${name}</span>
          ${right}
        </span>
        <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
      </span>
      <span style="display:flex;align-items:center;gap:8px;flex:none">
        <span class="n" style="font-size:17px;font-weight:600;letter-spacing:-0.02em">${amt}</span>
        <span style="color:${C.faint}">${ic('chevR', 17, 2)}</span>
      </span>
    </a>`;

ledger['LedgerCentre.dc.html'] = doc({ h: 1240, body: `
${header(G.gold, `${backRow('Ledger', `<button style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.92)">${ic('search', 20, 1.9)}</button>`)}
    <div style="display:flex;flex-direction:column;gap:7px">
      ${eyebrow('Owed to you')}
      <span class="n" style="font-size:44px;font-weight:600;line-height:1;letter-spacing:-0.03em">₹55,000</span>
      ${subline('₹12,000 lent · ₹43,000 spent for others')}
    </div>`, '22px 20px 26px')}

  <div style="display:flex;gap:3px;padding:3px;margin:18px 18px 20px;background:${C.sunk};border-radius:999px">
    <button style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:999px;background:${C.card};color:${C.ink};font-size:14px;font-weight:600;box-shadow:0 1px 3px rgba(35,61,77,0.14)">${ic('users', 17, 1.9)} People</button>
    <button style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:999px;color:${C.meta};font-size:14px;font-weight:600">${ic('doc', 17, 1.9)} Books</button>
  </div>

  <div style="display:flex;gap:8px;padding:0 18px 16px;${HSCROLL}">
${[['All', true], ['Family', false], ['Friends', false], ['Work', false], ['Vendors', false]]
  .map(([t, on]) => `    <button style="min-height:40px;padding:0 14px;display:flex;align-items:center;border-radius:999px;flex:none;${SNAP};white-space:nowrap;font-size:13.5px;font-weight:600;${on ? `background:${C.ink};color:${C.card}` : `background:${C.card};border:1px solid ${C.border};color:${C.meta}`}">${t}</button>`).join('\n')}
  </div>

${card(`${person('AR', 'orange', 'Ahmed Raza', 'Dubai trip · last movement 29 Aug', '₹35,900')}
${person('SI', 'blue', 'Sara Iyer', 'Loan · due 15 Sep', '₹12,000', statusChip('warn', 'Part paid'))}
${person('ZL', 'purple', 'Zenith Labs', 'Office claims · 3 entries', '₹7,100')}
    <a href="#" style="display:flex;align-items:center;gap:12px;min-height:64px;color:${C.meta}">
      <span style="width:42px;height:42px;border-radius:999px;background:${C.sunk};display:flex;align-items:center;justify-content:center;color:${C.faint};flex:none">${ic('check', 20, 2.2)}</span>
      <span style="flex:1;font-size:14.5px">2 people settled up</span>
      <span style="color:${C.faint}">${ic('chevR', 17, 2)}</span>
    </a>`, '0 18px 20px')}

${sectionHead('up', CAT.blue[0], CAT.blue[1], 'Loan groups', `<span class="n" style="font-size:13px;font-weight:600;color:${C.meta}">₹12,000</span>`, '0 20px 12px')}
  <div style="display:flex;flex-direction:column;gap:10px;padding:0 18px 22px">
${[['Sara — loan', 'Money lent · 1 of 4 instalments back', '₹12,000', 'user', 'blue']]
  .map(([name, sub, amt, icon, tint]) => `    <a href="#" class="el" style="display:flex;align-items:center;gap:13px;min-height:76px;background:${C.card};border-radius:16px;padding:14px 16px;color:${C.ink}">
      ${avatar(icon, CAT[tint][0], CAT[tint][1], 40)}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:15.5px;font-weight:600">${name}</span>
        <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
      </span>
      <span class="n" style="font-size:16px;font-weight:600">${amt}</span>
    </a>`).join('\n')}
    <p style="margin:2px 4px 0;font-size:12.5px;line-height:1.5;color:${C.meta}">Money you handed over. Never counted as spending — it left your balance and became money owed to you.</p>
  </div>

${sectionHead('card2', CAT.rust[0], CAT.rust[1], 'Reimbursement groups', `<span class="n" style="font-size:13px;font-weight:600;color:${C.meta}">₹43,000</span>`, '0 20px 12px')}
  <div style="display:flex;flex-direction:column;gap:10px;padding:0 18px 24px">
${[
  ['Dubai trip', 'Ahmed Raza · 4 entries · on your card', '₹35,900', 'plane', 'cyan'],
  ['Office claims', 'Zenith Labs · 3 entries · 1 refunded', '₹7,100', 'briefcase', 'purple'],
].map(([name, sub, amt, icon, tint]) => `    <a href="#" class="el" style="display:flex;align-items:center;gap:13px;min-height:76px;background:${C.card};border-radius:16px;padding:14px 16px;color:${C.ink}">
      ${avatar(icon, CAT[tint][0], CAT[tint][1], 40)}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:15.5px;font-weight:600">${name}</span>
        <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
      </span>
      <span class="n" style="font-size:16px;font-weight:600">${amt}</span>
    </a>`).join('\n')}
    <p style="margin:2px 4px 0;font-size:12.5px;line-height:1.5;color:${C.meta}">Your spending, on someone else's behalf. It counts this month and comes back later — as money in, never as income.</p>
  </div>

  <div style="margin-top:auto;padding:0 18px 26px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:9px">${ic('plus', 20, 2.2)} Add an entry</button>
  </div>

${nav('more')}` });

/* ── one person's khata ────────────────────────────────────────────────── */
const line = (date, what, book, amt, running, isCredit = false, last = false) =>
`    <div style="display:flex;align-items:flex-start;gap:11px;min-height:62px;padding:13px 0${last ? '' : `;border-bottom:1px solid ${C.rule}`}">
      <span class="n" style="width:46px;flex:none;font-size:12px;color:${C.faint};padding-top:2px">${date}</span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:14.5px;font-weight:600">${what}</span>
        ${book ? `<span style="font-size:12px;color:${C.meta}">${book}</span>` : ''}
      </span>
      <span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:none">
        <span class="n" style="font-size:14.5px;font-weight:600;color:${isCredit ? C.ok : C.ink}">${amt}</span>
        <span class="n" style="font-size:12px;color:${C.faint}">${running}</span>
      </span>
    </div>`;

ledger['LedgerPerson.dc.html'] = doc({ h: 1300, body: `
${header(G.gold, `${backRow('Ahmed Raza', `<button style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.92)">${ic('gear', 20, 1.8)}</button>`)}
    <div style="display:flex;flex-direction:column;gap:7px">
      ${eyebrow('Owes you')}
      <span class="n" style="font-size:44px;font-weight:600;line-height:1;letter-spacing:-0.03em">₹35,900</span>
      ${subline('Friend · 4 entries · nothing back yet')}
    </div>
    <div style="display:flex;gap:8px">
      <button class="el" style="flex:1;min-height:50px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:14px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.24);color:#FFFFFF;font-size:14.5px;font-weight:600">${ic('share', 17, 1.8)} Remind</button>
      <button class="el" style="flex:1;min-height:50px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:14px;background:#FFFFFF;color:${C.onFill};font-size:14.5px;font-weight:600">${ic('check', 17, 2.2)} Settle up</button>
    </div>`, '22px 20px 24px')}

  <div style="display:flex;align-items:center;gap:10px;padding:20px 22px 10px">
    <span style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.meta}">Dubai trip</span>
    <span style="flex:1;height:1px;background:${C.border}"></span>
    <span class="n" style="font-size:12.5px;font-weight:600;color:${C.meta}">₹35,900</span>
  </div>
${card(`    <div style="display:flex;align-items:center;gap:11px;padding:10px 0 8px;border-bottom:1px solid ${C.rule}">
      <span class="n" style="width:46px;flex:none;font-size:10.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.faint}">Date</span>
      <span style="flex:1;font-size:10.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.faint}">Entry</span>
      <span style="font-size:10.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.faint}">Amount · balance</span>
    </div>
${line('26 Aug', 'Flight — Emirates', 'You paid · HDFC Regalia', '+18,400', '18,400')}
${line('27 Aug', 'Hotel — Taj Palace', 'You paid · HDFC Regalia', '+12,500', '30,900')}
${line('28 Aug', 'Taxis', 'You paid · Cash', '+3,200', '34,100')}
${line('29 Aug', 'Meals', 'You paid · HDFC Regalia', '+1,800', '35,900', false, true)}`, '0 18px 22px')}

  <div style="display:flex;align-items:flex-start;gap:10px;margin:0 18px 24px;padding:14px 15px;border-radius:14px;background:${C.seagrassT}">
    <span style="color:${C.onFill};flex:none;margin-top:1px">${ic('alert', 17, 1.9)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.onFill}">These four are <b>your spending</b> — they were on your card, so they count in August's budget. When Ahmed pays you back it lands as money in, never as income.</span>
  </div>

${sectionHead('clock', C.neut, C.meta, 'Settled earlier', '', '0 20px 12px')}
${card(`    <div style="display:flex;align-items:center;gap:11px;min-height:60px;opacity:0.72">
      <span class="n" style="width:46px;flex:none;font-size:12px;color:${C.faint}">12 Jul</span>
      <span style="flex:1;font-size:14.5px">Concert tickets</span>
      ${statusChip('ok', 'Settled')}
      <span class="n" style="font-size:14px;font-weight:600;color:${C.meta}">₹4,800</span>
    </div>`, '0 18px 26px')}

  <div style="margin-top:auto;padding:0 18px 26px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:9px">${ic('plus', 20, 2.2)} Add to Ahmed's book</button>
  </div>` });

/* ── a book ────────────────────────────────────────────────────────────── */
ledger['LedgerBook.dc.html'] = doc({ h: 1180, body: `
${header(G.gold, `${backRow('Dubai trip', `<button style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.92)">${ic('share', 20, 1.8)}</button>`)}
    <div style="display:flex;flex-direction:column;gap:7px">
      ${eyebrow('Outstanding in this book')}
      <span class="n" style="font-size:44px;font-weight:600;line-height:1;letter-spacing:-0.03em">₹35,900</span>
      ${subline('4 entries · 26–29 Aug · open')}
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:rgba(0,0,0,0.20)">
      <span style="width:30px;height:30px;border-radius:999px;background:${CAT.orange[0]};display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700;color:${CAT.orange[1]};flex:none">AR</span>
      <span style="flex:1;font-size:13.5px;color:rgba(255,255,255,0.92)">Ahmed Raza owes all of it</span>
      <span class="n" style="font-size:14px;font-weight:600">₹35,900</span>
    </div>`, '22px 20px 24px')}

${sectionHead('doc', CAT.cyan[0], CAT.cyan[1], 'What is in it', link('Add'), '20px 20px 12px')}
${card([
  ['plane', 'cyan', 'Flight — Emirates', '26 Aug · HDFC Regalia', '₹18,400'],
  ['house2', 'purple', 'Hotel — Taj Palace', '27 Aug · HDFC Regalia', '₹12,500'],
  ['car', 'blue', 'Taxis', '28 Aug · Cash', '₹3,200'],
  ['cutlery', 'orange', 'Meals', '29 Aug · HDFC Regalia', '₹1,800'],
].map(([icon, tint, name, sub, amt], n, a) => `    <div style="display:flex;gap:13px">
      ${avatar(icon, CAT[tint][0], CAT[tint][1], 38, '14px')}
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:14px 0${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
          <span style="font-size:15px;font-weight:600">${name}</span>
          <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
        </span>
        ${amount(amt)}
      </div>
    </div>`).join('\n'), '0 18px 22px')}

  <div style="display:flex;align-items:flex-start;gap:10px;margin:0 18px 24px;padding:14px 15px;border-radius:14px;background:${C.sunk2}">
    <span style="color:${C.meta};flex:none;margin-top:1px">${ic('alert', 17, 1.9)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.meta}">A book groups entries. It does not split them — every entry here belongs to one person, which is how you said you actually lend.</span>
  </div>

  <div style="margin-top:auto;display:flex;gap:9px;padding:0 18px 26px">
    <button style="flex:1;min-height:54px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:15px;background:${C.sunk2};color:${C.ink};font-size:15px;font-weight:600">${ic('share', 18, 1.8)} Send it</button>
    <button class="el2" style="flex:1;min-height:54px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:15px;background:${TEAL_BTN};color:#FFFFFF;font-size:15px;font-weight:600">${ic('check', 18, 2.2)} Settle up</button>
  </div>` });

/* ── add an entry: the fork that decision 1 created ────────────────────── */
ledger['LedgerAddEntry.dc.html'] = doc({ h: 1000, body: `
  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 20px 0">
    <button style="width:44px;height:44px;margin-left:-10px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:${C.meta}">${ic('x', 21, 2)}</button>
    <h1 class="t" style="margin:0;font-size:19px">New entry</h1>
    <span style="width:44px;height:44px"></span>
  </div>
${titleBlock('What kind of money is this?', 'The three behave differently, and picking wrong here is the one thing that quietly corrupts a budget.', '18px 22px 20px')}

  <div style="display:flex;flex-direction:column;gap:11px;padding:0 18px">
${[
  ['up', 'blue', 'I lent money', 'Cash or a transfer out of your account.', '<b>Not spending.</b> It leaves your balance and becomes money owed to you.', true],
  ['card2', 'orange', 'I paid for someone', 'Their hotel, their ticket, on your card.', '<b>Your spending this month</b>, because it was. Marked to get back.', false],
  ['swap', 'purple', 'Something was refunded', 'A return, a cancelled booking.', '<b>Undoes spending.</b> Reduces that category in the month it lands.', false],
].map(([icon, tint, title, sub, effect, on]) => `    <button class="el" style="display:flex;align-items:flex-start;gap:13px;padding:16px;border-radius:18px;background:${C.card};border:1.5px solid ${on ? C.seagrass : 'transparent'};text-align:left">
      ${avatar(icon, CAT[tint][0], CAT[tint][1], 42)}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
        <span style="font-size:15.5px;font-weight:600">${title}</span>
        <span style="font-size:13px;line-height:1.45;color:${C.meta}">${sub}</span>
        <span style="font-size:12.5px;line-height:1.45;color:${C.meta};padding-top:6px;border-top:1px dashed ${C.rule}">${effect}</span>
      </span>
      <span style="width:24px;height:24px;border-radius:999px;${on ? `background:${C.seagrass};color:${C.onFill}` : `border:1.5px solid ${C.hair}`};display:flex;align-items:center;justify-content:center;flex:none;margin-top:2px">${on ? ic('check', 14, 2.8) : ''}</span>
    </button>`).join('\n')}
  </div>

  <div class="el" style="margin:20px 18px 0;background:${C.card};border-radius:18px;padding:2px 16px">
${[['Amount', '₹10,000'], ['Person', 'Ahmed Raza'], ['Book', 'Dubai trip'], ['From', 'HDFC Savings'], ['Date', 'Today, 3 Sep']]
  .map(([l, v], n, a) => `    <button style="display:flex;align-items:center;gap:12px;width:100%;min-height:58px${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
      <span style="width:76px;flex:none;font-size:13.5px;font-weight:600;color:${C.meta}">${l}</span>
      <span style="flex:1;font-size:15.5px;font-weight:600">${v}</span>
      <span style="color:${C.faint}">${ic('chevR', 18, 2)}</span>
    </button>`).join('\n')}
  </div>

  <div style="margin-top:auto;padding:20px 18px 26px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center">Save entry</button>
  </div>` });

/* ── writing one off — decision 3 ──────────────────────────────────────── */
ledger['LedgerWriteOff.dc.html'] = doc({ h: 760, body: `
  <div style="flex:1;background:rgba(35,61,77,0.46)"></div>
  <div class="el2" style="background:${C.card};border-radius:26px 26px 0 0;padding:10px 22px 28px;display:flex;flex-direction:column;gap:14px">
    <span style="width:38px;height:4px;border-radius:999px;background:${C.hair};align-self:center;margin-bottom:8px"></span>
    ${avatar('alert', C.dangerTint, C.danger, 48)}
    <h2 class="t" style="margin:2px 0 0;font-size:22px;letter-spacing:-0.015em">Write off ₹12,000 from Sara?</h2>
    <p style="margin:0;font-size:14.5px;line-height:1.5;color:${C.meta}">You are deciding this money is not coming back. That is a real cost, so it is recorded as one.</p>

    <div style="display:flex;flex-direction:column;gap:11px;padding:15px 16px;border-radius:16px;background:${C.sunk2}">
${[['Sara owes you', '₹12,000', C.ink],
   ['Becomes an expense today', '₹12,000', C.danger],
   ['Net worth falls by', '₹12,000', C.danger]]
  .map(([l, v, ink]) => `      <div style="display:flex;gap:10px"><span style="flex:1;font-size:13.5px;color:${C.meta}">${l}</span><span class="n" style="font-size:13.5px;font-weight:600;color:${ink}">${v}</span></div>`).join('\n')}
      <div style="display:flex;gap:10px;padding-top:10px;border-top:1px solid ${C.border}">
        <span style="flex:1;font-size:13.5px;font-weight:600">August stays as it was</span>
        <span class="n" style="font-size:13.5px;font-weight:600;color:${C.ok}">unchanged</span>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:12px;min-height:58px;padding:0 15px;border-radius:14px;border:1px solid ${C.border}">
      <span style="flex:1;font-size:14px;font-weight:600;color:${C.meta}">Put it under</span>
      <span style="display:flex;align-items:center;gap:7px;font-size:14.5px;font-weight:600">${avatar('user', CAT.pink[0], CAT.pink[1], 26)} Gifts &amp; help ${ic('chevR', 16, 2)}</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
      <button class="el2" style="width:100%;min-height:56px;border-radius:16px;background:${C.dangerFill};color:${C.onFill};font-size:16px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px">${ic('check', 18, 2.4)} Write it off</button>
      <button style="width:100%;min-height:50px;display:flex;align-items:center;justify-content:center;color:${C.meta};font-size:15px;font-weight:600">Keep chasing it</button>
    </div>
  </div>` });

  return ledger;
}
