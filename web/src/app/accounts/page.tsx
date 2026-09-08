import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Chip, RAIL_ICON, RAIL_TINT, ACCOUNT_ICON, ACCOUNT_TINT } from '../Icon';
import {
  actorOrNull, accountsWithBalances, methodsWithFunding, openCyclesFor,
} from '@/db/queries';
import { format } from '@/lib/money';
import { headerBg } from '../auth-ui';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import AddAccount from './AddAccount';
import AddMethod from './AddMethod';
import EditAccount, { type Editable } from './EditAccount';
import { MethodControls } from './Retire';
import CardDeck, { type CardInfo } from './CardDeck';
import Screen from '../Screen';
import Back from '../Back';

export const metadata = { title: 'Accounts · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const KIND_LABEL = {
  spending: 'Bank', cash: 'Cash', savings: 'Savings', credit: 'Credit card',
} as const;

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
  /* The apps and cards that take money from an account, named on its row, so
     the two sections of this screen are visibly one story: GPay is not a
     third kind of account, it is how the ICICI account gets spent. */
  const railsOn = (id: string) => methods.filter((m) => m.account_id === id
    && m.name.trim().toLowerCase() !== accounts.find((a) => a.id === id)?.name.trim().toLowerCase()).map((m) => m.name);
  /* Straight out of sign-up they have the starter kit and nothing else, so the
     relevant form opens itself rather than making them tap "add" on an empty
     screen. Each has its own condition: the account form while they still only
     have the starter cash, the payment-method form once they have added an
     account but no way to pay from it. */
  const needsAccounts = accounts.length <= 1;
  const needsMethods = accounts.length > 1 && methods.length <= 1;
  const editable = (a: (typeof accounts)[number]): Editable => ({
    id: a.id, name: a.name, kind: a.kind, last4: a.last4,
    bank_key: a.bank_key, card_network: a.card_network,
    opening: Number(a.opening_balance), limit: a.credit_limit ? Number(a.credit_limit) : null,
    statement_day: a.statement_day, due_day: a.due_day, methods: a.methods,
  });

  return (
    <Screen>
      <Back to="/" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
        <header className="el2" style={{
          background: headerBg('blue'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 30px', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <Link href="/" transitionTypes={['nav-back']} aria-label="Back" style={{
            width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
          }}>
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'rgba(255,255,255,.72)' }}>{name}</p>
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
            Accounts
          </h1>
          <div style={{ display: 'flex', gap: 22, marginTop: 4 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 'var(--step--2)', color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
                BALANCE
              </span>
              <span className="t" style={{ fontSize: 'var(--step-3)', letterSpacing: '-.02em' }}>{format(have)}</span>
            </span>
            {cards.length > 0 && (
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 'var(--step--2)', color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
                  OWED ON CARDS
                </span>
                <span className="t" style={{ fontSize: 'var(--step-3)', letterSpacing: '-.02em' }}>
                  {format(Math.abs(owed))}
                </span>
              </span>
            )}
          </div>
        </header>

        <Head>Bank and cash</Head>
        <Card>
          {holdings.map((a, i) => (
            <EditAccount key={a.id} account={editable(a)} canWrite={canWrite} last={i === holdings.length - 1}>
              <Chip icon={ACCOUNT_ICON[a.kind]} tint={ACCOUNT_TINT[a.kind]} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{a.name}</span>
                <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
                  {KIND_LABEL[a.kind]}{a.last4 && ` · ends ${a.last4}`}
                  {a.kind === 'savings' && ' · outside the budget'}
                </span>
                {railsOn(a.id).length > 0 && (
                  <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                    Paid through {railsOn(a.id).join(', ')}
                  </span>
                )}
              </span>
              <span style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="t n" style={{
                  fontSize: 'var(--step-1)', letterSpacing: '-.01em',
                  color: Number(a.balance) < 0 ? 'var(--c-danger)' : 'var(--c-ink)',
                }}>{format(Number(a.balance))}</span>
              </span>
            </EditAccount>
          ))}
          {holdings.length === 0 && <Empty>No accounts yet.</Empty>}
        </Card>

        {cards.length > 0 && (
          <>
            <Head>Cards</Head>
            <CardDeck canWrite={canWrite} cards={cards.map((a): CardInfo => {
              const cyc = cycleFor(a.id);
              return {
                edit: editable(a),
                owed: Math.abs(Number(a.balance)),
                limit: a.credit_limit ? Number(a.credit_limit) : null,
                cycle: cyc
                  ? { charged: Number(cyc.charged), entries: cyc.entries,
                      dueOn: new Date(cyc.due_on).toISOString().slice(0, 10) }
                  : null,
              };
            })} />
          </>
        )}

        {canWrite && (
          <p style={{ margin: '-2px var(--gutter) 16px', fontSize: 'var(--step--2)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
            Tap an account to rename it, correct its starting balance, or archive it.
          </p>
        )}
        {canWrite && <AddAccount startOpen={needsAccounts} />}

        <Head>Ways to pay</Head>
        <p style={{
          margin: '-4px 20px 12px', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)',
        }}>
          GPay, PhonePe, net banking, a debit card — each is linked to the account it takes money
          from, so what you spend through it comes off the right balance. Cash and credit cards are
          ways to pay on their own.
        </p>
        <Card>
          {methods.map((m, i) => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, minHeight: 76,
              borderBottom: i === methods.length - 1 ? undefined : '1px solid var(--c-rule)',
            }}>
              <Chip icon={RAIL_ICON[m.kind] ?? 'tag'} tint={RAIL_TINT[m.kind] ?? 'neutral'} size={40} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{m.name}</span>
                <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
                  {(m.kind === 'card' && m.funds_kind === 'credit') || (m.kind === 'cash' && m.funds_kind === 'cash')
                    ? `${m.funds} — the ${m.kind === 'card' ? 'card' : 'cash'} itself`
                    : `Takes money from ${m.funds}`}
                  {m.handle && ` · ${m.handle}`}
                </span>
              </span>
              {canWrite && <MethodControls id={m.id} isDefault={m.is_default} />}
            </div>
          ))}
          {methods.length === 0 && <Empty>No apps or cards linked yet.</Empty>}
        </Card>

        {canWrite && <AddMethod startOpen={needsMethods}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))} />}

        {!canWrite && (
          <p style={{
            margin: '0 var(--gutter)', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)', textAlign: 'center',
          }}>
            Only owners and contributing members can change accounts.
          </p>
        )}
        <TabBar current="/accounts" />
      </main>
    </Screen>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px var(--gutter) 11px' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600, letterSpacing: '-.012em' }}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="el card" style={{
      margin: '0 var(--gutter) 6px', background: 'var(--c-card)', borderRadius: 18, padding: '0 var(--pad)', overflow: 'hidden',
    }}>{children}</section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: 0, padding: '22px 0', textAlign: 'center', fontSize: 'var(--step--1)', color: 'var(--c-meta)',
    }}>{children}</p>
  );
}
