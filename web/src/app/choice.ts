import type { CSSProperties } from 'react';

/* One rule for every choice on a form: plain until it is chosen, navy once
   it is — the same navy for a category, a way to pay, a day or a tab. It used
   to be the option's own colour, so one sheet showed three selected styles
   (a white segment, a navy chip, a magenta GPay tile) and a chosen tile could
   be mistaken for a category. The option's own colour stays on its icon.

   One exception, on purpose: Add's kind switch (Expense · Income · Move) is a segmented control, the iOS idiom for
   "which form is this", and keeps its raised white segment on the grey track. Every chip and tile inside the form —
   category tiles, the day chips, a tab, "was this your spending" — wears on(). */
export const OFF: CSSProperties = {
  /* Quiet Ledger: an unchosen choice is a white chip with a hairline, so the one in colour reads as the answer. */
  background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)',
};

export const PRIMARY = 'var(--primary)';

/** Chosen. The ink argument is kept so callers need not change; every choice wears the primary now. */
export const on = (_ink?: string): CSSProperties => ({
  background: PRIMARY, color: 'var(--primary-foreground)', border: `1px solid ${PRIMARY}`,
});

/** The chip's look for whether it is chosen, in the ink it wears when it is. */
export const choice = (isOn: boolean, ink = PRIMARY): CSSProperties => (isOn ? on(ink) : OFF);
