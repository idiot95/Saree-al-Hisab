import type { CSSProperties } from 'react';

/* One rule for every choice on a form: grey until it is chosen, its own
   colour once it is. A row of chips in eight tints used to say nothing about
   which one was picked — the picked one was merely darker — and every
   section needed a line of text beside its name to confirm the answer. Now
   the only coloured thing in a section is the answer, so the text is not
   needed and is gone. */
export const OFF: CSSProperties = {
  background: 'var(--c-sunk)', color: 'var(--c-meta)', border: '1px solid transparent',
};

/** The brand green: dark in both themes, so its label is always white. Every
 *  other ink is a category tint — deep in light, pastel in dark — and takes
 *  --c-on-tint, which flips with the theme. */
export const PRIMARY = 'var(--c-primary-hi)';

export const on = (ink: string): CSSProperties => ({
  background: ink, color: ink === PRIMARY ? 'var(--c-on-primary)' : 'var(--c-on-tint)', border: `1px solid ${ink}`,
});

/** The chip's look for whether it is chosen, in the ink it wears when it is. */
export const choice = (isOn: boolean, ink = PRIMARY): CSSProperties => (isOn ? on(ink) : OFF);
