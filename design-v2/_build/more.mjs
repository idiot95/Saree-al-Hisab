import {
  C, G, TEAL_BTN, TEAL_SM, ic, doc, nav, header, backRow, eyebrow, subline,
  bigNumber, sectionHead, link, card, avatar, row, meta, amount, tag, dashedBtn, titleBlock,
  HSCROLL, SNAP,
  CAT,
  BAR, BAR_HOT, BAR_WARN, BAR_GOOD,
} from './lib.mjs';

export function buildMore() {
  const more = {};

const plainHead = (title, right = '') => `  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 20px 0">
    <button style="width:44px;height:44px;margin-left:-10px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:${C.meta}">${ic('back', 21, 2)}</button>
    <h1 class="t" style="margin:0;font-size:19px">${title}</h1>
    ${right || '<span style="width:44px;height:44px"></span>'}
  </div>`;

/* ══════════════════ INBOX ══════════════════
   The screen Home and More have been badging "3" at all along.
   One card per decision, each with the two answers on it.                */
more['Inbox.dc.html'] = doc({ h: 1240, body: `
${header(G.gold, `${backRow('Inbox')}
    <div style="display:flex;flex-direction:column;gap:7px">
      ${eyebrow('Waiting on you')}
      <span class="n" style="font-size:44px;font-weight:600;line-height:1;letter-spacing:-0.03em">5 things</span>
      ${subline('Nothing here has touched your balances yet')}
    </div>`, '22px 20px 26px')}

  <div style="display:flex;flex-direction:column;gap:12px;padding:20px 18px 0">

    <section class="el" style="background:${C.card};border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:13px">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatar('receipt', CAT.green[0], CAT.green[1], 40)}
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span style="display:flex;align-items:center;gap:8px">
            <span style="font-size:15.5px;font-weight:600">₹2,340 at Big Bazaar</span>
            ${tag('Scanned', C.onFill, C.seagrassT)}
          </span>
          <span style="font-size:12.5px;color:${C.meta}">From a receipt photo · today, 18:20</span>
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:9px;padding:12px 13px;border-radius:13px;background:${C.sunk2}">
        <span style="width:28px;height:28px;border-radius:999px;background:${CAT.green[0]};display:flex;align-items:center;justify-content:center;color:${CAT.green[1]};flex:none">${ic('cart', 15, 1.8)}</span>
        <span style="flex:1;font-size:13.5px;color:${C.meta}">Guessed <b style="color:${C.ink}">Groceries</b> on HDFC Savings</span>
      </div>
      <div style="display:flex;gap:8px">
        <button style="flex:1;min-height:48px;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:13px;background:${C.okFill};color:${C.onFill};font-size:14.5px;font-weight:600">${ic('check', 17, 2.4)} Looks right</button>
        <button style="min-height:48px;padding:0 16px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:${C.sunk2};color:${C.meta};font-size:14.5px;font-weight:600">Check it</button>
      </div>
    </section>

    <section class="el" style="background:${C.card};border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:13px">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatar('card2', CAT.rust[0], CAT.rust[1], 40)}
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span style="display:flex;align-items:center;gap:8px">
            <span style="font-size:15.5px;font-weight:600">₹1,180 at Apollo Pharmacy</span>
            ${tag('Imported', C.onFill, C.seagrassT)}
          </span>
          <span style="font-size:12.5px;color:${C.meta}">From an HDFC message · today, 09:14</span>
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:9px;padding:12px 13px;border-radius:13px;background:${C.sunk2}">
        <span style="width:28px;height:28px;border-radius:999px;background:${CAT.rust[0]};display:flex;align-items:center;justify-content:center;color:${CAT.rust[1]};flex:none">${ic('shield', 15, 1.8)}</span>
        <span style="flex:1;font-size:13.5px;color:${C.meta}">Looks like <b style="color:${C.ink}">Health</b> on HDFC Savings</span>
        <button style="min-height:44px;padding:0 6px;margin-right:-6px;display:flex;align-items:center;font-size:13px;font-weight:600;color:${C.teal}">Change</button>
      </div>
      <div style="display:flex;gap:8px">
        <button style="flex:1;min-height:48px;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:13px;background:${TEAL_SM};color:#FFFFFF;font-size:14.5px;font-weight:600">${ic('check', 17, 2.2)} Add it</button>
        <button style="min-height:48px;padding:0 16px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:${C.sunk2};color:${C.meta};font-size:14.5px;font-weight:600">Not mine</button>
      </div>
    </section>

    <section class="el" style="background:${C.card};border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:13px">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatar('house2', C.greenL, C.green, 40)}
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span style="font-size:15.5px;font-weight:600">Rent — Andheri flat</span>
          <span style="font-size:12.5px;color:${C.meta}">Expected 28 Aug · 3 days late</span>
        </span>
        <span class="n" style="font-size:17px;font-weight:600;color:${C.ok}">+₹22,000</span>
      </div>
      <div style="display:flex;gap:8px">
        <button style="flex:1;min-height:48px;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:13px;background:${C.okFill};color:${C.onFill};font-size:14.5px;font-weight:600">${ic('check', 17, 2.4)} Received</button>
        <button style="flex:1;min-height:48px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:${C.sunk2};color:${C.meta};font-size:14.5px;font-weight:600">Different amount</button>
      </div>
    </section>

    <section class="el" style="background:${C.card};border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:13px">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatar('refresh', CAT.purple[0], CAT.purple[1], 40)}
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span style="font-size:15.5px;font-weight:600">Jio postpaid looks monthly</span>
          <span style="font-size:12.5px;color:${C.meta}">₹1,099 on the 7th, three months running</span>
        </span>
      </div>
      <div style="display:flex;gap:8px">
        <button style="flex:1;min-height:48px;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:13px;background:${TEAL_SM};color:#FFFFFF;font-size:14.5px;font-weight:600">${ic('cal', 17, 1.9)} Schedule it</button>
        <button style="flex:1;min-height:48px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:${C.sunk2};color:${C.meta};font-size:14.5px;font-weight:600">No thanks</button>
      </div>
    </section>

    <section class="el" style="background:${C.card};border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:13px">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatar('split', CAT.rust[0], CAT.rust[1], 40)}
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span style="font-size:15.5px;font-weight:600">₹4,500 at Amazon, twice</span>
          <span style="font-size:12.5px;color:${C.meta}">HDFC Regalia · 28 Aug, five minutes apart</span>
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:9px;padding:12px 13px;border-radius:13px;background:${C.sunk2}">
        <span style="flex:1;font-size:13.5px;color:${C.meta}">The bank's message arrived after you had typed it in yourself</span>
      </div>
      <div style="display:flex;gap:8px">
        <button style="flex:1;min-height:48px;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:13px;background:${TEAL_SM};color:#FFFFFF;font-size:14.5px;font-weight:600">${ic('check', 17, 2.2)} Keep one</button>
        <button style="flex:1;min-height:48px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:${C.sunk2};color:${C.meta};font-size:14.5px;font-weight:600">Both are real</button>
      </div>
    </section>

    <div style="display:flex;align-items:center;gap:10px;padding:14px 15px;border-radius:14px;background:${C.seagrassT};margin-top:6px">
      <span style="color:${C.onFill};flex:none">${ic('check', 18, 2.2)}</span>
      <span style="flex:1;font-size:13.5px;line-height:1.45;color:${C.tealD}">Clear the inbox and your balances are up to date. Nothing here counts until you say so.</span>
    </div>
  </div>

${nav('more')}` });

/* ══════════════════ SHARE & SETTLE ══════════════════ */
more['ShareSettle.dc.html'] = doc({ h: 1080, body: `
${header(G.gold, `${backRow('Dubai trip', `<button style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.86)">${ic('share', 20, 1.8)}</button>`)}
    <div style="display:flex;flex-direction:column;gap:7px">
      ${eyebrow('Ahmed Raza owes you')}
      <span class="n" style="font-size:44px;font-weight:600;line-height:1;letter-spacing:-0.03em">₹35,900</span>
      ${subline('4 items · you paid for all of them')}
    </div>`, '22px 20px 26px')}

${sectionHead('split', C.goldL, C.gold, 'What is in it', link('Add an item'), '20px 20px 12px')}
${card(`${row({ icon: 'plane', tint: CAT.cyan[0], tintInk: CAT.cyan[1], title: 'Flight — Emirates', sub: meta("26 Aug · Ahmed's"), right: amount('₹18,400'), pad: 15, iconTop: '15px' })}
${row({ icon: 'house2', tint: CAT.purple[0], tintInk: CAT.purple[1], title: 'Hotel — Taj Palace', sub: meta("29 Aug · Ahmed's"), right: amount('₹12,500'), pad: 15, iconTop: '15px' })}
${row({ icon: 'car', tint: C.blueL, tintInk: CAT.blue[1], title: 'Taxis', sub: meta("27–29 Aug · Ahmed's"), right: amount('₹3,200'), pad: 15, iconTop: '15px' })}
${row({ icon: 'cutlery', tint: CAT.orange[0], tintInk: CAT.orange[1], title: 'Meals', sub: meta("27–29 Aug · Ahmed's"), right: amount('₹1,800'), last: true, pad: 15, iconTop: '15px' })}`, '0 18px 20px')}

${sectionHead('users', C.indigoL, C.indigo, 'Where it stands', '', '0 20px 12px')}
${card(`    <div style="display:flex;align-items:center;gap:12px;min-height:66px;border-bottom:1px solid ${C.rule}">
      <span style="width:38px;height:38px;border-radius:999px;background:linear-gradient(140deg,${CAT.green[0]} 0%,#A9D07E 100%);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${C.tealD};flex:none">AM</span>
      <span style="flex:1;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:15px;font-weight:600">You paid</span>
        <span style="font-size:12.5px;color:${C.meta}">HDFC Credit Card · 4 items</span>
      </span>
      <span class="n" style="font-size:15px;font-weight:600;color:${C.meta}">₹35,900</span>
    </div>
    <div style="display:flex;align-items:center;gap:12px;min-height:66px">
      <span style="width:38px;height:38px;border-radius:999px;background:linear-gradient(140deg,${CAT.orange[0]} 0%,#FBA766 100%);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${C.goldInk};flex:none">AR</span>
      <span style="flex:1;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:15px;font-weight:600">Ahmed owes</span>
        <span style="font-size:12.5px;color:${C.meta}">Shared 26 Aug · not yet opened</span>
      </span>
      <span class="n" style="font-size:15px;font-weight:600;color:${C.gold}">₹35,900</span>
    </div>`, '0 18px 22px')}

  <div style="display:flex;gap:9px;padding:0 18px 26px">
    <button style="flex:1;min-height:54px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:15px;background:${C.sunk2};color:${C.ink};font-size:15px;font-weight:600">${ic('share', 18, 1.8)} Remind</button>
    <button class="el2" style="flex:1;min-height:54px;display:flex;align-items:center;justify-content:center;border-radius:15px;background:linear-gradient(145deg,#C2551A 0%,#9C3F0D 100%);color:#FFFFFF;font-size:15px;font-weight:600">Settle up</button>
  </div>` });

more['ShareCompose.dc.html'] = doc({ h: 720, body: `
  <div style="flex:1;background:rgba(33,30,26,0.44)"></div>
  <div class="el2" style="background:${C.card};border-radius:26px 26px 0 0;padding:10px 20px 26px;display:flex;flex-direction:column;gap:14px">
    <span style="width:38px;height:4px;border-radius:999px;background:${C.off};align-self:center;margin-bottom:6px"></span>
    <h2 class="t" style="margin:0;font-size:21px;letter-spacing:-0.015em">Send Ahmed the breakdown</h2>
    <div style="display:flex;flex-direction:column;gap:9px;padding:15px 16px;border-radius:16px;background:${C.sunk2}">
      <span style="font-size:14px;font-weight:600">Dubai trip · Abdeali paid for these</span>
${[['Flight — Emirates', '₹18,400'], ['Hotel — Taj Palace', '₹12,500'], ['Taxis', '₹3,200'], ['Meals', '₹1,800']].map(([n, a]) =>
  `      <div style="display:flex;gap:10px"><span style="flex:1;font-size:13.5px;color:${C.meta}">${n}</span><span class="n" style="font-size:13.5px;font-weight:600;color:${C.meta}">${a}</span></div>`).join('\n')}
      <div style="display:flex;gap:10px;padding-top:9px;border-top:1px solid ${C.border}">
        <span style="flex:1;font-size:14px;font-weight:600">You owe Abdeali</span>
        <span class="n" style="font-size:14px;font-weight:700;color:${C.gold}">₹35,900</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:11px;min-height:56px;padding:0 15px;border-radius:14px;border:1px solid ${C.border}">
      <span style="color:${C.faint}">${ic('doc', 18, 1.8)}</span>
      <span style="flex:1;font-size:14.5px;color:${C.ph}">Add a note — optional</span>
    </div>
    <div style="display:flex;gap:9px">
${[['Message', 'phone'], ['WhatsApp', 'share'], ['Email', 'mail'], ['Copy', 'doc']].map(([t, i]) =>
  `      <button style="flex:1;min-height:74px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;border-radius:15px;background:${C.sunk2};color:${C.ink};font-size:12px;font-weight:600">${ic(i, 20, 1.8)} ${t}</button>`).join('\n')}
    </div>
  </div>` });

more['RecordPayment.dc.html'] = doc({ h: 880, body: `
  <div class="el2" style="background:${G.gold};color:#FFFFFF;border-radius:0 0 26px 26px;padding:18px 20px 24px;display:flex;flex-direction:column;gap:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <button style="width:44px;height:44px;margin-left:-10px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.86)">${ic('x', 21, 2)}</button>
      <h1 class="t" style="margin:0;font-size:19px;color:#FFFFFF">Payment received</h1>
      <span style="width:44px;height:44px"></span>
    </div>
    <div style="display:flex;flex-direction:column;gap:9px">
      ${eyebrow('Amount received')}
      <div style="display:flex;align-items:baseline;gap:6px">
        <span class="n" style="font-size:28px;font-weight:500;color:rgba(255,255,255,0.62)">₹</span>
        <span class="n" style="font-size:46px;font-weight:600;letter-spacing:-0.036em;line-height:1.05">12,000</span>
        <span style="width:2px;height:34px;background:rgba(255,255,255,0.85);margin-left:3px;align-self:center"></span>
      </div>
    </div>
  </div>

  <div class="el" style="margin:-16px 18px 14px;background:${C.card};border-radius:18px;padding:2px 16px">
${[['From', 'Sara Iyer', true], ['Into', 'HDFC Savings', true], ['On', 'Today, 31 Aug', false]].map(([l, v, chev], n, a) =>
  `    <button style="display:flex;align-items:center;gap:12px;width:100%;min-height:58px${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
      <span style="width:76px;flex:none;font-size:13.5px;font-weight:600;color:${C.meta}">${l}</span>
      <span style="flex:1;font-size:15.5px;font-weight:600">${v}</span>
      <span style="color:${C.faint}">${ic('chevR', 18, 2)}</span>
    </button>`).join('\n')}
  </div>

  <div class="el" style="margin:0 18px 14px;background:${C.card};border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:11px">
    <span style="font-size:14px;font-weight:600">Settles this much of what Sara owes</span>
    <div style="height:9px;border-radius:999px;background:${C.track};overflow:hidden;display:flex">
      <div style="width:40%;background:${BAR}"></div>
      <div style="width:60%;background:${C.tealL}"></div>
    </div>
    <div style="display:flex;gap:10px">
      <span class="n" style="flex:1;font-size:12.5px;color:${C.meta}">₹8,000 already back</span>
      <span class="n" style="font-size:12.5px;font-weight:600;color:${C.teal}">₹12,000 now · fully settled</span>
    </div>
  </div>

  <div style="display:flex;align-items:flex-start;gap:10px;margin:0 18px;padding:14px 15px;border-radius:14px;background:${C.sunk2}">
    <span style="color:${C.meta};flex:none;margin-top:1px">${ic('alert', 17, 1.9)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.meta}">This lands in your account as money in — it is not income, so it will not count towards Money in for the month.</span>
  </div>

  <div style="margin-top:auto;padding:20px 18px 26px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center">Record it</button>
  </div>` });

/* ══════════════════ HOUSEHOLD ══════════════════ */
more['HouseholdMembers.dc.html'] = doc({ h: 1040, body: `
${header(G.indigo, `${backRow('Household')}
    <div style="display:flex;flex-direction:column;gap:6px">
      <h2 class="t" style="margin:0;font-size:26px;color:#FFFFFF">Mogul Household</h2>
      ${subline('2 members · created 4 Aug 2026')}
    </div>`, '22px 20px 26px')}

  <div style="display:flex;align-items:flex-start;gap:10px;margin:20px 18px 20px;padding:14px 15px;border-radius:14px;background:${C.indigoL}">
    <span style="color:${C.onFill};flex:none;margin-top:1px">${ic('lock', 17, 1.9)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.indigo}">A household keeps one set of books. Everyone in it sees every entry and every budget — that is what makes the shared totals work.</span>
  </div>

${sectionHead('users', C.indigoL, C.indigo, 'Members', '', '0 20px 12px')}
${card(`${[
  ['AM', 'linear-gradient(140deg,${CAT.green[0]} 0%,#A9D07E 100%)', '${C.tealD}', 'Abdeali M', 'You · joined 4 Aug', 'Owner', C.indigo, C.indigoL],
  ['FM', 'linear-gradient(140deg,${CAT.purple[0]} 0%,#DE93CC 100%)', '${C.plum}', 'Fatema M', 'Joined 6 Aug', 'Adult', C.meta, C.sunk],
].map(([ini, grad, ink, name, sub, role, roleInk, roleBg], n, a) => `    <div style="display:flex;align-items:center;gap:12px;min-height:72px${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
      <span style="width:42px;height:42px;border-radius:999px;background:${grad};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:${ink};flex:none">${ini}</span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:15.5px;font-weight:600">${name}</span>
        <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
      </span>
      <button style="min-height:44px;padding:0 12px;display:flex;align-items:center;gap:6px;border-radius:11px;background:${roleBg};color:${roleInk};font-size:13px;font-weight:600">${role} ${ic('chevD', 14, 2)}</button>
    </div>`).join('\n')}
    <div style="display:flex;align-items:center;gap:12px;min-height:72px;border-top:1px solid ${C.rule}">
      <span style="width:42px;height:42px;border-radius:999px;background:${C.goldL};display:flex;align-items:center;justify-content:center;color:${C.gold};flex:none">${ic('clock', 20, 1.8)}</span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:15.5px;font-weight:600;color:${C.meta}">+91 98204 41213</span>
        <span style="font-size:12.5px;color:${C.gold}">Invited 29 Aug · expires in 5 days</span>
      </span>
      <button style="min-height:44px;padding:0 12px;display:flex;align-items:center;border-radius:11px;background:${C.sunk2};color:${C.meta};font-size:13px;font-weight:600">Resend</button>
    </div>`, '0 18px 22px')}

${dashedBtn('Invite someone', 'plus', '0 18px 24px')}

${sectionHead('doc', C.neut, C.meta, 'What each role can do', '', '0 20px 12px')}
${card(`${[
  ['Owner', 'Billing, removing members, deleting the household.'],
  ['Adult', 'Adds, edits and deletes anything. Cannot remove members.'],
  ['Viewer', 'Reads everything, records only their own entries.'],
].map(([r, d], n, a) => `    <div style="display:flex;flex-direction:column;gap:4px;padding:15px 0${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
      <span style="font-size:14.5px;font-weight:600">${r}</span>
      <span style="font-size:13px;line-height:1.5;color:${C.meta}">${d}</span>
    </div>`).join('\n')}`, '0 18px 26px')}` });

more['HouseholdInvite.dc.html'] = doc({ h: 880, body: `
${plainHead('Invite someone')}
${titleBlock('Who is joining?', 'They get a code that works for 7 days and sign in with their own number. From then on you both see the same books.', '20px 22px 22px')}
  <div style="display:flex;flex-direction:column;gap:16px;padding:0 20px">
    <div style="display:flex;flex-direction:column;gap:7px">
      <span class="eyebrow" style="color:${C.meta}">Their phone number</span>
      <div style="display:flex;gap:10px">
        <button style="min-height:58px;padding:0 14px;display:flex;align-items:center;gap:7px;border-radius:15px;background:${C.card};border:1px solid ${C.border};font-size:16px;font-weight:600;flex:none">+91 ${ic('chevD', 14, 2)}</button>
        <div class="n" style="flex:1;min-height:58px;display:flex;align-items:center;padding:0 16px;border-radius:15px;background:${C.card};border:1.5px solid ${C.teal};font-size:17px;font-weight:600">98204 41213</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:9px">
      <span class="eyebrow" style="color:${C.meta}">They join as</span>
${[
  ['Adult', 'Adds, edits and deletes anything. Cannot remove members.', true],
  ['Viewer', 'Reads everything, records only their own entries.', false],
].map(([r, d, on]) => `      <button class="el" style="display:flex;align-items:flex-start;gap:12px;padding:15px 16px;border-radius:16px;background:${C.card};border:1.5px solid ${on ? C.teal : 'transparent'};text-align:left">
        <span style="width:24px;height:24px;border-radius:999px;${on ? `background:${C.teal};color:#FFFFFF` : 'border:1.5px solid ${C.hair}'};display:flex;align-items:center;justify-content:center;flex:none;margin-top:1px">${on ? ic('check', 14, 2.8) : ''}</span>
        <span style="flex:1;display:flex;flex-direction:column;gap:3px">
          <span style="font-size:15.5px;font-weight:600">${r}</span>
          <span style="font-size:13px;line-height:1.45;color:${C.meta}">${d}</span>
        </span>
      </button>`).join('\n')}
    </div>
  </div>
  <div style="margin-top:auto;display:flex;flex-direction:column;gap:6px;padding:24px 18px 26px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center">Send invite</button>
    <button style="width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;color:${C.meta};font-size:15px;font-weight:600">${ic('share', 17, 1.8)} Share a link instead</button>
  </div>` });

more['HouseholdRole.dc.html'] = doc({ h: 660, body: `
  <div style="flex:1;background:rgba(33,30,26,0.44)"></div>
  <div class="el2" style="background:${C.card};border-radius:26px 26px 0 0;padding:10px 20px 26px;display:flex;flex-direction:column;gap:12px">
    <span style="width:38px;height:4px;border-radius:999px;background:${C.off};align-self:center;margin-bottom:6px"></span>
    <h2 class="t" style="margin:0;font-size:21px;letter-spacing:-0.015em">Fatema's role</h2>
${[
  ['Owner', 'Billing, removing members, deleting the household.', false],
  ['Adult', 'Adds, edits and deletes anything. Cannot remove members.', true],
  ['Viewer', 'Reads everything, records only their own entries.', false],
].map(([r, d, on]) => `    <button style="display:flex;align-items:flex-start;gap:12px;padding:15px 16px;border-radius:16px;background:${on ? C.tealL : C.sunk2};text-align:left">
      <span style="width:24px;height:24px;border-radius:999px;${on ? `background:${C.teal};color:#FFFFFF` : 'border:1.5px solid ${C.hair}'};display:flex;align-items:center;justify-content:center;flex:none;margin-top:1px">${on ? ic('check', 14, 2.8) : ''}</span>
      <span style="flex:1;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:15.5px;font-weight:600">${r}</span>
        <span style="font-size:13px;line-height:1.45;color:${on ? '${C.tealD}' : C.meta}">${d}</span>
      </span>
    </button>`).join('\n')}
    <div style="display:flex;align-items:flex-start;gap:10px;padding:13px 15px;border-radius:14px;background:${C.pollen};margin-top:4px">
      <span style="color:${C.onFill};flex:none;margin-top:1px">${ic('finger', 17, 1.8)}</span>
      <span style="flex:1;font-size:13px;line-height:1.5;color:${C.goldInk}">Changing a role asks for Face ID first.</span>
    </div>
    <button style="min-height:52px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:14px;background:${C.redL};color:${C.red};font-size:14.5px;font-weight:600;margin-top:4px">${ic('trash', 17, 1.9)} Remove from household</button>
  </div>` });

/* ══════════════════ SETTINGS ══════════════════ */
const toggle = (on) => on
  ? `<span style="width:50px;height:30px;border-radius:999px;background:${C.seagrass};display:flex;align-items:center;justify-content:flex-end;padding:3px;flex:none"><span style="width:24px;height:24px;border-radius:999px;background:#FFFFFF"></span></span>`
  : `<span style="width:50px;height:30px;border-radius:999px;background:${C.off};display:flex;align-items:center;justify-content:flex-start;padding:3px;flex:none"><span style="width:24px;height:24px;border-radius:999px;background:#FFFFFF"></span></span>`;

more['Settings.dc.html'] = doc({ h: 1300, body: `
${plainHead('Settings')}

${sectionHead('lock', C.tealL, C.teal, 'Lock &amp; privacy', '', '22px 20px 12px')}
${card(`${[
  ['Face ID', 'Falls back to your PIN', toggle(true)],
  ['Lock after', '2 minutes in the background', `<span style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:${C.meta}">2 min ${ic('chevR', 17, 2)}</span>`],
  ['Hide amounts in the app switcher', 'Blurs balances when you swipe away', toggle(true)],
  ['Always ask before the Vault', 'Even when the app is unlocked', toggle(true)],
  ['Change PIN', '', `<span style="color:${C.faint}">${ic('chevR', 17, 2)}</span>`],
  ['Devices', '3 signed in', `<span style="color:${C.faint}">${ic('chevR', 17, 2)}</span>`],
].map(([t, s, right], n, a) => `    <div style="display:flex;align-items:center;gap:12px;min-height:66px${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:15px;font-weight:600">${t}</span>
        ${s ? `<span style="font-size:12.5px;color:${C.meta}">${s}</span>` : ''}
      </span>
      ${right}
    </div>`).join('\n')}`, '0 18px 24px')}

${sectionHead('bank2', C.goldL, C.gold, 'Money', '', '0 20px 12px')}
${card(`${[
  ['Main currency', 'INR · ₹', `<span style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:${C.meta}">₹ INR ${ic('chevR', 17, 2)}</span>`],
  ['Exchange rates', 'Updated daily · 1 USD = ₹83.50', `<span style="color:${C.faint}">${ic('chevR', 17, 2)}</span>`],
  ['Month starts on', 'The 1st', `<span style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:${C.meta}">1st ${ic('chevR', 17, 2)}</span>`],
  ['Show the Hijri date', 'Beside Gregorian on scheduled payments', toggle(true)],
  ['Read payment messages', 'Suggests entries in your Inbox — nothing is added without you', toggle(true)],
].map(([t, s, right], n, a) => `    <div style="display:flex;align-items:center;gap:12px;min-height:66px${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:15px;font-weight:600">${t}</span>
        ${s ? `<span style="font-size:12.5px;line-height:1.4;color:${C.meta}">${s}</span>` : ''}
      </span>
      ${right}
    </div>`).join('\n')}`, '0 18px 24px')}

${sectionHead('bell', C.blueL, C.blue, 'Nudges', '', '0 20px 12px')}
${card(`${[
  ['A payment is due tomorrow', '', toggle(true)],
  ['Something is overdue', '', toggle(true)],
  ['A category is nearly spent', 'At 80%', toggle(true)],
  ['Weekly summary', 'Sunday evening', toggle(false)],
].map(([t, s, right], n, a) => `    <div style="display:flex;align-items:center;gap:12px;min-height:62px${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:15px;font-weight:600">${t}</span>
        ${s ? `<span style="font-size:12.5px;color:${C.meta}">${s}</span>` : ''}
      </span>
      ${right}
    </div>`).join('\n')}`, '0 18px 24px')}

${card(`    <button style="display:flex;align-items:center;gap:12px;width:100%;min-height:62px;border-bottom:1px solid ${C.rule}">
      <span style="flex:1;font-size:15px;font-weight:600;color:${C.teal}">Export everything</span>
      <span style="color:${C.faint}">${ic('chevR', 17, 2)}</span>
    </button>
    <button style="display:flex;align-items:center;gap:12px;width:100%;min-height:62px">
      <span style="flex:1;font-size:15px;font-weight:600;color:${C.red}">Sign out</span>
    </button>`, '0 18px 26px')}` });

/* ══════════════════ VAULT ══════════════════ */
more['Vault.dc.html'] = doc({ h: 1000, body: `
  <div class="el2" style="background:${G.char};color:#FFFFFF;border-radius:0 0 28px 28px;padding:22px 20px 24px;display:flex;flex-direction:column;gap:16px">
${backRow('Vault', `<button style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.86)">${ic('search', 20, 1.9)}</button>`)}
    <div style="display:flex;align-items:center;gap:11px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,0.12)">
      <span style="color:rgba(255,255,255,0.9);flex:none">${ic('lock', 18, 1.8)}</span>
      <span style="flex:1;font-size:13px;line-height:1.45;color:rgba(255,255,255,0.88)">Face ID confirmed. The Vault asks again every time it is opened, even mid-session.</span>
    </div>
  </div>

  <p style="margin:0;padding:20px 22px 16px;font-size:14.5px;line-height:1.5;color:${C.meta}">Policies, deeds and account papers — the things you go looking for once a year and cannot find.</p>

${card(`${[
  ['doc', C.blueL, C.blue, 'Flat — sale deed', 'PDF · 2.4 MB · added 12 Aug'],
  ['shield', CAT.indigo[0], CAT.indigo[1], 'Car insurance policy', 'PDF · renews 5 Sep'],
  ['shield', CAT.indigo[0], CAT.indigo[1], 'Health cover — family floater', 'PDF · renews 2 Jan'],
  ['bank2', C.tealL, C.teal, 'HDFC account papers', '3 files · added 4 Aug'],
  ['card2', CAT.rust[0], CAT.rust[1], 'Car loan agreement', 'PDF · 22 payments left'],
  ['user', C.goldL, C.gold, 'PAN and Aadhaar', '2 files · locked'],
  ['house', C.plumL, C.plum, 'Gold purchase receipts', '4 files · added 19 Aug'],
].map(([i, t, ti, name, sub], n, a) => `    <a href="#" style="display:flex;align-items:center;gap:13px;min-height:68px;color:${C.ink}${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
      ${avatar(i, t, ti, 38)}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:15px;font-weight:600">${name}</span>
        <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
      </span>
      <span style="color:${C.faint}">${ic('chevR', 18, 2)}</span>
    </a>`).join('\n')}`, '0 18px 22px')}

${dashedBtn('Add a document', 'plus', '0 18px 26px')}` });

/* ══════════════════ EMPTY & FIRST-RUN ══════════════════ */
const emptyBlock = (icon, tint, tintInk, title, body, action, secondary = '') =>
  `  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:15px;padding:48px 34px;text-align:center">
    <span style="width:76px;height:76px;border-radius:999px;background:${tint};display:flex;align-items:center;justify-content:center;color:${tintInk}">${ic(icon, 36, 1.6)}</span>
    <h2 class="t" style="margin:6px 0 0;font-size:25px;line-height:1.15;letter-spacing:-0.016em;text-wrap:balance">${title}</h2>
    <p style="margin:0;font-size:14.5px;line-height:1.55;color:${C.meta}">${body}</p>
    <button class="el" style="min-height:50px;padding:0 22px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:14px;background:${TEAL_BTN};color:#FFFFFF;font-size:15px;font-weight:600;margin-top:6px">${action}</button>
    ${secondary}
  </div>`;

// First run — Home with nothing in it yet, carrying the setup steps F17 moved out.
more['EmptyHome.dc.html'] = doc({ h: 1160, body: `
${header(G.teal, `    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="display:flex;flex-direction:column;gap:2px">
        ${eyebrow('August 2026')}
        <h1 class="t" style="margin:0;font-size:25px;line-height:1.1;color:#FFFFFF">Mogul Household</h1>
      </div>
      <a href="#" style="width:44px;height:44px;border-radius:999px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.24);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#FFFFFF;flex:none">AM</a>
    </div>
    <div style="display:flex;flex-direction:column;gap:9px">
      ${eyebrow('Left to spend')}
      <span class="n" style="font-size:48px;font-weight:600;line-height:1;letter-spacing:-0.034em;color:rgba(255,255,255,0.72)">₹—</span>
      ${subline('Record your first expense and this starts filling in')}
    </div>`, '26px 20px 26px')}

  <section class="el" style="margin:20px 18px 22px;background:${C.card};border-radius:18px;padding:18px 16px;display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;align-items:baseline;gap:10px">
      <h2 class="sec" style="flex:1">Finish setting up</h2>
      <span class="n" style="font-size:13px;font-weight:600;color:${C.meta}">1 of 6</span>
    </div>
    <div style="height:7px;border-radius:999px;background:${C.track};overflow:hidden"><div style="width:16.6%;height:7px;border-radius:999px;background:${BAR}"></div></div>
    <div style="display:flex;flex-direction:column;gap:2px">
${[
  ['Add your accounts', 'Done', true],
  ['Set a few budgets', 'Two or three to start with', false],
  ['Add what you owe', 'Loans and card limits', false],
  ['Add what you own', 'Flat, gold, deposits', false],
  ['Set up scheduled payments', 'Rent, fees, subscriptions', false],
  ['Invite your household', 'Fatema is not in yet', false],
].map(([t, s, done]) => `      <button style="display:flex;align-items:center;gap:12px;width:100%;min-height:54px">
        <span style="width:24px;height:24px;border-radius:999px;${done ? `background:${C.teal};color:#FFFFFF` : 'border:1.5px solid ${C.hair}'};display:flex;align-items:center;justify-content:center;flex:none">${done ? ic('check', 14, 2.8) : ''}</span>
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px">
          <span style="font-size:14.5px;font-weight:600${done ? `;color:${C.faint};text-decoration:line-through` : ''}">${t}</span>
          ${done ? '' : `<span style="font-size:12.5px;color:${C.meta}">${s}</span>`}
        </span>
        ${done ? '' : `<span style="color:${C.faint}">${ic('chevR', 17, 2)}</span>`}
      </button>`).join('\n')}
    </div>
  </section>

${sectionHead('bank2', C.tealL, C.teal, 'Accounts', link('Manage'))}
  <div style="display:flex;gap:12px;padding:0 18px 12px;${HSCROLL}">
${[['bank', C.tealL, C.teal, 'INR', '₹2,83,530', 'HDFC Savings'], ['briefcase', C.neut, CAT.neutral[1], 'INR', '₹18,450', 'Cash']].map(([i, t, ti, cur, val, sub]) =>
  `    <a href="#" class="el" style="flex:none;width:150px;${SNAP};background:${C.card};border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:13px;color:${C.ink}">
      <span style="display:flex;align-items:center;justify-content:space-between">
        <span style="width:32px;height:32px;border-radius:999px;background:${t};display:flex;align-items:center;justify-content:center;color:${ti}">${ic(i, 17, 1.7)}</span>
        <span style="font-size:10.5px;font-weight:700;letter-spacing:0.06em;color:${C.faint}">${cur}</span>
      </span>
      <span style="display:flex;flex-direction:column;gap:3px">
        <span class="n" style="font-size:19px;font-weight:600;letter-spacing:-0.025em">${val}</span>
        <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
      </span>
    </a>`).join('\n')}
  </div>
${dashedBtn('Add an account', 'plus', '0 18px 26px')}

${sectionHead('swap', C.neut, C.meta, 'Recent')}
  <div style="margin:0 18px 26px;padding:34px 24px;border-radius:18px;border:1.5px dashed ${C.dash};display:flex;flex-direction:column;align-items:center;gap:11px;text-align:center">
    <span style="width:52px;height:52px;border-radius:999px;background:${C.sunk};display:flex;align-items:center;justify-content:center;color:${C.faint}">${ic('receipt', 25, 1.7)}</span>
    <span style="font-size:15px;font-weight:600">Nothing recorded yet</span>
    <span style="font-size:13.5px;line-height:1.5;color:${C.meta}">Tap the + button to add your first expense. It takes about three taps.</span>
  </div>

${nav('home')}` });

more['EmptyActivity.dc.html'] = doc({ h: 844, body: `
${header(G.char, `    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <h1 class="t" style="margin:0;font-size:28px;line-height:1.1;color:#FFFFFF">Activity</h1>
      <button style="min-height:40px;padding:0 13px;display:flex;align-items:center;gap:7px;border-radius:999px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.22);font-size:13.5px;font-weight:600;color:#FFFFFF">August 2026 ${ic('chevD', 15, 2)}</button>
    </div>
    <div style="display:flex;gap:12px">
${[['In', '₹—'], ['Out', '₹—']].map(([l, v]) => `      <div style="flex:1;background:rgba(255,255,255,0.10);border-radius:14px;padding:13px 14px;display:flex;flex-direction:column;gap:5px">
        <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.72)">${l}</span>
        <span class="n" style="font-size:20px;font-weight:600;color:rgba(255,255,255,0.55)">${v}</span>
      </div>`).join('\n')}
    </div>`, '26px 20px 24px')}
${emptyBlock('receipt', C.sunk, C.faint, 'Nothing in August yet', 'Every expense, income and transfer you record shows up here, grouped by day.', `${ic('plus', 18, 2.2)} Add your first entry`,
  `<button style="min-height:44px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:${C.meta}">Look at another month</button>`)}
${nav('tx')}` });

more['EmptyBudget.dc.html'] = doc({ h: 844, body: `
${header(G.indigo, `    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <h1 class="t" style="margin:0;font-size:28px;line-height:1.1;color:#FFFFFF">Budget</h1>
      <button style="min-height:40px;padding:0 13px;display:flex;align-items:center;gap:7px;border-radius:999px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.22);font-size:13.5px;font-weight:600;color:#FFFFFF">August 2026 ${ic('chevD', 15, 2)}</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:9px">
      ${eyebrow('Left this month')}
      <span class="n" style="font-size:48px;font-weight:600;line-height:1;letter-spacing:-0.034em;color:rgba(255,255,255,0.72)">₹—</span>
      ${subline('No budget set — spending is still being tracked')}
    </div>`, '26px 20px 26px')}
${emptyBlock('pie', C.indigoL, C.indigo, 'No budgets yet', 'Pick two or three categories you actually want to watch. September will start as a copy of whatever you set, so a rough first guess is fine.', `${ic('plus', 18, 2.2)} Set your first budget`,
  `<button style="min-height:44px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:${C.meta}">Use last month's spending</button>`)}
${nav('budget')}` });

more['EmptyMoneyBack.dc.html'] = doc({ h: 844, body: `
${header(G.gold, `${backRow('Money to get back')}
    <div style="display:flex;flex-direction:column;gap:7px">
      ${eyebrow('Still owed to you')}
      <span class="n" style="font-size:44px;font-weight:600;line-height:1;letter-spacing:-0.03em;color:rgba(255,255,255,0.72)">₹0</span>
      ${subline('Nobody owes you anything right now')}
    </div>`, '22px 20px 26px')}
${emptyBlock('user', C.goldL, C.gold, 'All square', 'When you pay for someone else, switch on <b>Need this money back?</b> while adding the expense and it will be tracked here until it comes back.', `${ic('plus', 18, 2.2)} Record something owed`)}
${nav('more')}` });

  return more;
}
