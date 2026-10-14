create table if not exists public.notification_read_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  security_event_id uuid not null references public.security_events(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, security_event_id)
);

alter table public.notification_read_receipts enable row level security;
create policy "Owners manage notification read receipts"
  on public.notification_read_receipts for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.notification_read_receipts from anon, public;
grant select, insert, update, delete on public.notification_read_receipts to authenticated;
