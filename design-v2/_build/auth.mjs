import { C, G, TEAL_BTN, TEAL_SM, ic, doc, avatar, titleBlock } from './lib.mjs';

export function buildAuth() {
  const auth = {};

// Shared: a plain top bar with a back arrow, on the cream ground.
const topBack = (right = '') => `  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 20px 0">
    <button style="width:44px;height:44px;margin-left:-10px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:${C.meta}">${ic('back', 21, 2)}</button>
    ${right}
  </div>`;

// Shared: the numeric keypad used for phone entry and PIN entry.
const keypad = (delIcon = 'del', extraKey = '') => `  <div style="margin-top:auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:0 26px 30px">
${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k =>
  `    <button class="n" style="min-height:62px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:${C.card};font-size:25px;font-weight:600;color:${C.ink}">${k}</button>`).join('\n')}
    ${extraKey || `<span></span>`}
    <button class="n" style="min-height:62px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:${C.card};font-size:25px;font-weight:600;color:${C.ink}">0</button>
    <button style="min-height:62px;display:flex;align-items:center;justify-content:center;border-radius:16px;color:${C.meta}">${ic(delIcon, 24, 1.8)}</button>
  </div>`;

const primary = (txt, sub = '') => `  <div style="display:flex;flex-direction:column;gap:6px;padding:22px 20px 26px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center">${txt}</button>
    ${sub}
  </div>`;

const pinDots = (filled, total = 6, ink = C.teal, empty = '${C.hair}') =>
  `    <div style="display:flex;gap:14px;justify-content:center">
${Array.from({ length: total }, (_, i) => `      <span style="width:14px;height:14px;border-radius:999px;background:${i < filled ? ink : 'transparent'};border:1.5px solid ${i < filled ? ink : empty}"></span>`).join('\n')}
    </div>`;

/* ── 1 · Welcome ─────────────────────────────────────────────────────── */
auth['AuthWelcome.dc.html'] = doc({ h: 844, body: `
  <div class="el2" style="background:repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 26px),${G.teal};color:#FFFFFF;border-radius:0 0 32px 32px;padding:64px 26px 48px;display:flex;flex-direction:column;gap:18px">
    <span style="width:54px;height:54px;border-radius:16px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.24);display:flex;align-items:center;justify-content:center;color:#FFFFFF">${ic('doc', 27, 1.8)}</span>
    <h1 class="t" style="margin:0;font-size:38px;line-height:1.06;letter-spacing:-0.02em;text-wrap:balance;color:#FFFFFF">Every rupee,<br>where you left it.</h1>
    <p style="margin:0;font-size:15.5px;line-height:1.5;color:rgba(255,255,255,0.88)">One set of books for your money, or your household's. Budget a month, and everything reports against it.</p>
  </div>

  <div style="display:flex;flex-direction:column;gap:10px;margin-top:auto;padding:30px 20px 26px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:9px">${ic('phone', 19, 1.8)} Continue with phone</button>
${[['Continue with Apple', 'key'], ['Continue with Google', 'mail']].map(([t, i]) =>
  `    <button class="el" style="width:100%;min-height:54px;border-radius:16px;background:${C.card};color:${C.ink};font-size:15.5px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:9px">${ic(i, 19, 1.8)} ${t}</button>`).join('\n')}
    <p style="margin:10px 4px 0;font-size:12.5px;line-height:1.5;text-align:center;color:${C.meta}">By continuing you agree to the Terms and Privacy Policy.</p>
  </div>` });

/* ── 2 · Phone ───────────────────────────────────────────────────────── */
auth['AuthPhone.dc.html'] = doc({ h: 844, body: `
${topBack()}
${titleBlock('What is your number?', 'We send a 6-digit code to sign you in. No password to remember, forget or leak.', '20px 22px 22px')}
  <div style="display:flex;gap:10px;padding:0 20px 14px">
    <button style="min-height:60px;padding:0 15px;display:flex;align-items:center;gap:8px;border-radius:15px;background:${C.card};border:1px solid ${C.border};font-size:17px;font-weight:600;flex:none">🇮🇳 +91 ${ic('chevD', 15, 2)}</button>
    <div class="n" style="flex:1;min-height:60px;display:flex;align-items:center;gap:2px;padding:0 16px;border-radius:15px;background:${C.card};border:1.5px solid ${C.teal};font-size:19px;font-weight:600;letter-spacing:0.02em">
      98204 41
      <span style="width:2px;height:24px;background:${C.teal};margin-left:3px"></span>
    </div>
  </div>
  <p style="margin:0;padding:0 22px;font-size:13px;line-height:1.5;color:${C.meta}">Standard message rates may apply.</p>
${keypad()}
${primary('Send code')}` });

/* ── 3 · Code ────────────────────────────────────────────────────────── */
auth['AuthCode.dc.html'] = doc({ h: 844, body: `
${topBack()}
${titleBlock('Enter the code', 'Sent to +91 98204 41•••. It expires in 10 minutes.', '20px 22px 24px')}
  <div style="display:flex;gap:9px;padding:0 20px 16px">
${[['4', 'filled'], ['1', 'filled'], ['9', 'filled'], ['2', 'filled'], ['', 'focus'], ['', 'empty']].map(([d, st]) =>
  `    <span class="n" style="flex:1;min-height:62px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:${C.card};border:1.5px solid ${st === 'focus' ? C.teal : C.border};font-size:24px;font-weight:600">${d}${st === 'focus' ? `<span style="width:2px;height:26px;background:${C.teal}"></span>` : ''}</span>`).join('\n')}
  </div>
  <div style="display:flex;align-items:center;gap:8px;padding:0 22px">
    <span style="color:${C.faint}">${ic('clock', 17, 1.9)}</span>
    <span style="flex:1;font-size:13.5px;color:${C.meta}">Resend in 0:24</span>
    <button style="min-height:44px;display:flex;align-items:center;font-size:13.5px;font-weight:600;color:${C.teal}">Change number</button>
  </div>
${keypad()}
${primary('Verify')}` });

/* ── 4 · Name & recovery ─────────────────────────────────────────────── */
auth['AuthName.dc.html'] = doc({ h: 844, body: `
${topBack()}
${titleBlock('What should we call you?', 'This is the name household members see next to shared expenses.', '20px 22px 22px')}
  <div style="display:flex;flex-direction:column;gap:16px;padding:0 20px">
    <div style="display:flex;flex-direction:column;gap:7px">
      <span class="eyebrow" style="color:${C.meta}">Your name</span>
      <div style="min-height:58px;display:flex;align-items:center;padding:0 16px;border-radius:15px;background:${C.card};border:1.5px solid ${C.teal};font-size:16.5px;font-weight:600">
        Abdeali M
        <span style="width:2px;height:22px;background:${C.teal};margin-left:3px"></span>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:7px">
      <div style="display:flex;align-items:baseline;gap:8px">
        <span class="eyebrow" style="color:${C.meta}">Recovery email</span>
        <span style="font-size:11.5px;font-weight:600;color:${C.faint}">Optional</span>
      </div>
      <div style="min-height:58px;display:flex;align-items:center;padding:0 16px;border-radius:15px;background:${C.card};border:1px solid ${C.border};font-size:16.5px;color:${C.ph}">you@example.com</div>
      <p style="margin:0;font-size:13px;line-height:1.5;color:${C.meta}">Your way back in if you lose this number and are not in a household.</p>
    </div>
  </div>
${primary('Continue')}` });

/* ── 5 · Set PIN ─────────────────────────────────────────────────────── */
auth['AuthSetPin.dc.html'] = doc({ h: 844, body: `
${topBack()}
  <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:26px 30px 30px;text-align:center">
    ${avatar('lock', C.tealL, C.teal, 56)}
    <h1 class="t" style="margin:6px 0 0;font-size:29px;line-height:1.12;letter-spacing:-0.018em;text-wrap:balance">Lock the app with a PIN</h1>
    <p style="margin:0;font-size:15.5px;line-height:1.5;color:${C.meta}">Your net worth, account numbers and Vault sit behind this. Six digits.</p>
  </div>
${pinDots(3)}
${keypad()}` });

/* ── 6 · Confirm PIN ─────────────────────────────────────────────────── */
auth['AuthConfirmPin.dc.html'] = doc({ h: 844, body: `
${topBack()}
  <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:26px 30px 30px;text-align:center">
    ${avatar('lock', C.tealL, C.teal, 56)}
    <h1 class="t" style="margin:6px 0 0;font-size:29px;line-height:1.12;letter-spacing:-0.018em">Enter it once more</h1>
    <p style="margin:0;font-size:15.5px;line-height:1.5;color:${C.red}">Those did not match. Try again — nothing is saved yet.</p>
  </div>
${pinDots(2, 6, C.red, '${C.dash}')}
${keypad()}` });

/* ── 7 · Biometric ───────────────────────────────────────────────────── */
auth['AuthBiometric.dc.html'] = doc({ h: 844, body: `
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:40px 32px;text-align:center">
    <span style="width:88px;height:88px;border-radius:999px;background:${C.tealL};display:flex;align-items:center;justify-content:center;color:${C.teal}">${ic('finger', 46, 1.6)}</span>
    <h1 class="t" style="margin:8px 0 0;font-size:30px;line-height:1.1;letter-spacing:-0.018em;text-wrap:balance">Use Face ID instead?</h1>
    <p style="margin:0;font-size:15.5px;line-height:1.55;color:${C.meta}">Faster than the PIN, and the PIN still works whenever Face ID does not. You can change this in Settings.</p>
  </div>
  <div style="display:flex;flex-direction:column;gap:8px;padding:0 20px 30px">
    <button class="el2" style="width:100%;min-height:58px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center">Turn on Face ID</button>
    <button style="width:100%;min-height:52px;display:flex;align-items:center;justify-content:center;color:${C.meta};font-size:15px;font-weight:600">Use the PIN only</button>
  </div>` });

/* ── 8 · Locked ──────────────────────────────────────────────────────── */
auth['AuthLocked.dc.html'] = doc({ h: 844, body: `
  <div style="flex:1;display:flex;flex-direction:column;background:${G.teal};color:#FFFFFF">
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:40px 32px;text-align:center">
      <span style="width:64px;height:64px;border-radius:999px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.24);display:flex;align-items:center;justify-content:center;color:#FFFFFF">${ic('lock', 30, 1.8)}</span>
      <h1 class="t" style="margin:4px 0 0;font-size:26px;line-height:1.15;color:#FFFFFF">Mogul Household</h1>
      <p style="margin:0;font-size:14.5px;color:rgba(255,255,255,0.86)">Locked · unlock to continue</p>
${pinDots(4, 6, '#FFFFFF', 'rgba(255,255,255,0.42)')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:0 26px 26px">
${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k =>
  `      <button class="n" style="min-height:62px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:rgba(255,255,255,0.14);font-size:25px;font-weight:600;color:#FFFFFF">${k}</button>`).join('\n')}
      <button style="min-height:62px;display:flex;align-items:center;justify-content:center;border-radius:16px;color:rgba(255,255,255,0.86)">${ic('finger', 26, 1.7)}</button>
      <button class="n" style="min-height:62px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:rgba(255,255,255,0.14);font-size:25px;font-weight:600;color:#FFFFFF">0</button>
      <button style="min-height:62px;display:flex;align-items:center;justify-content:center;border-radius:16px;color:rgba(255,255,255,0.86)">${ic('del', 24, 1.8)}</button>
    </div>
    <button style="min-height:52px;display:flex;align-items:center;justify-content:center;margin:0 26px 26px;font-size:14.5px;font-weight:600;color:rgba(255,255,255,0.86)">Forgot PIN?</button>
  </div>` });

/* ── 9 · Re-auth sheet ───────────────────────────────────────────────── */
auth['AuthReauth.dc.html'] = doc({ h: 560, body: `
  <div style="flex:1;background:rgba(33,30,26,0.46)"></div>
  <div class="el2" style="background:${C.card};border-radius:26px 26px 0 0;padding:10px 22px 28px;display:flex;flex-direction:column;gap:14px">
    <span style="width:38px;height:4px;border-radius:999px;background:${C.off};align-self:center;margin-bottom:8px"></span>
    ${avatar('vault', '${CAT.neutral[0]}', '${CAT.neutral[1]}', 48)}
    <h2 class="t" style="margin:2px 0 0;font-size:22px;letter-spacing:-0.015em">Confirm it is you</h2>
    <p style="margin:0;font-size:14.5px;line-height:1.5;color:${C.meta}">The Vault holds your policies, deeds and account papers. It asks every time, even when the app is already unlocked.</p>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
      <button class="el2" style="width:100%;min-height:56px;border-radius:16px;background:${TEAL_BTN};color:#FFFFFF;font-size:16px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:9px">${ic('finger', 20, 1.7)} Use Face ID</button>
      <button style="width:100%;min-height:50px;display:flex;align-items:center;justify-content:center;color:${C.meta};font-size:15px;font-weight:600">Enter PIN instead</button>
    </div>
  </div>` });

/* ── 10 · Devices ────────────────────────────────────────────────────── */
auth['AuthDevices.dc.html'] = doc({ h: 900, body: `
${topBack(`<h1 class="t" style="margin:0;font-size:19px">Devices</h1><span style="width:44px"></span>`)}
  <p style="margin:0;padding:18px 22px 20px;font-size:14.5px;line-height:1.5;color:${C.meta}">Signed in on these devices. Signing one out ends its session immediately.</p>
  <section class="el" style="margin:0 18px 22px;background:${C.card};border-radius:18px;padding:0 16px">
${[
  ['phone', 'iPhone 15 Pro', 'Mumbai · active now', true],
  ['device', 'iPad Air', 'Mumbai · 2 days ago', false],
  ['device', 'Chrome on Mac', 'Pune · 3 weeks ago', false],
].map(([i, name, sub, here], n, a) => `    <div style="display:flex;align-items:center;gap:13px;min-height:72px${n === a.length - 1 ? '' : `;border-bottom:1px solid ${C.rule}`}">
      ${avatar(i, here ? C.tealL : C.neut, here ? C.teal : C.meta, 38)}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <span style="display:flex;align-items:center;gap:8px">
          <span style="font-size:15px;font-weight:600">${name}</span>
          ${here ? `<span style="font-size:10.5px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${C.teal};background:${C.tealL};border-radius:5px;padding:2px 6px">This one</span>` : ''}
        </span>
        <span style="font-size:12.5px;color:${C.meta}">${sub}</span>
      </span>
      ${here ? '' : `<button style="min-height:44px;padding:0 12px;display:flex;align-items:center;border-radius:11px;background:${C.sunk2};color:${C.meta};font-size:13.5px;font-weight:600">Sign out</button>`}
    </div>`).join('\n')}
  </section>
  <button style="margin:0 18px;min-height:52px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:15px;background:${C.redL};color:${C.red};font-size:14.5px;font-weight:600">${ic('x', 18, 2)} Sign out everywhere else</button>` });

/* ── 11 · Recovery ───────────────────────────────────────────────────── */
auth['AuthRecovery.dc.html'] = doc({ h: 844, body: `
${topBack()}
${titleBlock('Lost access to that number?', 'Pick whichever you still have. Your data stays exactly where it is either way.', '20px 22px 22px')}
  <div style="display:flex;flex-direction:column;gap:12px;padding:0 18px">
${[
  ['mail', C.tealL, C.teal, 'Email a recovery link', 'To a•••••i@alvazarat.org', true],
  ['users', C.indigoL, C.indigo, 'Ask your household Owner', 'They can re-invite you from Household members', false],
  ['finger', C.goldL, C.gold, 'Unlock with Face ID on this phone', 'Works only on a device already signed in', false],
].map(([i, t, ti, title, sub, on]) => `    <button class="el" style="display:flex;align-items:center;gap:13px;padding:16px;border-radius:18px;background:${C.card};border:1.5px solid ${on ? C.teal : 'transparent'};text-align:left">
      ${avatar(i, t, ti, 42)}
      <span style="flex:1;display:flex;flex-direction:column;gap:3px">
        <span style="font-size:15.5px;font-weight:600">${title}</span>
        <span style="font-size:13px;line-height:1.45;color:${C.meta}">${sub}</span>
      </span>
      <span style="color:${C.faint}">${ic('chevR', 18, 2)}</span>
    </button>`).join('\n')}
  </div>
  <div style="display:flex;align-items:flex-start;gap:10px;margin:22px 18px 0;padding:14px 15px;border-radius:14px;background:${C.pollen}">
    <span style="color:${C.gold};flex:none;margin-top:1px">${ic('alert', 18, 1.9)}</span>
    <span style="flex:1;font-size:13px;line-height:1.5;color:${C.goldInk}">With no recovery email, no household and no phone still signed in, a lost number means a lost account. Adding an email takes under a minute.</span>
  </div>
${primary('Continue')}` });

  return auth;
}
