/* The motion tokens (ql.css), for the few places that need them as numbers in script: a timer that must end with a
   CSS fade, and NumberFlow, whose Web Animations take milliseconds and an easing string, not var(). Read from the
   stylesheet once, so ql.css stays the one place the values live. Client only; the fallbacks are what ql.css says,
   for a call before the stylesheet has loaded. */
const cache = new Map<string, string>();
function token(name: string): string {
  let v = cache.get(name);
  if (v === undefined) {
    v = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (v) cache.set(name, v);
  }
  return v;
}

/** A duration token in milliseconds. */
export function tokenMs(name: string, fallback: number): number {
  const v = token(name);
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return v.endsWith('ms') ? n : n * 1000;
}

/** An easing token, as a string Web Animations accept. */
export function tokenEase(name: string, fallback: string): string {
  return token(name) || fallback;
}
