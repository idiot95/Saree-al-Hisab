import Link from '@/app/NavLink';
import { EmptyLine } from '../entries/parts';
import { redirect } from 'next/navigation';
import { Chip, RAIL_ICON, RAIL_TINT, ACCOUNT_ICON, ACCOUNT_TINT } from '../Icon';
import {
  actorOrNull, accountsWithBalances, methodsWithFunding, openCyclesFor,
} from '@/db/queries';
import { worthInput } from '@/db/worth';
import { netWorth } from '@/lib/worth';
import PageHead from '../PageHead';
import { withHousehold } from '@/db/client';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import AddAccount from './AddAccount';
import AddMethod from './AddMethod';
import EditAccount, { type Editable } from './EditAccount';
import { MethodControls } from './Retire';
import CardDeck, { type CardInfo } from './CardDeck';
import Screen from '../Screen';
import { Icon } from '../Icon';
import { Figure } from '../Figure';

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
  const [accounts, methods, cycles, wi] = await withHousehold(hh, () => Promise.all([
    accountsWithBalances(hh),
    methodsWithFunding(hh),
    openCyclesFor(hh),
    /* Read the way Wealth and Home read it — worthInput, holdings included — without waiting on a rate provider:
       holdings are valued at the last stored rates, as on Home. */
    worthInput(hh, actor.currency, { refreshRates: false }),
  ]));
  const members = wi.members;
  /* The same figure Wealth and Home show, from the same inputs and the same helper. */
  const { worth, receivable, assetTotal, debtTotal } = netWorth(wi.input);

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
  const owners = members.map((m) => ({ id: m.id, name: m.id === actor.user_id ? `${m.name} (you)` : m.name }));
  const editable = (a: (typeof accounts)[number]): Editable => ({
    id: a.id, name: a.name, kind: a.kind, last4: a.last4,
    bank_key: a.bank_key, card_network: a.card_network,
    opening: Number(a.opening_balance), limit: a.credit_limit ? Number(a.credit_limit) : null,
    statement_day: a.statement_day, due_day: a.due_day, methods: a.methods,
    owner: a.owner_user_id,
    owners,
  });

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back="/worth" title="Accounts" sub={name} />

        <div className="flex flex-col gap-6 pb-8">
          <div className="flex flex-col gap-6 px-[var(--gutter)]">
            {/* The same figure Wealth shows, from the same helper; a tap goes there. */}
            <Link href="/worth" motion="fade" aria-label="Net worth, open Wealth"
              className="press flex flex-col gap-3 rounded-[22px] bg-card shadow-card p-4 text-foreground no-underline">
              <span className="flex items-center justify-between">
                <span className="text-subhead text-muted-foreground">Net worth</span>
                <Icon name="chevron_right" size={20} className="text-muted-foreground" />
              </span>
              <Figure minor={worth}
                className={`text-large-title font-bold leading-none tracking-tight tabular-nums ${worth < 0 ? 'text-destructive' : ''}`} />
              <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3">
                {/* The three parts of the headline, so they add up to it: held, plus owed to you, less what you owe. */}
                <Mini term="Held" value={assetTotal} />
                <Mini term="Owed to you" value={receivable} />
                <Mini term="You owe" value={Math.abs(debtTotal)} />
              </dl>
            </Link>

            <Section title="Bank and cash">
              <List>
                {everyday.map((a, i) => (
                  <EditAccount key={a.id} account={editable(a)} canWrite={canWrite} last={i === everyday.length - 1}>
                    <AccountLine a={a} rails={railsOn(a.id)} />
                  </EditAccount>
                ))}
                {everyday.length === 0 && <Empty icon="account_balance">No bank account or cash yet.{canWrite && ' Add one below.'}</Empty>}
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
            <section aria-labelledby="sec-cards" className="flex flex-col gap-1.5">
              <h2 id="sec-cards" className="px-[calc(var(--gutter)+2px)] text-subhead font-semibold text-muted-foreground">Credit cards</h2>
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

          <div className="flex flex-col gap-3 px-[var(--gutter)]">
            {canWrite && accounts.length > 0 && (
              <Link href="/accounts/reconcile"
                className="press flex min-h-16 items-center gap-3 rounded-[20px] bg-card shadow-card px-[var(--pad)] py-3 text-foreground no-underline">
                <span className="grid size-[38px] flex-none place-items-center rounded-full bg-accent text-accent-foreground">
                  <Icon name="done_all" size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-body font-semibold">Reconcile with a statement</span>
                  <span className="text-subhead leading-snug text-muted-foreground">Match an account or card to what its statement says</span>
                </span>
                <Icon name="chevron_right" size={20} className="flex-none text-muted-foreground" />
              </Link>
            )}
            {canWrite && <AddAccount startOpen={needsAccounts} />}
            {canWrite && (
              <p className="px-0.5 text-subhead leading-snug text-muted-foreground">
                Tap an account to rename it, correct its starting balance, or archive it. Swipe it to move money or reconcile.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 px-[var(--gutter)]">
            <Section title="Ways to pay"
              note="GPay, PhonePe, net banking, a debit card — each is linked to the account it takes money from, so what you spend through it comes off the right balance. Cash and credit cards are ways to pay on their own.">
              <List>
                {methods.map((m, i) => (
                  <div key={m.id} className={`flex min-h-[68px] items-start gap-3 py-3 ${i === methods.length - 1 ? '' : 'border-b border-border'}`}>
                    <Chip icon={RAIL_ICON[m.kind] ?? 'tag'} tint={RAIL_TINT[m.kind] ?? 'neutral'} size={38} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-body font-semibold leading-snug [overflow-wrap:anywhere]">{m.name}</span>
                      {/* Which balance it spends, in as few words as the row has space for. */}
                      <span className="text-subhead leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                        {(m.kind === 'card' && m.funds_kind === 'credit') || (m.kind === 'cash' && m.funds_kind === 'cash')
                          ? `The ${m.kind === 'card' ? 'card' : 'cash'} itself`
                          : `From ${m.funds}`}
                        {m.handle && ` · ${m.handle}`}
                      </span>
                      {canWrite && <div className="mt-0.5"><MethodControls id={m.id} isDefault={m.is_default} /></div>}
                    </div>
                  </div>
                ))}
                {methods.length === 0 && <Empty icon="qr_code_2">No apps or cards linked yet.</Empty>}
              </List>
            </Section>
            {canWrite && <AddMethod startOpen={needsMethods}
              accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))} />}
          </div>

          {!canWrite && (
            <p className="mx-[var(--gutter)] flex items-start justify-center gap-1.5 text-center text-subhead text-muted-foreground">
              <Icon name="lock" size={16} className="mt-px" />
              Only owners and contributing members can change accounts.
            </p>
          )}
        </div>
        <TabBar current="/accounts" />
      </main>
    </Screen>
  );
}

function Mini({ term, value }: { term: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-footnote text-muted-foreground">{term}</dt>
      <dd className="text-body font-semibold tabular-nums [overflow-wrap:anywhere]"><Figure minor={value} /></dd>
    </div>
  );
}

/* A section's label over its card, as on Wealth, Loans and Household: named by its heading. */
function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  const id = `sec-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <h2 id={id} className="px-0.5 text-subhead font-semibold text-muted-foreground">{title}</h2>
      {note && <p className="px-0.5 pb-0.5 text-subhead leading-snug text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

/* One list card. px-[var(--pad)] and overflow-hidden: a swipe row's negative margin is --pad, so its actions stop
   at the rounded edge and the card never scrolls sideways. */
function List({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-[20px] bg-card shadow-card px-[var(--pad)]">{children}</div>;
}

type AccountRow = Awaited<ReturnType<typeof accountsWithBalances>>[number];

/* The account's chip, its name and what it is, and its balance as a Figure (it rolls when an edit or a
   reconciliation moves it). Names and rails wrap to a second line rather than being cut off. */
function AccountLine({ a, rails }: { a: AccountRow; rails: string[] }) {
  const bal = Number(a.balance);
  return (
    <>
      <Chip icon={ACCOUNT_ICON[a.kind]} tint={ACCOUNT_TINT[a.kind]} size={38} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-semibold leading-snug [overflow-wrap:anywhere]">{a.name}</span>
        <span className="text-subhead leading-snug text-muted-foreground">
          {KIND_LABEL[a.kind]}{a.last4 && ` · ends ${a.last4}`}
          {a.reconciled_on && <> · <Icon name="check" size={13} className="align-[-2px]" /> matched {new Date(`${a.reconciled_on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>}
        </span>
        {rails.length > 0 && <span className="text-subhead leading-snug text-muted-foreground [overflow-wrap:anywhere]">Paid through {rails.join(', ')}</span>}
      </span>
      <span className="flex flex-none flex-col items-end gap-0.5">
        <Figure minor={bal} className={`text-body font-semibold tabular-nums ${bal < 0 ? 'text-destructive' : ''}`} />
        {bal < 0 && <span className="flex items-center gap-0.5 text-footnote font-medium text-destructive"><Icon name="warning" size={13} />Overdrawn</span>}
      </span>
    </>
  );
}

function Empty({ icon, children }: { icon: string; children: React.ReactNode }) {
  return <EmptyLine icon={icon} className="">{children}</EmptyLine>;
}
