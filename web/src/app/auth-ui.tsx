/* Shared furniture for the four screens that stand between someone and the
   books. No hooks here on purpose, so the same pieces work in a server page
   and inside a client form. */

import { CURRENCIES } from '@/lib/money';

/* The one header background, used by every screen that has one.

   It used to carry a repeating 1px line every 26px, meant to read as ruled
   ledger paper. On a phone it read as banding across the header instead, so it
   is gone. A soft highlight and the gradient are the whole thing now. */
/* Each section of the app gets its own header colour.

   One dark teal on twelve screens made every one look like the last, which is
   the complaint that prompted this: you could not tell at a glance which part
   of the app you were in. The base stays dark so white text keeps working —
   every accent below was measured against white and the worst is 6.32:1,
   comfortably past the 4.5:1 that body text needs.

   The hue carries meaning where there is meaning to carry: money owed is
   pumpkin, the same colour as over-budget; savings and net worth are green. */
const ACCENT: Record<string, [string, string, string]> = {
  /* Every hero used to run from dark to slightly darker: all three stops sat
     between 2% and 8% relative luminance, so the gradient was invisible and
     the hero read as one flat slab of near-black. A page then had two levels —
     dark block, pale content — and nothing in between, which is what "cannot
     distinguish visual hierarchy" means. The lightest stop is now genuinely
     lit and the darkest genuinely deep, so the hero has a form and a light
     source. Every top stop still clears 4.5:1 against the white text on it,
     and scripts/contrast.test.mjs measures each one rather than trusting it. */
  //         lit           middle       deep
  teal:    ['#3A6B82', '#26485A', '#152833'],
  gold:    ['#8E5B14', '#603C0C', '#372206'],
  indigo:  ['#4B52A8', '#2F3470', '#1B1E42'],
  blue:    ['#2A6E9B', '#1A4664', '#102D43'],
  green:   ['#327C5C', '#215741', '#14392A'],
  purple:  ['#763D82', '#4B2754', '#2E1733'],
  pumpkin: ['#A94C19', '#73310F', '#461D08'],
  cyan:    ['#22797E', '#134E51', '#0C3234'],
  slate:   ['#4E606A', '#313D45', '#1F272C'],
};

export type Accent = keyof typeof ACCENT;

export function headerBg(accent: Accent = 'teal'): string {
  const [a, b, c] = ACCENT[accent] ?? ACCENT.teal;
  /* Three layers: a light source off the top-right corner, a deepening at the
     bottom edge so the hero's rounded corners read as a lifted surface rather
     than a crop, and the ramp itself. */
  return 'radial-gradient(115% 90% at 80% -16%, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 56%),'
    + 'radial-gradient(120% 70% at 20% 118%, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 60%),'
    + `linear-gradient(158deg,${a} 0%,${b} 54%,${c} 100%)`;
}

/** The default, kept so screens that have not chosen an accent still work. */
export const HEADER_BG = headerBg('teal');

export const primaryBtn: React.CSSProperties = {
  width: '100%', minHeight: 56, borderRadius: 15, fontSize: 'var(--step-1)', fontWeight: 600, color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  background:
    'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),'
    + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
};

export const quietBtn: React.CSSProperties = {
  width: '100%', minHeight: 52, borderRadius: 15, fontSize: 'var(--step-0)', fontWeight: 600,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  background: 'var(--c-card)', color: 'var(--c-ink)', border: '1px solid var(--c-border)',
  textDecoration: 'none',
};

export function AuthShell({ kicker, title, blurb, children }: {
  kicker?: string; title: React.ReactNode; blurb?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      background: 'var(--c-bg)', color: 'var(--c-ink)',
    }}>
      <div className="el2" style={{
        background: HEADER_BG, color: '#fff', borderRadius: '0 0 30px 30px',
        padding: '52px 24px 38px', display: 'flex', flexDirection: 'column', gap: 13,
      }}>
        <span style={{
          width: 50, height: 50, borderRadius: 15, background: 'rgba(255,255,255,.16)',
          border: '1px solid rgba(255,255,255,.24)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width={25} height={25} viewBox="0 0 24 24" fill="none" stroke="#fff"
            strokeWidth={1.8} strokeLinecap="round" aria-hidden>
            <path d="M4 6.5h16" /><path d="M7 12h10" /><path d="M10 17.5h4" />
          </svg>
        </span>
        {kicker && (
          <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'rgba(255,255,255,.78)' }}>{kicker}</p>
        )}
        <h1 className="t" style={{
          margin: 0, fontSize: 'var(--step-4)', lineHeight: 1.08, letterSpacing: '-.02em', textWrap: 'balance',
        }}>{title}</h1>
        {blurb && (
          <p style={{ margin: 0, fontSize: 'var(--step-0)', lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
            {blurb}
          </p>
        )}
      </div>
      {children}
    </main>
  );
}

export function Field({ label, name, type = 'text', hint, ...rest }: {
  label: string; name: string; type?: string; hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>{label}</span>
      <input
        name={name} type={type}
        style={{
          minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
          background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--field)',
          padding: '0 14px', width: '100%',
        }}
        {...rest}
      />
      {hint && (
        <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>{hint}</span>
      )}
    </label>
  );
}

/** Which currency a household keeps its books in. A native select on
 *  purpose: eighteen options is a wheel on a phone, not a list of chips. The
 *  symbol leads so the eye can find "₹" or "$" without reading. */
export function CurrencyField({ defaultValue = 'INR', hint, ...rest }: {
  defaultValue?: string; hint?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Currency</span>
      <select name="currency" defaultValue={defaultValue} style={{
        minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
        background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--field)',
        padding: '0 14px', width: '100%', appearance: 'auto',
      }} {...rest}>
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>{c.symbol.trim()}  {c.name} · {c.code}</option>
        ))}
      </select>
      {hint && (
        <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>{hint}</span>
      )}
    </label>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" style={{
      margin: 0, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px',
      borderRadius: 13, background: 'var(--c-danger-tint)', color: 'var(--c-danger)',
      fontSize: 'var(--step--1)', lineHeight: 1.5, fontWeight: 600,
    }}>
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={2} strokeLinecap="round" style={{ flex: 'none', marginTop: 2 }} aria-hidden>
        <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.4v.1" />
      </svg>
      {children}
    </p>
  );
}

/** The one thing every dead end has in common: it tells you what to do next. */
export function DeadEnd({ title, body, cta }: {
  title: string; body: string; cta?: { href: string; label: string };
}) {
  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 14, padding: '40px 34px', textAlign: 'center',
      background: 'var(--c-bg)', color: 'var(--c-ink)',
    }}>
      <span style={{
        width: 68, height: 68, borderRadius: 999, background: 'var(--c-sunk)',
        color: 'var(--c-meta)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={1.6} strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="8.6" /><path d="M12 7.6V13" /><path d="M12 16.4v.1" />
        </svg>
      </span>
      <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.016em' }}>{title}</h1>
      <p style={{
        margin: 0, fontSize: 'var(--step-0)', lineHeight: 1.55, color: 'var(--c-meta)', maxWidth: '32ch',
      }}>{body}</p>
      {cta && (
        <a href={cta.href} style={{ ...quietBtn, width: 'auto', padding: '0 22px', marginTop: 8 }}>
          {cta.label}
        </a>
      )}
    </main>
  );
}

/** Enough for the person invited to recognise their own address, not enough
 *  for whoever finds the link to learn someone else's. */
export function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, Math.min(2, local.length))}${'•'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}
