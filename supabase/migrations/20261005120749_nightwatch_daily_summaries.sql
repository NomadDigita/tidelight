create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.nightwatch_generate_daily_summaries()
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $function$
declare
  day_start timestamptz := date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC';
  day_end timestamptz;
  inserted_count integer := 0;
begin
  day_end := day_start + interval '1 day';

  with active_accounts as (
    select a.user_id
    from public.nightwatch_accounts a
    left join public.nightwatch_preferences p on p.user_id = a.user_id
    where p.daily_summary is distinct from false
  ), daily_runs as (
    select
      r.user_id,
      count(*)::integer as decision_count,
      count(*) filter (where r.outcome = 'executed')::integer as fill_count,
      count(*) filter (where r.outcome = 'rejected')::integer as rejected_count
    from public.nightwatch_runs r
    where r.created_at >= day_start and r.created_at < day_end
    group by r.user_id
  ), summaries as (
    select
      a.user_id,
      coalesce(d.decision_count, 0) as decision_count,
      coalesce(d.fill_count, 0) as fill_count,
      coalesce(d.rejected_count, 0) as rejected_count,
      coalesce((
        select string_agg(markets.symbol, ', ' order by markets.symbol)
        from (
          select distinct r.symbol
          from public.nightwatch_runs r
          where r.user_id = a.user_id and r.created_at >= day_start and r.created_at < day_end
          order by r.symbol
          limit 4
        ) markets
      ), 'no markets') as symbols
    from active_accounts a
    left join daily_runs d on d.user_id = a.user_id
  ), updated as (
    update public.nightwatch_alerts existing
    set title = 'Nightwatch daily summary',
        body = format(
          '%s decision%s across %s; %s paper fill%s, %s blocked by guardrails. No live orders were sent.',
          s.decision_count,
          case when s.decision_count = 1 then '' else 's' end,
          s.symbols,
          s.fill_count,
          case when s.fill_count = 1 then '' else 's' end,
          s.rejected_count
        ),
        read_at = null
    from summaries s
    where existing.user_id = s.user_id
      and existing.kind = 'summary'
      and existing.created_at >= day_start
      and existing.created_at < day_end
    returning existing.id
  )
  insert into public.nightwatch_alerts (user_id, kind, title, body)
  select
    s.user_id,
    'summary',
    'Nightwatch daily summary',
    format(
      '%s decision%s across %s; %s paper fill%s, %s blocked by guardrails. No live orders were sent.',
      s.decision_count,
      case when s.decision_count = 1 then '' else 's' end,
      s.symbols,
      s.fill_count,
      case when s.fill_count = 1 then '' else 's' end,
      s.rejected_count
    )
  from summaries s
  where not exists (
    select 1
    from public.nightwatch_alerts existing
    where existing.user_id = s.user_id
      and existing.kind = 'summary'
      and existing.created_at >= day_start
      and existing.created_at < day_end
  );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;

revoke all on function private.nightwatch_generate_daily_summaries() from public, anon, authenticated;

do $schedule$
declare
  old_job record;
begin
  for old_job in select jobid from cron.job where jobname = 'nightwatch-daily-summaries'
  loop
    perform cron.unschedule(old_job.jobid);
  end loop;

  perform cron.schedule(
    'nightwatch-daily-summaries',
    '0 23 * * *',
    'select private.nightwatch_generate_daily_summaries();'
  );
end;
$schedule$;
