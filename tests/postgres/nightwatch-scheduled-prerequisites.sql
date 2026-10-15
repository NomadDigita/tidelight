do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$$;

create schema auth;
create or replace function auth.role() returns text
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;

create table auth.users (id uuid primary key);
create table public.research_runs (id uuid primary key, user_id uuid not null references auth.users(id));
create table public.nightwatch_accounts (
  user_id uuid primary key references auth.users(id),
  paused boolean not null default false
);
create table public.nightwatch_preferences (
  user_id uuid primary key references auth.users(id),
  trigger_mode text not null default 'manual',
  monitor_symbol text
);

create schema nightwatch_private;
create table public.nightwatch_test_calls (
  id bigint generated always as identity primary key,
  owner_id text,
  symbol text,
  snapshot jsonb
);
create or replace function nightwatch_private.nightwatch_tick(
  p_symbol text, p_as_of_ms bigint, p_reference_price numeric, p_fast_sma numeric,
  p_slow_sma numeric, p_signal text, p_snapshot jsonb
) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
begin
  insert into public.nightwatch_test_calls(owner_id, symbol, snapshot)
  values (current_setting('request.jwt.claim.sub', true), p_symbol, p_snapshot);
  return jsonb_build_object('outcome', 'no_action', 'idempotent', false);
end;
$$;
