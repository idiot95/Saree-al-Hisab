/* What a scan is allowed to come back with.
   Everything here is treated as untrusted text from a model: nothing is
   accepted because it looks plausible, only because it parses into something
   the ledger would have accepted from a person typing it. */

export type Scanned = {
  kind: 'expense' | 'income' | 'unknown';
  amountMinor: number | null;
  occurredOn: string | null;
  merchant: string | null;
  categoryHint: string | null;
  confidence: 'high' | 'medium' | 'low';
  note: string | null;
};

export const PROMPT = `You are reading a photograph or screenshot of a receipt,
bill, or payment confirmation from India. Extract only what is actually visible.

Return JSON with exactly these keys:
  kind        "expense" if money left the person, "income" if it came in,
              "unknown" if the image does not make that clear.
  amount      the TOTAL paid, as a number in rupees. Use the grand total, not a
              line item and not the subtotal before tax. null if not visible.
  date        the transaction date as YYYY-MM-DD. null if not visible.
  merchant    the shop or payee name as printed, at most 60 characters.
  category    one short lowercase word for what was bought, or null.
  confidence  "high" only if the total and the date are both plainly legible;
              "medium" if one is inferred; "low" if the image is unclear.
  note        anything a person would want remembered, or null.

Do not guess. A null is better than a plausible invention. Return only the JSON.`;

const MAX_RUPEES = 100_000_000;

/** Parse a model reply into something the ledger could accept, or explain why
 *  it cannot. Fields that do not survive validation become null rather than
 *  being coerced — a wrong amount that looks right is worse than a blank. */
export function readScan(raw: string): Scanned | { error: string } {
  const text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: 'The reply was not readable. Try a clearer photograph.' };
  }
  if (!j || typeof j !== 'object') return { error: 'The reply was not readable.' };

  const kind = j.kind === 'expense' || j.kind === 'income' ? j.kind : 'unknown';

  let amountMinor: number | null = null;
  const rupees = typeof j.amount === 'number' ? j.amount
    : typeof j.amount === 'string' ? Number(j.amount.replace(/[^0-9.]/g, ''))
    : NaN;
  if (Number.isFinite(rupees) && rupees > 0 && rupees < MAX_RUPEES) {
    amountMinor = Math.round(rupees * 100);
  }

  let occurredOn: string | null = null;
  if (typeof j.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.date)) {
    const d = new Date(j.date);
    const year = d.getUTCFullYear();
    // A receipt from 1970 or 2190 is a misread, not a purchase.
    if (!Number.isNaN(d.getTime()) && year >= 2000 && year <= new Date().getFullYear() + 1) {
      occurredOn = j.date;
    }
  }

  const str = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

  return {
    kind,
    amountMinor,
    occurredOn,
    merchant: str(j.merchant, 60),
    categoryHint: str(j.category, 30)?.toLowerCase() ?? null,
    confidence: j.confidence === 'high' || j.confidence === 'medium' ? j.confidence : 'low',
    note: str(j.note, 200),
  };
}

/** Which fields a person still has to supply before this can be saved. The
 *  KIND is the highest-stakes one: an income booked as an expense is wrong in
 *  both directions at once, so an unclear kind always stops the save. */
export function whatIsMissing(s: Scanned): string[] {
  const gaps: string[] = [];
  if (s.kind === 'unknown') gaps.push('whether money went out or came in');
  if (s.amountMinor === null) gaps.push('the amount');
  if (s.occurredOn === null) gaps.push('the date');
  return gaps;
}
