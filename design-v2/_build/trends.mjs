import {
  C, G, CAT, SERIES, ic, doc, nav, header, backRow, eyebrow, subline,
  sectionHead, link, card, avatar, meta, amount, tag, dashedBtn,
  barChart, catBars, legend, chartCard, donut, HSCROLL, SNAP,
} from './lib.mjs';

export function buildTrends() {
  const trends = {};

/* ══════════════════ TRENDS ══════════════════
   The "am I drifting" screen. Monthly totals against your own average, then
   every category against the same category last month — which is the only
   comparison that tells you something you can act on.                     */
trends['Trends.dc.html'] = doc({ h: 1500, body: `
${header(G.indigo, `${backRow('Trends', `<button style="min-height:44px;padding:0 13px;display:flex;align-items:center;gap:7px;border-radius:999px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.22);font-size:13.5px;font-weight:600;color:#FFFFFF">6 months ${ic('chevD', 15, 2)}</button>`)}
    <div style="display:flex;flex-direction:column;gap:7px">
      ${eyebrow('You usually spend')}
      <span class="n" style="font-size:44px;font-weight:600;line-height:1;letter-spacing:-0.03em">₹2,07,833</span>
      ${subline('a month, over the last six')}
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:14px;background:rgba(0,0,0,0.20)">
      <span style="color:${C.goldL};flex:none">${ic('up', 18, 2)}</span>
      <span style="flex:1;font-size:13px;line-height:1.45;color:rgba(255,255,255,0.90)">August is <b>₹7,767 above</b> that — about 4% more than a normal month.</span>
    </div>`, '22px 20px 26px')}

${chartCard('What you spent each month', `<span class="n" style="font-size:12.5px;font-weight:600;color:${C.meta}">Aug ₹2,15,600</span>`,
`${barChart({ data: [198400, 204900, 231200, 187600, 209300, 215600], labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'], colour: C.indigo, h: 128 })}
    <div style="display:flex;align-items:center;gap:9px;padding-top:12px;border-top:1px solid ${C.rule}">
      <span style="width:8px;height:8px;border-radius:999px;background:${C.axis};flex:none"></span>
      <span style="flex:1;font-size:13px;line-height:1.4;color:${C.meta}">May was your heaviest month at <b style="color:${C.ink}">₹2,31,200</b>. June was your lightest.</span>
    </div>`, '20px 18px 22px')}

${chartCard('Where August went', `<a href="#" style="font-size:12.5px;font-weight:600">Budget</a>`,
`${donut({
  hero: '₹1,31,200', heroLabel: 'in categories',
  data: [
    { label: 'Rent', value: 45000, pct: 34, colour: SERIES[0] },
    { label: 'School fees', value: 22000, pct: 17, colour: SERIES[1] },
    { label: 'Groceries', value: 18400, pct: 14, colour: SERIES[2] },
    { label: 'Shopping', value: 12300, pct: 9, colour: SERIES[3] },
    { label: 'Eating Out', value: 11900, pct: 9, colour: SERIES[4] },
    { label: 'Everything else', value: 21600, pct: 17, colour: SERIES[5] },
  ] })}
    <div style="display:flex;align-items:center;gap:9px;padding-top:12px;border-top:1px solid ${C.rule}">
      <span style="width:8px;height:8px;border-radius:999px;background:${C.gold};flex:none"></span>
      <span style="flex:1;font-size:13px;line-height:1.4;color:${C.meta}">A further <b style="color:${C.ink}">₹84,400</b> was spent outside any category — 39% of the month.</span>
    </div>`, '0 18px 22px')}

${sectionHead('pie', C.indigoL, C.indigo, 'Against last month', link('July'), '0 20px 12px')}
${chartCard('Every category, August vs July', '',
`${catBars([
  { icon: 'house2', label: 'Rent', value: 45000, colour: SERIES[0], tint: CAT.green[0], ink: CAT.green[1] },
  { icon: 'child', label: 'School fees', value: 22000, colour: SERIES[1], tint: CAT.orange[0], ink: CAT.orange[1] },
  { icon: 'cart', label: 'Groceries', value: 18400, delta: -6, colour: SERIES[0], tint: CAT.green[0], ink: CAT.green[1] },
  { icon: 'bag', label: 'Shopping', value: 12300, delta: 22, colour: SERIES[3], tint: CAT.purple[0], ink: CAT.purple[1] },
  { icon: 'cutlery', label: 'Eating Out', value: 11900, delta: 34, colour: SERIES[1], tint: CAT.orange[0], ink: CAT.orange[1] },
  { icon: 'child', label: 'Children', value: 9000, delta: -4, colour: SERIES[4], tint: CAT.pink[0], ink: CAT.pink[1] },
  { icon: 'bulb', label: 'Utilities', value: 8000, delta: 3, colour: SERIES[5], tint: CAT.cyan[0], ink: CAT.cyan[1] },
  { icon: 'car', label: 'Transport', value: 4600, delta: -11, colour: SERIES[2], tint: CAT.blue[0], ink: CAT.blue[1] },
])}
    <div style="display:flex;align-items:center;gap:9px;padding-top:12px;border-top:1px solid ${C.rule}">
      <span style="font-size:12px;color:${C.faint}">Rent and School fees are the same every month, so they carry no change.</span>
    </div>`, '0 18px 22px')}

  <a href="#" class="el" style="margin:0 18px 22px;display:flex;align-items:center;gap:13px;min-height:82px;background:linear-gradient(135deg,${C.redL} 0%,${C.redL} 100%);border-radius:18px;padding:15px 16px;color:${C.ink}">
    <span style="width:42px;height:42px;border-radius:999px;background:${CAT.orange[0]};display:flex;align-items:center;justify-content:center;color:${CAT.orange[1]};flex:none">${ic('cutlery', 21, 1.8)}</span>
    <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
      <span style="font-size:15.5px;font-weight:600">Eating Out is your biggest change</span>
      <span style="font-size:12.5px;line-height:1.4;color:${C.meta}">₹3,020 more than July, and ₹1,900 over its budget</span>
    </span>
    <span style="color:${C.faint};flex:none">${ic('chevR', 18, 2)}</span>
  </a>

${sectionHead('clock', C.neut, C.meta, 'Where it goes most', '', '0 20px 12px')}
${card(`${[
  ['Big Bazaar', 'Groceries · 6 visits', '₹14,200', 'cart', 'green'],
  ['Swiggy', 'Eating Out · 11 orders', '₹7,450', 'cutlery', 'orange'],
  ['Amazon', 'Shopping · 4 orders', '₹6,900', 'bag', 'purple'],
].map(([name, sub, amt, icon, cat], n, a) => `    <div style="display:flex;gap:13px">
      ${avatar(icon, CAT[cat][0], CAT[cat][1], 38, '14px')}
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:14px 0${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
          <span style="font-size:15px;font-weight:600">${name}</span>
          <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
        </span>
        ${amount(amt)}
      </div>
    </div>`).join('\n')}`, '0 18px 26px')}

${nav('budget')}` });

  return trends;
}
