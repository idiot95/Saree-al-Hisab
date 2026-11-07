/* What each holding was worth on a given day: the same valuation as the
   holding_value view (0110), with "today" replaced by `d`. worthSeries asks it
   once per month-end to draw the holdings line.

   The rules are the view's, restated for a date:
     · the quantity is the latest snapshot dated d or earlier;
     · the rate is the newer of the household's override and the fetched quote,
       both dated d or earlier; on the same day the override wins;
     · value_minor = quantity × rate (× purity for metals) × a power of ten,
       worked in numeric by multiplication only, rounded once, half-even;
     · NULL, never zero, when there is no snapshot or no rate yet.
   Archived holdings are returned with archived_at, as the view returns them;
   the caller decides whether to leave them out.

   A function, not a view, because it takes a date. It runs as its caller
   (SECURITY INVOKER, the default), so row security narrows it to the household
   in scope exactly as it does the view. An invariant proves that, called with
   today's date, it agrees with holding_value for every holding. Idempotent. */
CREATE OR REPLACE FUNCTION holding_value_at(hh uuid, d date)
RETURNS TABLE (id uuid, value_minor bigint, archived_at timestamptz)
LANGUAGE sql STABLE PARALLEL SAFE AS $$
SELECT h.id,
       CASE h.kind
         WHEN 'fx_cash' THEN round_half_even(s.quantity::numeric * r.rate
           * power(10::numeric, (currency_digits(hh_.base_currency) - currency_digits(h.currency))::numeric))
         WHEN 'metal' THEN round_half_even(s.quantity::numeric * h.purity_permille * r.rate
           * power(10::numeric, (currency_digits(hh_.base_currency) - 6)::numeric))
       END,
       h.archived_at
FROM holding h
JOIN household hh_ ON hh_.id = h.household_id
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN h.kind = 'fx_cash' THEN h.currency
    WHEN h.metal = 'gold'   THEN 'XAU'
    WHEN h.metal = 'silver' THEN 'XAG'
  END AS code
) b
LEFT JOIN LATERAL (
  SELECT sn.quantity
  FROM holding_snapshot sn
  WHERE sn.holding_id = h.id AND sn.as_of <= d
  ORDER BY sn.as_of DESC
  LIMIT 1
) s ON true
LEFT JOIN LATERAL (
  SELECT c.rate
  FROM (
    (SELECT o.rate, o.as_of, 0 AS pref
     FROM price_override o
     WHERE o.household_id = h.household_id AND o.base = b.code
       AND o.quote = hh_.base_currency AND o.as_of <= d
     ORDER BY o.as_of DESC
     LIMIT 1)
    UNION ALL
    (SELECT q.rate, q.as_of, 1 AS pref
     FROM price_quote q
     WHERE q.base = b.code AND q.quote = hh_.base_currency AND q.as_of <= d
     ORDER BY q.as_of DESC, q.fetched_at DESC, q.source
     LIMIT 1)
  ) c
  ORDER BY c.as_of DESC, c.pref
  LIMIT 1
) r ON true
WHERE h.household_id = hh
$$;
