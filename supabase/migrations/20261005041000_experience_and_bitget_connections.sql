alter table public.user_preferences
  add column if not exists experience_mode text not null default 'pro'
  check (experience_mode in ('mini', 'pro'));

create table if not exists public.bitget_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Bitget account' check (char_length(label) between 1 and 80),
  mode text not null default 'paper' check (mode in ('paper', 'live')),
  live_enabled boolean not null default false,
  api_key_ciphertext text,
  api_secret_ciphertext text,
  passphrase_ciphertext text,
  encryption_version text,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bitget_connections_user_idx on public.bitget_connections(user_id, created_at desc);
alter table public.bitget_connections enable row level security;
create policy "Owners manage Bitget connections" on public.bitget_connections for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.bitget_connections from anon, public;
grant select, insert, update, delete on public.bitget_connections to authenticated;
