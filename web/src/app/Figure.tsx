'use client';

import { useState } from 'react';
import NumberFlow from '@number-flow/react';
import { tokenEase, tokenMs } from './motion';
import { figureParts, format, type Paise } from '@/lib/money';
import { useMoney } from './currency';

/** NumberFlow's roll on the motion tokens (Web Animations take numbers, not var()). */
const roll = () => ({ duration: tokenMs('--dur-roll', 600), easing: tokenEase('--ease-out', 'cubic-bezier(.22, 1, .36, 1)') });

/* An amount whose digits roll to their new value. The text it draws is the
   text format() writes (figureParts guarantees it), so a rolling figure and
   a static one never disagree.

   The first paint is static — nothing rolls on mount or on hydration — and it
   rolls only when `minor` changes afterwards. Reduced motion is respected by
   NumberFlow itself. Screen readers get the whole figure once, from the label,
   not digit by digit as they turn (role="img" hides the moving columns). */
export function Figure({ minor, currency, sign = false, paise = false, className }: {
  minor: number; currency?: string; sign?: boolean; paise?: Paise; className?: string;
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
      /* The roll is a flourish after a change, never something waited through: --dur-roll, not the library's 900ms.
         Read only once it is live (a change after first paint, on the phone), so the server never needs the tokens. */
      transformTiming={live ? roll() : undefined}
      spinTiming={live ? roll() : undefined}
      opacityTiming={live ? { duration: tokenMs('--dur-4', 300), easing: tokenEase('--ease-out', 'ease-out') } : undefined}
      respectMotionPreference
      role="img"
      aria-label={format(minor, ccy, { sign, paise })}
      className={className}
    />
  );
}
