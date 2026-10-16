\set ON_ERROR_STOP on
begin;
do $$ begin
  if nightwatch_private.next_schedule_time('09:00:42','Africa/Lagos','2026-10-15 00:00:00Z') is distinct from timestamptz '2026-10-15 08:00:42Z' then raise exception 'Timezone/seconds conversion is incorrect'; end if;
  if nightwatch_private.next_schedule_time('01:30','America/New_York','2026-11-01 00:00Z') is distinct from timestamptz '2026-11-01 06:30Z' then raise exception 'Repeated DST time must select one occurrence'; end if;
  if nightwatch_private.next_schedule_time('02:30','America/New_York','2026-03-08 00:00Z') is distinct from timestamptz '2026-03-08 07:30Z' then raise exception 'Missing DST time must shift forward'; end if;
end $$;
insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into public.nightwatch_accounts(user_id) select id from auth.users;
insert into public.research_runs values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare s public.nightwatch_schedules; n integer;
begin
  for n in 1..10 loop
    s:=public.save_nightwatch_schedule(null,'Review '||n,'RAAPLUSDT',('09:00:'||lpad(n::text,2,'0'))::time,'Africa/Lagos','sma_trend_v1',true,'10000000-0000-4000-8000-000000000001');
    if s.next_run_at<=now() then raise exception 'Next run must be in future'; end if;
  end loop;
  begin
    perform public.save_nightwatch_schedule(null,'Eleventh','RAAPLUSDT','09:00','UTC','sma_trend_v1',true,null);
    raise exception 'Expected ten-schedule capacity denial';
  exception when program_limit_exceeded then null; end;
  begin
    perform public.save_nightwatch_schedule(s.id,'Foreign research','RAAPLUSDT','09:00','UTC','sma_trend_v1',true,'10000000-0000-4000-8000-000000000002');
    raise exception 'Expected research ownership denial';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_nightwatch_schedule(s.id,'Bad timezone','RAAPLUSDT','09:00','Invented/Zone','sma_trend_v1',true,null);
    raise exception 'Expected timezone validation';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.claim_nightwatch_schedule();
    raise exception 'Owner must not claim worker jobs';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.nightwatch_schedules) then raise exception 'RLS leaked another owner schedules'; end if;
end $$;
reset role;
-- Verify actual paper ledger delegation, retry lease isolation, and same-candle idempotency.
do $$
declare s public.nightwatch_schedules; e jsonb; r jsonb; v_time bigint := floor(extract(epoch from now()-interval '1 minute')*1000); v_cash numeric; v_owner uuid := '00000000-0000-4000-8000-000000000001'; n integer;
begin
  select * into s from public.nightwatch_schedules where user_id=v_owner order by slot limit 1;
  update public.nightwatch_schedules set next_run_at=now()-interval '1 second' where id=s.id;
  e:=public.claim_nightwatch_schedule();
  if e is null then raise exception 'Due schedule was not claimed'; end if;
  r:=public.finish_nightwatch_schedule((e->>'id')::uuid,gen_random_uuid(),null,'provider_unavailable');
  if r->>'status' is distinct from 'lease_lost' then raise exception 'Foreign lease must be denied'; end if;
  r:=public.finish_nightwatch_schedule((e->>'id')::uuid,(e->>'lease_token')::uuid,jsonb_build_object('asOfMs',v_time,'price',100,'fast',101,'slow',99,'signal','buy','snapshot','{}'::jsonb));
  if r->>'status' is distinct from 'complete' or r->>'outcome' is distinct from 'executed' then raise exception 'Expected guarded paper buy: %',r; end if;
  if (select count(*) from public.nightwatch_orders where user_id=v_owner and paper_only)<>1 then raise exception 'Expected exactly one paper order'; end if;
  select cash_balance into v_cash from public.nightwatch_accounts where user_id=v_owner;
  if v_cash>=10000 or v_cash<9499 then raise exception 'Position cap or paper fee is incorrect'; end if;
  if exists(select 1 from public.nightwatch_orders where user_id<>v_owner) then raise exception 'Cross-account paper mutation'; end if;
  if not exists(select 1 from public.nightwatch_runs where snapshot->>'scheduleId'=s.id::text and snapshot->>'researchRunId'='10000000-0000-4000-8000-000000000001') then raise exception 'Lost schedule/research lineage'; end if;
  -- Another schedule on the same candle reuses the first decision.
  update public.nightwatch_schedules set next_run_at=now()-interval '1 second' where user_id=v_owner and slot=2;
  e:=public.claim_nightwatch_schedule();
  r:=public.finish_nightwatch_schedule((e->>'id')::uuid,(e->>'lease_token')::uuid,jsonb_build_object('asOfMs',v_time,'price',100,'fast',101,'slow',99,'signal','buy','snapshot','{}'::jsonb));
  if r->>'idempotent' is distinct from 'true' or (select count(*) from public.nightwatch_orders)<>1 then raise exception 'Repeated candle created duplicate order'; end if;
  -- Edits and account pause are checked again after claim.
  update public.nightwatch_schedules set next_run_at=now()-interval '1 second' where user_id=v_owner and slot=3;
  e:=public.claim_nightwatch_schedule();
  update public.nightwatch_accounts set paused=true where user_id=v_owner;
  r:=public.finish_nightwatch_schedule((e->>'id')::uuid,(e->>'lease_token')::uuid,null,null);
  if r->>'status' is distinct from 'skipped' then raise exception 'Paused agent must skip before ledger mutation'; end if;
  update public.nightwatch_accounts set paused=false where user_id=v_owner;
  update public.nightwatch_schedules set next_run_at=now()-interval '1 second' where user_id=v_owner and slot=4;
  e:=public.claim_nightwatch_schedule();
  update public.nightwatch_schedules set revision=revision+1 where id=(e->>'schedule_id')::uuid;
  r:=public.finish_nightwatch_schedule((e->>'id')::uuid,(e->>'lease_token')::uuid,null,null);
  if r->>'status' is distinct from 'skipped' then raise exception 'Changed schedule must skip'; end if;
  -- Failed provider calls retry with a new lease and eventually terminate.
  update public.nightwatch_schedules set next_run_at=now()-interval '1 second' where user_id=v_owner and slot=5;
  e:=public.claim_nightwatch_schedule();
  for n in 1..3 loop
    r:=public.finish_nightwatch_schedule((e->>'id')::uuid,(e->>'lease_token')::uuid,null,'provider_unavailable');
    update public.nightwatch_schedule_executions set lease_until=now()-interval '1 second' where id=(e->>'id')::uuid;
    if n<3 then e:=public.claim_nightwatch_schedule(); end if;
  end loop;
  perform public.claim_nightwatch_schedule();
  if (select status from public.nightwatch_schedule_executions where id=(e->>'id')::uuid) is distinct from 'failed' then raise exception 'Retries did not terminate'; end if;
  -- Ten daily reservations cannot be bypassed by changing or recreating a schedule.
  for n in 6..10 loop
    update public.nightwatch_schedules set next_run_at=now()-interval '1 second' where user_id=v_owner and slot=n;
    e:=public.claim_nightwatch_schedule();
    perform public.finish_nightwatch_schedule((e->>'id')::uuid,(e->>'lease_token')::uuid,null,'provider_unavailable');
  end loop;
  -- Reuse slot 1 via a new schedule id; history remains and budget still applies.
  delete from public.nightwatch_schedules where user_id=v_owner and slot=1;
  insert into public.nightwatch_schedules(user_id,slot,label,symbol,local_time,time_zone,playbook_key,next_run_at)
  values(v_owner,1,'Recreated','RAAPLUSDT','09:00','UTC','sma_trend_v1',now()-interval '1 second');
  e:=public.claim_nightwatch_schedule();
  if e is not null then raise exception 'Daily execution limit was bypassed'; end if;
  if not exists(select 1 from public.nightwatch_schedule_executions where error_code='daily_limit') then raise exception 'Daily-limit denial was not recorded'; end if;
end $$;
rollback;
