import Link from '@/app/NavLink';
import { redirect } from 'next/navigation';
import { actorOrNull, reconcileTargets } from '@/db/queries';
import { format } from '@/lib/money';
import { headerBg } from '../../auth-ui';
import { Chip, Icon, ACCOUNT_ICON, ACCOUNT_TINT } from '../../Icon';
import TabBar from '../../TabBar';
import { TAB_BAR_SPACE } from '../../tabs';
import Screen from '../../Screen';
import Back from '../../Back';

export const metadata = { title: 'Reconcile · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/* Which account to match against a statement. Each row says when it was last
   matched and how many entries have come in since — the ones a statement
   will be asked about. */
export default async function ReconcilePicker() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const accounts = await reconcileTargets(actor.household_id);

  return (
    <Screen>
      <Back to="/accounts" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
        <header className="el2" style={{
          background: headerBg('blue'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 26px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <Link href="/accounts" transitionTypes={['nav-back']} aria-label="Back" style={{
            width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
          }}>
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>Reconcile</h1>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
            Match an account to its bank or card statement: tick off what the statement shows, and
            find what the books are missing.
          </p>
        </header>

        <section className="el card" style={{
          margin: '20px var(--gutter) 0', background: 'var(--c-card)', borderRadius: 18, padding: '0 var(--pad)',
        }}>
          {accounts.map((a, i) => {
            const bal = Number(a.balance);
            const credit = a.kind === 'credit';
            return (
              <Link key={a.id} href={`/accounts/${a.id}/reconcile`} transitionTypes={['nav-forward']} style={{
                display: 'flex', alignItems: 'center', gap: 12, minHeight: 72, textDecoration: 'none', color: 'var(--c-ink)',
                borderBottom: i === accounts.length - 1 ? undefined : '1px solid var(--c-rule)',
              }}>
                <Chip icon={ACCOUNT_ICON[a.kind]} tint={ACCOUNT_TINT[a.kind]} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>
                    {a.name}{a.last4 ? <span style={{ fontWeight: 500, color: 'var(--c-meta)' }}> · {a.last4}</span> : null}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                    {a.last_on ? <Icon name="check" size={13} strokeWidth={2.4} /> : null}
                    {a.last_on
                      ? `Matched ${new Date(`${a.last_on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                      : 'Never matched'}
                    {` · ${a.open} ${a.open === 1 ? 'entry' : 'entries'} ${a.last_on ? 'since' : 'to check'}`}
                  </span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span className="t" style={{ fontSize: 'var(--step-0)' }}>{format(Math.abs(bal))}</span>
                  <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                    {credit ? (bal < 0 ? 'owed' : 'in credit') : bal < 0 ? 'overdrawn' : 'in the books'}
                  </span>
                </span>
              </Link>
            );
          })}
          {accounts.length === 0 && (
            <p style={{ margin: 0, padding: '22px 0', textAlign: 'center', fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
              No accounts yet.
            </p>
          )}
        </section>
        <TabBar current="/accounts" />
      </main>
    </Screen>
  );
}
