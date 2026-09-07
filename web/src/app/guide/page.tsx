import Link from 'next/link';
import { redirect } from 'next/navigation';
import { actorOrNull } from '@/db/queries';
import TabBar, { TAB_BAR_SPACE } from '../TabBar';
import { headerBg } from '../auth-ui';
import Screen from '../Screen';
import SwipeBack from '../SwipeBack';

export const metadata = { title: 'How it works · Quiet Ledger' };
export const dynamic = 'force-dynamic';

/* The short version of how the app is meant to be used. Reachable from the
   home screen at any time, not only on the first run — the questions it
   answers come back weeks later. */

const SECTIONS = [
  {
    title: 'Accounts hold your money',
    href: '/accounts', link: 'Open accounts',
    lines: [
      'A bank account, cash, savings and credit cards each get an entry here.',
      'Balances are worked out from what you record. You never edit a balance directly.',
      'Savings accounts sit outside the monthly budget, so moving money into savings is not spending.',
    ],
  },
  {
    title: 'Payment methods decide where spending lands',
    href: '/accounts', link: 'Open accounts',
    lines: [
      'GPay, a card, net banking, cash. Each one draws on exactly one account.',
      'When you record an expense you choose the payment method, not the account — so paying by GPay takes the money out of the bank behind it.',
      'This is why you never have to remember which app pulls from which bank.',
    ],
  },
  {
    title: 'Credit cards file themselves',
    href: '/accounts', link: 'Open accounts',
    lines: [
      'Give a card its statement day and due day when you add it.',
      'Every purchase then lands in the right billing cycle on its own.',
      'A purchase counts as spending on the day you made it. Paying the bill is a transfer, not spending, so it is never counted twice.',
    ],
  },
  {
    title: 'Categories are yours to shape',
    href: '/categories', link: 'Edit categories',
    lines: [
      'Rename, recolour and re-icon any of them, or add your own.',
      'Renaming is safe: every entry points at the category itself, so they all follow the new name and no month changes value.',
      'Retiring one stops it being offered for new entries. Nothing already filed under it moves, and it still shows in the months it was used.',
      'The order here is the order Add Entry offers them in, so the three you use daily are worth putting first.',
    ],
  },
  {
    title: 'The budget is the point',
    href: '/budget', link: 'Open budget',
    lines: [
      'Give each category an amount for the month. Everything you record then reports against it.',
      'Each month is its own set of figures — changing this month never rewrites the last one.',
      'A new month can start as a copy of the one before, so you set it once and adjust.',
      'Money moved into savings is not spending, so it never eats the budget.',
    ],
  },
  {
    title: 'Scanning a receipt',
    href: '/scan', link: 'Open scanning',
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
    href: '/worth', link: 'Open net worth',
    lines: [
      'Everything you hold, less everything you owe, in one figure.',
      'Money you have lent counts as yours, because it is — and money you owe someone counts against you.',
      'Savings are called out separately: they sit outside the monthly budget, so moving money there is not spending it.',
      'The line shows what was held in accounts month by month.',
    ],
  },
  {
    title: 'Things that come round every month',
    href: '/schedules', link: 'Open scheduled',
    lines: [
      'Rent, school fees, an EMI — set the amount, the day and how it is paid, once.',
      'Nothing is recorded until you say so. A schedule is a reminder with the details already filled in, not a standing instruction writing entries behind your back.',
      'When it is due it appears here and in the inbox, and one tap records it. The amount can be changed if this month differed.',
      'Days go up to 28, because every month has one — a reminder that moves is worse than none.',
    ],
  },
  {
    title: 'The inbox catches what slips',
    href: '/inbox', link: 'Open inbox',
    lines: [
      'If the same purchase looks like it was recorded twice, both entries are shown side by side and you decide.',
      'Two people in a household often record one purchase differently — he paid by card, she assumed cash — so that check deliberately ignores which account it was on.',
      'Saying "they are both real" is remembered, so a pair never asks twice.',
      'Card bills appear here as their due date approaches, with what is riding on them.',
    ],
  },
  {
    title: 'Seeing the shape of it',
    href: '/trends', link: 'Open trends',
    lines: [
      'Six months of spending as bars, with the budget marked on each one.',
      'This month broken down by category, with the amounts written out beside it.',
      'The biggest changes on last month, so a jump is visible before the statement arrives.',
      'Tap any category to see the entries behind the number.',
    ],
  },
  {
    title: 'Everything you have recorded',
    href: '/entries', link: 'Open entries',
    lines: [
      'Entries lists a month at a time, newest first, grouped by day.',
      'Tap any one to correct the amount, the date, the category or how it was paid.',
      'Correcting how it was paid moves the money to the account behind that method.',
      'Tapping a category on the budget or the home screen shows just that category.',
    ],
  },
  {
    title: 'Money you lend is not money you spent',
    href: '/people', link: 'Open lending',
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
    href: '/household', link: 'Open household',
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
      <SwipeBack to="/" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
        <header className="el2" style={{
          background: headerBg('slate'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 28px', display: 'flex', flexDirection: 'column', gap: 11,
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
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
            How it works
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
            Fourteen things worth knowing. Five minutes.
          </p>
        </header>

        <ol style={{ margin: 0, padding: '20px var(--gutter) 0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {SECTIONS.map((s, i) => (
            <li key={s.title} className="el" style={{
              background: 'var(--c-card)', borderRadius: 18, padding: 16,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 26, height: 26, flex: 'none', borderRadius: 999, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 'var(--step--1)', fontWeight: 700,
                  background: 'var(--c-teal-l)', color: 'var(--c-teal)',
                }}>{i + 1}</span>
                <h2 style={{ margin: 0, fontSize: 'var(--step-0)', fontWeight: 600, letterSpacing: '-.01em' }}>
                  {s.title}
                </h2>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {s.lines.map((l) => (
                  <li key={l} style={{ display: 'flex', gap: 9, fontSize: 'var(--step--1)', lineHeight: 1.5 }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: 999, background: 'var(--c-off)',
                      flex: 'none', marginTop: 7,
                    }} />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
              <Link href={s.href} style={{
                minHeight: 46, borderRadius: 12, display: 'flex', alignItems: 'center',
                justifyContent: 'center', textDecoration: 'none', fontSize: 'var(--step-0)', fontWeight: 600,
                background: 'var(--c-sunk)', color: 'var(--c-ink)',
              }}>{s.link}</Link>
            </li>
          ))}
        </ol>

        <Link transitionTypes={['nav-back']} href="/" style={{
          display: 'flex', margin: '20px 18px 0', minHeight: 52, borderRadius: 14,
          alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
          fontSize: 'var(--step-0)', fontWeight: 600, color: '#fff',
          background: 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),'
            + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
        }}>Back to home</Link>
        <TabBar current="/guide" />
      </main>
    </Screen>
  );
}
