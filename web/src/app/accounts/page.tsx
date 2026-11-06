import Link from '@/app/NavLink';
import { redirect } from 'next/navigation';
import { Chip, RAIL_ICON, RAIL_TINT, ACCOUNT_ICON, ACCOUNT_TINT } from '../Icon';
import {
  actorOrNull, accountsWithBalances, allBalances, methodsWithFunding, openCyclesFor, owedByPerson, tabHeldOwed,
} from '@/db/queries';
import { netWorth } from '@/lib/worth';
import PageHead from '../PageHead';
import { withHousehold } from '@/db/client';
import { format } from '@/lib/money';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import AddAccount from './AddAccount';
import AddMethod from './AddMethod';
import EditAccount, { type Editable } from './EditAccount';
import { MethodControls } from './Retire';
import CardDeck, { type CardInfo } from './CardDeck';
import Screen from '../Screen';
import { Icon } from '../Icon';

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
  const hh = actor.household_id;
  const [accounts, methods, cycles, balances, owedTo, held] = await withHousehold(hh, () => Promise.all([
    accountsWithBalances(hh),
    methodsWithFunding(hh),
    openCyclesFor(hh),
    allBalances(hh),
    owedByPerson(hh),
    tabHeldOwed(hh),
  ]));
  /* The same figure the Net worth screen shows, from the same helper. */
  const { worth, receivable, assetTotal, debtTotal } = netWorth({ accounts: balances, claimed: owedTo.reduce((n, o) => n + Number(o.claimed), 0), held: Number(held) });

  const canWrite = actor.role !== 'viewer';
  const holdings = accounts.filter((a) => a.kind !== 'credit');
  const everyday = holdings.filter((a) => a.kind !== 'savings');
  const saved = holdings.filter((a) => a.kind === 'savings');
  /* Cards lead with the one that wants paying: the deck opens on the first,
     and a card owing nothing is not what a person came to the screen for. */
  const cards = accounts.filter((a) => a.kind === 'credit')
    .sort((x, y) => Number(x.balance) - Number(y.balance));
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
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back="/worth" title="Accounts" sub={<span className="truncate">{name}</span>} />

        <div className="flex flex-col gap-5 px-[var(--gutter)]">
          <Link href="/worth" transitionTypes={['nav-lateral']}
            className="flex flex-col gap-3 rounded-[22px] border border-border bg-card p-4">
            <span className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Net worth</span>
              <Icon name="chevron_right" size={17} className="text-muted-foreground" />
            </span>
            <span className="font-display text-[40px] leading-none tabular-nums" style={worth < 0 ? { color: 'var(--destructive)' } : undefined}>
              {format(worth)}
            </span>
            <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3">
              {/* The three parts of the headline, so they add up to it: held, plus owed to you, less what you owe. */}
              <Mini term="Held" value={format(assetTotal)} />
              <Mini term="Owed to you" value={format(receivable)} />
              <Mini term="You owe" value={format(Math.abs(debtTotal))} />
            </dl>
          </Link>

          <Section title="Bank and cash">
            <List>
              {everyday.map((a, i) => (
                <EditAccount key={a.id} account={editable(a)} canWrite={canWrite} last={i === everyday.length - 1}>
                  <AccountLine a={a} rails={railsOn(a.id)} />
                </EditAccount>
              ))}
              {everyday.length === 0 && <Empty>No accounts yet.</Empty>}
            </List>
          </Section>

          {saved.length > 0 && (
            <Section title="Savings" note="Outside the monthly budget: money moved here is not spending.">
              <List>
                {saved.map((a, i) => (
                  <EditAccount key={a.id} account={editable(a)} canWrite={canWrite} last={i === saved.length - 1}>
                    <AccountLine a={a} rails={railsOn(a.id)} />
                  </EditAccount>
                ))}
              </List>
            </Section>
          )}
        </div>

        {cards.length > 0 && (
          <section aria-label="Credit cards" className="mt-5 flex flex-col gap-2">
            <h2 className="px-[calc(var(--gutter)+4px)] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Credit cards</h2>
            <CardDeck canWrite={canWrite} cards={cards.map((a): CardInfo => {
              const cyc = cycleFor(a.id);
              return {
                edit: editable(a),
                /* A card goes negative as it is spent on; a positive balance was overpaid and owes nothing. */
                owed: Math.max(0, -Number(a.balance)),
                limit: a.credit_limit ? Number(a.credit_limit) : null,
                cycle: cyc
                  ? { charged: Number(cyc.charged), entries: cyc.entries,
                      dueOn: new Date(cyc.due_on).toISOString().slice(0, 10) }
                  : null,
              };
            })} />
          </section>
        )}

        <div className="mt-5 flex flex-col gap-3 px-[var(--gutter)]">
          {canWrite && accounts.length > 0 && (
            <Link href="/accounts/reconcile" transitionTypes={['nav-forward']}
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4">
              <Icon name="done_all" size={20} className="text-primary" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold">Reconcile with a statement</span>
                <span className="text-xs text-muted-foreground">Match an account or card to what its statement says</span>
              </span>
              <Icon name="chevron_right" size={17} className="text-muted-foreground" />
            </Link>
          )}
          {canWrite && (
            <p className="px-1 text-xs leading-relaxed text-muted-foreground">
              Tap an account to rename it, correct its starting balance, or archive it. Swipe it to move money or reconcile.
            </p>
          )}
        </div>
        {canWrite && <div className="mt-1"><AddAccount startOpen={needsAccounts} /></div>}

        <div className="mt-5 flex flex-col gap-2 px-[var(--gutter)]">
          <Section title="Ways to pay"
            note="GPay, PhonePe, net banking, a debit card — each is linked to the account it takes money from, so what you spend through it comes off the right balance. Cash and credit cards are ways to pay on their own.">
            <List>
              {methods.map((m, i) => (
                <div key={m.id} className={`flex min-h-[68px] items-start gap-3 py-3 ${i === methods.length - 1 ? '' : 'border-b border-border'}`}>
                  <Chip icon={RAIL_ICON[m.kind] ?? 'tag'} tint={RAIL_TINT[m.kind] ?? 'neutral'} size={36} radius={10} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{m.name}</span>
                    {/* Which balance it spends, in as few words as the row has space for. */}
                    <span className="text-xs text-muted-foreground">
                      {(m.kind === 'card' && m.funds_kind === 'credit') || (m.kind === 'cash' && m.funds_kind === 'cash')
                        ? `The ${m.kind === 'card' ? 'card' : 'cash'} itself`
                        : `From ${m.funds}`}
                      {m.handle && ` · ${m.handle}`}
                    </span>
                    {canWrite && <span className="mt-0.5"><MethodControls id={m.id} isDefault={m.is_default} /></span>}
                  </span>
                </div>
              ))}
              {methods.length === 0 && <Empty>No apps or cards linked yet.</Empty>}
            </List>
          </Section>
        </div>

        {canWrite && <div className="mt-1"><AddMethod startOpen={needsMethods}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))} /></div>}

        {!canWrite && (
          <p className="mx-[var(--gutter)] mt-4 text-center text-sm text-muted-foreground">
            Only owners and contributing members can change accounts.
          </p>
        )}
        <TabBar current="/accounts" />
      </main>
    </Screen>
  );
}

function Mini({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[11px] text-muted-foreground">{term}</dt>
      <dd className="truncate text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {note && <p className="px-1 text-xs leading-relaxed text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-border bg-card px-4">{children}</div>;
}

type AccountRow = Awaited<ReturnType<typeof accountsWithBalances>>[number];

function AccountLine({ a, rails }: { a: AccountRow; rails: string[] }) {
  return (
    <>
      <Chip icon={ACCOUNT_ICON[a.kind]} tint={ACCOUNT_TINT[a.kind]} size={36} radius={10} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{a.name}</span>
        <span className="text-xs text-muted-foreground">
          {KIND_LABEL[a.kind]}{a.last4 && ` · ends ${a.last4}`}
          {a.reconciled_on && ` · matched ${new Date(`${a.reconciled_on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
        </span>
        {rails.length > 0 && <span className="truncate text-xs text-muted-foreground">Paid through {rails.join(', ')}</span>}
      </span>
      <span className="text-[17px] font-semibold tabular-nums" style={Number(a.balance) < 0 ? { color: 'var(--destructive)' } : undefined}>
        {format(Number(a.balance))}
      </span>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-5 text-center text-sm text-muted-foreground">{children}</p>;
}
