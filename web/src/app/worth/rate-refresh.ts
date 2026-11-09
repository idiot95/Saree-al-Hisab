'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/* The day's rates, refreshed once a screen that shows them is on the phone (v3.1 P5; Wealth and a holding's page).
   The render drew the last known rates and named the bases over a day old (`due`); this asks POST /api/rates once
   for them, and redraws (router.refresh) when ANY of them is no longer stale — refreshed by this ask or by anyone
   else since the render (another phone, the holding page, an earlier ask that finished after its screen went; P5
   fix round 1, review I1). Each base is asked about once per screen: a redraw that leaves only bases that failed
   does not ask again (review M1), and their lines keep saying so.

   `status(base)`: 'updating' until the answer, 'failed' when the provider could not be reached (or the ask was
   refused, a 429 included), 'updated' once the base is no longer due. */
export type RateStatus = 'updating' | 'failed' | 'updated';

export function useRateRefresh(due: string[]) {
  const router = useRouter();
  const key = [...due].sort().join(',');
  const asked = useRef(new Set<string>());
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (!key) return;
    const bases = key.split(',');
    const mine = asked.current;  // one Set for the screen's life
    if (bases.every((b) => mine.has(b))) return;
    for (const b of bases) mine.add(b);
    const ask = new AbortController();
    let answered = false;
    const settle = (stale: ReadonlySet<string>) => {
      answered = true;
      setFailed((was) => new Set([...[...was].filter((b) => !bases.includes(b)), ...bases.filter((b) => stale.has(b))]));
      if (bases.some((b) => !stale.has(b))) router.refresh();
    };
    fetch('/api/rates', { method: 'POST', signal: ask.signal, credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { stale: bases }))
      .then((r: { stale?: string[] }) => { if (!ask.signal.aborted) settle(new Set(r.stale ?? bases)); })
      .catch(() => { if (!ask.signal.aborted) settle(new Set(bases)); });
    return () => {
      ask.abort();
      // Not answered: whoever draws these bases next may ask again.
      if (!answered) for (const b of bases) mine.delete(b);
    };
  }, [key, router]);
  // A base no longer due was refreshed by someone: it reads updated even if this screen's own ask failed.
  return (base: string): RateStatus => (!due.includes(base) ? 'updated' : failed.has(base) ? 'failed' : 'updating');
}

/** Every rate line a screen has shown since it mounted, newest props first in place: a line whose base was
 *  refreshed stays (saying so) instead of vanishing and moving the sections under it (review M2). */
export function useRateLines<T extends { base: string }>(lines: T[]): T[] {
  const [seen, setSeen] = useState(lines);
  const missing = lines.filter((l) => !seen.some((s) => s.base === l.base));
  if (missing.length) setSeen([...seen, ...missing]);
  return missing.length ? [...seen, ...missing] : seen;
}
