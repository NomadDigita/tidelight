create table if not exists public.nightwatch_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trigger_mode text not null default 'manual' check (trigger_mode in ('manual', 'every_check')),
  alert_on_signal boolean not null default true,
  alert_on_fill boolean not null default true,
  daily_summary boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.nightwatch_preferences enable row level security;
create policy "Owners manage Nightwatch preferences" on public.nightwatch_preferences for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.nightwatch_preferences from anon, public;
grant select, insert, update, delete on public.nightwatch_preferences to authenticated;
