create table if not exists public.sec_company_facts_cache (
  ticker text primary key check (ticker = upper(ticker) and ticker ~ '^[A-Z][A-Z0-9.]{0,9}$'),
  cik text not null check (cik ~ '^[0-9]{10}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  source_url text not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint sec_company_facts_cache_expiry_valid check (expires_at > fetched_at)
);

comment on table public.sec_company_facts_cache is 'Public SEC EDGAR issuer metadata and reported fundamentals cached by a server-only route.';
alter table public.sec_company_facts_cache enable row level security;
revoke all on public.sec_company_facts_cache from public, anon, authenticated;
