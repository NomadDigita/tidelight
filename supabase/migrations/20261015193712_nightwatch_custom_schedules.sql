-- Daily schedules are separate from account-wide notification preferences.
create table public.nightwatch_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 1 and 10),
  label text not null check (char_length(label) between 1 and 64),
  symbol text not null check (symbol ~ '^[A-Z0-9]{2,24}USDT$'),
  local_time time(0) not null,
  time_zone text not null,
  playbook_key text not null,
  research_run_id uuid references public.research_runs(id) on delete set null,
  enabled boolean not null default true,
  revision integer not null default 1,
  next_run_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, slot)
);
create index nightwatch_schedules_due_idx on public.nightwatch_schedules(next_run_at) where enabled;
create table public.nightwatch_schedule_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid references public.nightwatch_schedules(id) on delete set null,
  schedule_revision integer not null,
  scheduled_for timestamptz not null,
  local_date date not null,
  config jsonb not null,
  status text not null check (status in ('running','complete','skipped','failed')),
  attempts smallint not null default 1 check (attempts between 1 and 3),
  lease_token uuid not null default gen_random_uuid(),
  lease_until timestamptz not null default now() + interval '75 seconds',
  run_id uuid references public.nightwatch_runs(id) on delete set null,
  outcome text,
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(schedule_id, local_date)
);
create index nightwatch_schedule_execution_owner_idx on public.nightwatch_schedule_executions(user_id, created_at desc);
create index nightwatch_schedule_execution_retry_idx on public.nightwatch_schedule_executions(lease_until) where status = 'running';
alter table public.nightwatch_schedules enable row level security;
alter table public.nightwatch_schedule_executions enable row level security;
create policy "Owners read Nightwatch schedules" on public.nightwatch_schedules for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners read Nightwatch executions" on public.nightwatch_schedule_executions for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.nightwatch_schedules,public.nightwatch_schedule_executions from public,anon,authenticated;
grant select on public.nightwatch_schedules,public.nightwatch_schedule_executions to authenticated;
grant all on public.nightwatch_schedules,public.nightwatch_schedule_executions to service_role;

create or replace function nightwatch_private.next_schedule_time(p_time time,p_zone text,p_after timestamptz)
returns timestamptz language plpgsql stable set search_path = '' as $$
declare v_date date := (p_after at time zone p_zone)::date; v_next timestamptz;
begin
  v_next := (v_date + p_time) at time zone p_zone;
  if v_next <= p_after then v_next := ((v_date + 1) + p_time) at time zone p_zone; end if;
  return v_next;
end;
$$;
revoke all on function nightwatch_private.next_schedule_time(time,text,timestamptz) from public,anon,authenticated;

create or replace function nightwatch_private.save_nightwatch_schedule(
  p_id uuid,p_label text,p_symbol text,p_local_time time,p_time_zone text,
  p_playbook_key text,p_enabled boolean,p_research_run_id uuid default null
) returns public.nightwatch_schedules language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_slot smallint; v_saved public.nightwatch_schedules;
begin
  if v_user is null then raise exception 'Sign in to manage schedules.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 19847));
  if p_symbol is null or p_symbol !~ '^[A-Z0-9]{2,24}USDT$' or p_local_time is null
    or p_local_time >= time '24:00:00' or extract(second from p_local_time) <> trunc(extract(second from p_local_time))
    or p_label is null or char_length(trim(p_label)) not between 1 and 64 or p_enabled is null
    or not exists(select 1 from pg_timezone_names where name=p_time_zone)
    or p_playbook_key is null or p_playbook_key <> all(array['sma_trend_v1','rsi_reversion_v1','channel_breakout_v1','weekend_drift_v1','trend_pullback_v1','semi_breakout_v1']) then
    raise exception 'Invalid schedule configuration.' using errcode='22023';
  end if;
  if p_research_run_id is not null and not exists(select 1 from public.research_runs where id=p_research_run_id and user_id=v_user) then
    raise exception 'Research note is unavailable in this account.' using errcode='42501';
  end if;
  if p_id is null then
    select n into v_slot from generate_series(1,10) n where not exists(select 1 from public.nightwatch_schedules s where s.user_id=v_user and s.slot=n) order by n limit 1;
    if v_slot is null then raise exception 'Maximum ten daily schedules per account.' using errcode='54000'; end if;
    insert into public.nightwatch_schedules(user_id,slot,label,symbol,local_time,time_zone,playbook_key,enabled,research_run_id,next_run_at)
    values(v_user,v_slot,trim(p_label),p_symbol,p_local_time,p_time_zone,p_playbook_key,p_enabled,p_research_run_id,nightwatch_private.next_schedule_time(p_local_time,p_time_zone,now())) returning * into v_saved;
  else
    update public.nightwatch_schedules set label=trim(p_label),symbol=p_symbol,local_time=p_local_time,time_zone=p_time_zone,
      playbook_key=p_playbook_key,enabled=p_enabled,research_run_id=p_research_run_id,revision=revision+1,
      next_run_at=nightwatch_private.next_schedule_time(p_local_time,p_time_zone,
        case when exists(select 1 from public.nightwatch_schedule_executions e where e.schedule_id=p_id and e.local_date=(now() at time zone p_time_zone)::date)
        then greatest(now(),((now() at time zone p_time_zone)::date+p_local_time) at time zone p_time_zone) else now() end),updated_at=now()
    where id=p_id and user_id=v_user returning * into v_saved;
    if not found then raise exception 'Schedule is unavailable in this account.' using errcode='42501'; end if;
  end if;
  return v_saved;
end;
$$;
revoke all on function nightwatch_private.save_nightwatch_schedule(uuid,text,text,time,text,text,boolean,uuid) from public,anon;
grant execute on function nightwatch_private.save_nightwatch_schedule(uuid,text,text,time,text,text,boolean,uuid) to authenticated;
create or replace function nightwatch_private.delete_nightwatch_schedule(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in to manage schedules.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,19847));
  delete from public.nightwatch_schedules where id=p_id and user_id=v_user;
  return found;
end;
$$;
revoke all on function nightwatch_private.delete_nightwatch_schedule(uuid) from public,anon;
grant execute on function nightwatch_private.delete_nightwatch_schedule(uuid) to authenticated;

-- Service-only claims reserve a daily budget before any model/provider work.
create or replace function public.claim_nightwatch_schedule() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.nightwatch_schedules; e public.nightwatch_schedule_executions; v_count integer;
begin
  update public.nightwatch_schedule_executions set status='failed',error_code='retry_exhausted',finished_at=now()
  where status='running' and lease_until <= now() and attempts>=3;
  select * into e from public.nightwatch_schedule_executions where status='running' and lease_until<=now() and attempts<3
  order by lease_until for update skip locked limit 1;
  if found then
    update public.nightwatch_schedule_executions set attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '75 seconds'
    where id=e.id returning * into e;
    return to_jsonb(e);
  end if;
  select * into s from public.nightwatch_schedules where enabled and next_run_at<=now()
  order by next_run_at,id for update skip locked limit 1;
  if not found then return null; end if;
  -- The account lock serializes claims across the user's different schedule rows.
  perform 1 from public.nightwatch_accounts where user_id=s.user_id for update;
  perform pg_advisory_xact_lock(hashtextextended(s.user_id::text,19848));
  select count(*) into v_count from public.nightwatch_schedule_executions
    where user_id=s.user_id and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  insert into public.nightwatch_schedule_executions(user_id,schedule_id,schedule_revision,scheduled_for,local_date,config,status,error_code,finished_at)
  values(s.user_id,s.id,s.revision,s.next_run_at,(s.next_run_at at time zone s.time_zone)::date,to_jsonb(s),
    case when v_count>=10 or s.next_run_at<now()-interval '15 minutes' then 'skipped' else 'running' end,
    case when v_count>=10 then 'daily_limit' when s.next_run_at<now()-interval '15 minutes' then 'missed_window' else null end,
    case when v_count>=10 or s.next_run_at<now()-interval '15 minutes' then now() else null end)
  on conflict(schedule_id,local_date) do nothing returning * into e;
  update public.nightwatch_schedules set next_run_at=nightwatch_private.next_schedule_time(s.local_time,s.time_zone,now()) where id=s.id;
  if e.id is null or e.status<>'running' then return null; end if;
  return to_jsonb(e);
end;
$$;
revoke all on function public.claim_nightwatch_schedule() from public,anon,authenticated;
grant execute on function public.claim_nightwatch_schedule() to service_role;

create or replace function public.finish_nightwatch_schedule(
  p_id uuid,p_lease_token uuid,p_market jsonb default null,p_error_code text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.nightwatch_schedule_executions; s public.nightwatch_schedules; v_paused boolean; v_result jsonb;
begin
  select * into e from public.nightwatch_schedule_executions where id=p_id for update;
  if not found or e.status<>'running' or e.lease_token<>p_lease_token or e.lease_until<=now() then return jsonb_build_object('status','lease_lost'); end if;
  select * into s from public.nightwatch_schedules where id=e.schedule_id for update;
  select paused into v_paused from public.nightwatch_accounts where user_id=e.user_id for update;
  if s.id is null or not s.enabled or s.revision<>e.schedule_revision or s.user_id<>e.user_id or coalesce(v_paused,true) then
    update public.nightwatch_schedule_executions set status='skipped',error_code='schedule_changed_or_paused',finished_at=now() where id=e.id;
    return jsonb_build_object('status','skipped');
  end if;
  if p_error_code is not null then
    update public.nightwatch_schedule_executions set error_code='provider_unavailable',lease_until=now()+interval '30 seconds' where id=e.id;
    return jsonb_build_object('status','retry_pending');
  end if;
  if s.research_run_id is not null and not exists(select 1 from public.research_runs where id=s.research_run_id and user_id=s.user_id) then
    raise exception 'Research note is unavailable in this account.' using errcode='42501';
  end if;
  perform set_config('request.jwt.claim.sub',e.user_id::text,true);
  v_result := nightwatch_private.nightwatch_tick(s.symbol,(p_market->>'asOfMs')::bigint,(p_market->>'price')::numeric,
    (p_market->>'fast')::numeric,(p_market->>'slow')::numeric,p_market->>'signal',
    coalesce(p_market->'snapshot','{}'::jsonb)||jsonb_build_object('trigger','custom_schedule','scheduleId',s.id,'scheduledFor',e.scheduled_for,'scheduleExecutionId',e.id,'researchRunId',s.research_run_id));
  update public.nightwatch_schedule_executions set status='complete',run_id=(v_result->>'run_id')::uuid,outcome=v_result->>'outcome',error_code=null,finished_at=now() where id=e.id;
  return v_result||jsonb_build_object('status','complete');
end;
$$;
revoke all on function public.finish_nightwatch_schedule(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.finish_nightwatch_schedule(uuid,uuid,jsonb,text) to service_role;

-- Preserve each existing opt-in as a daily 09:00 UTC schedule.
insert into public.nightwatch_schedules(user_id,slot,label,symbol,local_time,time_zone,playbook_key,research_run_id,next_run_at)
select p.user_id,1,'Daily market review',p.monitor_symbol,'09:00:00','UTC',p.playbook_key,p.research_run_id,
  nightwatch_private.next_schedule_time('09:00:00','UTC',now())
from public.nightwatch_preferences p join public.nightwatch_accounts a on a.user_id=p.user_id
where p.trigger_mode='every_check' and p.monitor_symbol is not null;

-- Registered only after the worker deployment is verified. Secrets stay in Vault.
create or replace function private.invoke_nightwatch_schedule_worker() returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text; v_request bigint;
begin
  if not exists(select 1 from public.nightwatch_schedules where enabled and next_run_at<=now())
     and not exists(select 1 from public.nightwatch_schedule_executions where status='running' and lease_until<=now()) then return null; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name='tic_research_worker_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='tic_research_worker_secret';
  if v_url is null or v_secret is null or v_url !~ '^https://[^/]+/api/cron/tic-research/?$' then raise exception 'Worker configuration is unavailable'; end if;
  v_url := regexp_replace(v_url,'/api/cron/tic-research/?$','/api/cron/nightwatch-schedules');
  select net.http_post(url:=v_url,headers:=jsonb_build_object('Authorization','Bearer '||v_secret),body:='{}'::jsonb,timeout_milliseconds:=60000) into v_request;
  return v_request;
end;
$$;
revoke all on function private.invoke_nightwatch_schedule_worker() from public,anon,authenticated,service_role;

create or replace function nightwatch_private.nightwatch_schedule_readiness() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view scheduler status.' using errcode='42501'; end if;
  return exists(select 1 from cron.job where jobname='nightwatch-custom-schedules' and active)
    and exists(select 1 from vault.secrets where name='tic_research_worker_secret');
end;
$$;
revoke all on function nightwatch_private.nightwatch_schedule_readiness() from public,anon;
grant execute on function nightwatch_private.nightwatch_schedule_readiness() to authenticated;

-- Public entrypoints retain invoker security; elevated implementations live in
-- the non-exposed schema and enforce auth.uid() ownership on every operation.
create or replace function public.save_nightwatch_schedule(
  p_id uuid,p_label text,p_symbol text,p_local_time time,p_time_zone text,
  p_playbook_key text,p_enabled boolean,p_research_run_id uuid default null
) returns public.nightwatch_schedules language sql security invoker set search_path = '' as $$
  select nightwatch_private.save_nightwatch_schedule($1,$2,$3,$4,$5,$6,$7,$8);
$$;
revoke all on function public.save_nightwatch_schedule(uuid,text,text,time,text,text,boolean,uuid) from public,anon;
grant execute on function public.save_nightwatch_schedule(uuid,text,text,time,text,text,boolean,uuid) to authenticated;
create or replace function public.delete_nightwatch_schedule(p_id uuid) returns boolean language sql security invoker set search_path = '' as $$
  select nightwatch_private.delete_nightwatch_schedule($1);
$$;
revoke all on function public.delete_nightwatch_schedule(uuid) from public,anon;
grant execute on function public.delete_nightwatch_schedule(uuid) to authenticated;
create or replace function public.nightwatch_schedule_readiness() returns boolean language sql security invoker set search_path = '' as $$
  select nightwatch_private.nightwatch_schedule_readiness();
$$;
revoke all on function public.nightwatch_schedule_readiness() from public,anon;
grant execute on function public.nightwatch_schedule_readiness() to authenticated;
