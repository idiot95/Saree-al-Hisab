import type { Row } from './EntryList';

/* An entry as every list draws it, and the days they are grouped under. Plain module (not the client list) so a
   server page can call it: Activity groups a month, Home shows today. */
export function toRow(e: {
  id: string; kind: string; amount: string; merchant: string | null; category: string | null; method: string | null;
  account: string; counter_account: string | null; icon: string | null; tint: string | null; is_shared: boolean;
  people: string | null; to_person: boolean; from_person: boolean; settles: boolean; counts_as_spend: boolean; book_id: string | null;
}): Row {
  return {
    id: e.id, kind: e.kind, amount: e.amount, merchant: e.merchant, category: e.category,
    method: e.method, account: e.account, counter_account: e.counter_account,
    icon: e.icon, tint: e.tint, is_shared: e.is_shared,
    people: e.people, to_person: e.to_person, from_person: e.from_person, settles: e.settles,
    counts_as_spend: e.counts_as_spend, book_id: e.book_id,
  };
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  // The year only when it is not this one — search reaches back past January.
  return d.toLocaleDateString('en-IN', d.getFullYear() === today.getFullYear()
    ? { weekday: 'short', day: 'numeric', month: 'short' }
    : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Grouped by day, newest first: Gestalt proximity does the work a date column would. */
export function byDay<E extends Parameters<typeof toRow>[0] & { occurred_on: string | Date }>(entries: E[]) {
  const days: { on: string; label: string; rows: Row[] }[] = [];
  for (const e of entries) {
    const key = new Date(e.occurred_on).toISOString().slice(0, 10);
    const last = days[days.length - 1];
    if (last && last.on === key) last.rows.push(toRow(e));
    else days.push({ on: key, label: dayLabel(key), rows: [toRow(e)] });
  }
  return days;
}
