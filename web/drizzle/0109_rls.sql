/* Row-level security: Postgres itself refuses a row from another household.

   Every query the app makes already names its household, and every action
   re-checks ownership on the server. This file is the layer under that: a
   query that forgot the household, or named the wrong one, gets no rows
   rather than somebody else's. It is defence in depth, not a new boundary.

   How it works. The app opens a transaction, runs
   `select set_config('app.household_id', <id>, true)` — transaction-local,
   so it can never leak onto a pooled connection — and every policy below
   compares `household_id` with app_household(). No setting means NULL, and
   NULL equals nothing, so an unscoped query sees an empty table.

   Who it bites. The Neon owner role carries BYPASSRLS, so for it every policy
   is a no-op — which is what migrations, tests and repairs want. The app
   connects as `saree_app`, a plain login role that owns nothing and cannot
   bypass anything; scripts/app-role.mjs gives it a password and writes the
   connection string. FORCE makes the rule hold for a table's owner too —
   here the owner bypasses anyway; a copy of this app whose owner lacks
   BYPASSRLS keeps every policy, but one thing then stops working: the SMS
   capture endpoint's capture_lookup() (0113) is SECURITY DEFINER and finds a
   token across households only because its owner bypasses row security.
   Without that it sees no capture_token row and refuses every token — it
   fails closed, it never reads past a policy. The invariants test checks the
   app role has no such attribute.

   Three tables are keyed by a household but read before one is known —
   `household`, `member` and `invite` are how a sign-in FINDS its household
   and how a link finds its invitation — so their policies are open when no
   household is set and scoped once one is. The tables with no household_id
   carry no policy: _migration, app_user, auth_identity, device,
   password_reset, price_quote (a market price, the same for everyone) and
   rate_limit — exactly the set invariants.test.mjs expects.

   Views run as their caller (security_invoker), or a view owned by the
   bypassing owner would read past every policy. CREATE OR REPLACE VIEW
   without options RESETS that flag, so this file runs after every view file
   before it and sets it on all of them; a view file after it (0110 onwards)
   must set it itself, and invariants.test.mjs fails if any view lacks it. */

create or replace function app_household() returns uuid
  language sql stable parallel safe
  as $$ select nullif(current_setting('app.household_id', true), '')::uuid $$;

-- The tables that carry household_id and are only ever read inside a scope.
alter table account enable row level security;
alter table account force row level security;
drop policy if exists account_household on account;
create policy account_household on account
  using (household_id = app_household()) with check (household_id = app_household());

alter table attachment enable row level security;
alter table attachment force row level security;
drop policy if exists attachment_household on attachment;
create policy attachment_household on attachment
  using (household_id = app_household()) with check (household_id = app_household());

alter table holding_attachment enable row level security;
alter table holding_attachment force row level security;
drop policy if exists holding_attachment_household on holding_attachment;
create policy holding_attachment_household on holding_attachment
  using (household_id = app_household()) with check (household_id = app_household());

alter table reconciliation enable row level security;
alter table reconciliation force row level security;
drop policy if exists reconciliation_household on reconciliation;
create policy reconciliation_household on reconciliation
  using (household_id = app_household()) with check (household_id = app_household());

alter table budget_set enable row level security;
alter table budget_set force row level security;
drop policy if exists budget_set_household on budget_set;
create policy budget_set_household on budget_set
  using (household_id = app_household()) with check (household_id = app_household());

/* A line has no household_id of its own — it belongs to a set, and the set
   belongs to a household. The policy walks that one hop rather than
   duplicating the column, so a line can never outlive the scope of its set. */
alter table budget_line enable row level security;
alter table budget_line force row level security;
drop policy if exists budget_line_household on budget_line;
create policy budget_line_household on budget_line
  using (exists (select 1 from budget_set s where s.id = set_id and s.household_id = app_household()))
  with check (exists (select 1 from budget_set s where s.id = set_id and s.household_id = app_household()));

alter table counterparty enable row level security;
alter table counterparty force row level security;
drop policy if exists counterparty_household on counterparty;
create policy counterparty_household on counterparty
  using (household_id = app_household()) with check (household_id = app_household());

alter table ledger_book enable row level security;
alter table ledger_book force row level security;
drop policy if exists ledger_book_household on ledger_book;
create policy ledger_book_household on ledger_book
  using (household_id = app_household()) with check (household_id = app_household());

alter table payment_method enable row level security;
alter table payment_method force row level security;
drop policy if exists payment_method_household on payment_method;
create policy payment_method_household on payment_method
  using (household_id = app_household()) with check (household_id = app_household());

alter table category enable row level security;
alter table category force row level security;
drop policy if exists category_household on category;
create policy category_household on category
  using (household_id = app_household()) with check (household_id = app_household());

alter table budget enable row level security;
alter table budget force row level security;
drop policy if exists budget_household on budget;
create policy budget_household on budget
  using (household_id = app_household()) with check (household_id = app_household());

alter table txn enable row level security;
alter table txn force row level security;
drop policy if exists txn_household on txn;
create policy txn_household on txn
  using (household_id = app_household()) with check (household_id = app_household());

alter table claim enable row level security;
alter table claim force row level security;
drop policy if exists claim_household on claim;
create policy claim_household on claim
  using (household_id = app_household()) with check (household_id = app_household());

alter table schedule enable row level security;
alter table schedule force row level security;
drop policy if exists schedule_household on schedule;
create policy schedule_household on schedule
  using (household_id = app_household()) with check (household_id = app_household());

alter table inbox_item enable row level security;
alter table inbox_item force row level security;
drop policy if exists inbox_item_household on inbox_item;
create policy inbox_item_household on inbox_item
  using (household_id = app_household()) with check (household_id = app_household());

/* Wealth (0035). Holdings, their snapshots and a household's own rates are
   the household's. A snapshot also carries the household its holding is in
   — a composite foreign key holds the two together — so it needs no EXISTS.
   price_quote is a market price, the same for every household: no
   household_id and no policy, and the grants at the end let the app read
   and add a quote but never change or remove one. */
alter table holding enable row level security;
alter table holding force row level security;
drop policy if exists holding_household on holding;
create policy holding_household on holding
  using (household_id = app_household()) with check (household_id = app_household());

alter table holding_snapshot enable row level security;
alter table holding_snapshot force row level security;
drop policy if exists holding_snapshot_household on holding_snapshot;
create policy holding_snapshot_household on holding_snapshot
  using (household_id = app_household()) with check (household_id = app_household());

alter table price_override enable row level security;
alter table price_override force row level security;
drop policy if exists price_override_household on price_override;
create policy price_override_household on price_override
  using (household_id = app_household()) with check (household_id = app_household());

-- The tables that find a household: open until one is named, scoped after.
alter table household enable row level security;
alter table household force row level security;
drop policy if exists household_scope on household;
create policy household_scope on household
  using (app_household() is null or id = app_household())
  with check (app_household() is null or id = app_household());

alter table member enable row level security;
alter table member force row level security;
drop policy if exists member_scope on member;
create policy member_scope on member
  using (app_household() is null or household_id = app_household())
  with check (app_household() is null or household_id = app_household());

alter table invite enable row level security;
alter table invite force row level security;
drop policy if exists invite_scope on invite;
create policy invite_scope on invite
  using (app_household() is null or household_id = app_household())
  with check (app_household() is null or household_id = app_household());

/* capture_token is household-only, with NO unscoped branch: an open branch would
   let any unscoped connection list, un-revoke or delete every household's tokens.
   The endpoint finds a token's household through capture_lookup(hash) (0113), a
   security-definer function that returns one live row. sms_draft holds message
   bodies and is household-only too. */
alter table capture_token enable row level security;
alter table capture_token force row level security;
drop policy if exists capture_token_scope on capture_token;
create policy capture_token_scope on capture_token
  using (household_id = app_household()) with check (household_id = app_household());

alter table sms_draft enable row level security;
alter table sms_draft force row level security;
drop policy if exists sms_draft_household on sms_draft;
create policy sms_draft_household on sms_draft
  using (household_id = app_household()) with check (household_id = app_household());

-- The children, scoped through their parent. A foreign key check bypasses
-- row security, so these policies are what keeps a child in its household.
alter table book_member enable row level security;
alter table book_member force row level security;
drop policy if exists book_member_household on book_member;
create policy book_member_household on book_member
  using (exists (select 1 from ledger_book b where b.id = book_id and b.household_id = app_household()))
  with check (exists (select 1 from ledger_book b where b.id = book_id and b.household_id = app_household()));

alter table card_cycle enable row level security;
alter table card_cycle force row level security;
drop policy if exists card_cycle_household on card_cycle;
create policy card_cycle_household on card_cycle
  using (exists (select 1 from account a where a.id = account_id and a.household_id = app_household()))
  with check (exists (select 1 from account a where a.id = account_id and a.household_id = app_household()));

alter table claim_item enable row level security;
alter table claim_item force row level security;
drop policy if exists claim_item_household on claim_item;
create policy claim_item_household on claim_item
  using (exists (select 1 from claim c where c.id = claim_id and c.household_id = app_household()))
  with check (exists (select 1 from claim c where c.id = claim_id and c.household_id = app_household()));

alter table occurrence enable row level security;
alter table occurrence force row level security;
drop policy if exists occurrence_household on occurrence;
create policy occurrence_household on occurrence
  using (exists (select 1 from schedule s where s.id = schedule_id and s.household_id = app_household()))
  with check (exists (select 1 from schedule s where s.id = schedule_id and s.household_id = app_household()));

alter table duplicate_dismissed enable row level security;
alter table duplicate_dismissed force row level security;
drop policy if exists duplicate_dismissed_household on duplicate_dismissed;
create policy duplicate_dismissed_household on duplicate_dismissed
  using (exists (select 1 from txn t where t.id = low_id and t.household_id = app_household())
     and exists (select 1 from txn t where t.id = high_id and t.household_id = app_household()))
  with check (exists (select 1 from txn t where t.id = low_id and t.household_id = app_household())
          and exists (select 1 from txn t where t.id = high_id and t.household_id = app_household()));

-- Every view runs as whoever asks, so the policies above apply through it.
do $$
declare v record;
begin
  for v in select viewname from pg_views where schemaname = 'public' loop
    execute format('alter view %I set (security_invoker = true)', v.viewname);
  end loop;
end $$;

-- The role the app connects as: LOGIN and nothing else. It owns no table,
-- cannot bypass a policy, and never sees the migration ledger. The password
-- is set by scripts/app-role.mjs, never written here.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'saree_app') then
    create role saree_app login nobypassrls noinherit;
  end if;
end $$;

grant usage on schema public to saree_app;
grant select, insert, update, delete on all tables in schema public to saree_app;
grant usage, select on all sequences in schema public to saree_app;
grant execute on all functions in schema public to saree_app;
revoke all on _migration from saree_app;
-- A quote is evidence of what the market said on a day: read it, add one, never rewrite it.
revoke update, delete, truncate on price_quote from saree_app;
-- One exception: fetched_at, so a re-fetch that finds the provider's date unchanged can say "checked again"
-- (db/prices.ts). The rate, the date and the source stay unrewritable.
grant update (fetched_at) on price_quote to saree_app;
-- A table a later migration adds is granted the same way, without a new line here.
alter default privileges in schema public grant select, insert, update, delete on tables to saree_app;
alter default privileges in schema public grant usage, select on sequences to saree_app;
alter default privileges in schema public grant execute on functions to saree_app;
