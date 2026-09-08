'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { digitsOf, format, fromKeys, keysDisplay, settleKeys, symbolOf, toKeys, typed } from '@/lib/money';

/* The household's currency, for client components.

   Server components need not ask: db/queries installs the request's currency
   as the default for a bare format(). A client component is rendered twice,
   once on the server and once in the phone, and neither run can see that
   request state — so it reads the currency from context, put there by the
   root layout, and formats through useMoney(). Both runs then agree, and the
   page does not flash rupees before settling on dirhams. */
const CurrencyContext = createContext('INR');

export function CurrencyProvider({ currency, children }: { currency: string; children: ReactNode }) {
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export const useCurrency = () => useContext(CurrencyContext);

/** format() and the keys helpers, bound to the household's currency — the
 *  symbol, how many minor digits it has, and both directions between what a
 *  field holds and what the ledger stores. */
export function useMoney() {
  const currency = useContext(CurrencyContext);
  return useMemo(() => ({
    currency,
    symbol: symbolOf(currency),
    digits: digitsOf(currency),
    format: (minor: number, opts?: { sign?: boolean; paise?: boolean }) => format(minor, currency, opts),
    keysDisplay: (keys: string) => keysDisplay(keys, currency),
    fromKeys: (keys: string) => fromKeys(keys, currency),
    toKeys: (minor: number) => toKeys(minor, currency),
    typed: (raw: string) => typed(raw, currency),
    settle: (keys: string) => settleKeys(keys, currency),
  }), [currency]);
}
