import Link from '@/app/NavLink';
import { Icon } from './Icon';

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

export default function GettingStarted({ progress, budgetAskedAbove = false }: {
  progress: { accounts: number; methods: number; entries: number; members: number; budget: number };
  /** Home's own card already asks for the budget: the strip counts the step but does not ask twice. */
  budgetAskedAbove?: boolean;
}) {
  const steps: Step[] = [
    {
      title: 'Add your accounts',
      blurb: 'Your bank, your cards, cash.',
      href: '/accounts', cta: 'Add accounts', done: progress.accounts > 1,
    },
    {
      title: 'Link how you pay',
      blurb: 'GPay, PhonePe, a debit card, net banking.',
      href: '/accounts', cta: 'Add a way to pay', done: progress.methods > 1,
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
  const ask = budgetAskedAbove ? remaining.filter((s) => s.href !== '/budget') : remaining;
  if (ask.length === 0) return null;
  const next = ask[0];

  return (
    <Link href={next.href} transitionTypes={['nav-forward']}
      className="press flex min-h-[62px] items-center gap-3 rounded-[18px] bg-card px-3.5 py-3 text-foreground">
      {/* A ring rather than a bar: it takes a quarter of the width and reads as progress at a glance. */}
      <span className="relative size-9 flex-none">
        <svg width={36} height={36} viewBox="0 0 36 36" aria-hidden className="text-muted">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3.5" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--primary)" strokeWidth="3.5"
            strokeLinecap="round" transform="rotate(-90 18 18)"
            strokeDasharray={`${(done / steps.length) * 94.2} 94.2`} />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-[10px] font-bold tabular-nums text-muted-foreground">
          {done}/{steps.length}
        </span>
      </span>

      {/* The line wraps to a second rather than cutting off ("Setting u…" was the audit's §6.3). */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{next.title}</span>
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {next.blurb} Setting up · {done} of {steps.length} done
        </span>
      </span>

      <Icon name="chevron_right" size={20} className="text-muted-foreground" />
    </Link>
  );
}
