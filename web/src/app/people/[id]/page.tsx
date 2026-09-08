import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  actorOrNull, categoriesFor, claimsFor, personById, personLedger,
} from '@/db/queries';
import { waysToPay } from '@/db/payment';
import { format } from '@/lib/money';
import { headerBg } from '../../auth-ui';
import PersonActions from './PersonActions';
import Claims from './Claims';
import Screen from '../../Screen';
import Back from '../../Back';
import { BACK_SPACE } from '../../tabs';

export const metadata = { title: 'Person · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const WORD = {
  lent: ['Lent', 'var(--c-ink)'],
  back: ['Paid back', 'var(--c-ok)'],
  written_off: ['Written off', 'var(--c-danger)'],
} as const;

export default async function Person({ params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const person = await personById(actor.household_id, id);
  if (!person) notFound();

  const [ledger, ways, cats, claims] = await Promise.all([
    personLedger(actor.household_id, person.account_id),
    waysToPay(actor.household_id),
    categoriesFor(actor.household_id),
    claimsFor(actor.household_id, person.id),
  ]);
  const balance = Number(person.balance);
  const owedOnClaims = claims
    .filter((c) => c.status === 'open' || c.status === 'part_paid')
    .reduce((n, c) => n + Number(c.outstanding), 0);
  const canWrite = actor.role !== 'viewer';

  return (
    <Screen>
      <Back to="/people" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: BACK_SPACE }}>
        <header className="el2" style={{
          background: headerBg('purple'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 26px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <Link href="/people" transitionTypes={['nav-back']} aria-label="Back" style={{
            width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
          }}>
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
            {person.name}
          </h1>
          <span className="t" style={{ fontSize: 'var(--step-4)', letterSpacing: '-.022em', marginTop: 2 }}>
            {balance === 0 && owedOnClaims === 0
              ? 'Settled up'
              : format(Math.abs(balance) + owedOnClaims)}
          </span>
          {/* Lending and shared costs are different debts and are said apart —
              conflating them is what makes a khata stop being trusted. */}
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
            {balance === 0 && owedOnClaims === 0
              ? `Nothing outstanding between you${person.phone ? ` · ${person.phone}` : ''}`
              : [
                  balance > 0 ? `${format(balance)} lent` : null,
                  balance < 0 ? `${format(-balance)} you owe` : null,
                  owedOnClaims > 0 ? `${format(owedOnClaims)} for shared costs` : null,
                ].filter(Boolean).join(' · ')}
          </p>
        </header>

        <div style={{ paddingTop: 20 }}>
          {canWrite && (
            <PersonActions
              personId={person.id} name={person.name} balance={balance}
              ways={ways}
              categories={cats.map((c) => ({ id: c.id, name: c.parent ? `${c.parent} › ${c.name}` : c.name }))}
            />
          )}

          <Claims
            claims={claims.map((c) => ({
              id: c.id, txn_id: c.txn_id, expected_amount: c.expected_amount,
              received: c.received, outstanding: c.outstanding, status: c.status,
              note: c.note, merchant: c.merchant, category: c.category,
              occurred_on: new Date(c.occurred_on).toISOString().slice(0, 10),
            }))}
            ways={ways}
            canEdit={canWrite}
          />

          {ledger.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 var(--gutter) 11px' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600 }}>Money lent and returned</h2>
              <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
            </div>
          )}

          {ledger.length === 0 ? (
            <p style={{
              margin: '10px 34px', textAlign: 'center', fontSize: 'var(--step--1)', lineHeight: 1.55,
              color: 'var(--c-meta)',
            }}>
              Nothing between you yet.
            </p>
          ) : (
            <section className="el card" style={{
              margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 18, padding: '0 var(--pad)',
            }}>
              {ledger.map((e, i) => {
                const [word, colour] = WORD[e.direction];
                return (
                  <div key={e.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, minHeight: 70,
                    borderBottom: i === ledger.length - 1 ? undefined : '1px solid var(--c-rule)',
                  }}>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 'var(--step-0)', fontWeight: 600, color: colour }}>{word}</span>
                      <span style={{
                        fontSize: 'var(--step--1)', color: 'var(--c-meta)', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {new Date(e.occurred_on).toLocaleDateString('en-IN',
                          { day: 'numeric', month: 'short', year: 'numeric' })}
                        {e.direction === 'written_off' && e.category ? ` · ${e.category}` : ''}
                        {e.direction !== 'written_off' && e.other_side ? ` · ${e.other_side}` : ''}
                        {e.note ? ` · ${e.note}` : ''}
                      </span>
                    </span>
                    <span className="t amt" style={{ fontSize: 'var(--step-0)', letterSpacing: '-.01em', color: colour }}>
                      {e.direction === 'back' ? '−' : '+'}{format(Number(e.amount))}
                    </span>
                  </div>
                );
              })}
            </section>
          )}

          <p style={{
            margin: '18px 20px 0', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)',
          }}>
            None of this touches the monthly budget while it is outstanding — money lent has not
            been spent. Writing it off is the moment that changes.
          </p>
        </div>
      </main>
    </Screen>
  );
}
