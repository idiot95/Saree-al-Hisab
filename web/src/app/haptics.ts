/* Haptics. Something a fingertip can feel when the screen has agreed to
   something — a tab taken, a swipe that has gone far enough to count, an
   entry saved.

   Two platforms, two mechanisms, one call:

   - Android (and anything with the Vibration API): `navigator.vibrate`, with
     short patterns so it registers as a click and not a buzz.
   - iOS has no Vibration API in any browser, installed PWA included. What it
     does have, since Safari 18, is a system haptic when a switch-styled
     checkbox (`<input type="checkbox" switch>`) is toggled. So a hidden one is
     kept in the document and clicked. On an older iOS the checkbox simply
     toggles in silence, which is harmless.

   Both need user activation — a tap that is still in progress — so this is
   only ever called from a pointer or click handler, never from an effect.
   Nothing here can throw its way into a caller: a phone with the setting off
   should feel nothing, not break something. */

export type Feel = 'tap' | 'select' | 'success' | 'warn';

const PATTERN: Record<Feel, number[]> = {
  tap: [8],
  select: [14],
  success: [10, 45, 16],
  warn: [20, 50, 20, 50, 20],
};

// The iOS cadence: one tick, or two for anything that means "done".
const TICKS: Record<Feel, number> = { tap: 1, select: 1, success: 2, warn: 3 };

let sw: HTMLLabelElement | null = null;

function tick() {
  if (!sw) {
    sw = document.createElement('label');
    sw.setAttribute('aria-hidden', 'true');
    sw.style.display = 'none';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.setAttribute('switch', '');
    box.tabIndex = -1;
    sw.appendChild(box);
    document.body.appendChild(sw);
  }
  sw.click();
}

export function haptic(feel: Feel = 'tap') {
  if (typeof window === 'undefined') return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERN[feel]);
      return;
    }
    tick();
    for (let i = 1; i < TICKS[feel]; i++) setTimeout(tick, 90 * i);
  } catch {
    // A locked-down browser is not a bug.
  }
}
