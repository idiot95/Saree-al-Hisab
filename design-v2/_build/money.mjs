import {
  C, G, TEAL_BTN, TEAL_SM, ic, doc, nav, header, backRow, eyebrow, subline,
  bigNumber, splitStat, sectionHead, link, card, avatar, row, meta, amount, tag,
  dashedBtn, titleBlock, HSCROLL, SNAP, typeChip, ring, ACCT,
  paceChart, barChart, catBars, spark, legend, chartCard, donut, SERIES,
  CAT,
  BAR, BAR_HOT, BAR_WARN, BAR_GOOD,
} from './lib.mjs';

export function buildMoney() {
  const money = {};

const plainHead = (title, right = '') => `  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 20px 0">
    <button style="width:44px;height:44px;margin-left:-10px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:${C.meta}">${ic('back', 21, 2)}</button>
    <h1 class="t" style="margin:0;font-size:19px">${title}</h1>
    ${right || '<span style="width:44px;height:44px"></span>'}
  </div>`;

/* ══════════════════ ACCOUNTS ══════════════════
   "I should be able to choose what account is what."
   The type is set once here, and everything downstream keys off it:
   Spending and Cash feed the budget, Savings is held out of it, Credit is
   a balance you owe rather than money you have.                          */
const acctRow = (icon, tint, ink, name, sub, bal, type, last) =>
`    <a href="#" style="display:flex;gap:13px;color:${C.ink}">
      ${avatar(icon, tint, ink, 40, '15px')}
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:15px 0${last ? '' : `;border-bottom:1px solid ${C.rule}`}">
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
          <span style="font-size:15.5px;font-weight:600">${name}</span>
          <span style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
            ${typeChip(type)}
            <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
          </span>
        </span>
        <span class="n" style="font-size:16px;font-weight:600">${bal}</span>
        <span style="color:${C.faint};flex:none">${ic('chevR', 17, 2)}</span>
      </div>
    </a>`;

money['Accounts.dc.html'] = doc({ h: 1240, body: `
${header(G.teal, `${backRow('Accounts', `<button style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.92)">${ic('plus', 21, 2.1)}</button>`)}
${bigNumber('Across every account', '₹4,21,930', `      ${subline('4 accounts · 1 credit card · INR and USD')}`)}
${splitStat('Feeds the budget', '₹3,80,180', 'Held as savings', '₹41,750', '${C.tealL}')}`, '22px 20px 24px')}

  <div style="display:flex;align-items:flex-start;gap:10px;margin:20px 18px 22px;padding:14px 15px;border-radius:14px;background:${C.seagrassT}">
    <span style="color:${C.onFill};flex:none;margin-top:1px">${ic('alert', 17, 1.9)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.tealD}">What an account is <b>for</b> decides how it is counted. Spending and Cash feed your budget. Savings is held out of it, so moving money there never looks like an expense.</span>
  </div>

${sectionHead('bank2', C.tealL, C.teal, 'Feeds the budget', `<span class="n" style="font-size:14px;font-weight:600;color:${C.meta}">₹3,80,180</span>`, '0 20px 12px')}
${card(`${acctRow('bank', C.tealL, C.teal, 'HDFC Savings', 'INR · ends 4471', '₹2,83,530', 'spending', false)}
${acctRow('bank', C.blueL, CAT.blue[1], 'ICICI Savings', 'INR · ends 9930', '₹78,200', 'spending', false)}
${acctRow('briefcase', C.neut, CAT.neutral[1], 'Cash', 'INR · in hand', '₹18,450', 'cash', true)}`, '0 18px 22px')}

${sectionHead('up', C.greenL, C.green, 'Held as savings', `<span class="n" style="font-size:14px;font-weight:600;color:${C.meta}">₹41,750</span>`, '0 20px 12px')}
${card(`${acctRow('briefcase', C.greenL, C.green, 'Cash (USD)', '$500.00 at ₹83.50', '₹41,750', 'savings', true)}`, '0 18px 22px')}

${sectionHead('card2', CAT.rust[0], CAT.rust[1], 'Cards', `<span class="n" style="font-size:14px;font-weight:600;color:${C.red}">−₹42,850</span>`, '0 20px 12px')}
${card(`${acctRow('card2', CAT.rust[0], CAT.rust[1], 'HDFC Regalia', 'INR · ends 8802 · due 12 Sep', '−₹42,850', 'credit', true)}`, '0 18px 22px')}

${dashedBtn('Add an account')}` });

money['AccountEdit.dc.html'] = doc({ h: 1000, body: `
${plainHead('Edit account', `<button style="min-height:44px;padding:0 6px;display:flex;align-items:center;font-size:14px;font-weight:600;color:${C.teal}">Save</button>`)}
  <div style="display:flex;flex-direction:column;gap:18px;padding:22px 20px 0">
    <div style="display:flex;flex-direction:column;gap:7px">
      <span class="eyebrow" style="color:${C.meta}">Name</span>
      <div style="min-height:56px;display:flex;align-items:center;padding:0 16px;border-radius:15px;background:${C.card};border:1.5px solid ${C.teal};font-size:16px;font-weight:600">ICICI Savings</div>
    </div>

    <div style="display:flex;flex-direction:column;gap:9px">
      <span class="eyebrow" style="color:${C.meta}">What is it for</span>
${[
  ['spending', 'Every expense from here counts against your budget.', false],
  ['savings', 'Held out of the budget. Moving money in is never an expense.', true],
  ['cash', 'Same as Spending, for notes in your pocket.', false],
  ['credit', 'A balance you owe. Paying the bill never counts twice.', false],
].map(([k, d, on]) => `      <button class="el" style="display:flex;align-items:flex-start;gap:12px;padding:15px 16px;border-radius:16px;background:${C.card};border:1.5px solid ${on ? C.teal : 'transparent'};text-align:left">
        <span style="width:24px;height:24px;border-radius:999px;${on ? `background:${C.teal};color:#FFFFFF` : 'border:1.5px solid ${C.hair}'};display:flex;align-items:center;justify-content:center;flex:none;margin-top:1px">${on ? ic('check', 14, 2.8) : ''}</span>
        <span style="flex:1;display:flex;flex-direction:column;gap:4px">
          <span style="display:flex;align-items:center;gap:8px">
            <span style="width:26px;height:26px;border-radius:999px;background:${ACCT[k].tint};display:flex;align-items:center;justify-content:center;color:${ACCT[k].ink};flex:none">${ic(ACCT[k].icon, 14, 1.8)}</span>
            <span style="font-size:15.5px;font-weight:600">${ACCT[k].label}</span>
          </span>
          <span style="font-size:13px;line-height:1.45;color:${C.meta}">${d}</span>
        </span>
      </button>`).join('\n')}
    </div>

${card(`    <div style="display:flex;align-items:center;gap:12px;min-height:62px;border-bottom:1px solid ${C.rule}">
      <span style="flex:1;font-size:15px;font-weight:600">Currency</span>
      <span style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:${C.meta}">₹ INR ${ic('chevR', 17, 2)}</span>
    </div>
    <div style="display:flex;align-items:center;gap:12px;min-height:62px;border-bottom:1px solid ${C.rule}">
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:15px;font-weight:600">Read payment messages</span>
        <span style="font-size:12.5px;color:${C.meta}">Suggests entries in your Inbox</span>
      </span>
      <span style="width:50px;height:30px;border-radius:999px;background:${C.seagrass};display:flex;align-items:center;justify-content:flex-end;padding:3px;flex:none"><span style="width:24px;height:24px;border-radius:999px;background:#FFFFFF"></span></span>
    </div>
    <button style="display:flex;align-items:center;gap:12px;width:100%;min-height:62px">
      <span style="flex:1;font-size:15px;font-weight:600;color:${C.red}">Remove this account</span>
    </button>`, '0 0 8px', '0 16px')}
  </div>` });

/* ══════════════════ SAVINGS ══════════════════ */
money['Savings.dc.html'] = doc({ h: 1140, body: `
  <div class="el2" style="background:radial-gradient(130% 85% at 84% -12%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 62%),linear-gradient(150deg,${C.green} 0%,#1F5C3B 58%,#17462D 100%);color:#FFFFFF;border-radius:0 0 28px 28px;padding:22px 20px 24px;display:flex;flex-direction:column;gap:18px">
${backRow('Savings')}
${bigNumber('Set aside', '₹41,750', `      ${subline('Never counted as spending · 1 account')}`)}
${splitStat('Added in August', '+₹8,350', 'Of what came in', '3.5%')}
  </div>

${chartCard('Put aside each month', `<span class="n" style="font-size:12.5px;font-weight:600;color:${C.meta}">₹26,250 over six</span>`,
`${barChart({ data: [4200, 2200, 6400, 0, 5100, 8350], labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'], colour: C.green })}
    <div style="display:flex;align-items:center;gap:9px;padding-top:12px;border-top:1px solid ${C.rule}">
      <span style="width:8px;height:8px;border-radius:999px;background:${C.axis};flex:none"></span>
      <span style="flex:1;font-size:13px;line-height:1.4;color:${C.meta}">Nothing went aside in June. August is your best month so far.</span>
    </div>`, '20px 18px 24px')}

${sectionHead('bank2', C.tealL, C.teal, 'Where it sits', link('Manage'), '0 20px 12px')}
${card(`    <a href="#" style="display:flex;gap:13px;color:${C.ink}">
      ${avatar('briefcase', C.greenL, C.green, 40, '15px')}
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:15px 0">
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
          <span style="font-size:15.5px;font-weight:600">Cash (USD)</span>
          <span style="display:flex;align-items:center;gap:7px">
            ${typeChip('savings')}
            <span style="font-size:12.5px;color:${C.meta}">$500.00 at ₹83.50</span>
          </span>
        </span>
        <span class="n" style="font-size:16px;font-weight:600">₹41,750</span>
        <span style="color:${C.faint};flex:none">${ic('chevR', 17, 2)}</span>
      </div>
    </a>`, '0 18px 20px')}

  <div style="display:flex;align-items:flex-start;gap:10px;margin:0 18px 20px;padding:14px 15px;border-radius:14px;background:${C.olive}">
    <span style="color:${C.onFill};flex:none;margin-top:1px">${ic('alert', 17, 1.9)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.green}">Mark any account as Savings and it stops feeding the budget. Money moved into it shows as a transfer, never as an expense.</span>
  </div>

${dashedBtn('Move money to savings', 'swap')}` });

/* ══════════════════ CARD CONTROL ══════════════════
   "Credit card spends must be controlled, and deduped."
   One screen per card: what the cycle holds, what is already counted, and
   anything that looks recorded twice.                                    */
money['CardControl.dc.html'] = doc({ h: 1510, body: `
  <div class="el2" style="background:${G.gold};color:#FFFFFF;border-radius:0 0 28px 28px;padding:22px 20px 26px;display:flex;flex-direction:column;gap:20px">
${backRow('HDFC Regalia', `<button style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.92)">${ic('gear', 20, 1.8)}</button>`)}
    <div style="display:flex;align-items:center;gap:20px">
      <div style="position:relative;display:flex;align-items:center;justify-content:center;flex:none">
        ${ring(21.4, 96, 10, '#FFFFFF', 'rgba(255,255,255,0.22)')}
        <span style="position:absolute;display:flex;flex-direction:column;align-items:center;gap:1px">
          <span class="n" style="font-size:19px;font-weight:600;line-height:1">21%</span>
          <span style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.86)">used</span>
        </span>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:7px">
        ${eyebrow('This cycle')}
        <span class="n" style="font-size:32px;font-weight:600;line-height:1;letter-spacing:-0.03em">₹42,850</span>
        ${subline('of a ₹2,00,000 limit')}
      </div>
    </div>
${splitStat('Statement', '5 Sep', 'Payment due', '12 Sep')}
    <div style="display:flex;align-items:center;gap:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.18)">
      <span style="flex:1;display:flex;flex-direction:column;gap:3px">
        ${eyebrow('Cycle to date')}
        <span style="font-size:12.5px;color:rgba(255,255,255,0.86)">12 purchases since 5 Aug</span>
      </span>
      ${spark({ data: [3200, 7400, 7400, 12900, 18600, 21000, 24500, 24500, 29800, 34300, 38350, 42850], colour: '#FFFFFF', w: 118, h: 34 })}
    </div>
  </div>

  <div style="display:flex;align-items:flex-start;gap:10px;margin:20px 18px 22px;padding:14px 15px;border-radius:14px;background:${C.seagrassT}">
    <span style="color:${C.onFill};flex:none;margin-top:1px">${ic('check', 18, 2.2)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.tealD}">All ₹42,850 is <b>already counted</b> in August's budget, on the day each purchase happened. Paying this bill moves money — it will not count again.</span>
  </div>

  <a href="#" class="el" style="margin:0 18px 24px;display:flex;align-items:center;gap:13px;min-height:76px;background:linear-gradient(135deg,${C.pumpkin} 0%,#FFA061 100%);border-radius:16px;padding:14px 16px;color:${C.ink}">
    <span style="width:40px;height:40px;border-radius:999px;background:${C.redL};display:flex;align-items:center;justify-content:center;color:${C.redDeep};flex:none">${ic('split', 21, 1.8)}</span>
    <span style="flex:1;display:flex;flex-direction:column;gap:3px">
      <span style="font-size:15.5px;font-weight:600">2 look recorded twice</span>
      <span style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:${C.danger}">${ic('alert', 13, 2.4)} ₹5,680 counted more than once</span>
    </span>
    <span style="color:${C.redDeep}">${ic('chevR', 18, 2)}</span>
  </a>

${chartCard('What is on it', `<span class="n" style="font-size:12.5px;font-weight:600;color:${C.meta}">₹42,850</span>`,
`${donut({
  hero: '₹42,850', heroLabel: 'this cycle',
  data: [
    { label: 'Travel', value: 12500, pct: 29, colour: SERIES[0] },
    { label: 'Shopping', value: 9800, pct: 23, colour: SERIES[1] },
    { label: 'Eating Out', value: 8400, pct: 20, colour: SERIES[2] },
    { label: 'Groceries', value: 7350, pct: 17, colour: SERIES[3] },
    { label: 'Not in a category', value: 4800, pct: 11, colour: SERIES[4] },
  ] })}`, '0 18px 22px')}

${sectionHead('cal', C.blueL, C.blue, 'When the bill lands', '', '0 20px 12px')}
${card(`    <div style="display:flex;align-items:center;gap:12px;min-height:66px;border-bottom:1px solid ${C.rule}">
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:15px;font-weight:600">Pay it automatically</span>
        <span style="font-size:12.5px;color:${C.meta}">In full, from HDFC Savings, on the 12th</span>
      </span>
      <span style="width:50px;height:30px;border-radius:999px;background:${C.seagrass};display:flex;align-items:center;justify-content:flex-end;padding:3px;flex:none"><span style="width:24px;height:24px;border-radius:999px;background:#FFFFFF"></span></span>
    </div>
    <div style="display:flex;align-items:center;gap:12px;min-height:66px">
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:15px;font-weight:600">Warn me at</span>
        <span style="font-size:12.5px;color:${C.meta}">Half the limit, and again at 80%</span>
      </span>
      <span style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:${C.meta}">₹1,00,000 ${ic('chevR', 17, 2)}</span>
    </div>`, '0 18px 26px')}` });

/* ══════════════════ DEDUPE ══════════════════
   The same charge arrives from two places — the bank message and the entry
   you typed. One card, both sources side by side, one button.            */
const dupe = (amt, merchant, cat, a, b, last) => `    <div style="display:flex;flex-direction:column;gap:12px;padding:16px 0${last ? '' : `;border-bottom:1px solid ${C.rule}`}">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatar('split', CAT.rust[0], CAT.rust[1], 38)}
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
          <span style="font-size:15.5px;font-weight:600">${merchant}</span>
          <span style="font-size:12.5px;color:${C.meta}">${cat}</span>
        </span>
        <span class="n" style="font-size:17px;font-weight:600;color:${C.red}">${amt}</span>
      </div>
      <div style="display:flex;gap:9px">
${[a, b].map(([src, when, keep]) => `        <button style="flex:1;display:flex;flex-direction:column;gap:6px;padding:13px 13px;border-radius:14px;background:${keep ? C.tealL : C.sunk2};border:1.5px solid ${keep ? C.teal : 'transparent'};text-align:left">
          <span style="display:flex;align-items:center;gap:7px">
            <span style="width:22px;height:22px;border-radius:999px;${keep ? `background:${C.teal};color:#FFFFFF` : 'border:1.5px solid ${C.hair}'};display:flex;align-items:center;justify-content:center;flex:none">${keep ? ic('check', 13, 2.8) : ''}</span>
            <span style="font-size:13px;font-weight:600;color:${keep ? '${C.tealD}' : C.ink}">${src}</span>
          </span>
          <span style="font-size:11.5px;color:${keep ? '${C.tealD}' : C.meta}">${when}</span>
        </button>`).join('\n')}
      </div>
      <div style="display:flex;gap:8px">
        <button style="flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:13px;background:${C.okFill};color:${C.onFill};font-size:14px;font-weight:600">${ic('check', 16, 2.4)} Keep the one ticked</button>
        <button style="min-height:46px;padding:0 15px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:${C.sunk2};color:${C.meta};font-size:14px;font-weight:600">Both are real</button>
      </div>
    </div>`;

money['Dedupe.dc.html'] = doc({ h: 1080, body: `
${header(G.char, `${backRow('Possible duplicates')}
${bigNumber('Counted more than once', '₹5,680', `      ${subline('2 pairs on HDFC Regalia this cycle')}`)}`, '22px 20px 26px')}

  <div style="display:flex;align-items:flex-start;gap:10px;margin:20px 18px 20px;padding:14px 15px;border-radius:14px;background:${C.sunk2}">
    <span style="color:${C.meta};flex:none;margin-top:1px">${ic('alert', 17, 1.9)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.meta}">Same amount, same card, within three days. Usually it is a bank message arriving after you already typed the expense in yourself.</span>
  </div>

${card(`${dupe('₹4,500', 'Amazon', 'Shopping · 28 Aug', ['From HDFC message', '28 Aug, 16:04', true], ['You typed it', '28 Aug, 16:09', false], false)}
${dupe('₹1,180', 'Apollo Pharmacy', 'Health · 26 Aug', ['From HDFC message', '26 Aug, 09:14', true], ['Scanned receipt', '26 Aug, 09:31', false], true)}`, '0 18px 22px')}

  <div style="display:flex;flex-direction:column;gap:10px;padding:0 18px 26px">
    <button class="el" style="min-height:54px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:15px;background:${C.card};color:${C.ink};font-size:15px;font-weight:600">${ic('check', 18, 2.2)} Keep the bank's copy for both</button>
    <p style="margin:0;padding:0 4px;font-size:12.5px;line-height:1.5;color:${C.meta};text-align:center">Whichever you drop goes to the Inbox for seven days before it is deleted for good.</p>
  </div>` });

/* ══════════════════ BUDGET EDIT ══════════════════
   Monthly, carried forward — set August, September starts as a copy.     */
money['BudgetEdit.dc.html'] = doc({ h: 1240, body: `
${plainHead('August 2026', `<button style="min-height:44px;padding:0 6px;display:flex;align-items:center;font-size:14px;font-weight:600;color:${C.teal}">Done</button>`)}
  <div style="display:flex;flex-direction:column;gap:5px;padding:18px 22px 20px">
    <div style="display:flex;align-items:baseline;gap:10px">
      <span class="eyebrow" style="color:${C.meta}">Budgeted</span>
      <span class="n" style="margin-left:auto;font-size:13px;font-weight:600;color:${C.gold}">₹93,000 still loose</span>
    </div>
    <span class="n" style="font-size:34px;font-weight:600;letter-spacing:-0.028em;line-height:1.05">₹1,47,000 <span style="font-size:19px;font-weight:500;color:${C.meta}">of ₹2,40,000</span></span>
    <div style="height:8px;border-radius:999px;background:${C.track};overflow:hidden;display:flex;margin-top:7px">
      <div style="width:61.3%;background:${BAR}"></div>
      <div style="width:38.7%;background:${C.goldL}"></div>
    </div>
  </div>

${card([
  ['house2', CAT.green[0], CAT.green[1], 'Rent', '₹45,000'],
  ['cart', CAT.green[0], CAT.green[1], 'Groceries', '₹25,000'],
  ['child', CAT.orange[0], CAT.orange[1], 'School fees', '₹22,000'],
  ['child', CAT.pink[0], CAT.pink[1], 'Children', '₹15,000'],
  ['bag', CAT.purple[0], CAT.purple[1], 'Shopping', '₹14,000'],
  ['cutlery', CAT.orange[0], CAT.orange[1], 'Eating Out', '₹10,000'],
  ['bulb', CAT.cyan[0], CAT.cyan[1], 'Utilities', '₹10,000'],
  ['car', C.blueL, CAT.blue[1], 'Transport', '₹6,000'],
].map(([i, t, ti, name, amt], n, a) => `    <div style="display:flex;gap:13px">
      ${avatar(i, t, ti, 38, '13px')}
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;padding:13px 0${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
        <span style="flex:1;font-size:15px;font-weight:600">${name}</span>
        <button class="n" style="min-height:44px;display:flex;align-items:center;padding:0 13px;border-radius:12px;background:${C.sunk2};font-size:15px;font-weight:600">${amt}</button>
      </div>
    </div>`).join('\n'), '0 18px 16px')}

${dashedBtn('Add a category', 'plus', '0 18px 20px')}

  <div style="display:flex;align-items:flex-start;gap:11px;margin:0 18px 12px;padding:15px 16px;border-radius:16px;background:${C.card};border:1px solid ${C.border}">
    <span style="color:${C.onFill};flex:none;margin-top:1px">${ic('refresh', 18, 1.9)}</span>
    <span style="flex:1;display:flex;flex-direction:column;gap:3px">
      <span style="font-size:14.5px;font-weight:600">September starts from these</span>
      <span style="font-size:13px;line-height:1.45;color:${C.meta}">Every month copies the one before it. Change September when you get there and August stays as it was.</span>
    </span>
    <span style="width:50px;height:30px;border-radius:999px;background:${C.seagrass};display:flex;align-items:center;justify-content:flex-end;padding:3px;flex:none"><span style="width:24px;height:24px;border-radius:999px;background:#FFFFFF"></span></span>
  </div>

  <button style="margin:0 18px 26px;min-height:50px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:14px;background:${C.sunk2};color:${C.meta};font-size:14.5px;font-weight:600">${ic('clock', 17, 1.9)} Use July's actual spending instead</button>` });

  return money;
}
