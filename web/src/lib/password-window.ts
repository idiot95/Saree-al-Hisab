/** Password sign-in is open when `until` is unset or unparsable, else until that moment. */
export function passwordSignInOpen(now: Date, until: string | undefined): boolean {
  if (!until) return true;
  const end = new Date(until);
  if (Number.isNaN(end.getTime())) return true;
  return now < end;
}

/* Once per process, not per module copy: the build bundles this module into
   the page and the route handler separately, each with its own top-level
   state, so the flag lives on globalThis. */
const WARNED = Symbol.for('hisab.passwordUntilWarned');
const flags = globalThis as unknown as Record<symbol, boolean | undefined>;

/** The window as configured (AUTH_PASSWORD_UNTIL), at this moment. An
 *  unparsable value keeps password sign-in open — locking everybody out over
 *  a typo is the worse failure — but says so once per process, without the
 *  value itself, so the typo is found rather than lived with. */
export function passwordSignInOpenNow(
  until: string | undefined = process.env.AUTH_PASSWORD_UNTIL,
  now: Date = new Date(),
  warn: (message: string) => void = (m) => console.error(m),
): boolean {
  if (until && Number.isNaN(Date.parse(until)) && !flags[WARNED]) {
    flags[WARNED] = true;
    warn('AUTH_PASSWORD_UNTIL is set but is not a date; password sign-in stays open.');
  }
  return passwordSignInOpen(now, until);
}
