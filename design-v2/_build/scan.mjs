import {
  C, G, CAT, TEAL_BTN, ic, doc, header, backRow, eyebrow, subline,
  sectionHead, card, avatar, meta, amount, statusChip, titleBlock, HSCROLL, SNAP,
} from './lib.mjs';

export function buildScan() {
  const s = {};

/* ══════════════════ SCAN → REVIEW → CONFIRM ══════════════════
   The rule the whole flow exists to protect: an assistant never posts. It
   proposes, and you confirm. The model will eventually read ₹1,180 as
   ₹11,800, so the amount is the one field shown largest, checked first, and
   marked when the model was unsure.
   · Doherty — extraction takes a second or two, so the wait is a real state
     with the picture already on screen, not a spinner over nothing.
   · Recognition over recall — the photo stays beside the fields, so you
     verify against the receipt instead of remembering it.
   · Fitts — the confirm bar is 58px at the thumb; corrections are inline.   */

const field = (label, value, sure, last = false) =>
`    <button style="display:flex;align-items:center;gap:12px;width:100%;min-height:60px${last ? '' : `;border-bottom:1px solid ${C.rule}`}">
      <span style="width:84px;flex:none;font-size:13.5px;font-weight:600;color:${C.meta}">${label}</span>
      <span style="flex:1;min-width:0;display:flex;align-items:center;gap:8px">
        <span style="font-size:15.5px;font-weight:600">${value}</span>
        ${sure ? '' : statusChip('warn', 'Check')}
      </span>
      <span style="color:${C.faint}">${ic('chevR', 18, 2)}</span>
    </button>`;

s['ScanReview.dc.html'] = doc({ h: 1180, body: `
  <div class="el2" style="background:repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 26px),${G.teal};color:#FFFFFF;border-radius:0 0 26px 26px;padding:18px 20px 22px;display:flex;flex-direction:column;gap:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <button style="width:44px;height:44px;margin-left:-10px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.86)">${ic('x', 21, 2)}</button>
      <h1 class="t" style="margin:0;font-size:19px;color:#FFFFFF">Check this over</h1>
      <button style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.86)">${ic('camera', 20, 1.8)}</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:9px">
      ${eyebrow('Read from the receipt')}
      <div style="display:flex;align-items:baseline;gap:6px">
        <span class="n" style="font-size:28px;font-weight:500;color:rgba(255,255,255,0.62)">₹</span>
        <span class="n" style="font-size:46px;font-weight:600;letter-spacing:-0.036em;line-height:1.05">2,340</span>
      </div>
      ${subline('Nothing is saved until you confirm it')}
    </div>
  </div>

  <div style="display:flex;gap:12px;padding:18px 18px 16px">
    <div style="width:104px;height:132px;flex:none;border-radius:14px;background:${C.sunk};border:1px solid ${C.border};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:${C.faint}">
      ${ic('receipt', 30, 1.6)}
      <span style="font-size:11px;font-weight:600">Your photo</span>
    </div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:9px;justify-content:center">
      <span style="font-size:14px;font-weight:600;line-height:1.35">Tap the picture to see it full size while you check the figures.</span>
      <span style="font-size:12.5px;line-height:1.45;color:${C.meta}">Anything marked <b>Check</b> is where the reader was unsure.</span>
    </div>
  </div>

  <div class="el" style="margin:0 18px 16px;background:${C.card};border-radius:18px;padding:2px 16px">
${field('Amount', '₹2,340', true)}
${field('Paid to', 'Big Bazaar', true)}
${field('Date', '31 Aug 2026', true)}
${field('Category', 'Groceries', false)}
${field('Paid using', 'HDFC Savings', false)}
${field('Shared', 'With the household', true, true)}
  </div>

  <div style="display:flex;align-items:flex-start;gap:10px;margin:0 18px 18px;padding:14px 15px;border-radius:14px;background:${C.pollen}">
    <span style="color:${C.onFill};flex:none;margin-top:1px">${ic('alert', 17, 1.9)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.onFill}">Category and account were <b>guessed</b> from the merchant, not read off the receipt. Worth a glance before you confirm.</span>
  </div>

${sectionHead('doc', C.neut, C.meta, 'Also on the receipt', '', '0 20px 12px')}
${card(`${[
  ['Atta 10kg', '₹560'], ['Toor dal 2kg', '₹340'], ['Milk 4×1L', '₹280'],
].map(([n2, a2], i, arr) => `    <div style="display:flex;align-items:center;gap:12px;min-height:52px${i === arr.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
      <span style="flex:1;font-size:14.5px;color:${C.meta}">${n2}</span>
      <span class="n" style="font-size:14px;font-weight:600;color:${C.meta}">${a2}</span>
    </div>`).join('\n')}
    <div style="display:flex;align-items:center;gap:12px;min-height:48px;border-top:1px solid ${C.rule}">
      <span style="flex:1;font-size:12.5px;color:${C.faint}">Kept as a note. Line items are not categorised separately.</span>
    </div>`, '0 18px 22px')}

  <div style="margin-top:auto;display:flex;flex-direction:column;gap:9px;padding:0 18px 26px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:9px">${ic('check', 19, 2.2)} Confirm and save</button>
    <button style="width:100%;min-height:50px;display:flex;align-items:center;justify-content:center;color:${C.meta};font-size:15px;font-weight:600">Discard this scan</button>
  </div>` });

/* ── while it reads: a real state, with the picture already visible ────── */
s['ScanReading.dc.html'] = doc({ h: 760, body: `
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:40px 34px;text-align:center">
    <div style="width:150px;height:196px;border-radius:18px;background:${C.sunk};border:1px solid ${C.border};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:${C.faint}">
      ${ic('receipt', 42, 1.5)}
      <span style="font-size:12px;font-weight:600">Big Bazaar</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;align-items:center">
      <h2 class="t" style="margin:0;font-size:24px;letter-spacing:-0.016em">Reading the receipt</h2>
      <p style="margin:0;font-size:14.5px;line-height:1.55;color:${C.meta};max-width:30ch">A second or two. You will get a chance to correct anything before it is saved.</p>
    </div>
    <div style="width:180px;height:5px;border-radius:999px;background:${C.track};overflow:hidden">
      <div style="width:62%;height:5px;border-radius:999px;background:${C.seagrass}"></div>
    </div>
  </div>
  <div style="padding:0 18px 30px">
    <button style="width:100%;min-height:50px;display:flex;align-items:center;justify-content:center;color:${C.meta};font-size:15px;font-weight:600">Cancel</button>
  </div>` });

/* ── the key. Stated plainly, including where it goes. ─────────────────── */
s['AssistKey.dc.html'] = doc({ h: 1120, body: `
  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 20px 0">
    <button style="width:44px;height:44px;margin-left:-10px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:${C.meta}">${ic('back', 21, 2)}</button>
    <h1 class="t" style="margin:0;font-size:19px">Scanning</h1>
    <span style="width:44px;height:44px"></span>
  </div>
${titleBlock('Scan receipts and screenshots', 'Bring your own Google Gemini key. It reads a photo and fills in the entry for you — you always confirm before anything is saved.', '18px 22px 20px')}

  <div style="display:flex;flex-direction:column;gap:7px;padding:0 20px 18px">
    <span class="eyebrow" style="color:${C.meta}">Gemini API key</span>
    <div style="min-height:58px;display:flex;align-items:center;gap:10px;padding:0 16px;border-radius:15px;background:${C.card};border:1.5px solid ${C.seagrass}">
      <span class="n" style="flex:1;font-size:15.5px;letter-spacing:0.04em">AIza••••••••••••••••••••3fQ</span>
      ${statusChip('ok', 'Working')}
    </div>
    <a href="#" style="min-height:44px;display:flex;align-items:center;font-size:13.5px;font-weight:600">Get a key from Google AI Studio</a>
  </div>

${card(`${[
  ['lock', 'blue', 'It stays on this phone', 'Kept in this browser only. Never written to our database, and never stored on our server — it passes through and is forgotten.'],
  ['device', 'neutral', 'Each device needs its own', 'Enter it again on your other phone. Everyone then spends their own quota rather than sharing one.'],
  ['alert', 'orange', 'Pictures go to Google', 'A receipt or screenshot you scan is sent to Gemini to be read. Nothing else in this app is.'],
].map(([icon, tint, t, d], i, a) => `    <div style="display:flex;gap:13px">
      ${avatar(icon, CAT[tint][0], CAT[tint][1], 38, '15px')}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;padding:15px 0${i === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
        <span style="font-size:15px;font-weight:600">${t}</span>
        <span style="font-size:13px;line-height:1.5;color:${C.meta}">${d}</span>
      </div>
    </div>`).join('\n')}`, '0 18px 20px')}

${card(`    <div style="display:flex;align-items:center;gap:12px;min-height:64px;border-bottom:1px solid ${C.rule}">
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:15px;font-weight:600">Scanned this month</span>
        <span style="font-size:12.5px;color:${C.meta}">14 receipts, 6 screenshots</span>
      </span>
      <span class="n" style="font-size:15px;font-weight:600;color:${C.meta}">20</span>
    </div>
    <button style="display:flex;align-items:center;gap:12px;width:100%;min-height:64px">
      <span style="flex:1;font-size:15px;font-weight:600;color:${C.danger}">Remove this key</span>
    </button>`, '0 18px 26px')}

  <div style="display:flex;align-items:flex-start;gap:10px;margin:0 18px 26px;padding:14px 15px;border-radius:14px;background:${C.sunk2}">
    <span style="color:${C.meta};flex:none;margin-top:1px">${ic('alert', 17, 1.9)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.meta}">Without a key the app works exactly as it does now — the keypad, and everything else. Only scanning is switched off.</span>
  </div>` });

  return s;
}
