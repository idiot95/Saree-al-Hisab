'use client';

import { Area, AreaChart, XAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { useMoney } from '../currency';
import type { SeriesPoint } from './types';

/* Held in accounts and the holdings, at each month-end, stacked. Accounts only — no people: what was owed to
   you months ago is not something the books keep, so the line says "held" and means it. The words under the
   chart (WealthView, drawn with the page) are the record; the shape is the quick read. */
const config = {
  held: { label: 'In accounts', color: 'var(--chart-1)' },
  holdings: { label: 'Pots, gold & silver', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export default function WorthChart({ series }: { series: SeriesPoint[] }) {
  const { format } = useMoney();
  const total = (p: SeriesPoint) => p.held + p.holdings;
  return (
    <ChartContainer config={config} className="aspect-auto h-36 w-full"
      aria-label={`Held each month: ${series.map((p) => `${p.month} ${format(total(p))}`).join(', ')}`} role="img">
      <AreaChart data={series} margin={{ left: 4, right: 4, top: 6, bottom: 0 }}>
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={6} interval={0} padding={{ left: 12, right: 12 }} />
        <ChartTooltip cursor={false}
          content={<ChartTooltipContent formatter={(value, name) => (
            <span className="flex w-full justify-between gap-3">
              <span className="text-muted-foreground">{config[name as keyof typeof config]?.label ?? name}</span>
              <span className="font-semibold tabular-nums">{format(Number(value))}</span>
            </span>
          )} />} />
        <Area dataKey="held" type="monotone" stackId="w" stroke="var(--color-held)" fill="var(--color-held)" fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} />
        <Area dataKey="holdings" type="monotone" stackId="w" stroke="var(--color-holdings)" fill="var(--color-holdings)" fillOpacity={0.3} strokeWidth={2} isAnimationActive={false} />
      </AreaChart>
    </ChartContainer>
  );
}
