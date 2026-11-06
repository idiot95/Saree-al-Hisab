import Link from '@/app/NavLink';
import { redirect } from 'next/navigation';
import { actorOrNull } from '@/db/queries';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import PageHead from '../PageHead';
import Screen from '../Screen';

export const metadata = { title: 'How it works · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/* The short version of how the app is meant to be used. Reachable from the
   home screen at any time, not only on the first run — the questions it
   answers come back weeks later. */

const SECTIONS = [
  {
    title: 'Accounts hold your money',
    href: '/accounts', link: 'Money › Accounts',
    lines: [
      'A bank account, cash, savings and credit cards each get an entry here.',
      'Balances are worked out from what you record. You never edit a balance directly.',
      'Savings accounts sit outside the monthly budget, so moving money into savings is not spending.',
    ],
  },
  {
    title: 'Say how you paid, and the right balance moves',
    href: '/accounts', link: 'Money › Accounts',
    lines: [
      'GPay, PhonePe, net banking and a debit card are each linked to the one bank account they take money from. Cash and a credit card are ways to pay on their own.',
      'When you record an expense you pick one tile — "GPay", "Cash", the card, or the bank directly — and the money comes off the account behind it.',
      'This is why you never have to remember which app pulls from which bank.',
    ],
  },
  {
    title: 'Credit cards file themselves',
    href: '/accounts', link: 'Money › Accounts',
    lines: [
      'Give a card its statement day and due day when you add it.',
      'Every purchase then lands in the right billing cycle on its own.',
      'A purchase counts as spending on the day you made it. Paying the bill is a transfer, not spending, so it is never counted twice.',
    ],
  },
  {
    title: 'Categories are yours to shape',
    href: '/categories', link: 'Plan › Categories',
    lines: [
      'Rename, recolour and re-icon any of them, or add your own.',
      'Renaming is safe: every entry points at the category itself, so they all follow the new name and no month changes value.',
      'Retiring one stops it being offered for new entries. Nothing already filed under it moves, and it still shows in the months it was used.',
      'The order here is the order Add Entry offers them in, so the three you use daily are worth putting first.',
    ],
  },
  {
    title: 'The budget is the point',
    href: '/budget', link: 'Plan › Budget',
    lines: [
      'Give each category an amount for the month. Everything you record then reports against it.',
      'Each month is its own set of figures — changing this month never rewrites the last one.',
      'A new month can start as a copy of the one before, so you set it once and adjust.',
      'Money moved into savings is not spending, so it never eats the budget.',
    ],
  },
  {
    title: 'Scanning a receipt',
    href: '/scan', link: 'Scan a receipt',
    lines: [
      'Photograph a receipt and the total, date and shop are read off it.',
      'Nothing is ever recorded for you. What comes back is a draft you check and save yourself — a figure guessed from a blurred receipt is worse than one you typed.',
      'If the amount, the date or whether money went out cannot be read, it says so and hands you a blank entry instead of guessing.',
      'It needs a free Google AI key, added once under Household. The key is yours, stored encrypted, and every scan is billed to your own quota.',
    ],
  },
  {
    title: 'Recording an entry',
    href: '/add', link: 'New entry',
    lines: [
      'Three choices: expense, income or transfer.',
      'Type the amount, pick how you paid and pick a category.',
      'If someone else in your household already recorded something similar, you are told before you save.',
    ],
  },
  {
    title: 'What it all adds up to',
    href: '/worth', link: 'Money › Net worth',
    lines: [
      'Everything you hold, less everything you owe, in one figure.',
      'Money you have lent counts as yours, because it is — and money you owe someone counts against you.',
      'Savings are called out separately: they sit outside the monthly budget, so moving money there is not spending it.',
      'The line shows what was held in accounts month by month.',
    ],
  },
  {
    title: 'Things that come round every month',
    href: '/entries?f=upcoming', link: 'Activity › Upcoming',
    lines: [
      'Rent, school fees, an EMI — set the amount, the day and how it is paid, once.',
      'Nothing is recorded until you say so. A schedule is a reminder with the details already filled in, not a standing instruction writing entries behind your back.',
      'When it is due it appears here, under Upcoming and on Home, and one tap records it. The amount can be changed if this month differed.',
      'Days go up to 28, because every month has one — a reminder that moves is worse than none.',
    ],
  },
  {
    title: 'To review catches what slips',
    href: '/entries?f=review', link: 'Activity › To review',
    lines: [
      'If the same purchase looks like it was recorded twice, both entries are shown side by side and you decide.',
      'Two people in a household often record one purchase differently — he paid by card, she assumed cash — so that check deliberately ignores which account it was on.',
      'Saying "they are both real" is remembered, so a pair never asks twice.',
      'Card bills appear here as their due date approaches, with what is riding on them.',
    ],
  },
  {
    title: 'Seeing the shape of it',
    href: '/budget#trends', link: 'Plan › Trends',
    lines: [
      'Six months of spending as a line, with the budget as a dashed line beside it.',
      'This month by category, largest first, with the amounts written out beside each bar.',
      'The biggest changes on last month, so a jump is visible before the statement arrives.',
      'Tap any category to see the entries behind the number.',
    ],
  },
  {
    title: 'Everything you have recorded',
    href: '/entries', link: 'Activity › Entries',
    lines: [
      'Entries lists a month at a time, newest first, grouped by day.',
      'Tap any one to correct the amount, the date, the category or how it was paid.',
      'Correcting how it was paid moves the money to the account behind that method.',
      'Tapping a category on the budget or the home screen shows just that category.',
    ],
  },
  {
    title: 'Money you lend is not money you spent',
    href: '/people', link: 'Loans',
    lines: [
      'Add anyone you lend to or borrow from, and every rupee between you is tracked.',
      'Lending moves money from your account into theirs. It never touches the monthly budget, because you have not spent it.',
      'Money coming back is not income either — it was never spending in the first place.',
      'Writing off what someone owes IS spending, counted in the month you forgive it. That is the moment the money is actually gone.',
      'Paying for something someone else owes part of is different again: open the entry and record who owes you. Your spending stays as it was — you did pay for it — and what comes back is tracked separately.',
      'Books are folders for people — a flat, a trip, office lunches — so you can see where a whole group stands without adding it up yourself.',
    ],
  },
  {
    title: 'Your household shares one set of books',
    href: '/household', link: 'Household and settings',
    lines: [
      'Everyone you invite sees every entry and every budget.',
      'Owners can invite people, change what they can do and remove them.',
      'Contributing members add and edit entries. Viewers can only read.',
      'You can also keep more than one household — your own and a shop, say — and switch between them.',
    ],
  },
];

export default async function Guide() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');

  return (
    <Screen>
      <main style={{ minHeight: '100dvh', background: 'var(--background)', paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back="/" title="How it works" sub={`${SECTIONS.length} things worth knowing. Tap one to open it.`} />

        {/* One list, each topic shut until tapped: the questions come back one at a time, weeks apart, and fourteen
            open cards were a 5,000px scroll to find one of them. Native <details>, so it opens with no script. */}
        <ol className="mx-[var(--gutter)] overflow-hidden rounded-2xl border border-border bg-card">
          {SECTIONS.map((s, i) => (
            <li key={s.title} className={i === 0 ? '' : 'border-t border-border'}>
              <details className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2">
                  <span className="grid size-7 flex-none place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{i + 1}</span>
                  <span className="flex-1 text-[15px] font-semibold">{s.title}</span>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden
                    className="flex-none text-muted-foreground transition-transform group-open:rotate-180"
                    strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </summary>
                <div className="flex flex-col gap-2.5 pb-4 pl-14 pr-4">
                  {s.lines.map((l) => <p key={l} className="text-sm leading-relaxed text-muted-foreground">{l}</p>)}
                  <Link href={s.href} transitionTypes={['nav-forward']} className="flex min-h-11 items-center self-start text-sm font-semibold text-primary">
                    {s.link} →
                  </Link>
                </div>
              </details>
            </li>
          ))}
        </ol>
        <TabBar current="/guide" />
      </main>
    </Screen>
  );
}
