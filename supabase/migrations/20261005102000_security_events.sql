create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('mfa_required','mfa_verified','control_change','paper_exit')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_events_user_created_idx on public.security_events(user_id, created_at desc);
alter table public.security_events enable row level security;
create policy "Owners read security events" on public.security_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners create security events" on public.security_events for insert to authenticated with check ((select auth.uid()) = user_id);
revoke all on public.security_events from anon, public;
grant select, insert on public.security_events to authenticated;
