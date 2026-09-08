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
| A foreign-currency entry carries a rate; the currency is fixed once entries exist | `0107` — `txn_currency_shape`, `household_currency_fixed` triggers |
| Another household's rows are invisible, whoever asks | `0109` — policies on every household table, `app_household()`, the `saree_app` role |

## Row security

`0109_rls.sql` runs last and re-applies every run on purpose. Besides the
policies it does two things a later file can undo without noticing: it sets
`security_invoker = true` on **every** view (a `CREATE OR REPLACE VIEW` without
options silently resets the flag, so a re-issued view would otherwise run as its
owner and see everything), and it re-grants the app role on **all** tables so a
new table is reachable. A new `01xx` file that creates a view or a table needs
nothing extra as long as it sorts before `0109`; a new household-scoped table
needs its own `ENABLE` + `FORCE ROW LEVEL SECURITY` and policy added to `0109`,
and `scripts/invariants.test.mjs` fails until it has one.
