import {
  C, G, CAT, TEAL_BTN, ic, doc, nav, header, backRow, eyebrow, subline,
  bigNumber, splitStat, sectionHead, link, card, avatar, meta, amount, tag,
  statusChip, dashedBtn, titleBlock, ring, HSCROLL, SNAP,
} from './lib.mjs';

export function buildMethods() {
  const m = {};

const plainHead = (title, right = '') => `  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 20px 0">
    <button style="width:44px;height:44px;margin-left:-10px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:${C.meta}">${ic('back', 21, 2)}</button>
    <h1 class="t" style="margin:0;font-size:19px">${title}</h1>
    ${right || '<span style="width:44px;height:44px"></span>'}
  </div>`;

/* ══════════════════ PAYMENT METHODS ══════════════════
   The distinction the whole screen exists to make: an ACCOUNT holds money,
   a METHOD is a rail. GPay holds nothing — it draws on a bank account, so
   spending "by GPay" has to leave that bank account or the balances lie.
   Every method row therefore states its funding account on the face.       */
const methodRow = (icon, tint, name, handle, funds, spent, last) =>
`    <a href="#" style="display:flex;gap:13px;color:${C.ink}">
      ${avatar(icon, CAT[tint][0], CAT[tint][1], 40, '14px')}
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:14px 0${last ? '' : `;border-bottom:1px solid ${C.rule}`}">
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
          <span style="font-size:15.5px;font-weight:600">${name}</span>
          <span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:12px;color:${C.faint}">${handle}</span>
            <span style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:${C.meta}">${ic('swap', 12, 2.2)} ${funds}</span>
          </span>
        </span>
        <span style="display:flex;flex-direction:column;align-items:flex-end;gap:1px;flex:none">
          <span class="n" style="font-size:14.5px;font-weight:600">${spent}</span>
          <span style="font-size:11px;color:${C.faint}">this month</span>
        </span>
        <span style="color:${C.faint};flex:none">${ic('chevR', 17, 2)}</span>
      </div>
    </a>`;

m['PaymentMethods.dc.html'] = doc({ h: 1300, body: `
${header(G.teal, `${backRow('How you pay', `<button style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.92)">${ic('plus', 21, 2.1)}</button>`)}
${bigNumber('Spent in August', '₹2,15,600', `      ${subline('across 6 ways of paying, from 4 accounts')}`)}
${splitStat('Most used', 'GPay · ₹94,300', 'Ways to pay', '6')}`, '22px 20px 24px')}

  <div style="display:flex;align-items:flex-start;gap:10px;margin:20px 18px 22px;padding:14px 15px;border-radius:14px;background:${C.seagrassT}">
    <span style="color:${C.onFill};flex:none;margin-top:1px">${ic('alert', 17, 1.9)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.onFill}">A way of paying is not an account. <b>GPay holds no money</b> — it draws on a bank account, so paying by GPay leaves that bank. Tell it which account each one uses and your balances stay right.</span>
  </div>

${sectionHead('phone', CAT.blue[0], CAT.blue[1], 'UPI', '', '0 20px 12px')}
${card(`${methodRow('phone', 'blue', 'GPay', 'abdeali@okhdfc', 'HDFC Savings', '₹94,300', false)}
${methodRow('phone', 'purple', 'PhonePe', 'abdeali@ybl', 'ICICI Savings', '₹18,900', true)}`, '0 18px 22px')}

${sectionHead('card2', CAT.rust[0], CAT.rust[1], 'Cards', '', '0 20px 12px')}
${card(`${methodRow('card2', 'rust', 'HDFC Regalia', 'ends 8802', 'HDFC Regalia', '₹42,850', false)}
${methodRow('card2', 'green', 'HDFC Debit', 'ends 4471', 'HDFC Savings', '₹12,400', true)}`, '0 18px 22px')}

${sectionHead('bank2', C.tealL, C.teal, 'Everything else', '', '0 20px 12px')}
${card(`${methodRow('bank', 'cyan', 'Net banking', 'HDFC', 'HDFC Savings', '₹45,000', false)}
${methodRow('briefcase', 'neutral', 'Cash', 'in hand', 'Cash', '₹2,150', true)}`, '0 18px 22px')}

${dashedBtn('Add a way to pay')}` });

/* ── setting one up: the funding account is the whole point ─────────────── */
m['MethodEdit.dc.html'] = doc({ h: 1080, body: `
${plainHead('New way to pay', `<button style="min-height:44px;padding:0 6px;display:flex;align-items:center;font-size:14px;font-weight:600;color:${C.teal}">Save</button>`)}
${titleBlock('What kind is it?', 'This decides which accounts it is allowed to draw on.', '18px 22px 18px')}

  <div style="display:flex;gap:8px;padding:0 18px 20px;${HSCROLL}">
${[['UPI', 'phone', true], ['Card', 'card2', false], ['Net banking', 'bank', false], ['Cash', 'briefcase', false], ['Auto-debit', 'refresh', false]]
  .map(([t, i, on]) => `    <button style="min-height:44px;padding:0 14px;display:flex;align-items:center;gap:7px;border-radius:999px;flex:none;${SNAP};white-space:nowrap;font-size:13.5px;font-weight:600;${on ? `background:${C.ink};color:${C.card}` : `background:${C.card};border:1px solid ${C.border};color:${C.meta}`}">${ic(i, 16, 1.9)} ${t}</button>`).join('\n')}
  </div>

  <div class="el" style="margin:0 18px 18px;background:${C.card};border-radius:18px;padding:2px 16px">
    <div style="display:flex;align-items:center;gap:12px;min-height:60px;border-bottom:1px solid ${C.rule}">
      <span style="width:88px;flex:none;font-size:13.5px;font-weight:600;color:${C.meta}">Name</span>
      <span style="flex:1;font-size:15.5px;font-weight:600">GPay</span>
    </div>
    <div style="display:flex;align-items:center;gap:12px;min-height:60px">
      <span style="width:88px;flex:none;font-size:13.5px;font-weight:600;color:${C.meta}">UPI ID</span>
      <span style="flex:1;font-size:15.5px;font-weight:600">abdeali@okhdfc</span>
    </div>
  </div>

  <div style="display:flex;flex-direction:column;gap:9px;padding:0 18px">
    <span class="eyebrow" style="color:${C.meta};padding:0 2px 2px">Money comes out of</span>
${[
  ['bank', 'green', 'HDFC Savings', '₹2,83,530 · spending', true],
  ['bank', 'blue', 'ICICI Savings', '₹78,200 · spending', false],
  ['briefcase', 'neutral', 'Cash', '₹18,450 · cash', false],
].map(([icon, tint, name, sub, on]) => `    <button class="el" style="display:flex;align-items:center;gap:13px;padding:14px 16px;border-radius:16px;background:${C.card};border:1.5px solid ${on ? C.seagrass : 'transparent'};text-align:left">
      ${avatar(icon, CAT[tint][0], CAT[tint][1], 40)}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:15.5px;font-weight:600">${name}</span>
        <span class="n" style="font-size:12.5px;color:${C.meta}">${sub}</span>
      </span>
      <span style="width:24px;height:24px;border-radius:999px;${on ? `background:${C.seagrass};color:${C.onFill}` : `border:1.5px solid ${C.hair}`};display:flex;align-items:center;justify-content:center;flex:none">${on ? ic('check', 14, 2.8) : ''}</span>
    </button>`).join('\n')}
    <p style="margin:6px 2px 0;font-size:13px;line-height:1.5;color:${C.meta}">Savings accounts are not offered here — money in savings is held out of the budget, so it cannot be a way of paying.</p>
  </div>

  <div style="margin-top:auto;padding:22px 18px 26px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center">Save this way to pay</button>
  </div>` });

/* ── the card's billing cycle, and what settles it ──────────────────────── */
m['CardCycle.dc.html'] = doc({ h: 1360, body: `
  <div class="el2" style="background:repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 26px),${G.gold};color:#FFFFFF;border-radius:0 0 28px 28px;padding:22px 20px 26px;display:flex;flex-direction:column;gap:20px">
${backRow('HDFC Regalia', `<button style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.92)">${ic('gear', 20, 1.8)}</button>`)}
    <div style="display:flex;align-items:center;gap:20px">
      <div style="position:relative;display:flex;align-items:center;justify-content:center;flex:none">
        ${ring(21.4, 92, 10, '#FFFFFF', 'rgba(255,255,255,0.22)')}
        <span style="position:absolute;display:flex;flex-direction:column;align-items:center;gap:1px">
          <span class="n" style="font-size:18px;font-weight:600;line-height:1">21%</span>
          <span style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.88)">of limit</span>
        </span>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:6px">
        ${eyebrow('This cycle')}
        <span class="n" style="font-size:31px;font-weight:600;line-height:1;letter-spacing:-0.03em">₹42,850</span>
        ${subline('6 Aug – 5 Sep · 12 purchases')}
      </div>
    </div>
  </div>

${sectionHead('cal', CAT.blue[0], CAT.blue[1], 'The cycle', link('Edit dates'), '20px 20px 14px')}
  <section class="el" style="margin:0 18px 20px;background:${C.card};border-radius:18px;padding:18px 16px 16px;display:flex;flex-direction:column;gap:16px">
    <div style="display:flex;align-items:center;gap:0">
${[['Opened', '6 Aug', true], ['Statement', '5 Sep', true], ['Due', '12 Sep', false]]
  .map(([l, d, done], i, a) => `      <div style="flex:1;display:flex;flex-direction:column;align-items:${i === 0 ? 'flex-start' : i === a.length - 1 ? 'flex-end' : 'center'};gap:7px">
        <span style="font-size:11.5px;font-weight:600;color:${C.meta}">${l}</span>
        <span class="n" style="font-size:14.5px;font-weight:600;color:${done ? C.ink : C.gold}">${d}</span>
      </div>`).join('\n')}
    </div>
    <div style="position:relative;height:6px;border-radius:999px;background:${C.track}">
      <div style="position:absolute;left:0;top:0;height:6px;width:74%;border-radius:999px;background:${C.seagrass}"></div>
      <span style="position:absolute;left:74%;top:-4px;width:14px;height:14px;margin-left:-7px;border-radius:999px;background:${C.card};border:3px solid ${C.seagrass}"></span>
    </div>
    <div style="display:flex;align-items:flex-start;gap:10px;padding:13px 14px;border-radius:13px;background:${C.seagrassT}">
      <span style="color:${C.onFill};flex:none;margin-top:1px">${ic('check', 17, 2.2)}</span>
      <span style="flex:1;font-size:13px;line-height:1.5;color:${C.onFill}">Every purchase here <b>was already counted</b> in the month it happened. Paying this bill clears the cycle — it never counts again.</span>
    </div>
  </section>

${sectionHead('swap', CAT.rust[0], CAT.rust[1], 'What the bill settles', '', '0 20px 12px')}
${card([
  ['Aug', 'plane', 'cyan', 'Taj Palace', '29 Aug · Travel', '₹12,500', 'To get back'],
  ['Aug', 'bag', 'purple', 'Amazon', '28 Aug · Shopping', '₹4,500', ''],
  ['Aug', 'cutlery', 'orange', 'Swiggy', '24 Aug · Eating Out', '₹1,180', ''],
].map(([, icon, tint, name, sub, amt, badge], n, a) => `    <div style="display:flex;gap:13px">
      ${avatar(icon, CAT[tint][0], CAT[tint][1], 38, '14px')}
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:14px 0${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span style="font-size:15px;font-weight:600">${name}</span>
          <span style="display:flex;align-items:center;gap:7px">
            <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
            ${badge ? statusChip('warn', badge) : ''}
          </span>
        </span>
        ${amount(amt)}
      </div>
    </div>`).join('\n') + `
    <a href="#" style="display:flex;align-items:center;gap:6px;min-height:52px;font-size:13.5px;font-weight:600;border-top:1px solid ${C.rule}">See all 12 ${ic('chevR', 15, 2.1)}</a>`, '0 18px 22px')}

  <div style="display:flex;align-items:flex-start;gap:10px;margin:0 18px 22px;padding:14px 15px;border-radius:14px;background:${C.pollen}">
    <span style="color:${C.onFill};flex:none;margin-top:1px">${ic('alert', 17, 1.9)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.onFill}"><b>₹12,500 of this is Ahmed's.</b> It is on your card and in August's budget, but it is also in his book — when he pays you back it comes off there, not off this bill.</span>
  </div>

  <div style="margin-top:auto;display:flex;flex-direction:column;gap:9px;padding:0 18px 26px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:9px">${ic('check', 19, 2.2)} Pay ₹42,850 and clear the cycle</button>
    <button style="width:100%;min-height:50px;display:flex;align-items:center;justify-content:center;color:${C.meta};font-size:15px;font-weight:600">Paid a different amount</button>
  </div>` });

  return m;
}
