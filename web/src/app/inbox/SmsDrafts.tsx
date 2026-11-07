'use client';

import Link from '@/app/NavLink';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import SwipeRow from '../SwipeRow';
import Snack, { type SnackState } from '../Snack';
import { Icon } from '../Icon';
import { startPending } from '../pending';
import { dismissDraft, restoreDraft } from './actions';
import { DIRECTION } from './direction';
import { replacing } from '../backStack';
import { useMoney } from '@/app/currency';

/* Bank messages a phone forwarded, waiting to become entries. Never an entry on their own: Review opens Add entry
   with what the message said already filled in, and Save there is what records it. A row swipes to Add and Dismiss;
   Dismiss has fifteen minutes of Undo, like a deleted entry. */

export type SmsRow = {
  id: string; amount: number | null; direction: 'debit' | 'credit' | null; merchant: string | null;
  /** Already in words ("6 Nov"), worked out on the server so both renders agree. */
  when: string; account: string | null; last4: string | null; sender: string | null;
};


export default function SmsDrafts({ rows, canWrite, justDismissed = null, empty = null }: {
  rows: SmsRow[]; canWrite: boolean;
  /** Dismissed a moment ago on the message's own screen: offer its Undo here. */
  justDismissed?: string | null;
  /** What to say when nothing is waiting, the last row dismissed here included. */
  empty?: React.ReactNode;
}) {
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const [, start] = useTransition();
  const [snack, setSnack] = useState<SnackState>(null);
  /* The dismissal made on the message's own screen, offered for Undo here until the line goes. */
  const [offer, setOffer] = useState(justDismissed);
  const closeSnack = useCallback(() => {
    setSnack(null);
    setOffer(null);
    // The ?dismissed= comes off the address (and nothing else does), so a reload does not offer the Undo twice.
    if (justDismissed) {
      const u = new URL(window.location.href);
      u.searchParams.delete('dismissed');
      replacing(`${u.pathname}${u.search}`);
      router.replace(`${u.pathname}${u.search}`, { scroll: false });
    }
  }, [justDismissed, router]);
  const undoElsewhere = (id: string) => start(async () => {
    const back = await restoreDraft(id);
    if (back.ok) router.refresh();
    else setSnack({ text: back.error, tone: 'error' });
  });
  const line: SnackState = snack ?? (offer ? { text: 'Bank message dismissed', undo: () => undoElsewhere(offer) } : null);
  const unhide = (id: string) => setGone((g) => { const n = new Set(g); n.delete(id); return n; });
  const review = (id: string) => {
    const href = `/add?draft=${id}`;
    startPending(href);
    router.push(href);
  };

  function dismiss(r: SmsRow) {
    setGone((g) => new Set(g).add(r.id));
    start(async () => {
      const fd = new FormData();
      fd.append('id', r.id);
      const res = await dismissDraft(null, fd);
      if (!res.ok) { unhide(r.id); setSnack({ text: res.error, tone: 'error' }); return; }
      setSnack({
        text: `${r.merchant ?? 'Bank message'} dismissed`,
        undo: () => start(async () => {
          const back = await restoreDraft(r.id);
          if (back.ok) { unhide(r.id); router.refresh(); }
          else setSnack({ text: back.error, tone: 'error' });
        }),
      });
      router.refresh();
    });
  }

  const shown = rows.filter((r) => !gone.has(r.id));
  if (shown.length === 0) return <>{empty}<Snack snack={line} onClose={closeSnack} /></>;
  return (
    <section id="sms" aria-label="From SMS" className="mx-[var(--gutter)] flex flex-col gap-1.5">
      <div className="flex min-h-6 items-center justify-between gap-3 px-0.5">
        <h2 className="text-subhead font-semibold text-muted-foreground">
          {shown.length} bank {shown.length === 1 ? 'message' : 'messages'} waiting
        </h2>
        <Link href="/household/capture"
          className="-my-2.5 -mr-2 flex min-h-11 min-w-11 items-center justify-center px-2 text-body font-medium text-primary in-data-[platform=android]:min-h-12 in-data-[platform=android]:min-w-12">Set up</Link>
      </div>
      <div className="overflow-hidden rounded-[20px] bg-card shadow-card px-[var(--pad)]">
        {shown.map((r, i) => (
          <SwipeRow key={r.id} commit={false} actions={canWrite ? [
            { label: 'Add', tone: 'primary', icon: <Icon name="add" size={20} />, act: () => review(r.id) },
            { label: 'Dismiss', tone: 'danger', icon: <Icon name="close" size={20} />, act: () => dismiss(r) },
          ] : []}>
            <Row r={r} last={i === shown.length - 1} canWrite={canWrite} />
          </SwipeRow>
        ))}
      </div>
      <p className="px-0.5 text-footnote leading-relaxed text-muted-foreground">
        {canWrite
          ? 'Review opens a new entry with what the message said. Nothing is recorded until you save it.'
          : 'Only owners and contributing members can turn these into entries.'}
      </p>
      <Snack snack={line} onClose={closeSnack} />
    </section>
  );
}

function Row({ r, last, canWrite }: { r: SmsRow; last: boolean; canWrite: boolean }) {
  // A list row, so static (CLAUDE.md, Figures: lists stay static).
  const { format } = useMoney();
  const d = DIRECTION[r.direction ?? 'none'];
  const where = r.account ?? (r.last4 ? `Account ending ${r.last4}` : null);
  return (
    <div className={`flex min-h-[76px] items-center gap-3 py-2.5 ${last ? '' : 'border-b border-border'}`}>
      <Link href={`/inbox/sms/${r.id}`} draggable={false}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-foreground no-underline in-data-[platform=android]:min-h-12">
        <span className={`grid size-10 flex-none place-items-center rounded-[12px] ${d.tone}`}>
          <Icon name={d.icon} size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-medium [overflow-wrap:anywhere]">
            {r.amount !== null
              ? <><span className="tabular-nums">{format(r.amount, { paise: 'auto' })}</span>{r.merchant ? ` · ${r.merchant}` : ''}</>
              : <>Amount not found{r.merchant ? ` · ${r.merchant}` : ''}</>}
          </span>
          <span className="text-footnote text-muted-foreground">{d.word} · {r.when}</span>
          {(where || r.sender) && (
            <span className="text-footnote text-muted-foreground [overflow-wrap:anywhere]">
              {[where, r.sender ? `from ${r.sender}` : null].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
      </Link>
      {canWrite && (
        <Link href={`/add?draft=${r.id}`}
          className="press flex min-h-11 flex-none items-center rounded-full bg-primary px-4 text-body font-semibold text-primary-foreground in-data-[platform=android]:min-h-12">
          Review
        </Link>
      )}
    </div>
  );
}
