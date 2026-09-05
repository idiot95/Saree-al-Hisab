import Link from 'next/link';
import { format } from '@/lib/money';

type Row = { category_id: string; name: string; tint: string; budget: string; spent: string };

const TINT: Record<string, string> = {
  green: 'var(--cat-green-ink)', orange: 'var(--cat-orange-ink)', blue: 'var(--cat-blue-ink)',
  purple: 'var(--cat-purple-ink)', pink: 'var(--cat-pink-ink)', cyan: 'var(--cat-cyan-ink)',
  rust: 'var(--cat-rust-ink)', indigo: 'var(--cat-indigo-ink)',
};

/* The month against its budget, which is the whole point of the app. Pace is
   the useful part: being 60% through the money is fine on the 20th and a
   problem on the 6th, and only one of those is visible from a total. */
export default function MonthSoFar({ month, rows, budget, spent }: {
  month: string; rows: Row[]; budget: number; spent: number;
}) {
  const now = new Date();
  const start = new Date(month);
  const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const sameMonth = now.getFullYear() === start.getFullYear() && now.getMonth() === start.getMonth();
  const dayOfMonth = sameMonth ? now.getDate() : days;
  const throughMonth = dayOfMonth / days;
  const throughMoney = budget > 0 ? spent / budget : 0;

  const over = budget > 0 && spent > budget;
  const ahead = budget > 0 && !over && throughMoney > throughMonth + 0.08;
  const left = budget - spent;

  const withBudget = rows.filter((r) => Number(r.budget) > 0);
  const top = [...withBudget].sort((a, b) => Number(b.spent) - Number(a.spent)).slice(0, 4);

  return (
    <section className="el" style={{
      background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 600, flex: 1 }}>
          {start.toLocaleDateString('en-IN', { month: 'long' })} so far
        </h2>
        <Link href="/budget" style={{
          fontSize: 13, fontWeight: 600, color: 'var(--c-teal)', textDecoration: 'none',
        }}>Budget</Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <span className="t" style={{ fontSize: 32, letterSpacing: '-.022em', lineHeight: 1 }}>
          {format(spent)}
        </span>
        <span style={{ fontSize: 13.5, color: 'var(--c-meta)', paddingBottom: 3 }}>
          of {format(budget)}
        </span>
      </div>

      {/* The bar carries a marker for how far through the month it is, so the
          question "am I going too fast" is answered by looking, not by sums. */}
      <span style={{ position: 'relative', display: 'block', height: 10 }}>
        <span style={{
          position: 'absolute', inset: 0, borderRadius: 999,
          background: 'var(--c-track)', overflow: 'hidden',
        }}>
          <span style={{
            display: 'block', height: '100%', borderRadius: 999,
            width: `${Math.min(100, throughMoney * 100)}%`,
            background: over ? 'var(--c-danger-fill)'
              : ahead ? 'var(--c-warn-fill)' : 'var(--c-ok-fill)',
          }} />
        </span>
        {sameMonth && (
          <span aria-hidden style={{
            position: 'absolute', top: -3, bottom: -3, width: 2, borderRadius: 2,
            left: `calc(${Math.min(100, throughMonth * 100)}% - 1px)`,
            background: 'var(--c-ink)', opacity: 0.5,
          }} />
        )}
      </span>

      <p style={{
        margin: 0, fontSize: 13, lineHeight: 1.45,
        color: over ? 'var(--c-danger)' : ahead ? 'var(--c-warn)' : 'var(--c-meta)',
        fontWeight: over || ahead ? 600 : 400,
      }}>
        {over
          ? `${format(-left)} over budget with ${days - dayOfMonth} days to go.`
          : ahead
            ? `${format(left)} left, and ${days - dayOfMonth} days. Going a little fast.`
            : sameMonth
              ? `${format(left)} left for the last ${days - dayOfMonth} days of the month.`
              : `${format(left)} of the budget was not spent.`}
      </p>

      {top.length > 0 && (
        <ul style={{
          margin: 0, padding: '3px 0 0', listStyle: 'none',
          display: 'flex', flexDirection: 'column', gap: 9,
        }}>
          {top.map((r) => {
            const b = Number(r.budget); const s = Number(r.spent);
            const pct = b > 0 ? Math.min(100, (s / b) * 100) : 0;
            const isOver = s > b;
            return (
              <li key={r.category_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 12.5, width: 92, overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', color: 'var(--c-meta)',
                }}>{r.name}</span>
                <span style={{
                  flex: 1, height: 6, borderRadius: 999, background: 'var(--c-track)',
                  overflow: 'hidden',
                }}>
                  <span style={{
                    display: 'block', height: '100%', borderRadius: 999, width: `${pct}%`,
                    background: isOver ? 'var(--c-danger-fill)' : TINT[r.tint] ?? 'var(--c-seagrass)',
                  }} />
                </span>
                <span style={{
                  fontSize: 12, width: 74, textAlign: 'right', fontWeight: 600,
                  color: isOver ? 'var(--c-danger)' : 'var(--c-meta)',
                }}>{format(s)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
