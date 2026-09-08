'use client';

import { useEffect, useSyncExternalStore } from 'react';
import AddEntry from '../add/AddEntry';
import { subscribe, snapshotPickers, snapshotQueue, nothing, none, dequeue, type Queued } from '../add/queue';
import { useMoney } from '@/app/currency';
import { haptic } from '../haptics';
import { forcedTheme, THEME_COOKIE } from '@/lib/theme';

/* What the app is when there is no signal.

   Before: a page that said "no connection, try again" — true, and useless at
   the till, which is the one place an entry is most worth writing down. Now
   it is Add Entry, drawn from the names the phone kept the last time the
   form was opened online, and every save goes to the phone's queue. The
   layout sends the queue the moment signal returns.

   Everything on this screen is read from the phone AFTER the page has come
   up: the page itself is a cached shell holding nothing, because a cached
   page with household data in it would be household data on disk. */

const localToday = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function OfflineScreen() {
  const pickers = useSyncExternalStore(subscribe, snapshotPickers, nothing);
  const queue = useSyncExternalStore(subscribe, snapshotQueue, none);

  /* The shell was cached without cookies, so the layout could not stamp the
     chosen scheme on it. The cookie is still on the phone; read it here so a
     dark ledger does not flash light at the till. */
  useEffect(() => {
    const raw = document.cookie.split('; ').find((c) => c.startsWith(`${THEME_COOKIE}=`));
    const forced = forcedTheme(raw?.slice(THEME_COOKIE.length + 1));
    if (!forced) return;
    document.documentElement.dataset.theme = forced;
    document.documentElement.style.colorScheme = forced;
  }, []);

  const ways = pickers?.ways ?? [];
  if (!pickers || ways.length === 0) return <Bare queue={queue} />;

  return (
    <AddEntry offline
      categories={pickers.categories} ways={ways}
      tabs={pickers.tabs ?? []}
      householdId={pickers.householdId} today={localToday()}
      onQueued={() => { /* the store's own event re-renders the list below */ }}
    >
      <Banner />
      <Pending queue={queue} />
    </AddEntry>
  );
}

function Banner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, margin: '0 var(--gutter) 12px',
      padding: '12px 15px', borderRadius: 14, background: 'var(--c-sunk2)', color: 'var(--c-meta)',
      fontSize: 'var(--step--1)', fontWeight: 600, lineHeight: 1.4,
    }}>
      <NoSignal size={18} />
      <span style={{ flex: 1 }}>
        No connection. Entries saved here stay on this phone and go into the books when signal
        is back.
      </span>
      {/* A real navigation, not a client-side one: the service worker
          answers it from the network if there is one, and with this page
          again if there is not. A <Link> would only fetch a payload. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" style={{
        minHeight: 44, padding: '0 10px', display: 'flex', alignItems: 'center', flex: 'none',
        textDecoration: 'none', color: 'var(--c-teal)', fontWeight: 700,
      }}>Retry</a>
    </div>
  );
}

function Pending({ queue }: { queue: Queued[] }) {
  const { format } = useMoney();
  if (queue.length === 0) return null;
  return (
    <section aria-label="Waiting to be sent" className="el card" style={{
      margin: '0 var(--gutter) 12px', background: 'var(--c-card)', borderRadius: 16, padding: '0 16px',
    }}>
      <p style={{
        margin: 0, padding: '12px 0 4px', fontSize: 'var(--step--2)', fontWeight: 700,
        letterSpacing: '.04em', color: 'var(--c-meta)',
      }}>
        WAITING FOR SIGNAL · {queue.length}
      </p>
      {queue.map((q, i) => (
        <div key={q.clientRef} style={{
          display: 'flex', alignItems: 'center', gap: 10, minHeight: 52,
          borderBottom: i === queue.length - 1 ? undefined : '1px solid var(--c-rule)',
        }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {q.kind === 'income' ? 'Income' : q.kind === 'transfer' ? 'Transfer' : (q.merchant || 'Expense')}
              <span style={{ color: 'var(--c-meta)', fontWeight: 500 }}> · {q.occurredOn}</span>
            </span>
            {q.stuck && (
              <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-danger)' }}>Not accepted: {q.stuck}</span>
            )}
          </span>
          <span className="t n" style={{ fontSize: 'var(--step-0)' }}>{format(q.amountMinor)}</span>
          <button type="button" aria-label={`Discard ${format(q.amountMinor)}`}
            onClick={() => { haptic('select'); dequeue(q.clientRef); }} style={{
              width: 44, height: 44, marginRight: -10, borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--c-meta)',
            }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      ))}
    </section>
  );
}

/* Nothing kept on this phone yet: the form cannot be offered, because it
   would have no categories to offer. Say what would make it work next time. */
function Bare({ queue }: { queue: Queued[] }) {
  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 15, padding: '40px 32px', textAlign: 'center',
      background: 'var(--c-bg)', color: 'var(--c-ink)',
    }}>
      <span style={{
        width: 70, height: 70, borderRadius: 999, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--c-sunk)', color: 'var(--c-meta)',
      }}>
        <NoSignal size={32} />
      </span>
      <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.016em' }}>
        No connection
      </h1>
      <p style={{
        margin: 0, fontSize: 'var(--step-0)', lineHeight: 1.55, color: 'var(--c-meta)', maxWidth: '31ch',
      }}>
        Your books live on the server, so they need a signal to open. Nothing has been lost.
        Open Add Entry once while online, and from then on entries can be written here
        without a signal and sent when it returns.
      </p>
      {queue.length > 0 && (
        <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
          {queue.length === 1 ? 'One entry is' : `${queue.length} entries are`} waiting on this phone to be sent.
        </p>
      )}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" style={{
        minHeight: 50, padding: '0 22px', display: 'flex', alignItems: 'center',
        borderRadius: 14, textDecoration: 'none', fontSize: 'var(--step-0)', fontWeight: 600,
        background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-ink)',
      }}>Try again</a>
    </main>
  );
}

function NoSignal({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
      <path d="M3 3l18 18" /><path d="M8.8 15.2a4.5 4.5 0 0 1 6.4 0" />
      <path d="M5.5 11.8a9 9 0 0 1 3.2-2.1M18.5 11.8a9 9 0 0 0-4.8-2.4" />
      <path d="M2.5 8.4A14 14 0 0 1 7 5.7M21.5 8.4a14 14 0 0 0-8.6-3.6" />
      <path d="M12 19.5v.01" />
    </svg>
  );
}
