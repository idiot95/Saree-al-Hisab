/** Password sign-in is open when `until` is unset or unparsable, else until that moment. */
export function passwordSignInOpen(now: Date, until: string | undefined): boolean {
  if (!until) return true;
  const end = new Date(until);
  if (Number.isNaN(end.getTime())) return true;
  return now < end;
}
