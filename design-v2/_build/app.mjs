import {
  C, G, TEAL_BTN, TEAL_SM, ic, doc, nav, header, backRow, eyebrow, subline,
  bigNumber, bar, splitStat, sectionHead, link, card, avatar, row, meta, amount,
  paceChart, barChart, catBars, spark, legend, chartCard, SERIES,
  tag, pillBtn, dashedBtn, stepHead, titleBlock, HSCROLL, SNAP, sharedTag, ledgerBadge,
  CAT,
  BAR, BAR_HOT, BAR_WARN, BAR_GOOD,
  statusChip,
} from './lib.mjs';

export function buildApp() {
  const app = {};

/* ══════════════════ HOME ══════════════════
   F01 scope pill · F04 overdue surfaced · F06 quick-action row dropped
   F07 exclusion note · F13 "Inbox" · F15 150px cards · F19 44px links
   F23 FX footnote                                                       */
app['Main.dc.html'] = doc({ h: 1530, body: `
${header(G.teal, `    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="display:flex;flex-direction:column;gap:2px">
        ${eyebrow('August 2026')}
        <h1 class="t" style="margin:0;font-size:25px;line-height:1.1;color:#FFFFFF">Mogul Household</h1>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex:none">
        <button style="width:44px;height:44px;border-radius:999px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.24);display:flex;align-items:center;justify-content:center;color:#FFFFFF">${ic('search', 19, 1.9)}</button>
        <a href="#" style="width:44px;height:44px;border-radius:999px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.24);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#FFFFFF">AM</a>
      </div>
    </div>
${bigNumber('Left to spend', '₹24,400', `${bar(89.8)}
      ${subline('₹2,15,600 of your ₹2,40,000 budget · month ends today')}`)}
${splitStat('Money in', '₹2,40,000', 'Money out', '₹2,15,600')}
    <span style="font-size:11.5px;line-height:1.4;color:rgba(255,255,255,0.86);margin-top:-8px">Transfers and card payments are not counted as spending.</span>`, '26px 20px 24px')}

  <div style="display:flex;gap:10px;padding:18px 18px 22px;${HSCROLL}">
${[
  ['inbox', C.pollen, 'Inbox', '5 to decide'],
  ['up', C.olive, 'Savings', '₹41,750'],
  ['card2', C.pumpkinT, 'Card', '₹42,850'],
  ['user', C.seagrassT, 'Owed to you', '₹55,000'],
].map(([i, fill, label, val]) => `    <a href="#" class="el" style="flex:none;width:142px;${SNAP};background:${fill};border-radius:16px;padding:13px;display:flex;flex-direction:column;gap:10px;color:${C.onFill}">
      <span style="width:32px;height:32px;border-radius:999px;background:rgba(35,61,77,0.16);display:flex;align-items:center;justify-content:center;color:${C.onFill}">${ic(i, 17, 1.9)}</span>
      <span style="display:flex;flex-direction:column;gap:2px">
        <span style="font-size:12.5px;font-weight:600;opacity:0.82">${label}</span>
        <span class="n" style="font-size:16.5px;font-weight:600;letter-spacing:-0.02em">${val}</span>
      </span>
    </a>`).join('\n')}
  </div>

${sectionHead('bank2', C.tealL, C.teal, 'Accounts', link('Manage'))}
  <div style="display:flex;gap:12px;padding:0 18px 8px;${HSCROLL}">
${[
  ['bank', C.tealL, C.teal, 'INR', '₹2,83,530', 'HDFC Savings'],
  ['bank', C.blueL, C.blue, 'INR', '₹78,200', 'ICICI Savings'],
  ['briefcase', C.neut, C.neutInk, 'INR', '₹18,450', 'Cash'],
  ['briefcase', C.greenL, C.green, 'USD', '$500.00', 'Savings · ₹41,750'],
].map(([i, t, ti, cur, val, sub]) => `    <a href="#" class="el" style="flex:none;width:150px;${SNAP};background:${C.card};border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:13px;color:${C.ink}">
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
  <span class="n" style="padding:0 20px 22px;font-size:11.5px;color:${C.faint}">Spending accounts ₹3,80,180 · USD at ₹83.50 today</span>

${sectionHead('cal', C.blueL, C.blue, 'Your month', link('See all'))}

  <div style="display:flex;align-items:center;gap:10px;padding:0 22px 8px">
    <span style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.red}">Still to pay</span>
    <span style="flex:1;height:1px;background:${C.rule}"></span>
  </div>
${card(`    <div style="display:flex;gap:13px">
      <span style="margin-top:15px;width:38px;height:38px;border-radius:999px;background:${C.dangerTint};display:flex;align-items:center;justify-content:center;color:${C.danger};flex:none">${ic('alert', 19, 2)}</span>
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:15px 0;border-bottom:1px solid ${C.rule}">
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span style="font-size:15px;font-weight:600">Maid salary</span>
          <span style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:${C.danger}">${ic('alert', 13, 2.4)} 3 days late · was due 28 Aug</span>
        </span>
        <button style="min-height:38px;padding:0 14px;display:flex;align-items:center;border-radius:11px;background:${C.okFill};color:${C.onFill};font-size:13px;font-weight:600;flex:none;gap:5px">${ic('check', 14, 2.4)} Paid</button>
        <span class="n" style="font-size:15.5px;font-weight:600">₹9,000</span>
      </div>
    </div>
${row({ icon: 'house2', tint: CAT.green[0], tintInk: CAT.green[1], title: 'Rent', sub: `<span style="font-size:12.5px;font-weight:600;color:${C.blue}">Due tomorrow</span>`, right: amount('₹45,000'), pad: 15, iconTop: '15px' })}
${row({ icon: 'shield', tint: C.blueL, tintInk: C.blue, title: 'Car insurance', sub: meta('In 5 days'), right: amount('₹18,200'), last: true, pad: 15, iconTop: '15px' })}`, '0 18px 20px')}

  <div style="display:flex;align-items:center;gap:10px;padding:0 22px 8px">
    <span style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.meta}">Today, 31 August</span>
    <span style="flex:1;height:1px;background:${C.rule}"></span>
    <span class="n" style="font-size:12px;font-weight:600;color:${C.meta}">−₹5,340</span>
  </div>
${card(`${row({ icon: 'cart', tint: CAT.green[0], tintInk: CAT.green[1], title: 'Big Bazaar', sub: `<span style="display:flex;align-items:center;gap:7px">${meta('Groceries · HDFC Savings')}${sharedTag()}</span>`, right: amount('−₹2,340'), pad: 13 })}
${row({ icon: 'fuel', tint: C.blueL, tintInk: C.blue, title: 'Indian Oil', sub: meta('Transport · Cash (INR)'), right: amount('−₹3,000') })}
${row({ icon: 'card2', tint: C.neut, tintInk: C.neutInk, title: 'HDFC Credit Card', sub: `<span style="display:flex;align-items:center;gap:7px">${meta('Card payment')}${tag('Not an expense', C.meta, C.sunk)}</span>`, right: amount('₹18,400', C.meta), pad: 13 })}
${row({ icon: 'briefcase', tint: C.greenL, tintInk: C.green, title: 'Salary — Zenith Labs', sub: meta('Income · HDFC Savings'), right: amount('+₹1,20,000', C.ok), last: true })}`, '0 18px 26px')}

${nav('home')}` });

/* ══════════════════ ACTIVITY ══════════════════
   F01 scope moved into the header · F14 renamed · F16 filters · F18 search  */
app['Transactions.dc.html'] = doc({ h: 1400, body: `
${header(G.char, `    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <h1 class="t" style="margin:0;font-size:28px;line-height:1.1;color:#FFFFFF">Activity</h1>
      <button style="min-height:44px;padding:0 13px;display:flex;align-items:center;gap:7px;border-radius:999px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.22);font-size:13.5px;font-weight:600;color:#FFFFFF">August 2026 ${ic('chevD', 15, 2)}</button>
    </div>
    <div style="display:flex;gap:12px">
      <div style="flex:1;background:rgba(255,255,255,0.10);border-radius:14px;padding:13px 14px;display:flex;flex-direction:column;gap:5px">
        <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.86)">In</span>
        <span class="n" style="font-size:20px;font-weight:600;letter-spacing:-0.02em;color:${C.tealL}">₹2,40,000</span>
      </div>
      <div style="flex:1;background:rgba(255,255,255,0.10);border-radius:14px;padding:13px 14px;display:flex;flex-direction:column;gap:5px">
        <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.86)">Out</span>
        <span class="n" style="font-size:20px;font-weight:600;letter-spacing:-0.02em">₹2,15,600</span>
      </div>
    </div>
    <span style="font-size:11.5px;line-height:1.4;color:rgba(255,255,255,0.86);margin-top:-8px">Transfers and card payments are not counted in Out.</span>
    <a href="#" style="display:flex;align-items:center;gap:10px;min-height:48px;background:rgba(255,255,255,0.10);border-radius:13px;padding:0 14px;color:rgba(255,255,255,0.66)">
      ${ic('search', 19, 1.9)}
      <span style="font-size:14.5px">Search Amazon, Ahmed, Travel, 5000</span>
    </a>`, '26px 20px 22px')}

  <div style="display:flex;gap:8px;padding:18px 18px 0;${HSCROLL}">
    <button class="el" style="min-height:42px;padding:0 15px;display:flex;align-items:center;border-radius:999px;background:linear-gradient(145deg,#2C5063 0%,#1C3541 100%);color:#FFFFFF;font-size:13.5px;font-weight:600;flex:none">All</button>
${['Expenses', 'Income', 'Shared', 'Transfers', 'Card payments'].map(t =>
  `    <button style="min-height:42px;padding:0 15px;display:flex;align-items:center;border-radius:999px;background:${C.card};border:1px solid ${C.border};color:${C.meta};font-size:13.5px;font-weight:600;flex:none;${SNAP};white-space:nowrap">${t}</button>`).join('\n')}
  </div>

${[
  ['Today, 31 August', '−₹5,340', C.meta, C.sunk, [
    row({ icon: 'cart', tint: CAT.green[0], tintInk: CAT.green[1], title: 'Big Bazaar', sub: `<span style="display:flex;align-items:center;gap:7px">${meta('Groceries · HDFC Savings')}${sharedTag()}</span>`, right: amount('−₹2,340'), pad: 14, iconTop: '15px' }),
    row({ icon: 'fuel', tint: C.blueL, tintInk: CAT.blue[1], title: 'Indian Oil', sub: meta('Transport · Cash (INR)'), right: amount('−₹3,000'), last: true, pad: 15, iconTop: '15px' }),
  ]],
  ['30 August', '+₹8,000', C.green, C.greenL, [
    row({ icon: 'card2', tint: C.neut, tintInk: CAT.neutral[1], title: 'HDFC Credit Card', sub: `<span style="display:flex;align-items:center;gap:7px">${meta('Card payment · from HDFC Savings')}${tag('Not an expense', C.meta, C.sunk)}</span>`, right: amount('₹18,400', C.meta), pad: 14, iconTop: '15px' }),
    row({ icon: 'user', tint: C.goldL, tintInk: C.gold, title: 'Sara Iyer', sub: meta('Loan repayment · HDFC Savings'), right: amount('+₹8,000', C.ok), last: true, pad: 15, iconTop: '15px' }),
  ]],
  ['29 August', '+₹1,07,500', C.green, C.greenL, [
    row({ icon: 'briefcase', tint: C.greenL, tintInk: C.green, title: 'Salary — Zenith Labs', sub: meta('Income · HDFC Savings'), right: amount('+₹1,20,000', C.ok), pad: 15, iconTop: '15px' }),
    row({ icon: 'plane', tint: CAT.cyan[0], tintInk: CAT.cyan[1], title: 'Taj Palace', sub: `<span style="display:flex;align-items:center;gap:7px">${meta('Travel · HDFC Credit Card')}${statusChip('warn', 'To get back')}</span>`, right: amount('−₹12,500'), last: true, pad: 14, iconTop: '15px' }),
  ]],
  ['28 August', '−₹4,500', C.meta, C.sunk, [
    row({ icon: 'bag', tint: CAT.purple[0], tintInk: CAT.purple[1], title: 'Amazon', sub: meta('Shopping · HDFC Credit Card'), right: amount('−₹4,500'), pad: 15, iconTop: '15px' }),
    `    <div style="display:flex;gap:13px">
      ${avatar('swap', C.neut, CAT.neutral[1], 38, '15px')}
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:14px 0">
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
          <span style="font-size:15px;font-weight:600">HDFC Savings → Cash (USD)</span>
          <span style="display:flex;align-items:center;gap:7px">
            ${meta('Transfer')}
            <span class="n" style="font-size:11px;font-weight:600;color:${C.meta};background:${C.neut};border-radius:5px;padding:2px 6px">1 USD = ₹83.50</span>
          </span>
        </span>
        <span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
          ${amount('₹8,350', C.meta)}
          <span class="n" style="font-size:12px;color:${C.faint}">$100.00</span>
        </span>
      </div>
    </div>`,
  ]],
].map(([day, tot, ink, bg, rows], i) => `  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:${i === 0 ? '14' : '6'}px 22px 8px">
    <h2 style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.02em;color:${C.meta}">${day}</h2>
    <span class="n" style="font-size:12px;font-weight:600;color:${ink};background:${bg};border-radius:7px;padding:3px 8px">${tot}</span>
  </div>
${card(rows.join('\n'), i === 3 ? '0 18px 26px' : '0 18px 14px')}`).join('\n')}

${nav('tx')}` });

/* ══════════════════ ADD EXPENSE ══════════════════
   F02 number pad, Save in the pad · type switcher · category chips · recents
   Sized to a real 390×844 device so nothing hides behind a keyboard.        */
app['AddExpense.dc.html'] = doc({ h: 900, body: `
  <div class="el2" style="background:${G.teal};color:#FFFFFF;border-radius:0 0 26px 26px;padding:18px 20px 22px;display:flex;flex-direction:column;gap:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <button style="width:44px;height:44px;margin-left:-10px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.86)">${ic('x', 21, 2)}</button>
      <h1 class="t" style="margin:0;font-size:19px;color:#FFFFFF">New entry</h1>
      <span style="width:44px;height:44px"></span>
    </div>
    <div style="display:flex;gap:3px;padding:3px;background:rgba(0,0,0,0.22);border-radius:999px">
      <button style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:999px;font-size:13.5px;font-weight:600;background:#FFFFFF;color:${C.ink}">Expense</button>
      <button style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:999px;font-size:13.5px;font-weight:600;color:rgba(255,255,255,0.86)">Income</button>
      <button style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:999px;font-size:13.5px;font-weight:600;color:rgba(255,255,255,0.86)">Transfer</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="display:flex;align-items:baseline;gap:6px">
        <span class="n" style="font-size:28px;font-weight:500;color:rgba(255,255,255,0.62)">₹</span>
        <span class="n" style="font-size:46px;font-weight:600;letter-spacing:-0.036em;line-height:1.05">2,340</span>
        <span style="width:2px;height:34px;background:rgba(255,255,255,0.85);margin-left:3px;align-self:center"></span>
      </div>
      <button style="min-height:44px;padding:0 12px;display:flex;align-items:center;gap:6px;border-radius:999px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.22);font-size:13px;font-weight:600;color:#FFFFFF;flex:none">INR ${ic('chevD', 14, 2)}</button>
    </div>
  </div>

  <div class="el" style="margin:-18px 18px 12px;background:${C.card};border-radius:18px;padding:2px 16px">
    <button style="display:flex;align-items:center;gap:12px;width:100%;min-height:56px;border-bottom:1px solid ${C.rule}">
      <span style="width:92px;flex:none;font-size:13.5px;font-weight:600;color:${C.meta}">Paid to</span>
      <span style="flex:1;font-size:15.5px;font-weight:600">Big Bazaar</span>
      <span style="color:${C.faint}">${ic('chevR', 18, 2)}</span>
    </button>
    <button style="display:flex;align-items:center;gap:12px;width:100%;min-height:56px;border-bottom:1px solid ${C.rule}">
      <span style="width:92px;flex:none;font-size:13.5px;font-weight:600;color:${C.meta}">Paid using</span>
      <span style="flex:1;display:flex;align-items:center;gap:8px">
        <span style="width:26px;height:26px;border-radius:999px;background:${C.tealL};display:flex;align-items:center;justify-content:center;color:${C.teal};flex:none">${ic('bank', 14, 1.7)}</span>
        <span style="font-size:15.5px;font-weight:600">HDFC Savings</span>
      </span>
      <span style="color:${C.faint}">${ic('chevR', 18, 2)}</span>
    </button>
    <button style="display:flex;align-items:center;gap:12px;width:100%;min-height:56px">
      <span style="width:92px;flex:none;font-size:13.5px;font-weight:600;color:${C.meta}">Date</span>
      <span style="flex:1;font-size:15.5px;font-weight:600">Today, 31 Aug</span>
      <span style="color:${C.faint}">${ic('chevR', 18, 2)}</span>
    </button>
  </div>

  <div style="display:flex;gap:8px;padding:0 18px 10px;${HSCROLL}">
${[['Groceries', CAT.green[0], CAT.green[1], true], ['Eating Out', CAT.orange[0], CAT.orange[1], false], ['Transport', C.blueL, CAT.blue[1], false], ['Shopping', CAT.purple[0], CAT.purple[1], false], ['Children', CAT.pink[0], CAT.pink[1], false], ['Utilities', CAT.cyan[0], CAT.cyan[1], false]]
  .map(([t, bg, ink, on]) => `    <button style="min-height:44px;padding:0 14px;display:flex;align-items:center;gap:7px;border-radius:999px;flex:none;${SNAP};white-space:nowrap;font-size:13.5px;font-weight:600;${on ? `background:${ink};color:#FFFFFF` : `background:${bg};color:${ink}`}">${t}</button>`).join('\n')}
    <button style="min-height:44px;padding:0 13px;display:flex;align-items:center;gap:6px;border-radius:999px;flex:none;${SNAP};white-space:nowrap;background:${C.card};border:1px solid ${C.border};color:${C.meta};font-size:13.5px;font-weight:600">All categories ${ic('chevR', 15, 2)}</button>
  </div>

  <button onClick="{{ toggleMore }}" style="margin:0 18px 12px;display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;border-radius:14px;border:1.5px dashed ${C.dash};color:${C.teal};font-size:14.5px;font-weight:600">
    <span>{{ moreLabel }}</span>
    <span style="display:flex;transform: {{ chevronRotate }}">${ic('chevD', 17, 2)}</span>
  </button>

  <sc-if value="{{ more }}" hint-placeholder-val="{{ false }}">
    <div class="el" style="margin:0 18px 12px;background:${C.card};border-radius:18px;padding:2px 16px">
      <button onClick="{{ toggleBack }}" style="display:flex;align-items:center;gap:12px;width:100%;min-height:64px">
        ${avatar('user', C.goldL, C.gold, 36)}
        <span style="flex:1;display:flex;flex-direction:column;gap:2px">
          <span style="font-size:15px;font-weight:600">Need this money back?</span>
          <span style="font-size:12.5px;color:${C.meta}">Reimbursement, loan or shared expense</span>
        </span>
        <sc-if value="{{ back }}" hint-placeholder-val="{{ false }}">
          <span style="width:50px;height:30px;border-radius:999px;background:${C.seagrass};display:flex;align-items:center;justify-content:flex-end;padding:3px;flex:none"><span style="width:24px;height:24px;border-radius:999px;background:#FFFFFF"></span></span>
        </sc-if>
        <sc-if value="{{ backOff }}" hint-placeholder-val="{{ true }}">
          <span style="width:50px;height:30px;border-radius:999px;background:${C.off};display:flex;align-items:center;justify-content:flex-start;padding:3px;flex:none"><span style="width:24px;height:24px;border-radius:999px;background:#FFFFFF"></span></span>
        </sc-if>
      </button>
      <button onClick="{{ toggleShared }}" style="border-top:1px solid ${C.rule};display:flex;align-items:center;gap:12px;width:100%;min-height:64px">
        ${avatar('users', C.indigoL, C.indigo, 36)}
        <span style="flex:1;display:flex;flex-direction:column;gap:2px">
          <span style="font-size:15px;font-weight:600">Shared with the household</span>
          <span style="font-size:12.5px;color:${C.meta}">Shows a Shared tag to everyone</span>
        </span>
        <sc-if value="{{ shared }}" hint-placeholder-val="{{ true }}">
          <span style="width:50px;height:30px;border-radius:999px;background:${C.seagrass};display:flex;align-items:center;justify-content:flex-end;padding:3px;flex:none"><span style="width:24px;height:24px;border-radius:999px;background:#FFFFFF"></span></span>
        </sc-if>
        <sc-if value="{{ sharedOff }}" hint-placeholder-val="{{ false }}">
          <span style="width:50px;height:30px;border-radius:999px;background:${C.off};display:flex;align-items:center;justify-content:flex-start;padding:3px;flex:none"><span style="width:24px;height:24px;border-radius:999px;background:#FFFFFF"></span></span>
        </sc-if>
      </button>
      <button style="display:flex;align-items:center;gap:12px;width:100%;min-height:56px;border-top:1px solid ${C.rule};color:${C.teal}">
        <span style="width:92px;flex:none;font-size:13.5px;font-weight:600;color:${C.meta}">Receipt</span>
        <span style="flex:1;font-size:15.5px;font-weight:600">Attach or scan</span>
        <span style="color:${C.faint}">${ic('camera', 19, 1.8)}</span>
      </button>
      <button style="display:flex;align-items:center;gap:12px;width:100%;min-height:56px;border-top:1px solid ${C.rule}">
        <span style="width:92px;flex:none;font-size:13.5px;font-weight:600;color:${C.meta}">Note</span>
        <span style="flex:1;font-size:15.5px;color:${C.ph}">Add a note</span>
      </button>
    </div>
  </sc-if>

  <div style="margin-top:auto;padding:10px 14px 18px;background:${C.card};border-top:1px solid ${C.border};display:flex;gap:9px">
    <div style="flex:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px">
${['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '.'].map(k =>
  `      <button class="n" style="min-height:56px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:${C.sunk2};font-size:23px;font-weight:600;color:${C.ink}">${k}</button>`).join('\n')}
    </div>
    <div style="width:92px;flex:none;display:flex;flex-direction:column;gap:9px">
      <button style="min-height:56px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:${C.sunk};color:${C.meta}">${ic('del', 23, 1.8)}</button>
      <button class="el2" style="flex:1;min-height:169px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border-radius:14px;background:${TEAL_BTN};color:#FFFFFF;font-size:15px;font-weight:600">
        ${ic('check', 24, 2.2)}
        Save
      </button>
    </div>
  </div>`,
  logic: `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { more: false, back: false, shared: true };
  }
  renderVals() {
    var self = this;
    return {
      more: this.state.more,
      back: this.state.back,
      backOff: !this.state.back,
      shared: this.state.shared,
      sharedOff: !this.state.shared,
      toggleShared: function () { self.setState({ shared: !self.state.shared }); },
      moreLabel: this.state.more ? 'Fewer options' : 'More options',
      chevronRotate: this.state.more ? 'rotate(180deg)' : 'rotate(0deg)',
      toggleMore: function () { self.setState({ more: !self.state.more }); },
      toggleBack: function () { self.setState({ back: !self.state.back }); }
    };
  }
}` });

/* ══════════════════ + SHEET ══════════════════
   F06: the one entry point for adding, replacing Home's duplicate row.
   "Receipt" becomes "Scan a receipt" — a capture path, not a fifth type.  */
app['AddSheet.dc.html'] = doc({ h: 560, body: `
  <div style="flex:1;background:rgba(33,30,26,0.42)"></div>
  <div class="el2" style="background:${C.card};border-radius:26px 26px 0 0;padding:10px 18px 26px;display:flex;flex-direction:column;gap:6px">
    <span style="width:38px;height:4px;border-radius:999px;background:${C.off};align-self:center;margin-bottom:10px"></span>
    <h2 class="t" style="margin:0 0 8px;font-size:21px;letter-spacing:-0.015em">What are you adding?</h2>
${[
  ['down', CAT.rust[0], CAT.rust[1], 'Expense', 'Money leaving an account'],
  ['up', C.greenL, C.green, 'Income', 'Salary, rent, a repayment'],
  ['swap', C.blueL, CAT.blue[1], 'Transfer', 'Between your own accounts'],
  ['camera', CAT.purple[0], CAT.purple[1], 'Scan a receipt', 'Fills in an expense for you'],
].map(([i, t, ti, title, sub], n, a) => `    <button style="display:flex;align-items:center;gap:13px;width:100%;min-height:70px;padding:0 2px${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
      ${avatar(i, t, ti, 42)}
      <span style="flex:1;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:15.5px;font-weight:600">${title}</span>
        <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
      </span>
      <span style="color:${C.faint}">${ic('chevR', 18, 2)}</span>
    </button>`).join('\n')}
  </div>` });

/* ══════════════════ BUDGET ══════════════════
   F01 scope · F08 unbudgeted row · F19 Edit target                        */
app['Budget.dc.html'] = doc({ h: 1880, body: `
${header(G.indigo, `    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <h1 class="t" style="margin:0;font-size:28px;line-height:1.1;color:#FFFFFF">Budget</h1>
      <button style="min-height:44px;padding:0 13px;display:flex;align-items:center;gap:7px;border-radius:999px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.22);font-size:13.5px;font-weight:600;color:#FFFFFF">August 2026 ${ic('chevD', 15, 2)}</button>
    </div>
${bigNumber('Left this month', '₹24,400', `${bar(89.8)}
      ${subline('₹2,15,600 of ₹2,40,000 · 90% used, one day left')}`)}
${splitStat('Daily average', '₹6,955', 'Over budget', '1 category', '${C.goldL}')}`)}

${chartCard('Spent against plan', `<a href="#" style="font-size:12.5px;font-weight:600">Trends</a>`,
`${paceChart({
  actual: [4800, 11200, 18400, 25100, 33600, 41200, 49800, 58300, 67100, 74900, 83600, 92400, 101200, 110800, 119300, 128100, 136900, 145200, 154800, 163100, 171900, 179400, 186200, 192800, 198100, 203600, 207900, 210400, 212100, 214000, 215600],
  plan: 240000, days: 31, over: true })}
${legend([['Spent', C.teal], ['Even pace', C.axis, true]])}
    <div style="display:flex;align-items:center;gap:9px;padding-top:12px;border-top:1px solid ${C.rule}">
      <span style="width:8px;height:8px;border-radius:999px;background:${C.red};flex:none"></span>
      <span style="flex:1;font-size:13px;line-height:1.4;color:${C.meta}">You went ahead of an even pace on <b style="color:${C.ink}">9 August</b> and stayed there.</span>
    </div>`, '20px 18px 22px')}

${sectionHead('pie', C.indigoL, C.indigo, 'By category', link('Edit'), '0 20px 12px')}
${card([
  ['house2', CAT.green[0], CAT.green[1], 'Rent', 'All spent', C.meta, 100, 'full', '₹45,000 of ₹45,000', null],
  ['cart', CAT.green[0], CAT.green[1], 'Groceries', '₹6,600 left', C.meta, 74, 'ok', '₹18,400 of ₹25,000', ['On track', 'ok']],
  ['child', CAT.orange[0], CAT.orange[1], 'School fees', 'All spent', C.meta, 100, 'full', '₹22,000 of ₹22,000', null],
  ['cutlery', CAT.orange[0], CAT.orange[1], 'Eating Out', '₹1,900 over', C.danger, 100, 'over', '₹11,900 of ₹10,000', ['Over', 'danger']],
  ['bag', CAT.purple[0], CAT.purple[1], 'Shopping', '₹1,700 left', C.meta, 88, 'near', '₹12,300 of ₹14,000', ['Close', 'warn']],
  ['child', CAT.pink[0], CAT.pink[1], 'Children', '₹6,000 left', C.meta, 60, 'ok', '₹9,000 of ₹15,000', ['On track', 'ok']],
  ['bulb', CAT.cyan[0], CAT.cyan[1], 'Utilities', '₹2,000 left', C.meta, 80, 'near', '₹8,000 of ₹10,000', ['Close', 'warn']],
  ['car', C.blueL, CAT.blue[1], 'Transport', '₹1,400 left', C.meta, 77, 'ok', '₹4,600 of ₹6,000', null],
].map(([i, t, ti, name, rightTxt, rightInk, pct, state, sub, badge]) => `    <div style="display:flex;gap:13px">
      ${avatar(i, t, ti, 38, '17px')}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;padding:16px 0;border-bottom:1px solid ${C.rule}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <span style="display:flex;align-items:center;gap:8px;min-width:0">
            <span style="font-size:15px;font-weight:600">${name}</span>
            ${badge ? statusChip(badge[1], badge[0]) : ''}
          </span>
          <span class="n" style="font-size:14px;font-weight:600;color:${rightInk}">${rightTxt}</span>
        </div>
        <div style="height:7px;border-radius:999px;background:${C.track};overflow:hidden"><div style="width:${pct}%;height:7px;border-radius:999px;background:${state === 'over' ? '${BAR_HOT}' : state === 'near' || state === 'full' ? 'linear-gradient(90deg,${C.gold} 0%,${C.gold} 100%)' : TEAL_SM}"></div></div>
        <span class="n" style="font-size:12.5px;color:${C.faint}">${sub}</span>
      </div>
    </div>`).join('\n') + `
    <a href="#" style="display:flex;gap:13px;color:${C.ink}">
      ${avatar('doc', C.neut, C.meta, 38, '16px')}
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:16px 0">
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span style="font-size:15px;font-weight:600">Not in a category</span>
          <span style="font-size:12.5px;color:${C.meta}">14 entries · give them a budget</span>
        </span>
        <span class="n" style="font-size:14px;font-weight:600;color:${C.meta}">₹84,400</span>
        <span style="color:${C.faint};flex:none">${ic('chevR', 17, 2)}</span>
      </div>
    </a>`, '0 18px 12px')}

  <div class="el" style="margin:0 18px 18px;background:${C.card};border-radius:16px;padding:15px 16px;display:flex;flex-direction:column;gap:11px">
    <div style="display:flex;align-items:center;gap:12px">
      <span style="flex:1;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:14.5px;font-weight:600">Not yet budgeted</span>
        <span style="font-size:12.5px;color:${C.meta}">Of your ₹2,40,000 plan</span>
      </span>
      <span class="n" style="font-size:17px;font-weight:600;color:${C.gold}">₹93,000</span>
    </div>
    <div style="height:9px;border-radius:999px;background:${C.track};overflow:hidden;display:flex">
      <div style="width:61.3%;background:${BAR}"></div>
      <div style="width:38.7%;background:${C.goldL}"></div>
    </div>
    <div style="display:flex;gap:10px">
      <span class="n" style="flex:1;font-size:12px;color:${C.meta}">₹1,47,000 in categories</span>
      <span class="n" style="font-size:12px;font-weight:600;color:${C.gold}">₹93,000 loose</span>
    </div>
  </div>

${dashedBtn('Add a category')}

  <div style="display:flex;align-items:flex-start;gap:10px;margin:0 18px 26px;padding:14px 15px;border-radius:14px;background:${C.indigoL}">
    <span style="color:${C.onFill};flex:none;margin-top:1px">${ic('refresh', 17, 1.9)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.indigo}">September starts as a copy of these amounts. Change it then and August stays as it was.</span>
  </div>

${nav('budget')}` });

/* ══════════════════ MONEY TO GET BACK ══════════════════
   F01 scope · F10 same actions on every card · F11 back · F20 real link   */
const backPerson = (initials, grad, ink, name, sub, amt, badge, extra) => `  <section class="el" style="margin:0 18px 12px;background:${C.card};border-radius:18px;padding:15px 16px;display:flex;flex-direction:column;gap:13px">
    <div style="display:flex;align-items:center;gap:12px">
      <span style="width:44px;height:44px;border-radius:999px;background:${grad};display:flex;align-items:center;justify-content:center;font-size:14.5px;font-weight:700;color:${ink};flex:none">${initials}</span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <span style="display:flex;align-items:center;gap:8px">
          <span style="font-size:16.5px;font-weight:600">${name}</span>
          ${badge || ''}
        </span>
        <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
      </span>
      <span class="n" style="font-size:20px;font-weight:600;letter-spacing:-0.025em">${amt}</span>
    </div>
${extra}
    <div style="display:flex;gap:8px">
      <button style="flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:13px;background:${C.sunk2};color:${C.ink};font-size:14px;font-weight:600">${ic('share', 17, 1.8)} Remind</button>
      <button style="flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:linear-gradient(145deg,#C2551A 0%,#9C3F0D 100%);color:#FFFFFF;font-size:14px;font-weight:600">Mark received</button>
    </div>
  </section>`;

app['MoneyToGetBack.dc.html'] = doc({ h: 1240, body: `
${header(G.gold, `${backRow('Money to get back')}
${bigNumber('Still owed to you', '₹55,000', `      ${subline('From 3 people · ₹8,000 received so far')}`)}
    <button class="el" style="min-height:52px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:15px;background:#FFFFFF;color:${C.goldInk};font-size:15.5px;font-weight:600">${ic('plus', 18, 2)} Record a payment received</button>`, '22px 20px 24px')}

  <div style="display:flex;gap:8px;padding:18px 18px 16px;${HSCROLL}">
    <button class="el" style="min-height:42px;padding:0 15px;display:flex;align-items:center;border-radius:999px;background:linear-gradient(145deg,#C2551A 0%,#9C3F0D 100%);color:#FFFFFF;font-size:13.5px;font-weight:600;flex:none">All</button>
${['Reimbursements', 'Loans', 'Shared'].map(t => `    <button style="min-height:42px;padding:0 15px;display:flex;align-items:center;border-radius:999px;background:${C.card};border:1px solid ${C.border};color:${C.meta};font-size:13.5px;font-weight:600;flex:none;${SNAP};white-space:nowrap">${t}</button>`).join('\n')}
  </div>

${backPerson('AR', 'linear-gradient(140deg,${CAT.orange[0]} 0%,#FBA766 100%)', '${C.goldInk}', 'Ahmed Raza', 'Dubai trip · shared 26 Aug', '₹35,900', '',
`    <div style="display:flex;flex-direction:column;gap:9px;padding:12px 0;border-top:1px solid ${C.rule};border-bottom:1px solid ${C.rule}">
      <div style="display:flex;align-items:center;gap:9px">
        <span style="width:8px;height:8px;border-radius:999px;background:${C.blue};flex:none"></span>
        <span style="flex:1;font-size:14px;color:${C.meta}">Flight — Emirates</span>
        <span class="n" style="font-size:14px;font-weight:600;color:${C.meta}">₹18,400</span>
      </div>
      <div style="display:flex;align-items:center;gap:9px">
        <span style="width:8px;height:8px;border-radius:999px;background:${C.plum};flex:none"></span>
        <span style="flex:1;font-size:14px;color:${C.meta}">Hotel — Taj Palace</span>
        <span class="n" style="font-size:14px;font-weight:600;color:${C.meta}">₹12,500</span>
      </div>
      <a href="#" style="min-height:44px;display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:600">See all 4 items ${ic('chevR', 15, 2.1)}</a>
    </div>`)}

${backPerson('SI', 'linear-gradient(140deg,${CAT.blue[0]} 0%,#7FBCE4 100%)', '${C.blue}', 'Sara Iyer', 'Loan given · due by 15 Sep', '₹12,000', statusChip('warn', 'Part paid'),
`    <div style="display:flex;flex-direction:column;gap:7px;padding:12px 0;border-top:1px solid ${C.rule};border-bottom:1px solid ${C.rule}">
      <div style="height:7px;border-radius:999px;background:${C.track};overflow:hidden"><div style="width:40%;height:7px;border-radius:999px;background:${BAR}"></div></div>
      <span class="n" style="font-size:12.5px;color:${C.faint}">₹8,000 of ₹20,000 back</span>
    </div>`)}

${backPerson('ZL', 'linear-gradient(140deg,${CAT.purple[0]} 0%,#DE93CC 100%)', '${C.plum}', 'Zenith Labs', 'Work reimbursement · shared 24 Aug', '₹7,100', '', '')}

${nav('more')}` });

/* ══════════════════ SCHEDULED ══════════════════
   F01 scope · F09 the number you actually need to cover · F11 back        */
app['ScheduledPayments.dc.html'] = doc({ h: 1480, body: `
${header(G.blue, `${backRow('Scheduled Payments')}
${bigNumber('To cover in September', '₹99,849', `      ${subline('Includes ₹9,000 overdue · excludes the card bill until it is final')}`)}
${splitStat('Overdue', '₹9,000', 'Next up', 'Rent, tomorrow', '${C.goldL}')}`, '22px 20px 24px')}

${sectionHead('alert', C.redL, C.red, '<span style="color:' + C.red + '">Overdue</span>', '', '20px 20px 12px')}
  <section class="el" style="margin:0 18px 22px;background:${C.dangerTint};border-radius:18px;padding:15px 16px 14px;display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;align-items:center;gap:13px">
      <span style="width:40px;height:40px;border-radius:999px;background:${C.redL};display:flex;align-items:center;justify-content:center;color:${C.redDeep};flex:none">${ic('user', 21, 1.8)}</span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:16px;font-weight:600;color:${C.ink}">Maid salary</span>
        <span style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:${C.danger}">${ic('alert', 13, 2.4)} 3 days late · was due 28 Aug</span>
      </span>
      <span class="n" style="font-size:18px;font-weight:600;color:${C.ink}">₹9,000</span>
    </div>
    <div style="display:flex;gap:8px">
      <button style="flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:${C.okFill};color:${C.onFill};font-size:14px;font-weight:600;gap:6px">${ic('check', 16, 2.4)} Paid</button>
      <button style="flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:rgba(255,255,255,0.78);color:${C.meta};font-size:14px;font-weight:600">Not yet</button>
      <button style="flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:rgba(255,255,255,0.78);color:${C.meta};font-size:14px;font-weight:600">Skip</button>
    </div>
  </section>

${sectionHead('cal', C.blueL, C.blue, 'Tomorrow, 1 September', '', '0 20px 12px')}
  <section class="el" style="margin:0 18px 22px;background:${C.card};border-radius:18px;padding:15px 16px 14px;display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;align-items:center;gap:13px">
      ${avatar('house2', CAT.green[0], CAT.green[1], 40)}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:16px;font-weight:600">Rent</span>
        <span style="font-size:12.5px;color:${C.meta}">Every 1st · from HDFC Savings</span>
      </span>
      <span class="n" style="font-size:18px;font-weight:600">₹45,000</span>
    </div>
    <div style="display:flex;gap:8px">
      <button style="flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:${C.okFill};color:${C.onFill};font-size:14px;font-weight:600;gap:6px">${ic('check', 16, 2.4)} Paid</button>
      <button style="flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:${C.sunk2};color:${C.meta};font-size:14px;font-weight:600">Not yet</button>
      <button style="flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:${C.sunk2};color:${C.meta};font-size:14px;font-weight:600">Skip</button>
    </div>
  </section>

${sectionHead('clock', C.neut, C.meta, 'Later in September', '', '0 20px 12px')}
${card(`${row({ icon: 'shield', tint: CAT.indigo[0], tintInk: CAT.indigo[1], title: 'Car insurance', sub: meta('5 Sep · yearly'), right: amount('₹18,200'), pad: 15, iconTop: '15px' })}
${row({ icon: 'card2', tint: CAT.rust[0], tintInk: CAT.rust[1], title: 'HDFC Regalia bill', sub: meta('12 Sep · monthly'), right: `<span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:none">${amount('₹42,850', C.meta)}<span style="font-size:11.5px;font-weight:600;color:${C.gold}">so far · final 5 Sep</span></span>`, pad: 15, iconTop: '15px' })}
${row({ icon: 'receipt', tint: CAT.purple[0], tintInk: CAT.purple[1], title: 'Netflix', sub: meta('12 Sep · monthly'), right: amount('₹649'), pad: 15, iconTop: '15px' })}
${row({ icon: 'child', tint: CAT.orange[0], tintInk: CAT.orange[1], title: 'School fees', sub: meta('15 Sep · quarterly'), right: amount('₹22,000'), pad: 15, iconTop: '15px' })}
${row({ icon: 'bulb', tint: CAT.cyan[0], tintInk: CAT.cyan[1], title: 'Sabeel contribution', sub: `<span style="display:flex;align-items:center;gap:7px">${meta('18 Sep · 1 Rabi al-Awwal')}${tag('Hijri', C.onFill, C.seagrassT)}</span>`, right: amount('₹5,000'), last: true, pad: 14, iconTop: '15px' })}`)}

${nav('more')}` });

/* ══════════════════ NET WORTH ══════════════════
   Drop #3: scope is read-only here — net worth is household-wide by nature.
   F11 back                                                                 */
app['NetWorth.dc.html'] = doc({ h: 1430, body: `
${header(G.plum, `${backRow('Net Worth')}
${ledgerBadge()}
${bigNumber('Net worth today', '₹68,42,930', '')}
${splitStat('What you own', '₹73,10,780', 'What you owe', '₹4,67,850', '${C.goldL}')}`, '22px 20px 24px')}

${chartCard('Six months', `<span class="n" style="font-size:12.5px;font-weight:600;color:${C.green}">▲ ₹4,32,730</span>`,
`${barChart({ data: [6410200, 6502800, 6588400, 6641900, 6755300, 6842930], labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'], colour: C.plum, h: 108 })}`, '20px 18px 22px')}

${sectionHead('up', C.greenL, C.green, 'What you own', `<span class="n" style="font-size:14px;font-weight:600;color:${C.meta}">₹73,10,780</span>`, '0 20px 12px')}
  <div style="display:flex;gap:3px;height:9px;padding:0 18px 12px">
    <div style="width:93.5%;border-radius:999px;background:${BAR_GOOD}"></div>
    <div style="width:5.8%;border-radius:999px;background:#9CB06E"></div>
    <div style="width:0.7%;border-radius:999px;background:${C.gold}"></div>
  </div>
${card(`${row({ icon: 'house', tint: C.greenL, tintInk: C.green, title: 'Assets', sub: meta('Flat, gold, deposits · 5 items'), right: `<span style="display:flex;align-items:center;gap:8px">${amount('₹68,33,850')}<span style="color:${C.faint}">${ic('chevR', 17, 2)}</span></span>`, pad: 15, iconTop: '15px' })}
${row({ icon: 'bank2', tint: C.tealL, tintInk: C.teal, title: 'Cash & bank', sub: meta('4 accounts · INR and USD'), right: `<span style="display:flex;align-items:center;gap:8px">${amount('₹4,21,930')}<span style="color:${C.faint}">${ic('chevR', 17, 2)}</span></span>`, pad: 15, iconTop: '15px' })}
${row({ icon: 'user', tint: C.goldL, tintInk: C.gold, title: 'Money to get back', sub: meta('From 3 people'), right: `<span style="display:flex;align-items:center;gap:8px">${amount('₹55,000')}<span style="color:${C.faint}">${ic('chevR', 17, 2)}</span></span>`, last: true, pad: 15, iconTop: '15px' })}`)}

${sectionHead('down', C.redL, C.red, 'What you owe', `<span class="n" style="font-size:14px;font-weight:600;color:${C.meta}">₹4,67,850</span>`, '0 20px 12px')}
${card(`${row({ icon: 'car', tint: CAT.rust[0], tintInk: CAT.rust[1], title: 'Loans taken', sub: meta('Car loan · 22 payments left'), right: `<span style="display:flex;align-items:center;gap:8px">${amount('₹4,25,000')}<span style="color:${C.faint}">${ic('chevR', 17, 2)}</span></span>`, pad: 15, iconTop: '15px' })}
${row({ icon: 'card2', tint: CAT.rust[0], tintInk: CAT.rust[1], title: 'Credit cards', sub: meta('HDFC Regalia · ₹42,850 so far · due 12 Sep'), right: `<span style="display:flex;align-items:center;gap:8px">${amount('₹42,850')}<span style="color:${C.faint}">${ic('chevR', 17, 2)}</span></span>`, last: true, pad: 15, iconTop: '15px' })}`)}

${nav('more')}` });

/* ══════════════════ MORE ══════════════════
   F13 Inbox · F21 account count reconciled · F22 Vault explained          */
app['MoreMenu.dc.html'] = doc({ h: 1180, body: `
${header(G.teal, `    <h1 class="t" style="margin:0;font-size:28px;line-height:1.1;color:#FFFFFF">More</h1>
    <a href="#" style="display:flex;align-items:center;gap:13px;color:#FFFFFF">
      <span style="width:52px;height:52px;border-radius:999px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;flex:none">AM</span>
      <span style="flex:1;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:17px;font-weight:600">Abdeali M</span>
        <span style="font-size:12.5px;color:rgba(255,255,255,0.88)">Mogul Household · Owner</span>
      </span>
      <span style="color:rgba(255,255,255,0.86)">${ic('chevR', 19, 2)}</span>
    </a>`, '26px 20px 26px')}

  <a href="#" class="el" style="margin:20px 18px 22px;display:flex;align-items:center;gap:13px;min-height:70px;background:${C.pollen};border-radius:16px;padding:13px 16px;color:${C.onFill}">
    <span style="width:38px;height:38px;border-radius:999px;background:rgba(35,61,77,0.16);display:flex;align-items:center;justify-content:center;color:${C.onFill};flex:none">${ic('inbox', 20, 1.9)}</span>
    <span style="flex:1;display:flex;flex-direction:column;gap:2px">
      <span style="font-size:15.5px;font-weight:600">Inbox</span>
      <span style="font-size:13px;opacity:0.82">5 things need a decision</span>
    </span>
    <span class="n" style="min-width:26px;height:26px;padding:0 8px;border-radius:999px;background:${C.onFill};color:${C.pollen};font-size:12.5px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none">5</span>
  </a>

${card([
  ['bank2', C.tealL, C.teal, 'Accounts', '4 accounts · set what each one is for'],
  ['card2', CAT.rust[0], CAT.rust[1], 'Cards', 'HDFC Regalia · ₹42,850 this cycle · 2 to check'],
  ['up', C.greenL, C.green, 'Savings', '₹41,750 · kept out of the budget'],
  ['car', CAT.rust[0], CAT.rust[1], 'Loans', '₹4,25,000 owed'],
  ['user', C.goldL, C.gold, 'Money to get back', '₹55,000 from 3 people'],
  ['cal', C.blueL, C.blue, 'Scheduled Payments', '₹99,849 to cover in September'],
  ['up', C.greenL, C.green, 'Expected Income', 'Salary, rent'],
  ['house', C.plumL, C.plum, 'Assets & Net Worth', '₹68,42,930'],
  ['vault', '${CAT.neutral[0]}', '${CAT.neutral[1]}', 'Vault', 'Policies, deeds and account papers · 7 items'],
  ['users', C.indigoL, C.indigo, 'Household', '2 members · you are Owner'],
  ['gear', C.neut, C.meta, 'Settings', 'Currency, lock, notifications'],
].map(([i, t, ti, title, sub], n, a) => `    <a href="#" style="display:flex;align-items:center;gap:13px;min-height:68px;color:${C.ink}${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
      ${avatar(i, t, ti, 38)}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:15.5px;font-weight:600">${title}</span>
        <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
      </span>
      <span style="color:${C.faint}">${ic('chevR', 18, 2)}</span>
    </a>`).join('\n'))}

${nav('more')}` });

/* ══════════════════ SETUP — F17: twelve steps cut to three ══════════════ */
app['SetupHousehold.dc.html'] = doc({ h: 900, body: `
${stepHead(1, 3, 33)}
${titleBlock('Just you, or a household?', 'A household keeps one set of books that everyone in it can see. If you would rather your spending stayed to yourself, choose Just me — you can still create a household later.')}
  <div style="display:flex;flex-direction:column;gap:12px;padding:0 18px">
    <button class="el" style="display:flex;align-items:center;gap:14px;padding:17px 16px;border-radius:18px;background:linear-gradient(135deg,${C.tealL} 0%,#DCEFF5 100%);border:1.5px solid ${C.teal}">
      <span style="width:44px;height:44px;border-radius:999px;background:${TEAL_SM};display:flex;align-items:center;justify-content:center;color:#FFFFFF;flex:none">${ic('user', 22, 1.8)}</span>
      <span style="flex:1;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:17px;font-weight:600">Just me</span>
        <span style="font-size:13.5px;line-height:1.45;color:${C.tealD}">One set of books, visible only to you.</span>
      </span>
      <span style="width:26px;height:26px;border-radius:999px;background:${C.teal};display:flex;align-items:center;justify-content:center;color:#FFFFFF;flex:none">${ic('check', 15, 2.6)}</span>
    </button>
    <button class="el" style="display:flex;align-items:center;gap:14px;padding:17px 16px;border-radius:18px;background:${C.card};border:1.5px solid transparent">
      ${avatar('users', C.indigoL, C.indigo, 44)}
      <span style="flex:1;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:17px;font-weight:600">Create a household</span>
        <span style="font-size:13.5px;line-height:1.45;color:${C.meta}">One shared set of books. Everyone you invite sees every entry, and every budget.</span>
      </span>
      <span style="width:26px;height:26px;border-radius:999px;border:1.5px solid ${C.hair};flex:none"></span>
    </button>
  </div>
  <div style="margin-top:auto;display:flex;flex-direction:column;gap:6px;padding:24px 18px 26px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center">Continue</button>
    <button style="width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;color:${C.meta};font-size:15px;font-weight:600">Skip for now</button>
  </div>` });

app['SetupAccounts.dc.html'] = doc({ h: 1000, body: `
${stepHead(2, 3, 66)}
${titleBlock('Where does your money sit?', 'Add the accounts, cash and cards you actually use, with what is in them today. You can change any of this later.')}
${card([
  ['bank', C.tealL, C.teal, 'HDFC Savings', 'Bank · INR · ends 4471', '₹2,83,530'],
  ['briefcase', C.neut, CAT.neutral[1], 'Cash', 'Cash · INR', '₹18,450'],
  ['card2', CAT.rust[0], CAT.rust[1], 'HDFC Regalia', 'Credit card · INR · ends 8802', '−₹42,850'],
].map(([i, t, ti, name, sub, bal], n, a) => `    <div style="display:flex;gap:13px">
      ${avatar(i, t, ti, 40, '15px')}
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:15px 0${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span style="font-size:15.5px;font-weight:600">${name}</span>
          <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
        </span>
        <span style="display:flex;flex-direction:column;align-items:flex-end;gap:1px">
          <span class="n" style="font-size:15px;font-weight:600">${bal}</span>
          <button style="min-height:44px;display:flex;align-items:center;justify-content:flex-end;font-size:13px;font-weight:600;color:${C.teal}">Edit</button>
        </span>
      </div>
    </div>`).join('\n'), '0 18px 16px')}
${dashedBtn('Add an account', 'plus', '0 18px 0')}
  <div style="margin-top:auto;display:flex;flex-direction:column;gap:6px;padding:24px 18px 26px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center">Continue</button>
    <button style="width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;color:${C.meta};font-size:15px;font-weight:600">Skip for now</button>
  </div>` });

app['SetupBudget.dc.html'] = doc({ h: 1000, body: `
${stepHead(3, 3, 100)}
${titleBlock('What do you want to keep an eye on?', 'Set this month. September will start as a copy of whatever you put here, so a rough first guess is fine — you will have a real month to correct it against.')}
  <div style="display:flex;flex-wrap:wrap;gap:8px;padding:0 18px 18px">
${[['Groceries', CAT.green[0], CAT.green[1], true], ['Eating Out', CAT.orange[0], CAT.orange[1], true], ['Transport', C.blueL, CAT.blue[1], true], ['Shopping', CAT.purple[0], CAT.purple[1], false], ['Children', CAT.pink[0], CAT.pink[1], true], ['Utilities', CAT.cyan[0], CAT.cyan[1], false], ['Health', CAT.rust[0], CAT.rust[1], false], ['Travel', CAT.cyan[0], CAT.cyan[1], false]]
  .map(([t, bg, ink, on]) => `    <button style="min-height:44px;padding:0 14px;display:flex;align-items:center;gap:7px;border-radius:999px;font-size:13.5px;font-weight:600;${on ? `background:${ink};color:#FFFFFF` : `background:${bg};color:${ink}`}">${on ? ic('check', 15, 2.6) : ic('plus', 15, 2.2)} ${t}</button>`).join('\n')}
  </div>
${card([
  ['cart', CAT.green[0], CAT.green[1], 'Groceries', '₹25,000'],
  ['cutlery', CAT.orange[0], CAT.orange[1], 'Eating Out', '₹10,000'],
  ['car', C.blueL, CAT.blue[1], 'Transport', '₹6,000'],
  ['child', CAT.pink[0], CAT.pink[1], 'Children', '₹15,000'],
].map(([i, t, ti, name, amt], n, a) => `    <div style="display:flex;gap:13px">
      ${avatar(i, t, ti, 38, '14px')}
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:14px 0${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
        <span style="flex:1;font-size:15px;font-weight:600">${name}</span>
        <span class="n" style="min-height:40px;display:flex;align-items:center;padding:0 12px;border-radius:11px;background:${C.sunk2};font-size:15px;font-weight:600">${amt}</span>
      </div>
    </div>`).join('\n'), '0 18px 16px')}
  <div style="display:flex;align-items:center;gap:10px;margin:0 18px;padding:13px 15px;border-radius:14px;background:${C.seagrassT}">
    <span style="color:${C.onFill};flex:none">${ic('check', 18, 2.2)}</span>
    <span style="flex:1;font-size:13.5px;line-height:1.45;color:${C.tealD}">That is everything we need. The rest — loans, assets, scheduled payments — you can add from Home whenever you like.</span>
  </div>
  <div style="margin-top:auto;display:flex;flex-direction:column;gap:6px;padding:24px 18px 26px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center">Finish setup</button>
    <button style="width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;color:${C.meta};font-size:15px;font-weight:600">Skip for now</button>
  </div>` });

  return app;
}
