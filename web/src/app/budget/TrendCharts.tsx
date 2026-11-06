'use client';

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { useMoney } from '../currency';

/* Plan's two charts, loaded lazily (LazyCharts.tsx) because Recharts is a large library and both sit below the
   fold. Each states its figures in words as well: the table under the chart is the record, the shape is the quick
   read, and the chart's label carries every month for a screen reader. */

export type SpendPoint = { label: string; spent: number; budget: number | null };
export type BackPoint = { label: string; back: number };

const spendConfig = {
  spent: { label: 'Spent', color: 'var(--chart-1)' },
  budget: { label: 'Budget', color: 'var(--muted-foreground)' },
} satisfies ChartConfig;

/** Six months of spending as a line, with the budget as a dashed line where there was one. */
export function SpendLine({ points }: { points: SpendPoint[] }) {
  const { format } = useMoney();
  const budgeted = points.some((p) => p.budget !== null);
  return (
    <ChartContainer config={spendConfig} className="aspect-auto h-36 w-full" role="img"
      aria-label={`Spending over ${points.length} months: ${points.map((p) => `${p.label} ${format(p.spent)}`).join(', ')}`}>
      <LineChart data={points} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} interval={0} padding={{ left: 14, right: 14 }} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value, name) => (
          <span className="flex w-full justify-between gap-3">
            <span className="text-muted-foreground">{spendConfig[name as keyof typeof spendConfig]?.label ?? name}</span>
            <span className="font-semibold tabular-nums">{format(Number(value))}</span>
          </span>
        )} />} />
        {budgeted && (
          <Line dataKey="budget" type="linear" stroke="var(--color-budget)" strokeWidth={1.5} strokeDasharray="4 3"
            dot={{ r: 3, fill: 'var(--card)', stroke: 'var(--color-budget)', strokeWidth: 1.5 }}
            connectNulls={false} isAnimationActive={false} />
        )}
        <Line dataKey="spent" type="monotone" stroke="var(--color-spent)" strokeWidth={2.5}
          dot={{ r: 3, fill: 'var(--color-spent)' }} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}

const backConfig = { back: { label: 'Came back', color: 'var(--chart-1)' } } satisfies ChartConfig;

/** Money that came back, a bar a month; this month is the lit bar and the rest recede. */
export function BackBars({ points }: { points: BackPoint[] }) {
  const { format } = useMoney();
  return (
    <ChartContainer config={backConfig} className="aspect-auto h-32 w-full" role="img"
      aria-label={`Money back over ${points.length} months: ${points.map((p) => `${p.label} ${format(p.back)}`).join(', ')}`}>
      <BarChart data={points} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} interval={0} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator formatter={(value) => (
          <span className="font-semibold tabular-nums">{format(Number(value))}</span>
        )} />} />
        <Bar dataKey="back" radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false}>
          {points.map((p, i) => (
            <Cell key={p.label} fill={i === points.length - 1 ? 'var(--color-back)' : 'var(--input)'} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
