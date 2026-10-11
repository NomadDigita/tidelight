create table if not exists public.community_post_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1800),
  symbol text check (symbol is null or symbol ~ '^[A-Z0-9]{2,32}$'),
  stance text not null default 'watching' check (stance in ('watching','bullish','bearish','question','neutral')),
  source_url text check (source_url is null or source_url ~ '^https://'),
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media)='array' and jsonb_array_length(media)<=4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_post_drafts_user_updated_idx on public.community_post_drafts(user_id,updated_at desc);
alter table public.community_post_drafts enable row level security;
drop policy if exists "Users manage own community post drafts" on public.community_post_drafts;
create policy "Users manage own community post drafts" on public.community_post_drafts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create table if not exists public.community_message_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  peer_id uuid not null references public.community_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  updated_at timestamptz not null default now(),
  primary key(user_id,peer_id),
  check(user_id<>peer_id)
);
alter table public.community_message_drafts enable row level security;
drop policy if exists "Users manage own private message drafts" on public.community_message_drafts;
create policy "Users manage own private message drafts" on public.community_message_drafts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists "Senders delete their own messages" on public.community_messages;
create policy "Senders delete their own messages" on public.community_messages for delete to authenticated using(sender_id=auth.uid());
