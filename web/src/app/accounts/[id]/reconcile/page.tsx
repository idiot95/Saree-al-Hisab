import Link from '@/app/NavLink';
import { notFound, redirect } from 'next/navigation';
import { actorOrNull, reconcileAccount } from '@/db/queries';
import { format } from '@/lib/money';
import { headerBg } from '../../../auth-ui';
import { Icon } from '../../../Icon';
import Screen from '../../../Screen';
import Back from '../../../Back';
import { BACK_SPACE } from '../../../tabs';
import Reconcile, { UndoLatest } from './Reconcile';

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

  return (
    <Screen>
      <Back to="/accounts/reconcile" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: BACK_SPACE }}>
        <header className="el2" style={{
          background: headerBg('blue'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 24px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <Link href="/accounts/reconcile" transitionTypes={['nav-back']} aria-label="Back" style={{
            width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
          }}>
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'rgba(255,255,255,.72)' }}>Reconcile</p>
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
            {account.name}{account.last4 ? ` · ${account.last4}` : ''}
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
            {last
              ? `Last matched to the ${day(last.on, true)} statement`
              : 'Never matched. The first match starts from the balance this account was opened with.'}
            {` · ${format(Math.abs(Number(account.balance)))} ${credit ? (Number(account.balance) < 0 ? 'owed' : 'in credit') : 'in the books today'}`}
          </p>
        </header>

        {justDone && (
          <p role="status" style={{
            margin: '18px var(--gutter) 0', padding: '12px 14px', borderRadius: 14, display: 'flex', gap: 10,
            alignItems: 'center', background: 'var(--c-ok-tint)', color: 'var(--c-ok)',
            fontSize: 'var(--step--1)', fontWeight: 600, lineHeight: 1.45,
          }}>
            <Icon name="check" size={18} strokeWidth={2.4} />
            <span style={{ flex: 1 }}>
              Matched to the {day(justDone.on, true)} statement — {justDone.entries} {justDone.entries === 1 ? 'entry' : 'entries'} ticked off
              {justDone.adjustment ? `, and a ${format(Math.abs(Number(justDone.adjustment)))} adjustment recorded` : ''}.
            </span>
          </p>
        )}

        {canWrite ? (
          <Reconcile
            accountId={account.id} credit={credit} today={today} lastOn={last?.on ?? null}
            cleared={Number(account.cleared)}
            entries={entries.map((e) => ({ id: e.id, on: e.on, what: e.what, via: e.via, signed: Number(e.signed) }))}
          />
        ) : (
          <p style={{ margin: '20px var(--gutter)', fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
            Only owners and contributing members can reconcile accounts.
          </p>
        )}

        {history.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '22px var(--gutter) 11px' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600, letterSpacing: '-.012em' }}>Statements matched</h2>
              <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
            </div>
            <section className="el card" style={{
              margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 18, padding: '0 var(--pad)',
            }}>
              {history.map((r, i) => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, minHeight: 64,
                  borderBottom: i === history.length - 1 ? undefined : '1px solid var(--c-rule)',
                }}>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{day(r.on, true)}</span>
                    <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                      {r.entries} {r.entries === 1 ? 'entry' : 'entries'}
                      {r.adjustment ? ` · adjusted ${Number(r.adjustment) > 0 ? '+' : '−'}${format(Math.abs(Number(r.adjustment)))}` : ''}
                      {r.who ? ` · ${r.who}` : ''}
                    </span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span className="t" style={{ fontSize: 'var(--step-0)' }}>{format(Math.abs(Number(r.balance)))}</span>
                    {credit && <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>{Number(r.balance) < 0 ? 'owed' : 'in credit'}</span>}
                  </span>
                  {canWrite && i === 0 && <UndoLatest id={r.id} />}
                </div>
              ))}
            </section>
          </>
        )}
      </main>
    </Screen>
  );
}
