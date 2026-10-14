create table if not exists public.account_privacy_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  analytics_choice text not null check (analytics_choice in ('accepted', 'rejected')),
  updated_at timestamptz not null default now()
);

alter table public.account_privacy_preferences enable row level security;
create policy "Owners read their privacy preferences"
  on public.account_privacy_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.account_privacy_preferences from public, anon, authenticated;
grant select on public.account_privacy_preferences to authenticated;
grant all on public.account_privacy_preferences to service_role;
