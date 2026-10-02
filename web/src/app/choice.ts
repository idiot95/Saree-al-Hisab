import type { CSSProperties } from 'react';

/* One rule for every choice on a form: plain until it is chosen, navy once
   it is — the same navy for a category, a way to pay, a day or a tab. It used
   to be the option's own colour, so one sheet showed three selected styles
   (a white segment, a navy chip, a magenta GPay tile) and a chosen tile could
   be mistaken for a category. The option's own colour stays on its icon. */
export const OFF: CSSProperties = {
  /* Quiet Ledger: an unchosen choice is a white chip with a hairline, so the one in colour reads as the answer. */
  background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)',
};

export const PRIMARY = 'var(--primary)';

/** Chosen. The ink argument is kept so callers need not change; every choice wears the primary now. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const on = (_ink?: string): CSSProperties => ({
  background: PRIMARY, color: 'var(--primary-foreground)', border: `1px solid ${PRIMARY}`,
});

/** The chip's look for whether it is chosen, in the ink it wears when it is. */
export const choice = (isOn: boolean, ink = PRIMARY): CSSProperties => (isOn ? on(ink) : OFF);
