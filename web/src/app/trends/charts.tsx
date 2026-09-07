import { format } from '@/lib/money';

/* Plain SVG, rendered on the server. No chart library: nothing to download,
   nothing to execute, and the Content-Security-Policy stays closed. It also
   means these draw identically before any JavaScript arrives.

   Every chart states its numbers in text as well as in shape. Colour and
   length are how you read it at a glance; the words are how you read it if you
   cannot tell the colours apart, or the bar is two pixels tall. */

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)',
                'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];

const TINT: Record<string, string> = {
  green: 'var(--cat-green-ink)', orange: 'var(--cat-orange-ink)',
  blue: 'var(--cat-blue-ink)', purple: 'var(--cat-purple-ink)',
  pink: 'var(--cat-pink-ink)', cyan: 'var(--cat-cyan-ink)',
  rust: 'var(--cat-rust-ink)', indigo: 'var(--cat-indigo-ink)',
};

/* ── months, as bars against the budget line ────────────────────────────── */

export function MonthBars({ points }: {
  points: { month: string; spent: string; budget: string }[];
}) {
  const W = 320, H = 132, PAD = 18;
  const max = Math.max(
    ...points.map((p) => Math.max(Number(p.spent), Number(p.budget))), 1);
  const bw = (W - PAD * 2) / points.length;

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
        aria-label={`Spending over ${points.length} months. `
          + points.map((p) => `${label(p.month)} ${format(Number(p.spent))}`).join(', ')}
        style={{ display: 'block', overflow: 'visible' }}>
        {points.map((p, i) => {
          const spent = Number(p.spent), budget = Number(p.budget);
          const x = PAD + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const h = Math.max(spent > 0 ? 3 : 0, (spent / max) * (H - 42));
          const y = H - 22 - h;
          const over = budget > 0 && spent > budget;
          const by = budget > 0 ? H - 22 - (budget / max) * (H - 42) : null;
          return (
            <g key={p.month}>
              {by !== null && (
                <line x1={x - 3} x2={x + w + 3} y1={by} y2={by}
                  stroke="var(--c-dash)" strokeWidth={1.5} strokeDasharray="3 2" />
              )}
              <rect x={x} y={y} width={w} height={h} rx={4}
                fill={over ? 'var(--c-danger-fill)' : 'var(--c-seagrass)'} />
              <text x={x + w / 2} y={H - 8} textAnchor="middle"
                fontSize={9.5} fill="var(--c-meta)">{label(p.month)}</text>
            </g>
          );
        })}
      </svg>
      <figcaption style={{
        display: 'flex', gap: 14, marginTop: 8, fontSize: 11.5, color: 'var(--c-meta)',
      }}>
        <Key colour="var(--c-seagrass)">spent</Key>
        <Key dashed>budget</Key>
        <Key colour="var(--c-danger-fill)">over</Key>
      </figcaption>
    </figure>
  );
}

/* ── this month, as a ring ──────────────────────────────────────────────── */

export function CategoryDonut({ slices, total }: {
  slices: { id: string; name: string; amount: number; tint: string }[]; total: number;
}) {
  const S = 150, R = 62, T = 22, C = S / 2;
  let angle = -Math.PI / 2;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <svg viewBox={`0 0 ${S} ${S}`} width={S} height={S} role="img"
        aria-label={`Spending by category. ${slices.map((s) =>
          `${s.name} ${format(s.amount)}`).join(', ')}`}
        style={{ flex: 'none' }}>
        {slices.map((s, i) => {
          const frac = s.amount / total;
          const start = angle;
          const end = angle + frac * Math.PI * 2;
          angle = end;
          // A single slice is a full circle, which an arc path cannot draw.
          if (frac >= 0.9999) {
            return <circle key={s.id} cx={C} cy={C} r={R - T / 2} fill="none"
              stroke={TINT[s.tint] ?? SERIES[i % 6]} strokeWidth={T} />;
          }
          return (
            <path key={s.id} d={arc(C, C, R - T / 2, start, end)} fill="none"
              stroke={TINT[s.tint] ?? SERIES[i % 6]} strokeWidth={T} strokeLinecap="butt" />
          );
        })}
        <text x={C} y={C - 3} textAnchor="middle" fontSize={16} fontWeight={600}
          fill="var(--c-ink)" className="t">{format(total)}</text>
        <text x={C} y={C + 13} textAnchor="middle" fontSize={9.5} fill="var(--c-meta)">
          this month
        </text>
      </svg>

      <ul style={{
        flex: 1, minWidth: 150, margin: 0, padding: 0, listStyle: 'none',
        display: 'flex', flexDirection: 'column', gap: 7,
      }}>
        {slices.map((s, i) => (
          <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{
              width: 9, height: 9, borderRadius: 3, flex: 'none',
              background: TINT[s.tint] ?? SERIES[i % 6],
            }} />
            <span style={{
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{s.name}</span>
            <span style={{ color: 'var(--c-meta)' }}>
              {Math.round((s.amount / total) * 100)}%
            </span>
            <span style={{ fontWeight: 600, minWidth: 62, textAlign: 'right' }}>
              {format(s.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function Key({ children, colour, dashed }: {
  children: React.ReactNode; colour?: string; dashed?: boolean;
}) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 12, height: dashed ? 0 : 8, borderRadius: 2, flex: 'none',
        background: dashed ? undefined : colour,
        borderTop: dashed ? '1.5px dashed var(--c-dash)' : undefined,
      }} />
      {children}
    </span>
  );
}

export function label(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short' });
}
