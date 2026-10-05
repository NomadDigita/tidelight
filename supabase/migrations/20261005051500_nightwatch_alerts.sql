create table if not exists public.nightwatch_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.nightwatch_runs(id) on delete cascade,
  kind text not null check (kind in ('signal','fill','summary')),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id, kind)
);
create index if not exists nightwatch_alerts_user_created_idx on public.nightwatch_alerts(user_id, created_at desc);
alter table public.nightwatch_alerts enable row level security;
create policy "Owners read Nightwatch alerts" on public.nightwatch_alerts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners create Nightwatch alerts" on public.nightwatch_alerts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners update Nightwatch alerts" on public.nightwatch_alerts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.nightwatch_alerts from anon, public;
grant select, insert, update on public.nightwatch_alerts to authenticated;
