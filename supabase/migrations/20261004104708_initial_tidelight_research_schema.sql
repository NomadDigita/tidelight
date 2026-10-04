create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  risk_profile text not null default 'balanced' check (risk_profile in ('conservative','balanced','growth')),
  default_region text not null default 'US',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9.]{1,16}$'),
  company_name text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);
create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 2000),
  status text not null default 'queued' check (status in ('queued','collecting','analyzing','complete','failed')),
  event_type text, summary jsonb, model_name text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references public.research_runs(id) on delete cascade,
  url text not null, title text not null, publisher text, published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  source_type text not null default 'web' check (source_type in ('web','market_data','filing','user_note')),
  excerpt text, content_hash text,
  unique (research_run_id, url)
);
create table public.research_evidence (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references public.research_runs(id) on delete cascade,
  source_id uuid references public.research_sources(id) on delete set null,
  claim text not null, supporting_quote text,
  stance text not null default 'supports' check (stance in ('supports','contradicts','context')),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now()
);
create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9.]{1,16}$'),
  exposure_pct numeric(6,3) not null check (exposure_pct >= 0 and exposure_pct <= 100),
  captured_at timestamptz not null default now()
);
create index watchlist_items_user_created_idx on public.watchlist_items(user_id, created_at desc);
create index research_runs_user_created_idx on public.research_runs(user_id, created_at desc);
create index research_sources_run_idx on public.research_sources(research_run_id);
create index research_evidence_run_idx on public.research_evidence(research_run_id);
create index portfolio_snapshots_user_time_idx on public.portfolio_snapshots(user_id, captured_at desc);
alter table public.user_preferences enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.research_runs enable row level security;
alter table public.research_sources enable row level security;
alter table public.research_evidence enable row level security;
alter table public.portfolio_snapshots enable row level security;
create policy "Owners manage preferences" on public.user_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners manage watchlist" on public.watchlist_items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners manage research runs" on public.research_runs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners manage portfolio snapshots" on public.portfolio_snapshots for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners access research sources" on public.research_sources for all to authenticated
  using (exists (select 1 from public.research_runs r where r.id = research_run_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.research_runs r where r.id = research_run_id and r.user_id = (select auth.uid())));
create policy "Owners access research evidence" on public.research_evidence for all to authenticated
  using (exists (select 1 from public.research_runs r where r.id = research_run_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.research_runs r where r.id = research_run_id and r.user_id = (select auth.uid())));
revoke all on public.user_preferences, public.watchlist_items, public.research_runs, public.research_sources, public.research_evidence, public.portfolio_snapshots from anon, public;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.user_preferences, public.watchlist_items, public.research_runs, public.research_sources, public.research_evidence, public.portfolio_snapshots to authenticated;
