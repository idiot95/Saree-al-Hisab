import type { TABS } from './tabs';

/* The inside of one tab: the rule across the top, the glyph in its pill,
   the label. No handlers and no state, so the loading skeleton can draw it
   as a still without a line of client JavaScript. */
export function TabGlyph({ t, on, here, add }: {
  t: (typeof TABS)[number]; on: boolean; here: boolean; add: boolean;
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
        color: '#fff',
        background: 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.2) 0%, rgba(255,255,255,0) 60%),'
          + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
        boxShadow: '0 4px 14px -4px rgba(35,61,77,.5)',
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
      }}>{t.label}</span>
    </>
  );
}
