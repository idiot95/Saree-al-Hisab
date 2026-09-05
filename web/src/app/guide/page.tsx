import Link from 'next/link';
import { redirect } from 'next/navigation';
import { actorOrNull } from '@/db/queries';
import TabBar, { TAB_BAR_SPACE } from '../TabBar';
import { HEADER_BG } from '../auth-ui';

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
    title: 'Recording an entry',
    href: '/add', link: 'New entry',
    lines: [
      'Three choices: expense, income or transfer.',
      'Type the amount, pick how you paid and pick a category.',
      'If someone else in your household already recorded something similar, you are told before you save.',
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
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
      <header className="el2" style={{
        background: HEADER_BG, color: '#fff', borderRadius: '0 0 28px 28px',
        padding: '18px 20px 28px', display: 'flex', flexDirection: 'column', gap: 11,
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
          How it works
        </h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
          Seven things worth knowing. Two minutes.
        </p>
      </header>

      <ol style={{ margin: 0, padding: '20px 18px 0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {SECTIONS.map((s, i) => (
          <li key={s.title} className="el" style={{
            background: 'var(--c-card)', borderRadius: 18, padding: 16,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 26, height: 26, flex: 'none', borderRadius: 999, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700,
                background: 'var(--c-teal-l)', color: 'var(--c-teal)',
              }}>{i + 1}</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>
                {s.title}
              </h2>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {s.lines.map((l) => (
                <li key={l} style={{ display: 'flex', gap: 9, fontSize: 13.5, lineHeight: 1.5 }}>
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
              justifyContent: 'center', textDecoration: 'none', fontSize: 14.5, fontWeight: 600,
              background: 'var(--c-sunk)', color: 'var(--c-ink)',
            }}>{s.link}</Link>
          </li>
        ))}
      </ol>

      <Link href="/" style={{
        display: 'flex', margin: '20px 18px 0', minHeight: 52, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
        fontSize: 15.5, fontWeight: 600, color: '#fff',
        background: 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),'
          + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
      }}>Back to home</Link>
      <TabBar current="/guide" />
    </main>
  );
}
