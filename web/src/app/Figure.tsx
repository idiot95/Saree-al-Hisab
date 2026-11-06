'use client';

import { useState } from 'react';
import NumberFlow from '@number-flow/react';
import { figureParts, format } from '@/lib/money';
import { useMoney } from './currency';

/* An amount whose digits roll to their new value. The text it draws is the
   text format() writes (figureParts guarantees it), so a rolling figure and
   a static one never disagree.

   The first paint is static — nothing rolls on mount or on hydration — and it
   rolls only when `minor` changes afterwards. Reduced motion is respected by
   NumberFlow itself. Screen readers get the whole figure once, from the label,
   not digit by digit as they turn (role="img" hides the moving columns). */
export function Figure({ minor, currency, sign = false, paise = false, className }: {
  minor: number; currency?: string; sign?: boolean; paise?: boolean; className?: string;
}) {
  const household = useMoney().currency;
  const ccy = currency ?? household;
  const p = figureParts(minor, ccy, { sign, paise });

  /* Rolls only once the value has changed from the one first drawn. */
  const [seen, setSeen] = useState(minor);
  const [live, setLive] = useState(false);
  if (seen !== minor) { setSeen(minor); setLive(true); }

  return (
    <NumberFlow
      value={p.value}
      locales={p.locale}
      format={p.format}
      prefix={p.prefix}
      animated={live}
      respectMotionPreference
      role="img"
      aria-label={format(minor, ccy, { sign, paise })}
      className={className}
    />
  );
}
