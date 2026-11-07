/* What the Wealth server page hands its client parts. Plain data only: every
   figure is already a number of minor units in the household's currency, and
   every native amount is already written out, so the client draws and never
   prices anything. */

/** A pot or a metal, as a row. `owner` is a current member's id, or null for
 *  joint (no owner, or one who has left). `value` is null when no rate is known. */
export type HoldingItem = {
  id: string; kind: 'fx_cash' | 'metal'; name: string;
  owner: string | null; ownerName: string;
  /** Its own amount, as its own currency writes it ("$4,200.00", "KD 1,250"), or the weight ("50 g"). */
  native: string;
  /** "22k", "Sterling" for a metal; the currency code for a pot. */
  badge: string;
  value: number | null;
  /** Its rate could not be refreshed today and an older fetched one is in use. */
  stale: boolean;
};

/** The figures for one choice of whose net worth: Household, a member, or Joint. */
export type WealthView = {
  key: string; chip: string; title: string;
  worth: number;
  /** The four classes of the bar, each >= 0. */
  bank: number; pots: number; metals: number; owed: number;
  /** What is owed out (cards, money borrowed), <= 0. */
  debt: number;
  /** The accounts' own net: what is in them less what the cards owe. */
  accounts: number;
  /** Whether receivables belong to this view (they are the household's, so not a member's). */
  counted: boolean;
  unvalued: number;
};

/** "Rates 6 Nov", and one line per rate that could not be refreshed. */
export type RateNote = { asOf: string | null; stale: string[] };

export type SeriesPoint = { month: string; held: number; holdings: number };
