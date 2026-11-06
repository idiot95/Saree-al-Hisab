'use client';

import Link from '@/app/NavLink';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import SwipeRow from '../SwipeRow';
import Snack, { type SnackState } from '../Snack';
import { Icon } from '../Icon';
import { Figure } from '../Figure';
import { Label } from '../PageHead';
import { startPending } from '../pending';
import { dismissDraft, restoreDraft } from './actions';
import { DIRECTION } from './direction';

/* Bank messages a phone forwarded, waiting to become entries. Never an entry on their own: Review opens Add entry
   with what the message said already filled in, and Save there is what records it. A row swipes to Add and Dismiss;
   Dismiss has fifteen minutes of Undo, like a deleted entry. */

export type SmsRow = {
  id: string; amount: number | null; direction: 'debit' | 'credit' | null; merchant: string | null;
  /** Already in words ("6 Nov"), worked out on the server so both renders agree. */
  when: string; account: string | null; last4: string | null; sender: string | null;
};


export default function SmsDrafts({ rows, canWrite, justDismissed = null }: {
  rows: SmsRow[]; canWrite: boolean;
  /** Dismissed a moment ago on the message's own screen: offer its Undo here. */
  justDismissed?: string | null;
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
    // The ?dismissed= comes off the address, so a reload does not offer the Undo twice.
    if (justDismissed) router.replace('/inbox', { scroll: false });
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
    router.push(href, { transitionTypes: ['nav-forward'] });
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
  if (shown.length === 0) return <Snack snack={line} onClose={closeSnack} />;
  return (
    <section id="sms" aria-label="From SMS" className="mx-[var(--gutter)] mb-5 flex flex-col gap-2">
      <Label action={<Link href="/household/capture" transitionTypes={['nav-forward']}
        className="-mr-2 flex min-h-11 min-w-11 items-center justify-center px-2 text-xs font-semibold text-primary in-data-[platform=android]:min-h-12 in-data-[platform=android]:min-w-12">Set up</Link>}>
        From SMS · {shown.length}
      </Label>
      <div className="overflow-hidden rounded-2xl border border-border bg-card px-[var(--pad)]">
        {shown.map((r, i) => (
          <SwipeRow key={r.id} commit={false} actions={canWrite ? [
            { label: 'Add', tone: 'primary', icon: <Icon name="add" size={20} />, act: () => review(r.id) },
            { label: 'Dismiss', tone: 'danger', icon: <Icon name="close" size={20} />, act: () => dismiss(r) },
          ] : []}>
            <Row r={r} last={i === shown.length - 1} canWrite={canWrite} />
          </SwipeRow>
        ))}
      </div>
      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        {canWrite
          ? 'Review opens a new entry with what the message said. Nothing is recorded until you save it.'
          : 'Only owners and contributing members can turn these into entries.'}
      </p>
      <Snack snack={line} onClose={closeSnack} />
    </section>
  );
}

function Row({ r, last, canWrite }: { r: SmsRow; last: boolean; canWrite: boolean }) {
  const d = DIRECTION[r.direction ?? 'none'];
  const where = r.account ?? (r.last4 ? `Account ending ${r.last4}` : null);
  return (
    <div className={`flex min-h-[84px] items-center gap-3 py-3 ${last ? '' : 'border-b border-border'}`}>
      <Link href={`/inbox/sms/${r.id}`} transitionTypes={['nav-forward']} draggable={false}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-foreground no-underline in-data-[platform=android]:min-h-12">
        <span className={`grid size-10 flex-none place-items-center rounded-[11px] ${d.tone}`}>
          <Icon name={d.icon} size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold [overflow-wrap:anywhere]">
            {r.amount !== null
              ? <><Figure minor={r.amount} paise="auto" className="tabular-nums" />{r.merchant ? ` · ${r.merchant}` : ''}</>
              : <>Amount not found{r.merchant ? ` · ${r.merchant}` : ''}</>}
          </span>
          <span className="text-sm text-muted-foreground">{d.word} · {r.when}</span>
          {(where || r.sender) && (
            <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {[where, r.sender ? `from ${r.sender}` : null].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
      </Link>
      {canWrite && (
        <Link href={`/add?draft=${r.id}`} transitionTypes={['nav-forward']}
          className="press flex min-h-11 flex-none items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground in-data-[platform=android]:min-h-12">
          Review
        </Link>
      )}
    </div>
  );
}
