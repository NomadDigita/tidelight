-- Studio sharing is opt-in; existing members retain private activity.
alter table public.community_profiles
  add column if not exists show_studio_stats boolean not null default false;

-- Service-role-only aggregate API. Existing owner RLS on raw Studio tables
-- remains unchanged. The predicate is evaluated in the same snapshot as counts.
create or replace function public.community_public_studio_stats(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.show_studio_stats then jsonb_build_object(
    'researchRuns', (select count(*) from public.research_runs r where r.user_id = p.id and r.status = 'complete'),
    'backtests', (select count(*) from public.strategy_backtest_runs b where b.user_id = p.id),
    'watchlistItems', (select count(*) from public.watchlist_items w where w.user_id = p.id),
    'paperDecisions', (select count(*) from public.nightwatch_runs n where n.user_id = p.id)
      + (select count(*) from public.futures_paper_decisions f where f.user_id = p.id)
  ) else null end
  from public.community_profiles p where p.id = p_profile_id;
$$;
revoke all on function public.community_public_studio_stats(uuid) from public, anon, authenticated;
grant execute on function public.community_public_studio_stats(uuid) to service_role;
