'use client';

import Link from '@/app/NavLink';
import { useState } from 'react';
import { haptic } from '../haptics';
import { ACTIVITY_CHIPS, Words, chip, chipOff, chipOn, chipRow, countBadge } from '../form-bits';

export type ActivityFilter = 'all' | 'review' | 'upcoming' | 'sms';

/* Activity's one row of filter chips: All · To review (n) · Upcoming · From SMS (n). Each is a plain link to
   /entries?f=…, so without script it is ordinary navigation and the server draws that view. With script the
   chip lights the moment it is tapped, before the server answers (a chip that waits for the network reads as a
   missed tap), and the address is replaced rather than pushed, so Back leaves Activity instead of walking back
   through every chip tried. The two counts are the same two halves Home's To review tile adds up. */
export default function ActivityChips({ current, review, sms, month }: {
  current: ActivityFilter; review: number; sms: number;
  /** The month All is showing, kept on every chip so coming back to All lands on the same month. */
  month?: string | null;
}) {
  const [picked, setPicked] = useState<ActivityFilter | null>(null);
  // A server answer for a different filter (Back, a link) wins over a stale tap.
  const [seen, setSeen] = useState(current);
  if (seen !== current) { setSeen(current); setPicked(null); }
  const lit = picked ?? current;
  const chips: { key: ActivityFilter; label: string; short?: string; count?: number }[] = ACTIVITY_CHIPS.map((c) => ({
    ...c, count: c.key === 'review' ? review : c.key === 'sms' ? sms : undefined,
  }));
  const hrefOf = (key: ActivityFilter) => {
    const q = new URLSearchParams();
    if (key !== 'all') q.set('f', key);
    if (month) q.set('m', month);
    const s = q.toString();
    return s ? `/entries?${s}` : '/entries';
  };
  return (
    /* The row wraps, never scrolls sideways: what is offered can be counted. */
    <nav aria-label="Activity" className={chipRow}>
      {chips.map((c) => {
        const on = c.key === lit;
        return (
          <Link key={c.key} href={hrefOf(c.key)} replace data-replace motion="fade"
            aria-current={c.key === current ? 'page' : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              if (c.key !== lit) haptic('select');
              setPicked(c.key);
            }}
            aria-label={c.count ? `${c.label} ${c.count}` : c.label}
            className={`${chip} ${on ? chipOn : chipOff}`}>
            <Words label={c.label} short={c.short} />
            {!!c.count && (
              <span className={`${countBadge} ${on
                ? 'bg-primary-foreground/90 text-primary' : 'bg-attention-soft text-attention-soft-foreground'}`}>
                {c.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
