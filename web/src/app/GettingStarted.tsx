import Link from 'next/link';

/* Onboarding is a strip, not a screen.

   It used to be a tall card at the top of home, so the first thing anyone saw
   was a list of chores rather than what their month cost. A checklist earns
   one line until it is finished, and then it disappears — the app is for
   people who have already set it up, which is nearly all of the time. */

type Step = {
  title: string; blurb: string; href: string; cta: string;
  done: boolean;
  /* An optional step counts towards the ring but never holds the strip open —
     a household of one would otherwise be nagged to invite somebody forever. */
  optional?: boolean;
};

export default function GettingStarted({ progress }: {
  progress: { accounts: number; methods: number; entries: number; members: number; budget: number };
}) {
  const steps: Step[] = [
    {
      title: 'Add your accounts',
      blurb: 'Your bank, your cards, cash.',
      href: '/accounts', cta: 'Add accounts', done: progress.accounts > 1,
    },
    {
      title: 'Add how you pay',
      blurb: 'GPay, a card, net banking.',
      href: '/accounts', cta: 'Add a payment method', done: progress.methods > 1,
    },
    {
      title: 'Set this month’s budget',
      blurb: 'Everything reports against it.',
      href: '/budget', cta: 'Set the budget', done: progress.budget > 0,
    },
    {
      title: 'Record an entry',
      blurb: 'An expense, income or a transfer.',
      href: '/add', cta: 'New entry', done: progress.entries > 0,
    },
    {
      title: 'Invite your household',
      blurb: 'If anyone else keeps these books with you.',
      href: '/household', cta: 'Invite someone', done: progress.members > 1,
      optional: true,
    },
  ];

  const done = steps.filter((s) => s.done).length;
  /* Finished means every step that actually has to happen. The optional one
     is offered while there is other setup left and then stops asking. */
  const remaining = steps.filter((s) => !s.done && !s.optional);
  if (remaining.length === 0) return null;
  const next = remaining[0];

  return (
    <Link href={next.href} className="el card" style={{
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 62, padding: '0 var(--pad)',
      borderRadius: 15, textDecoration: 'none', background: 'var(--c-card)',
      border: '1px solid var(--c-border)', color: 'var(--c-ink)',
    }}>
      {/* A ring rather than a bar: it takes a quarter of the width and reads
          as progress at a glance. */}
      <span style={{ position: 'relative', width: 36, height: 36, flex: 'none' }}>
        <svg width={36} height={36} viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--c-track)" strokeWidth="3.5" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--c-seagrass)" strokeWidth="3.5"
            strokeLinecap="round" transform="rotate(-90 18 18)"
            strokeDasharray={`${(done / steps.length) * 94.2} 94.2`} />
        </svg>
        <span className="n" style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 'var(--step--2)', fontWeight: 700,
          color: 'var(--c-meta)',
        }}>{done}/{steps.length}</span>
      </span>

      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{next.title}</span>
        <span style={{
          fontSize: 'var(--step--1)', color: 'var(--c-meta)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{next.blurb} Setting up · {done} of {steps.length} done</span>
      </span>

      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--c-off)"
        strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
    </Link>
  );
}
