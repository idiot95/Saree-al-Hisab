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
   here the owner bypasses anyway, but a copy of this app whose owner lacks
   BYPASSRLS is covered without a second thought. The invariants test checks
   the app role has no such attribute.

   Three tables are keyed by a household but read before one is known —
   `household`, `member` and `invite` are how a sign-in FINDS its household
   and how a link finds its invitation — so their policies are open when no
   household is set and scoped once one is. The tables keyed by a person or
   a token (app_user, password_reset, rate_limit, device) carry no policy.

   Views run as their caller (security_invoker), or a view owned by the
   bypassing owner would read past every policy. CREATE OR REPLACE VIEW
   without options RESETS that flag, so this file runs after every view file
   and sets it on all of them; a new view file must set it itself, and
   invariants.test.mjs fails if any view lacks it. */

create or replace function app_household() returns uuid
  language sql stable parallel safe
  as $$ select nullif(current_setting('app.household_id', true), '')::uuid $$;

-- The tables that carry household_id and are only ever read inside a scope.
alter table account enable row level security;
alter table account force row level security;
drop policy if exists account_household on account;
create policy account_household on account
  using (household_id = app_household()) with check (household_id = app_household());

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
-- A table a later migration adds is granted the same way, without a new line here.
alter default privileges in schema public grant select, insert, update, delete on tables to saree_app;
alter default privileges in schema public grant usage, select on sequences to saree_app;
alter default privileges in schema public grant execute on functions to saree_app;
