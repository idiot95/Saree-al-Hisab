import { notFound, redirect } from 'next/navigation';
import { actorOrNull, reconcileAccount } from '@/db/queries';
import { format } from '@/lib/money';
import { Icon } from '../../../Icon';
import PageHead from '../../../PageHead';
import Screen from '../../../Screen';
import { BACK_SPACE } from '../../../tabs';
import Reconcile, { UndoLatest } from './Reconcile';
import { Figure } from '../../../Figure';

export const metadata = { title: 'Reconcile · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = (iso: string, year = false) => new Date(`${iso}T00:00:00`)
  .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });

/* One account against one statement. The screen is the working: what the
   statement says, what the ticked entries add up to, and the difference —
   which is zero before it will finish, unless the person chooses to record
   what is left as an adjustment. Past statements sit underneath, the latest
   with an Undo. */
export default async function ReconcileAccount({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }>;
}) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { done } = await searchParams;

  const data = await reconcileAccount(actor.household_id, id);
  if (!data) notFound();
  const { account, entries, history } = data;
  const credit = account.kind === 'credit';
  const canWrite = actor.role !== 'viewer';
  const today = new Date().toISOString().slice(0, 10);
  const last = history[0] ?? null;
  const justDone = done && last && last.id === done ? last : null;

  const bal = Number(account.balance);
  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: BACK_SPACE }}>
        <PageHead back="/accounts/reconcile" eyebrow="Reconcile"
          title={<>{account.name}{account.last4 ? ` · ${account.last4}` : ''}</>}
          sub={last
            ? `Last matched to the ${day(last.on, true)} statement`
            : 'Never matched. The first match starts from the balance this account was opened with.'} />

        <div className="flex flex-col gap-5 pb-8">
          {/* What the books say today: a Figure, so it rolls when a match records an adjustment or an Undo takes
              one away. */}
          <section aria-label="In the books today" className="mx-[var(--gutter)] flex flex-col gap-1.5 rounded-[22px] bg-card shadow-card p-4">
            <span className="text-subhead text-muted-foreground">
              {credit ? (bal < 0 ? 'Owed on the card today' : 'In credit today') : bal < 0 ? 'Overdrawn today' : 'In the books today'}
            </span>
            <Figure minor={Math.abs(bal)} className="text-large-title font-bold leading-none tracking-tight tabular-nums" />
          </section>

          {justDone && (
            <p role="status" className="mx-[var(--gutter)] flex items-start gap-2 rounded-xl bg-accent px-3.5 py-3 text-body font-semibold leading-normal text-accent-foreground">
              <Icon name="check_circle" size={18} className="mt-px" />
              <span className="min-w-0 flex-1">
                Matched to the {day(justDone.on, true)} statement — {justDone.entries} {justDone.entries === 1 ? 'entry' : 'entries'} ticked off
                {justDone.adjustment ? `, and a ${format(Math.abs(Number(justDone.adjustment)))} adjustment recorded` : ''}.
              </span>
            </p>
          )}

          {canWrite ? (
            /* Keyed by the latest match, so a Finish (or an Undo) redraws the form from scratch: the statement, the ticks
             and the DOM start again together instead of carrying the last statement's figure. */
            <Reconcile key={last?.id ?? 'none'}
              accountId={account.id} credit={credit} today={today} lastOn={last?.on ?? null}
              cleared={Number(account.cleared)}
              entries={entries.map((e) => ({ id: e.id, on: e.on, what: e.what, via: e.via, signed: Number(e.signed) }))}
            />
          ) : (
            <p className="mx-[var(--gutter)] flex items-start gap-1.5 text-subhead text-muted-foreground">
              <Icon name="lock" size={16} className="mt-px" />
              Only owners and contributing members can reconcile accounts.
            </p>
          )}

          {history.length > 0 && (
            <section aria-labelledby="sec-matched" className="flex flex-col gap-1.5 px-[var(--gutter)]">
              <h2 id="sec-matched" className="px-0.5 text-subhead font-semibold text-muted-foreground">Statements matched</h2>
              <ul className="overflow-hidden rounded-[20px] bg-card shadow-card">
                {history.map((r, i) => (
                  <li key={r.id} className="flex min-h-16 items-center gap-3 border-b border-border px-[var(--pad)] py-2.5 last:border-b-0">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-body font-semibold">{day(r.on, true)}</span>
                      <span className="text-subhead leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                        {r.entries} {r.entries === 1 ? 'entry' : 'entries'}
                        {r.adjustment ? ` · adjusted ${Number(r.adjustment) > 0 ? '+' : '−'}${format(Math.abs(Number(r.adjustment)))}` : ''}
                        {r.who ? ` · ${r.who}` : ''}
                      </span>
                    </span>
                    <span className="flex flex-none flex-col items-end gap-0.5">
                      <span className="text-body font-semibold tabular-nums">{format(Math.abs(Number(r.balance)))}</span>
                      {credit && <span className="text-footnote text-muted-foreground">{Number(r.balance) < 0 ? 'owed' : 'in credit'}</span>}
                    </span>
                    {canWrite && i === 0 && <UndoLatest id={r.id} />}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </Screen>
  );
}
