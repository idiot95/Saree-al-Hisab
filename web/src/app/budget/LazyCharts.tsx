'use client';

import dynamic from 'next/dynamic';
import WhenNear from '../WhenNear';
import type { BackPoint, SpendPoint } from './TrendCharts';

/* Plan's charts, fetched only when their card comes near the screen. The box keeps the plot's height while it
   loads; the words under each chart are drawn by the page, so nothing moves when the chart arrives. */
const Spend = dynamic(() => import('./TrendCharts').then((m) => m.SpendLine), { ssr: false });
const Back = dynamic(() => import('./TrendCharts').then((m) => m.BackBars), { ssr: false });

export function LazySpendLine({ points }: { points: SpendPoint[] }) {
  return <WhenNear className="h-36"><Spend points={points} /></WhenNear>;
}

export function LazyBackBars({ points }: { points: BackPoint[] }) {
  return <WhenNear className="h-32"><Back points={points} /></WhenNear>;
}
