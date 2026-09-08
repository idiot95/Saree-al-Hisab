/* Stable values written on an account. Labels and artwork may improve later;
   the stored keys do not. The SVGs are kept locally so the card still looks
   like itself offline and no bank learns which accounts a household uses.

   Bank marks: Simple Icons (CC0) for HDFC, ICICI and Axis; SBI artwork from
   bank.sbi via Wikimedia Commons. Network marks: the Visa and Mastercard
   artwork published by their brand centres, Amex's Blue Box mark, and the
   NPCI RuPay mark. All marks remain trademarks of their respective owners. */

export const BANKS = [
  { key: 'hdfc', label: 'HDFC Bank', logo: '/brands/bank-hdfc.svg' },
  { key: 'icici', label: 'ICICI Bank', logo: '/brands/bank-icici.svg' },
  { key: 'sbi', label: 'State Bank of India', short: 'SBI', logo: '/brands/bank-sbi.svg' },
  { key: 'axis', label: 'Axis Bank', logo: '/brands/bank-axis.svg' },
  { key: 'other', label: 'Other bank', logo: null },
] as const;

export const CARD_NETWORKS = [
  { key: 'visa', label: 'Visa', logo: '/brands/network-visa.svg' },
  { key: 'mastercard', label: 'Mastercard', logo: '/brands/network-mastercard.svg' },
  { key: 'amex', label: 'American Express', short: 'Amex', logo: '/brands/network-amex.svg' },
  { key: 'rupay', label: 'RuPay', logo: '/brands/network-rupay.svg' },
] as const;

export type BankKey = (typeof BANKS)[number]['key'];
export type CardNetwork = (typeof CARD_NETWORKS)[number]['key'];

export const bankFor = (key: string | null | undefined) => BANKS.find((b) => b.key === key) ?? null;
export const networkFor = (key: string | null | undefined) => CARD_NETWORKS.find((n) => n.key === key) ?? null;

/** Existing cards predate the stored bank field. Give their familiar name a
 *  best-effort logo immediately; editing the card makes the choice explicit. */
export function bankFromName(name: string) {
  const s = name.trim().toLowerCase();
  if (s.includes('hdfc')) return bankFor('hdfc');
  if (s.includes('icici')) return bankFor('icici');
  if (/(^|\s)sbi(\s|$)|state bank/.test(s)) return bankFor('sbi');
  if (s.includes('axis')) return bankFor('axis');
  return null;
}
