'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { Chip } from '../Icon';
import SwipeRow from '../SwipeRow';
import Snack, { type SnackState } from '../Snack';
import { format } from '@/lib/money';
import { removeEntry, restoreEntry } from './actions';

export type Row = {
  id: string; kind: string; amount: string; merchant: string | null;
  category: string | null; method: string | null; account: string;
  counter_account: string | null; icon: string | null; tint: string | null; is_shared: boolean;
  /* A cost laid out for several people on a tab is several loans underneath
     and one line here. `rows` says how many, `people` who it went to. Such a
     line opens its tab rather than a single row of it, and is not swipeable:
     editing one loan of three would leave the payment adding up to nothing. */
  rows: number; people: string | null; book_id: string | null;
  to_person: boolean; from_person: boolean; lent: string;
};

const MOVES = new Set(['transfer', 'card_payment']);
const INCOMING = new Set(['income', 'claim_receipt', 'refund']);

/* The month's entries, a card per day. Tap a row to open it; swipe it left
   for Edit and Delete, and all the way across to delete in one move. Delete
   is soft in the database and undoable on the screen, so it can afford to be
   one gesture with no dialog in front of it. */
export default function EntryList({ days, canEdit }: {
  days: { on: string; label: string; rows: Row[] }[]; canEdit: boolean;
}) {
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const [snack, setSnack] = useState<SnackState>(null);
  const [, start] = useTransition();
  const closeSnack = useCallback(() => setSnack(null), []);

  const unhide = (id: string) => setGone((g) => { const n = new Set(g); n.delete(id); return n; });

  function del(e: Row) {
    setGone((g) => new Set(g).add(e.id));
    start(async () => {
      const r = await removeEntry(e.id);
      if (!r.ok) { unhide(e.id); setSnack({ text: r.error, tone: 'error' }); return; }
      const what = e.merchant || e.category || (MOVES.has(e.kind) ? 'Transfer' : 'Entry');
      setSnack({
        text: `${what} · ${format(Number(e.amount))} deleted`,
        undo: () => start(async () => {
          const back = await restoreEntry(e.id);
          if (back.ok) unhide(e.id);
          else setSnack({ text: back.error, tone: 'error' });
        }),
      });
    });
  }

  return (
    <div style={{ padding: '18px 0 0' }}>
      {days.map((d) => {
        const rows = d.rows.filter((e) => !gone.has(e.id));
        if (rows.length === 0) return null;
        return (
          <section key={d.on} style={{ marginBottom: 18 }}>
            <h2 style={{
              margin: '0 var(--gutter) 8px', fontSize: 'var(--step--1)', fontWeight: 700, letterSpacing: '.03em',
              color: 'var(--c-meta)',
            }}>{d.label}</h2>
            <div className="el card" style={{
              margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 16,
              padding: '0 var(--pad)', overflow: 'hidden',
            }}>
              {rows.map((e, i) => (
                <SwipeRow key={e.id} actions={canEdit && e.rows === 1 ? [
                  { label: 'Edit', tone: 'primary', icon: <Pen />,
                    act: () => router.push(`/entries/${e.id}`, { transitionTypes: ['nav-forward'] }) },
                  { label: 'Delete', tone: 'danger', icon: <Bin />, act: () => del(e) },
                ] : []}>
                  <Entry e={e} last={i === rows.length - 1} />
                </SwipeRow>
              ))}
            </div>
          </section>
        );
      })}
      <Snack snack={snack} onClose={closeSnack} />
    </div>
  );
}

function Entry({ e, last }: { e: Row; last: boolean }) {
  const move = MOVES.has(e.kind);
  const incoming = INCOMING.has(e.kind);
  const lent = e.to_person;
  const cameBack = e.from_person && !e.to_person;
  const part = Number(e.lent) < Number(e.amount);
  const href = e.rows > 1 && e.book_id ? `/tab/${e.book_id}` : `/entries/${e.id}`;
  return (
    <Link href={href} transitionTypes={['nav-forward']} draggable={false} style={{
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 68,
      textDecoration: 'none', color: 'var(--c-ink)',
      borderBottom: last ? undefined : '1px solid var(--c-rule)',
    }}>
      {move && !lent ? (
        <span style={{
          width: 38, height: 38, flex: 'none', borderRadius: 11, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 8h13l-3-3M17 16H4l3 3" />
          </svg>
        </span>
      ) : (
        <Chip icon={e.icon} tint={e.tint} size={38} />
      )}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 'var(--step-0)', fontWeight: 600, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {cameBack
            ? `Came back from ${e.people ?? 'them'}`
            : e.merchant || e.category || (lent ? 'Laid out' : move ? 'Transfer' : 'Entry')}
        </span>
        <span style={{
          fontSize: 'var(--step--2)', color: 'var(--c-meta)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {lent
            ? `${part ? `${format(Number(e.lent))} of it ` : ''}lent to ${e.people ?? 'them'}`
              + (e.category ? ` · ${e.category}` : '')
            : cameBack
              ? `into ${e.counter_account ?? e.account}`
            : move && e.counter_account
              ? `${e.account} → ${e.counter_account}`
              : [e.category, e.method].filter(Boolean).join(' · ')}
          {e.is_shared && !lent && ' · shared'}
        </span>
      </span>
      <span className="t amt" style={{
        fontSize: 'var(--step-0)', letterSpacing: '-.01em',
        color: incoming || cameBack ? 'var(--c-ok)'
          : move && !lent ? 'var(--c-meta)' : 'var(--c-ink)',
      }}>
        {incoming || cameBack ? '+' : ''}{format(Number(e.amount))}
      </span>
    </Link>
  );
}

function Pen() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M13.5 6.5l3 3" />
    </svg>
  );
}
function Bin() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16" /><path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
    </svg>
  );
}
