import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  actorOrNull, categoriesFor, claimsFor, methodsFor, personById, personLedger,
} from '@/db/queries';
import { format } from '@/lib/money';
import { HEADER_BG } from '../../auth-ui';
import PersonActions from './PersonActions';
import Claims from './Claims';

export const metadata = { title: 'Person · Quiet Ledger' };
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

  const [ledger, methods, cats, claims] = await Promise.all([
    personLedger(actor.household_id, person.account_id),
    methodsFor(actor.household_id),
    categoriesFor(actor.household_id),
    claimsFor(actor.household_id, person.id),
  ]);
  const balance = Number(person.balance);
  const owedOnClaims = claims
    .filter((c) => c.status === 'open' || c.status === 'part_paid')
    .reduce((n, c) => n + Number(c.outstanding), 0);
  const canWrite = actor.role !== 'viewer';

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: 44 }}>
      <header className="el2" style={{
        background: HEADER_BG, color: '#fff', borderRadius: '0 0 28px 28px',
        padding: '18px 20px 26px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <Link href="/people" aria-label="Back" style={{
          width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
        }}>
          <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="t" style={{ margin: 0, fontSize: 27, letterSpacing: '-.018em' }}>
          {person.name}
        </h1>
        <span className="t" style={{ fontSize: 32, letterSpacing: '-.022em', marginTop: 2 }}>
          {balance === 0 && owedOnClaims === 0
            ? 'Settled up'
            : format(Math.abs(balance) + owedOnClaims)}
        </span>
        {/* Lending and shared costs are different debts and are said apart —
            conflating them is what makes a khata stop being trusted. */}
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
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
            methods={methods.map((m) => ({ id: m.id, name: m.name, funds: m.funds }))}
            categories={cats.map((c) => ({ id: c.id, name: c.name }))}
          />
        )}

        <Claims
          claims={claims.map((c) => ({
            id: c.id, txn_id: c.txn_id, expected_amount: c.expected_amount,
            received: c.received, outstanding: c.outstanding, status: c.status,
            note: c.note, merchant: c.merchant, category: c.category,
            occurred_on: new Date(c.occurred_on).toISOString().slice(0, 10),
          }))}
          methods={methods.map((m) => ({ id: m.id, name: m.name, funds: m.funds }))}
          canEdit={canWrite}
        />

        {ledger.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 11px' }}>
            <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 600 }}>Money lent and returned</h2>
            <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
          </div>
        )}

        {ledger.length === 0 ? (
          <p style={{
            margin: '10px 34px', textAlign: 'center', fontSize: 14, lineHeight: 1.55,
            color: 'var(--c-meta)',
          }}>
            Nothing between you yet.
          </p>
        ) : (
          <section className="el" style={{
            margin: '0 18px', background: 'var(--c-card)', borderRadius: 18, padding: '0 16px',
          }}>
            {ledger.map((e, i) => {
              const [word, colour] = WORD[e.direction];
              return (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, minHeight: 70,
                  borderBottom: i === ledger.length - 1 ? undefined : '1px solid var(--c-rule)',
                }}>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: colour }}>{word}</span>
                    <span style={{
                      fontSize: 12.5, color: 'var(--c-meta)', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {new Date(e.occurred_on).toLocaleDateString('en-IN',
                        { day: 'numeric', month: 'short', year: 'numeric' })}
                      {e.direction === 'written_off' && e.category ? ` · ${e.category}` : ''}
                      {e.direction !== 'written_off' && e.other_side ? ` · ${e.other_side}` : ''}
                      {e.note ? ` · ${e.note}` : ''}
                    </span>
                  </span>
                  <span className="t" style={{ fontSize: 16, letterSpacing: '-.01em', color: colour }}>
                    {e.direction === 'back' ? '−' : '+'}{format(Number(e.amount))}
                  </span>
                </div>
              );
            })}
          </section>
        )}

        <p style={{
          margin: '18px 20px 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)',
        }}>
          None of this touches the monthly budget while it is outstanding — money lent has not
          been spent. Writing it off is the moment that changes.
        </p>
      </div>
    </main>
  );
}
