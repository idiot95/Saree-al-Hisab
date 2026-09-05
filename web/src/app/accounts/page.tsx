import { redirect } from 'next/navigation';
import {
  actorOrNull, accountsWithBalances, methodsWithFunding, openCyclesFor,
} from '@/db/queries';
import { format } from '@/lib/money';
import { HEADER_BG } from '../auth-ui';
import TabBar, { TAB_BAR_SPACE } from '../TabBar';
import AddAccount from './AddAccount';
import AddMethod from './AddMethod';
import { RetireAccount, MethodControls } from './Retire';

export const metadata = { title: 'Accounts · Quiet Ledger' };
export const dynamic = 'force-dynamic';

const KIND_LABEL = {
  spending: 'Bank', cash: 'Cash', savings: 'Savings', credit: 'Credit card',
} as const;

const RAIL_LABEL: Record<string, string> = {
  upi: 'UPI', card: 'Card', netbanking: 'Net banking', cash: 'Cash',
  cheque: 'Cheque', wallet: 'Wallet', autodebit: 'Standing instruction',
};

const nth = (d: number) => {
  const s = ['th', 'st', 'nd', 'rd'][(d % 100 - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][d % 100] ?? 'th';
  return `${d}${s}`;
};

export default async function Accounts() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const name = actor.household_name;
  const [accounts, methods, cycles] = await Promise.all([
    accountsWithBalances(actor.household_id),
    methodsWithFunding(actor.household_id),
    openCyclesFor(actor.household_id),
  ]);

  const canWrite = actor.role !== 'viewer';
  const holdings = accounts.filter((a) => a.kind !== 'credit');
  const cards = accounts.filter((a) => a.kind === 'credit');
  const have = holdings.reduce((n, a) => n + Number(a.balance), 0);
  const owed = cards.reduce((n, a) => n + Number(a.balance), 0); // negative when owing
  const cycleFor = (id: string) => cycles.find((c) => c.account_id === id);
  /* Straight out of sign-up they have the starter kit and nothing else, so the
     relevant form opens itself rather than making them tap "add" on an empty
     screen. Each has its own condition: the account form while they still only
     have the starter cash, the payment-method form once they have added an
     account but no way to pay from it. */
  const needsAccounts = accounts.length <= 1;
  const needsMethods = accounts.length > 1 && methods.length <= 1;

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
      <header className="el2" style={{
        background: HEADER_BG, color: '#fff', borderRadius: '0 0 28px 28px',
        padding: '18px 20px 30px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <a href="/" aria-label="Back" style={{
          width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
        }}>
          <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </a>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,.72)' }}>{name}</p>
        <h1 className="t" style={{ margin: 0, fontSize: 27, letterSpacing: '-.018em' }}>
          Accounts
        </h1>
        <div style={{ display: 'flex', gap: 22, marginTop: 4 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
              BALANCE
            </span>
            <span className="t" style={{ fontSize: 25, letterSpacing: '-.02em' }}>{format(have)}</span>
          </span>
          {cards.length > 0 && (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
                OWED ON CARDS
              </span>
              <span className="t" style={{ fontSize: 25, letterSpacing: '-.02em' }}>
                {format(Math.abs(owed))}
              </span>
            </span>
          )}
        </div>
      </header>

      <Head>Bank and cash</Head>
      <Card>
        {holdings.map((a, i) => (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, minHeight: 76,
            borderBottom: i === holdings.length - 1 ? undefined : '1px solid var(--c-rule)',
          }}>
            <Pill kind={a.kind} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15.5, fontWeight: 600 }}>{a.name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--c-meta)' }}>
                {KIND_LABEL[a.kind]}{a.last4 && ` · ends ${a.last4}`}
                {a.kind === 'savings' && ' · outside the budget'}
              </span>
            </span>
            <span style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="t" style={{
                fontSize: 17, letterSpacing: '-.01em',
                color: Number(a.balance) < 0 ? 'var(--c-danger)' : 'var(--c-ink)',
              }}>{format(Number(a.balance))}</span>
              {canWrite && <RetireAccount id={a.id} name={a.name} blocked={a.methods} />}
            </span>
          </div>
        ))}
        {holdings.length === 0 && <Empty>No accounts yet.</Empty>}
      </Card>

      {cards.length > 0 && (
        <>
          <Head>Cards</Head>
          <Card>
            {cards.map((a, i) => {
              const cyc = cycleFor(a.id);
              const used = Math.abs(Number(a.balance));
              const limit = a.credit_limit ? Number(a.credit_limit) : null;
              return (
                <div key={a.id} style={{
                  display: 'flex', flexDirection: 'column', gap: 10, padding: '15px 0',
                  borderBottom: i === cards.length - 1 ? undefined : '1px solid var(--c-rule)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Pill kind="credit" />
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 600 }}>{a.name}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--c-meta)' }}>
                        {a.last4 ? `ends ${a.last4} · ` : ''}
                        statement {a.statement_day ? nth(a.statement_day) : '—'},
                        {' '}due {a.due_day ? nth(a.due_day) : '—'}
                      </span>
                    </span>
                    <span className="t" style={{ fontSize: 17, letterSpacing: '-.01em' }}>
                      {format(used)}
                    </span>
                  </div>

                  {limit && (
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <span style={{
                        height: 7, borderRadius: 999, background: 'var(--c-track)', overflow: 'hidden',
                      }}>
                        <span style={{
                          display: 'block', height: '100%', borderRadius: 999,
                          width: `${Math.min(100, (used / limit) * 100)}%`,
                          background: used / limit > 0.8 ? 'var(--c-danger-fill)'
                            : used / limit > 0.5 ? 'var(--c-warn-fill)' : 'var(--c-ok-fill)',
                        }} />
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--c-meta)' }}>
                        {format(limit - used)} of {format(limit)} still available
                      </span>
                    </span>
                  )}

                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                    borderRadius: 11, background: 'var(--c-sunk2)', fontSize: 12.5,
                    lineHeight: 1.45, color: 'var(--c-meta)',
                  }}>
                    {cyc ? (
                      <>
                        <b style={{ color: 'var(--c-ink)' }}>{format(Number(cyc.charged))}</b>
                        {' '}on this cycle from {cyc.entries} {cyc.entries === 1 ? 'entry' : 'entries'},
                        {' '}due {new Date(cyc.due_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.
                      </>
                    ) : (
                      <>Nothing on this cycle yet.</>
                    )}
                  </span>

                  {canWrite && (
                    <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <RetireAccount id={a.id} name={a.name} blocked={a.methods} />
                    </span>
                  )}
                </div>
              );
            })}
          </Card>
        </>
      )}

      {canWrite && <AddAccount startOpen={needsAccounts} />}

      <Head>Payment methods</Head>
      <p style={{
        margin: '-4px 20px 12px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)',
      }}>
        Each one draws on a single account, so spending is recorded against the right balance.
      </p>
      <Card>
        {methods.map((m, i) => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, minHeight: 76,
            borderBottom: i === methods.length - 1 ? undefined : '1px solid var(--c-rule)',
          }}>
            <span style={{
              width: 40, height: 40, flex: 'none', borderRadius: 11, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
              background: 'var(--cat-indigo)', color: 'var(--cat-indigo-ink)',
            }}>{RAIL_LABEL[m.kind]?.slice(0, 3).toUpperCase() ?? '···'}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15.5, fontWeight: 600 }}>{m.name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--c-meta)' }}>
                {m.funds}{m.handle && ` · ${m.handle}`}
              </span>
            </span>
            {canWrite && <MethodControls id={m.id} isDefault={m.is_default} />}
          </div>
        ))}
        {methods.length === 0 && <Empty>No payment methods yet.</Empty>}
      </Card>

      {canWrite && <AddMethod startOpen={needsMethods}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))} />}

      {!canWrite && (
        <p style={{
          margin: '0 20px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)', textAlign: 'center',
        }}>
          Only owners and contributing members can change accounts.
        </p>
      )}
      <TabBar current="/accounts" />
    </main>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px 11px' }}>
      <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 600, letterSpacing: '-.012em' }}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="el" style={{
      margin: '0 18px 6px', background: 'var(--c-card)', borderRadius: 18, padding: '0 16px',
    }}>{children}</section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: 0, padding: '22px 0', textAlign: 'center', fontSize: 13.5, color: 'var(--c-meta)',
    }}>{children}</p>
  );
}

function Pill({ kind }: { kind: 'spending' | 'savings' | 'credit' | 'cash' }) {
  const tint = {
    spending: ['var(--cat-blue)', 'var(--cat-blue-ink)'],
    cash: ['var(--cat-green)', 'var(--cat-green-ink)'],
    savings: ['var(--cat-cyan)', 'var(--cat-cyan-ink)'],
    credit: ['var(--cat-orange)', 'var(--cat-orange-ink)'],
  }[kind];
  const d = {
    spending: 'M3.5 9.5h17M4.5 6.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z',
    cash: 'M3.5 7.5h17v9h-17zM12 9.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z',
    savings: 'M12 3.5 20 8v8l-8 4.5L4 16V8z',
    credit: 'M3.5 9.5h17M4.5 6.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM6.5 14h3',
  }[kind];
  return (
    <span style={{
      width: 40, height: 40, flex: 'none', borderRadius: 11, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: tint[0], color: tint[1],
    }}>
      <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </span>
  );
}
