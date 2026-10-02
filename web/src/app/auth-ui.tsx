/* Shared furniture for the four screens that stand between someone and the
   books. No hooks here on purpose, so the same pieces work in a server page
   and inside a client form. */

import { CURRENCIES } from '@/lib/money';

/* The one header background, used by every screen that has one.

   It used to carry a repeating 1px line every 26px, meant to read as ruled
   ledger paper. On a phone it read as banding across the header instead, so it
   is gone. A soft highlight and the gradient are the whole thing now. */

/* Quiet Ledger: the one filled button is flat navy. The gradients went with the coloured headers. */
export const primaryBtn: React.CSSProperties = {
  width: '100%', minHeight: 54, borderRadius: 14, fontSize: 'var(--step-0)', fontWeight: 600,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  background: 'var(--primary)', color: 'var(--primary-foreground)',
};

export const quietBtn: React.CSSProperties = {
  width: '100%', minHeight: 52, borderRadius: 15, fontSize: 'var(--step-0)', fontWeight: 600,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)',
  textDecoration: 'none',
};

export function AuthShell({ kicker, title, blurb, children }: {
  kicker?: string; title: React.ReactNode; blurb?: React.ReactNode; children: React.ReactNode;
}) {
  /* Paper, the app's mark, and the serif title: the same first impression the screens behind it make. */
  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      background: 'var(--background)', color: 'var(--foreground)',
    }}>
      <div style={{ padding: '48px 24px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* The app's own icon — the letter ح traced once from Noto Naskh (scripts/make-icons.mjs) — not a font
            fallback's guess at it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={48} height={48} style={{ borderRadius: 14 }} />
        {kicker && <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--muted-foreground)' }}>{kicker}</p>}
        <h1 className="font-display" style={{
          margin: 0, fontSize: 36, fontWeight: 400, lineHeight: 1.08, textWrap: 'balance',
        }}>{title}</h1>
        {blurb && (
          <p style={{ margin: 0, fontSize: 'var(--step-0)', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
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
      <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--muted-foreground)' }}>{label}</span>
      <input
        name={name} type={type}
        style={{
          minHeight: 52, borderRadius: 13, border: '1px solid var(--border)',
          background: 'var(--card)', color: 'var(--foreground)', fontSize: 'var(--field)',
          padding: '0 14px', width: '100%',
        }}
        {...rest}
      />
      {hint && (
        <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--muted-foreground)' }}>{hint}</span>
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
      <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--muted-foreground)' }}>Currency</span>
      <select name="currency" defaultValue={defaultValue} style={{
        minHeight: 52, borderRadius: 13, border: '1px solid var(--border)',
        background: 'var(--card)', color: 'var(--foreground)', fontSize: 'var(--field)',
        padding: '0 14px', width: '100%', appearance: 'auto',
      }} {...rest}>
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>{c.symbol.trim()}  {c.name} · {c.code}</option>
        ))}
      </select>
      {hint && (
        <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--muted-foreground)' }}>{hint}</span>
      )}
    </label>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" style={{
      margin: 0, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px',
      borderRadius: 13, background: 'color-mix(in srgb, var(--destructive) 12%, transparent)', color: 'var(--destructive)',
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
      background: 'var(--background)', color: 'var(--foreground)',
    }}>
      <span style={{
        width: 68, height: 68, borderRadius: 999, background: 'var(--muted)',
        color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={1.6} strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="8.6" /><path d="M12 7.6V13" /><path d="M12 16.4v.1" />
        </svg>
      </span>
      <h1 className="font-display" style={{ margin: 0, fontSize: 32, fontWeight: 400 }}>{title}</h1>
      <p style={{
        margin: 0, fontSize: 'var(--step-0)', lineHeight: 1.55, color: 'var(--muted-foreground)', maxWidth: '32ch',
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
