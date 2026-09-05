import Link from 'next/link';
import { redirect } from 'next/navigation';
import { actorOrNull, peopleFor } from '@/db/queries';
import { format } from '@/lib/money';
import { HEADER_BG } from '../auth-ui';
import TabBar, { TAB_BAR_SPACE } from '../TabBar';
import AddPerson from './AddPerson';

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

  const people = await peopleFor(actor.household_id);
  const canWrite = actor.role !== 'viewer';
  const owedToYou = people.reduce((n, p) => n + Math.max(0, Number(p.balance)), 0);
  const youOwe = people.reduce((n, p) => n + Math.min(0, Number(p.balance)), 0);
  const settled = people.filter((p) => Number(p.balance) === 0);
  const open = people.filter((p) => Number(p.balance) !== 0);

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
      <header className="el2" style={{
        background: HEADER_BG, color: '#fff', borderRadius: '0 0 28px 28px',
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
        <h1 className="t" style={{ margin: 0, fontSize: 27, letterSpacing: '-.018em' }}>
          Lending
        </h1>
        <div style={{ display: 'flex', gap: 24, marginTop: 2 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
              OWED TO YOU
            </span>
            <span className="t" style={{ fontSize: 25, letterSpacing: '-.02em' }}>
              {format(owedToYou)}
            </span>
          </span>
          {youOwe < 0 && (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
                YOU OWE
              </span>
              <span className="t" style={{ fontSize: 25, letterSpacing: '-.02em' }}>
                {format(-youOwe)}
              </span>
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: 'rgba(255,255,255,.78)' }}>
          Money lent is not spending. It sits here until it comes back — or until you decide
          it will not.
        </p>
      </header>

      <div style={{ paddingTop: 20 }}>
        {open.length > 0 && <Head>Outstanding</Head>}
        {open.length > 0 && <List people={open} />}

        {canWrite && <AddPerson startOpen={people.length === 0} />}

        {settled.length > 0 && (
          <>
            <Head>Settled up</Head>
            <List people={settled} />
          </>
        )}

        {people.length === 0 && (
          <p style={{
            margin: '0 34px', textAlign: 'center', fontSize: 14, lineHeight: 1.55,
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
      <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 600, letterSpacing: '-.012em' }}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  );
}

function List({ people }: { people: Awaited<ReturnType<typeof peopleFor>> }) {
  return (
    <section className="el" style={{
      margin: '0 18px 22px', background: 'var(--c-card)', borderRadius: 18, padding: '0 16px',
    }}>
      {people.map((p, i) => {
        const bal = Number(p.balance);
        const [bg, ink] = TINT[p.tint] ?? ['var(--cat-neutral)', 'var(--cat-neutral-ink)'];
        return (
          <Link key={p.id} href={`/people/${p.id}`} style={{
            display: 'flex', alignItems: 'center', gap: 12, minHeight: 74,
            textDecoration: 'none', color: 'var(--c-ink)',
            borderBottom: i === people.length - 1 ? undefined : '1px solid var(--c-rule)',
          }}>
            <span style={{
              width: 42, height: 42, flex: 'none', borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
              background: bg, color: ink,
            }}>{p.name.slice(0, 2).toUpperCase()}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15.5, fontWeight: 600 }}>{p.name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--c-meta)' }}>
                {p.entries === 0 ? 'nothing yet'
                  : `${p.entries} ${p.entries === 1 ? 'entry' : 'entries'}`}
                {p.relationship !== 'friend' && ` · ${p.relationship}`}
              </span>
            </span>
            <span style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="t" style={{
                fontSize: 17, letterSpacing: '-.01em',
                color: bal > 0 ? 'var(--c-ink)' : bal < 0 ? 'var(--c-danger)' : 'var(--c-meta)',
              }}>{bal === 0 ? '—' : format(Math.abs(bal))}</span>
              {bal !== 0 && (
                <span style={{ fontSize: 11, color: 'var(--c-meta)' }}>
                  {bal > 0 ? 'owes you' : 'you owe'}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
