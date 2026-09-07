import type { TABS } from './tabs';

/* The inside of one tab: the rule across the top, the glyph in its pill,
   the label. No handlers and no state, so the loading skeleton can draw it
   as a still without a line of client JavaScript. */
export function TabGlyph({ t, on, here, add, open = false }: {
  t: (typeof TABS)[number]; on: boolean; here: boolean; add: boolean;
  /** The plus with its options fanned out: the same glyph, turned to a cross. */
  open?: boolean;
}) {
  return (
    <>
      {/* A rule across the top of the live tab. Colour and weight alone
          were too quiet to read at arm's length in daylight; a bar of
          solid colour at a known place is legible without being looked
          for. Von Restorff: exactly one at a time. */}
      {on && !add && (
        <span aria-hidden style={{
          position: 'absolute', top: 0, left: '22%', right: '22%', height: 3,
          borderRadius: '0 0 3px 3px', background: 'var(--c-teal)',
          opacity: here ? 1 : .45,
        }} />
      )}
      <span style={add ? {
        /* Raised and filled: the one thing done many times a day should
           not look like the four things done occasionally. */
        width: 46, height: 46, borderRadius: 999, marginTop: -14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--c-on-pumpkin)',
        background: 'var(--g-pumpkin)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35), 0 6px 16px -4px rgba(254,127,45,.55)',
        /* A quarter turn less one eighth: the plus IS the cross, so opening
           and closing is one glyph turning rather than two swapping. */
        transform: open ? 'rotate(45deg)' : 'none',
        transition: 'transform .22s cubic-bezier(.2,.8,.2,1)',
      } : {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 26, minWidth: 44, borderRadius: 999,
        /* A tinted pill behind the live tab's glyph — shape as well as
           colour, so it survives a bright screen and colour blindness. */
        background: here ? 'var(--c-teal-pill)' : 'transparent',
      }}>
        <svg width={add ? 24 : 21} height={add ? 24 : 21} viewBox="0 0 24 24"
          fill={here && !add ? 'var(--c-teal-pill)' : 'none'}
          stroke="currentColor" strokeWidth={add ? 2.4 : on ? 2.2 : 1.8}
          strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={t.d} />
        </svg>
      </span>
      <span style={{
        fontSize: 'var(--step--2)', fontWeight: on ? 700 : 500, letterSpacing: '.01em',
      }}>{add && open ? 'Close' : t.label}</span>
    </>
  );
}
