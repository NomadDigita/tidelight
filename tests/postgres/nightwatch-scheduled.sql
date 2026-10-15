\set ON_ERROR_STOP on
begin;

do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000001';
  v_other uuid := '00000000-0000-0000-0000-000000000002';
  v_run uuid := '10000000-0000-0000-0000-000000000001';
  v_other_run uuid := '10000000-0000-0000-0000-000000000002';
  v_result jsonb;
  v_call public.nightwatch_test_calls%rowtype;
  v_calls integer;
begin
  insert into auth.users values (v_user), (v_other);
  insert into public.research_runs values (v_run, v_user), (v_other_run, v_other);
  insert into public.nightwatch_accounts(user_id, paused) values (v_user, false), (v_other, false);
  insert into public.nightwatch_preferences(user_id, trigger_mode, monitor_symbol, research_run_id)
  values (v_user, 'every_check', 'RAAPLUSDT', v_run), (v_other, 'manual', 'RAAPLUSDT', null);

  if has_function_privilege('anon', 'public.nightwatch_tick_scheduled(uuid,text,bigint,numeric,numeric,numeric,text,jsonb,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.nightwatch_tick_scheduled(uuid,text,bigint,numeric,numeric,numeric,text,jsonb,uuid)', 'EXECUTE') then
    raise exception 'Scheduled RPC must not be executable by anon or authenticated';
  end if;
  if not has_function_privilege('service_role', 'public.nightwatch_tick_scheduled(uuid,text,bigint,numeric,numeric,numeric,text,jsonb,uuid)', 'EXECUTE') then
    raise exception 'Scheduled RPC must be executable by service_role';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform public.nightwatch_tick_scheduled(v_user, 'RAAPLUSDT', 1, 100, 99, 98, 'hold', '{}', v_run);
    raise exception 'Non-service caller unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.role', 'service_role', true);

  -- Manual preference, pause, symbol mismatch, and a stale linked research id all skip safely.
  v_result := public.nightwatch_tick_scheduled(v_other, 'RAAPLUSDT', 1, 100, 99, 98, 'hold', '{}', null);
  if v_result->>'outcome' <> 'skipped' then raise exception 'Manual preference must skip'; end if;
  update public.nightwatch_accounts set paused = true where user_id = v_user;
  v_result := public.nightwatch_tick_scheduled(v_user, 'RAAPLUSDT', 1, 100, 99, 98, 'hold', '{}', v_run);
  if v_result->>'outcome' <> 'skipped' then raise exception 'Paused account must skip'; end if;
  update public.nightwatch_accounts set paused = false where user_id = v_user;
  v_result := public.nightwatch_tick_scheduled(v_user, 'RNVDAUSDT', 1, 100, 99, 98, 'hold', '{}', v_run);
  if v_result->>'outcome' <> 'skipped' then raise exception 'Changed symbol must skip'; end if;
  v_result := public.nightwatch_tick_scheduled(v_user, 'RAAPLUSDT', 1, 100, 99, 98, 'hold', '{}', null);
  if v_result->>'outcome' <> 'skipped' then raise exception 'Stale research link must skip'; end if;
  select count(*) into v_calls from public.nightwatch_test_calls;
  if v_calls <> 0 then raise exception 'Skipped schedules must not reach the paper tick'; end if;

  -- A linked note owned by another account is rejected even if preference data is tampered with.
  update public.nightwatch_preferences set research_run_id = v_other_run where user_id = v_user;
  begin
    perform public.nightwatch_tick_scheduled(v_user, 'RAAPLUSDT', 1, 100, 99, 98, 'hold', '{}', v_other_run);
    raise exception 'Foreign research note unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  update public.nightwatch_preferences set research_run_id = v_run where user_id = v_user;

  v_result := public.nightwatch_tick_scheduled(
    v_user, 'RAAPLUSDT', 1, 100, 99, 98, 'hold', '{"source":"integration-test"}', v_run
  );
  if v_result->>'outcome' <> 'no_action' then raise exception 'Expected guarded paper result'; end if;
  select * into strict v_call from public.nightwatch_test_calls;
  if v_call.owner_id <> v_user::text or v_call.symbol <> 'RAAPLUSDT' then
    raise exception 'Wrapper did not set owner identity and selected symbol';
  end if;
  if v_call.snapshot->>'trigger' <> 'scheduled_opt_in' or v_call.snapshot->>'researchRunId' <> v_run::text
    or v_call.snapshot->>'source' <> 'integration-test' then
    raise exception 'Paper tick lost trigger, research lineage, or input snapshot';
  end if;

  begin
    perform public.nightwatch_tick_scheduled(null, 'RAAPLUSDT', 1, 100, 99, 98, 'hold', '{}', null);
    raise exception 'Invalid owner unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.nightwatch_tick_scheduled(v_user, 'invalid', 1, 100, 99, 98, 'hold', '{}', v_run);
    raise exception 'Invalid symbol unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

rollback;
