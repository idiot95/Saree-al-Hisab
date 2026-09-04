# Migrations

Two kinds of file, and the order matters:

- `00xx_*.sql` — **generated** by `drizzle-kit generate` from `src/db/schema.ts`.
  Tables, columns, enums, indexes and CHECK constraints. Never hand-edit these.
- `01xx_views_*.sql` — **hand-written**, and they run *after* all of the above.
  Views, functions and triggers: the places where the invariants actually live.

Run in filename order. The `01xx` files are idempotent (`CREATE OR REPLACE`,
`DROP TRIGGER IF EXISTS`), so re-running them is safe.

## Where each rule lives

| Rule | File |
|---|---|
| Card payments and transfers are not spending | `0100` — `spend_txn` |
| Savings sits outside the budget | `0100` — `spend_txn` |
| Refunds net off in the month they land | `0102` — `spend_txn` (replaced) |
| Duplicates: same person, and two people | `0101` — `duplicate_candidate` |
| A person's running balance | `0102` — `counterparty_balance` |
| A purchase files into the right card cycle | `0103` — `txn_apply_method` trigger |
| A payment method draws on a real account | `0103` — `method_funding_is_valid` trigger |
