import Link from '@/app/NavLink';
import { redirect } from 'next/navigation';
import { actorOrNull, reconcileTargets } from '@/db/queries';
import { format } from '@/lib/money';
import { Chip, Icon, ACCOUNT_ICON, ACCOUNT_TINT } from '../../Icon';
import TabBar from '../../TabBar';
import { TAB_BAR_SPACE } from '../../tabs';
import PageHead from '../../PageHead';
import Screen from '../../Screen';

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
      <main style={{ minHeight: '100dvh', background: 'var(--background)', paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back="/accounts" title="Reconcile"
          sub="Match an account to its statement: tick off what the statement shows, and find what the books are missing." />

        <section className="border border-border" style={{
          margin: '20px var(--gutter) 0', background: 'var(--card)', borderRadius: 18, padding: '0 var(--pad)',
        }}>
          {accounts.map((a, i) => {
            const bal = Number(a.balance);
            const credit = a.kind === 'credit';
            return (
              <Link key={a.id} href={`/accounts/${a.id}/reconcile`} transitionTypes={['nav-forward']} style={{
                display: 'flex', alignItems: 'center', gap: 12, minHeight: 72, textDecoration: 'none', color: 'var(--foreground)',
                borderBottom: i === accounts.length - 1 ? undefined : '1px solid var(--border)',
              }}>
                <Chip icon={ACCOUNT_ICON[a.kind]} tint={ACCOUNT_TINT[a.kind]} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>
                    {a.name}{a.last4 ? <span style={{ fontWeight: 500, color: 'var(--muted-foreground)' }}> · {a.last4}</span> : null}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--step--2)', color: 'var(--muted-foreground)' }}>
                    {a.last_on ? <Icon name="check" size={13} /> : null}
                    {a.last_on
                      ? `Matched ${new Date(`${a.last_on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                      : 'Never matched'}
                    {` · ${a.open} ${a.open === 1 ? 'entry' : 'entries'} ${a.last_on ? 'since' : 'to check'}`}
                  </span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span className="t" style={{ fontSize: 'var(--step-0)' }}>{format(Math.abs(bal))}</span>
                  <span style={{ fontSize: 'var(--step--2)', color: 'var(--muted-foreground)' }}>
                    {credit ? (bal < 0 ? 'owed' : 'in credit') : bal < 0 ? 'overdrawn' : 'in the books'}
                  </span>
                </span>
              </Link>
            );
          })}
          {accounts.length === 0 && (
            <p style={{ margin: 0, padding: '22px 0', textAlign: 'center', fontSize: 'var(--step--1)', color: 'var(--muted-foreground)' }}>
              No accounts yet.
            </p>
          )}
        </section>
        <TabBar current="/accounts" />
      </main>
    </Screen>
  );
}
