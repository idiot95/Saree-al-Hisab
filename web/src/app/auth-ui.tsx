/* Shared furniture for the four screens that stand between someone and the
   books. No hooks here on purpose, so the same pieces work in a server page
   and inside a client form. */

/* The one header background, used by every screen that has one.

   It used to carry a repeating 1px line every 26px, meant to read as ruled
   ledger paper. On a phone it read as banding across the header instead, so it
   is gone. A soft highlight and the gradient are the whole thing now. */
export const HEADER_BG =
  'radial-gradient(130% 85% at 82% -12%, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 62%),'
  + 'linear-gradient(150deg,#2C5063 0%,#233D4D 58%,#172B37 100%)';

export const primaryBtn: React.CSSProperties = {
  width: '100%', minHeight: 56, borderRadius: 15, fontSize: 16.5, fontWeight: 600, color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  background:
    'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),'
    + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
};

export const quietBtn: React.CSSProperties = {
  width: '100%', minHeight: 52, borderRadius: 15, fontSize: 15.5, fontWeight: 600,
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
          <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,.78)' }}>{kicker}</p>
        )}
        <h1 className="t" style={{
          margin: 0, fontSize: 33, lineHeight: 1.08, letterSpacing: '-.02em', textWrap: 'balance',
        }}>{title}</h1>
        {blurb && (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
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
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)' }}>{label}</span>
      <input
        name={name} type={type}
        style={{
          minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
          background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 16,
          padding: '0 14px', width: '100%',
        }}
        {...rest}
      />
      {hint && (
        <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--c-meta)' }}>{hint}</span>
      )}
    </label>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" style={{
      margin: 0, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px',
      borderRadius: 13, background: 'var(--c-danger-tint)', color: 'var(--c-danger)',
      fontSize: 13.5, lineHeight: 1.5, fontWeight: 600,
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
      <h1 className="t" style={{ margin: 0, fontSize: 24, letterSpacing: '-.016em' }}>{title}</h1>
      <p style={{
        margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--c-meta)', maxWidth: '32ch',
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
