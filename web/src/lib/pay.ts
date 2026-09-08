/* A way to pay, named in one string.

   Every real account is a way to pay — cash, a bank account, a card — and a
   rail (GPay, PhonePe, net banking) is a way of drawing on one of them. For a
   long time only the rails were offered, so a household with two banks and
   one UPI app could only ever record spending from the bank the app drew on;
   the other bank was in the books and unreachable from the Add screen.

   `a:<account id>` names an account paid from directly; `m:<rail id>` names a
   rail, whose account follows from it. The server resolves either to the
   account_id and payment_method_id it writes (`src/db/payment.ts`), so a
   client never names an account for a rail — the same rule as before, with
   the account itself now a legitimate answer.                                */

export type Rail = {
  id: string; name: string; kind: string; handle?: string | null; is_default?: boolean;
};
export type Way = { id: string; name: string; kind: string; rails: Rail[] };

export type PayRef = { account: string; rail: null } | { account: string; rail: string };

export const accountRef = (accountId: string) => `a:${accountId}`;
export const railRef = (railId: string) => `m:${railId}`;

/** The pair a reference points at, or null for one that names nothing of
 *  these ways — a rail archived since the screen loaded, another household's
 *  id, junk. A bare id is read as a rail: that is what an entry queued on a
 *  phone by an older build carries. */
export function findRef(ways: Way[], ref: string | null | undefined): { way: Way; rail: Rail | null } | null {
  if (typeof ref !== 'string' || !ref) return null;
  const bare = !ref.includes(':');
  const [tag, id] = bare ? ['m', ref] : [ref.slice(0, 1), ref.slice(2)];
  if (!id) return null;
  if (tag === 'a') {
    const way = ways.find((w) => w.id === id);
    return way ? { way, rail: null } : null;
  }
  if (tag !== 'm') return null;
  for (const way of ways) {
    const rail = way.rails.find((r) => r.id === id);
    if (rail) return { way, rail };
  }
  return null;
}

export const refOf = (way: Way, rail: Rail | null) => (rail ? railRef(rail.id) : accountRef(way.id));

/** What Add Entry opens on: the rail marked default, else the first rail
 *  there is, else the first account. Empty when there are no accounts at all. */
export function defaultRef(ways: Way[]): string {
  for (const w of ways) for (const r of w.rails) if (r.is_default) return railRef(r.id);
  for (const w of ways) if (w.rails[0]) return railRef(w.rails[0].id);
  return ways[0] ? accountRef(ways[0].id) : '';
}

/** A rail that carries its account's own name — "Cash" on Cash, the card on
 *  the card — is the account, not a second way of reaching it. It is chosen
 *  with the account and never offered beside it. */
export const ownRail = (way: Way) =>
  way.rails.find((r) => r.name.trim().toLowerCase() === way.name.trim().toLowerCase()) ?? null;

/** The rails offered under a chosen account, besides paying from it directly. */
export const viaRails = (way: Way) => way.rails.filter((r) => r !== ownRail(way));

/** Choosing an account: its default rail if one is marked, else its own-named
 *  rail, else — where it has rails — the first, else the account itself. */
export function pickWay(way: Way): string {
  const r = way.rails.find((x) => x.is_default) ?? ownRail(way) ?? way.rails[0] ?? null;
  return refOf(way, r);
}

/** "GPay · HDFC Savings", "HDFC Savings" — one way to pay, in words. */
export function payLabel(way: Way, rail: Rail | null): string {
  if (!rail || rail === ownRail(way)) return way.name;
  return `${rail.name} · ${way.name}`;
}

/** Every way to pay for a <select>: one group per account that has rails
 *  beyond its own, a single option for one that has not. */
export function payOptions(ways: Way[]): { label: string; options: { value: string; label: string }[] }[] {
  return ways.map((w) => {
    const via = viaRails(w);
    const own = ownRail(w);
    const options = [{ value: refOf(w, own), label: w.name }];
    for (const r of via) options.push({ value: railRef(r.id), label: `${r.name} · ${w.name}` });
    return { label: w.name, options };
  });
}
