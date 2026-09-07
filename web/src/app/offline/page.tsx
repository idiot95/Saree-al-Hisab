export const metadata = { title: 'No connection · Quiet Ledger' };
import Screen from '../Screen';

/* Shown by the service worker when a navigation cannot reach the server. It is
   static on purpose: it must render with no session, no database and no
   network, which is the one moment it is needed. */
export default function Offline() {
  return (
    <Screen>
      <main style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 15, padding: '40px 32px', textAlign: 'center',
        background: 'var(--c-bg)', color: 'var(--c-ink)',
      }}>
        <span style={{
          width: 70, height: 70, borderRadius: 999, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 3l18 18" /><path d="M8.8 15.2a4.5 4.5 0 0 1 6.4 0" />
            <path d="M5.5 11.8a9 9 0 0 1 3.2-2.1M18.5 11.8a9 9 0 0 0-4.8-2.4" />
            <path d="M2.5 8.4A14 14 0 0 1 7 5.7M21.5 8.4a14 14 0 0 0-8.6-3.6" />
            <path d="M12 19.5v.01" />
          </svg>
        </span>
        <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.016em' }}>
          No connection
        </h1>
        <p style={{
          margin: 0, fontSize: 'var(--step-0)', lineHeight: 1.55, color: 'var(--c-meta)', maxWidth: '31ch',
        }}>
          Your books live on the server, so they need a signal to open. Nothing has been lost —
          try again once you are back online.
        </p>
        <a href="/" style={{
          minHeight: 50, padding: '0 22px', display: 'flex', alignItems: 'center',
          borderRadius: 14, textDecoration: 'none', fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-ink)',
        }}>Try again</a>
      </main>
    </Screen>
  );
}
