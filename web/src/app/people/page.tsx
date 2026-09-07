import Link from 'next/link';
import { redirect } from 'next/navigation';
import { actorOrNull, bookList, owedByPerson, peopleFor } from '@/db/queries';
import { format } from '@/lib/money';
import { headerBg } from '../auth-ui';
import TabBar, { TAB_BAR_SPACE } from '../TabBar';
import AddPerson from './AddPerson';
import NewBook from '../books/NewBook';

export const metadata = { title: 'People · Quiet Ledger' };
export const dynamic = 'force-dynamic';

const TINT: Record<string, [string, string]> = {
  green: ['var(--cat-green)', 'var(--cat-green-ink)'],
  orange: ['var(--cat-orange)', 'var(--cat-orange-ink)'],
  blue: ['var(--cat-blue)', 'var(--cat-blue-ink)'],
  purple: ['var(--cat-purple)', 'var(--cat-purple-ink)'],
  pink: ['var(--cat-pink)', 'var(--cat-pink-ink)'],
  cyan: ['var(--cat-cyan)', 'var(--cat-cyan-ink)'],
  rust: ['var(--cat-rust)', 'var(--cat-rust-ink)'],
  indigo: ['var(--cat-indigo)', 'var(--cat-indigo-ink)'],
};

export default async function People() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const [people, owed, books] = await Promise.all([
    peopleFor(actor.household_id),
    owedByPerson(actor.household_id),
    bookList(actor.household_id),
  ]);
  const claimed = new Map(owed.map((o) => [o.id, Number(o.claimed)]));
  const claimsTotal = owed.reduce((n, o) => n + Number(o.claimed), 0);
  const canWrite = actor.role !== 'viewer';
  const owedToYou = people.reduce((n, p) => n + Math.max(0, Number(p.balance)), 0);
  const youOwe = people.reduce((n, p) => n + Math.min(0, Number(p.balance)), 0);
  const outstanding = (p: { id: string; balance: string }) =>
    Number(p.balance) !== 0 || (claimed.get(p.id) ?? 0) > 0;
  const settled = people.filter((p) => !outstanding(p));
  const open = people.filter(outstanding);

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
      <header className="el2" style={{
        background: headerBg('purple'), color: '#fff', borderRadius: '0 0 28px 28px',
        padding: '18px 20px 26px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <Link href="/" aria-label="Back" style={{
          width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
        }}>
          <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
          Lending
        </h1>
        <div style={{ display: 'flex', gap: 24, marginTop: 2 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 'var(--step--2)', color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
              OWED TO YOU
            </span>
            <span className="t" style={{ fontSize: 'var(--step-3)', letterSpacing: '-.02em' }}>
              {format(owedToYou + claimsTotal)}
            </span>
          </span>
          {youOwe < 0 && (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 'var(--step--2)', color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
                YOU OWE
              </span>
              <span className="t" style={{ fontSize: 'var(--step-3)', letterSpacing: '-.02em' }}>
                {format(-youOwe)}
              </span>
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'rgba(255,255,255,.78)' }}>
          {claimsTotal > 0
            ? `${format(owedToYou)} lent · ${format(claimsTotal)} owed for things you paid for`
            : 'Money lent is not spending. It sits here until it comes back — or until you decide it will not.'}
        </p>
      </header>

      <div style={{ paddingTop: 20 }}>
        {open.length > 0 && <Head>Outstanding</Head>}
        {open.length > 0 && <List people={open} claimed={claimed} />}

        {canWrite && <AddPerson startOpen={people.length === 0} />}

        {settled.length > 0 && (
          <>
            <Head>Settled up</Head>
            <List people={settled} claimed={claimed} />
          </>
        )}

        {people.length > 0 && (
          <>
            <Head>Books</Head>
            <p style={{
              margin: '-4px 20px 12px', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)',
            }}>
              Folders for people — the flat, a trip, office lunches — so you can see where a
              whole group stands without adding it up yourself.
            </p>
            {books.length > 0 && (
              <section className="el" style={{
                margin: '0 18px 16px', background: 'var(--c-card)', borderRadius: 18, padding: '0 16px',
              }}>
                {books.map((b, i) => {
                  const t = Number(b.lent) + Number(b.claimed);
                  return (
                    <Link key={b.id} href={`/books/${b.id}`} style={{
                      display: 'flex', alignItems: 'center', gap: 12, minHeight: 72,
                      textDecoration: 'none', color: 'var(--c-ink)',
                      opacity: b.closed_at ? 0.55 : 1,
                      borderBottom: i === books.length - 1 ? undefined : '1px solid var(--c-rule)',
                    }}>
                      <span style={{
                        width: 40, height: 40, flex: 'none', borderRadius: 11, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: b.kind === 'loan' ? 'var(--cat-indigo)' : 'var(--cat-cyan)',
                        color: b.kind === 'loan' ? 'var(--cat-indigo-ink)' : 'var(--cat-cyan-ink)',
                      }}>
                        <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l1.8 2h7.6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
                        </svg>
                      </span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{b.name}</span>
                        <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                          {b.people} {b.people === 1 ? 'person' : 'people'}
                          {b.closed_at ? ' · closed' : ''}
                        </span>
                      </span>
                      <span className="t" style={{ fontSize: 'var(--step-0)', color: t === 0 ? 'var(--c-meta)' : 'var(--c-ink)' }}>
                        {t === 0 ? '—' : format(Math.abs(t))}
                      </span>
                    </Link>
                  );
                })}
              </section>
            )}
            {canWrite && <NewBook />}
          </>
        )}

        {people.length === 0 && (
          <p style={{
            margin: '0 34px', textAlign: 'center', fontSize: 'var(--step--1)', lineHeight: 1.55,
            color: 'var(--c-meta)',
          }}>
            Add someone you lend to or borrow from, and every rupee between you is tracked here.
          </p>
        )}
      </div>
      <TabBar current="/people" />
    </main>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 11px' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600, letterSpacing: '-.012em' }}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  );
}

function List({ people, claimed }: {
  people: Awaited<ReturnType<typeof peopleFor>>; claimed: Map<string, number>;
}) {
  return (
    <section className="el" style={{
      margin: '0 18px 22px', background: 'var(--c-card)', borderRadius: 18, padding: '0 16px',
    }}>
      {people.map((p, i) => {
        const bal = Number(p.balance);
        const total = bal + (claimed.get(p.id) ?? 0);
        const [bg, ink] = TINT[p.tint] ?? ['var(--cat-neutral)', 'var(--cat-neutral-ink)'];
        return (
          <Link key={p.id} href={`/people/${p.id}`} style={{
            display: 'flex', alignItems: 'center', gap: 12, minHeight: 74,
            textDecoration: 'none', color: 'var(--c-ink)',
            borderBottom: i === people.length - 1 ? undefined : '1px solid var(--c-rule)',
          }}>
            <span style={{
              width: 42, height: 42, flex: 'none', borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 'var(--step--1)', fontWeight: 700,
              background: bg, color: ink,
            }}>{p.name.slice(0, 2).toUpperCase()}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{p.name}</span>
              <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
                {(claimed.get(p.id) ?? 0) > 0 && bal !== 0
                  ? `${format(bal)} lent · ${format(claimed.get(p.id)!)} shared`
                  : (claimed.get(p.id) ?? 0) > 0
                    ? 'shared costs'
                    : p.entries === 0 ? 'nothing yet'
                      : `${p.entries} ${p.entries === 1 ? 'entry' : 'entries'}`}
              </span>
            </span>
            <span style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="t" style={{
                fontSize: 'var(--step-1)', letterSpacing: '-.01em',
                color: total > 0 ? 'var(--c-ink)' : total < 0 ? 'var(--c-danger)' : 'var(--c-meta)',
              }}>{total === 0 ? '—' : format(Math.abs(total))}</span>
              {total !== 0 && (
                <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                  {total > 0 ? 'owes you' : 'you owe'}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
