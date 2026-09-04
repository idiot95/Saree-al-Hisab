import Link from 'next/link';

/* The steps tick themselves off from real rows. Nothing here is a flag that
   somebody has to remember to set, so it cannot drift out of step with what
   the household has actually done. */

type Step = { title: string; blurb: string; href: string; cta: string; done: boolean };

export default function GettingStarted({ progress }: {
  progress: { accounts: number; methods: number; entries: number; members: number };
}) {
  const steps: Step[] = [
    {
      title: 'Add your accounts',
      blurb: 'Your bank, your cards, cash. Credit cards can hold their billing cycle.',
      href: '/accounts', cta: 'Go to accounts',
      done: progress.accounts > 1,
    },
    {
      title: 'Add how you pay',
      blurb: 'GPay, a card, net banking. Each one draws on an account.',
      href: '/accounts', cta: 'Go to accounts',
      done: progress.methods > 1,
    },
    {
      title: 'Record an entry',
      blurb: 'An expense, some income or a transfer. Three taps.',
      href: '/add', cta: 'New entry',
      done: progress.entries > 0,
    },
    {
      title: 'Invite your household',
      blurb: 'Optional. Everyone you invite sees the same set of books.',
      href: '/household', cta: 'Go to household',
      done: progress.members > 1,
    },
  ];

  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.find((s) => !s.done)!;

  return (
    <section className="el" style={{
      background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 600, flex: 1 }}>Getting started</h2>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)' }}>
          {done} of {steps.length}
        </span>
      </div>

      <span style={{ height: 6, borderRadius: 999, background: 'var(--c-track)', overflow: 'hidden' }}>
        <span style={{
          display: 'block', height: '100%', borderRadius: 999,
          width: `${(done / steps.length) * 100}%`, background: 'var(--c-seagrass)',
        }} />
      </span>

      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
        {steps.map((s, i) => (
          <li key={s.title} style={{
            display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 0',
            borderBottom: i === steps.length - 1 ? undefined : '1px solid var(--c-rule)',
            opacity: s.done ? 0.55 : 1,
          }}>
            <span style={{
              width: 24, height: 24, flex: 'none', borderRadius: 999, marginTop: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: s.done ? 'var(--c-ok-fill)' : 'var(--c-sunk)',
              color: s.done ? 'var(--c-on-fill)' : 'var(--c-meta)',
              fontSize: 11.5, fontWeight: 700,
            }}>
              {s.done ? (
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12.5 10 17.5 19 7" />
                </svg>
              ) : i + 1}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{
                fontSize: 14.5, fontWeight: 600,
                textDecoration: s.done ? 'line-through' : undefined,
              }}>{s.title}</span>
              {!s.done && (
                <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--c-meta)' }}>
                  {s.blurb}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>

      {/* The New entry button sits directly below this card, so pointing at it
          again here would just be the same button twice. */}
      {next.href !== '/add' && (
        <Link href={next.href} className="el" style={{
          minHeight: 50, borderRadius: 13, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8, textDecoration: 'none', fontSize: 15.5, fontWeight: 600,
          background: 'var(--c-seagrass)', color: 'var(--c-on-fill)',
        }}>
          {next.cta}
        </Link>
      )}
    </section>
  );
}
