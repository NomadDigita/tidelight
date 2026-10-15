-- Exact, project-scoped request analytics for the developer console.
-- This reports request volume and latency only; it does not invent monetary costs.
create or replace function public.get_tic_usage_analytics(
  p_project_ids uuid[],
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  usage_day date,
  request_count bigint,
  success_count bigint,
  client_error_count bigint,
  server_error_count bigint,
  pending_count bigint,
  average_duration_ms numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  project_count integer;
begin
  project_count := coalesce(cardinality(p_project_ids), 0);
  if project_count < 1 or project_count > 500
     or array_position(p_project_ids, null) is not null
     or (select count(distinct id) from unnest(p_project_ids) as projects(id)) <> project_count
     or p_from is null or p_to is null or p_to <= p_from
     or p_to - p_from > interval '31 days' then
    raise exception using errcode = '22023', message = 'invalid usage analytics parameters';
  end if;

  return query
  with days as (
    select generate_series(
      date_trunc('day', p_from at time zone 'UTC'),
      date_trunc('day', (p_to - interval '1 microsecond') at time zone 'UTC'),
      interval '1 day'
    )::date as day
  ), counts as (
    select
      (r.created_at at time zone 'UTC')::date as day,
      count(*) as requests,
      count(*) filter (where r.status_code >= 200 and r.status_code < 400) as successes,
      count(*) filter (where r.status_code >= 400 and r.status_code < 500) as client_errors,
      count(*) filter (where r.status_code >= 500) as server_errors,
      count(*) filter (where r.status_code is null) as pending,
      round(avg(r.duration_ms)::numeric, 1) as average_duration
    from public.developer_api_requests r
    where r.project_id = any(p_project_ids)
      and r.created_at >= p_from
      and r.created_at < p_to
    group by (r.created_at at time zone 'UTC')::date
  )
  select
    days.day,
    coalesce(counts.requests, 0),
    coalesce(counts.successes, 0),
    coalesce(counts.client_errors, 0),
    coalesce(counts.server_errors, 0),
    coalesce(counts.pending, 0),
    counts.average_duration
  from days
  left join counts on counts.day = days.day
  order by days.day;
end;
$$;

revoke all on function public.get_tic_usage_analytics(uuid[], timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_tic_usage_analytics(uuid[], timestamptz, timestamptz) to service_role;
