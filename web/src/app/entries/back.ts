/* Where an entry's Back, Save and Delete may return to: a screen of ours, never a URL from the form or the address.
   An exact list — the plain screens, a tab or a person by id, and Activity's three chips — so `from=` and the
   form's `back` can name the chip an entry was opened from (Upcoming's calendar, To review's duplicates) and
   nothing else. */
const PATHS = /^\/(?:|entries|accounts|people|tab\/[0-9a-f-]{36}|people\/[0-9a-f-]{36})$/;
const CHIPS = new Set(['/entries?f=review', '/entries?f=upcoming', '/entries?f=sms']);

export function safeBack(to: unknown): string {
  return typeof to === 'string' && (PATHS.test(to) || CHIPS.has(to)) ? to : '/entries';
}
