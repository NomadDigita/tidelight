-- User controlled email notifications and an idempotent transactional delivery queue.
create table if not exists public.email_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nightwatch_signals boolean not null default false,
  nightwatch_fills boolean not null default false,
  nightwatch_risks boolean not null default false,
  nightwatch_research boolean not null default false,
  nightwatch_daily_summary boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.email_notification_preferences enable row level security;
create policy "Owners manage email notification preferences"
  on public.email_notification_preferences for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.email_notification_preferences from anon, public;
grant select, insert, update, delete on public.email_notification_preferences to authenticated;

create table if not exists public.email_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null unique check (char_length(event_key) between 8 and 200),
  category text not null check (category in ('nightwatch_signal','nightwatch_fill','nightwatch_risk','nightwatch_research','nightwatch_summary','security')),
  payload jsonb not null,
  state text not null default 'pending' check (state in ('pending','sending','sent','suppressed','failed')),
  attempts integer not null default 0 check (attempts between 0 and 8),
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists email_delivery_queue_due_idx
  on public.email_delivery_queue(next_attempt_at, created_at)
  where state in ('pending','failed','sending') and attempts < 8;
alter table public.email_delivery_queue enable row level security;
revoke all on public.email_delivery_queue from anon, authenticated, public;
grant all on public.email_delivery_queue to service_role;

create or replace function public.claim_email_delivery_jobs(p_limit integer default 20)
returns setof public.email_delivery_queue
language sql
volatile
security invoker
set search_path = ''
as $$
  with due as (
    select q.id
    from public.email_delivery_queue as q
    where q.state in ('pending', 'failed', 'sending')
      and q.attempts < 8
      and q.next_attempt_at <= now()
    order by q.next_attempt_at, q.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 50))
  )
  update public.email_delivery_queue as q
  set state = 'sending', attempts = q.attempts + 1,
      next_attempt_at = now() + interval '10 minutes'
  from due
  where q.id = due.id
  returning q.*;
$$;
revoke all on function public.claim_email_delivery_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_email_delivery_jobs(integer) to service_role;
