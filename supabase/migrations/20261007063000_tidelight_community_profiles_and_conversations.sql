create table if not exists public.community_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9]{4,8}$'),
  display_name text not null check (char_length(display_name) between 1 and 48),
  avatar_url text,
  bio text not null default '' check (char_length(bio) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handle_changed_at timestamptz not null default now()
);
create unique index if not exists community_profiles_handle_lower_uidx on public.community_profiles(lower(handle));
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.community_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1800),
  symbol text check (symbol is null or symbol ~ '^[A-Z0-9]{2,32}$'),
  stance text not null default 'watching' check (stance in ('watching','bullish','bearish','question','neutral')),
  source_url text check (source_url is null or source_url ~ '^https://'),
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media)='array' and jsonb_array_length(media)<=4),
  reply_to uuid references public.community_posts(id) on delete set null,
  quote_post_id uuid references public.community_posts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists community_posts_created_idx on public.community_posts(created_at desc);
create index if not exists community_posts_symbol_idx on public.community_posts(symbol,created_at desc);
create table if not exists public.community_reactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  kind text not null check (kind in ('like','repost')),
  created_at timestamptz not null default now(),
  primary key (user_id,post_id,kind)
);
create table if not exists public.community_follows (
  follower_id uuid not null references public.community_profiles(id) on delete cascade,
  following_id uuid not null references public.community_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id,following_id),
  check (follower_id<>following_id)
);
create table if not exists public.community_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id,blocked_id),
  check (blocker_id<>blocked_id)
);
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','misinformation','other')),
  created_at timestamptz not null default now()
);
create table if not exists public.community_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_a,user_b),
  check (user_a<user_b)
);
create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.community_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists community_messages_conversation_idx on public.community_messages(conversation_id,created_at);
alter table public.community_profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_follows enable row level security;
alter table public.community_blocks enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_conversations enable row level security;
alter table public.community_messages enable row level security;
drop policy if exists "Community profiles are public" on public.community_profiles;
create policy "Community profiles are public" on public.community_profiles for select using (true);
drop policy if exists "Users create their own community profile" on public.community_profiles;
create policy "Users create their own community profile" on public.community_profiles for insert to authenticated with check (id=auth.uid());
drop policy if exists "Users update their own community profile" on public.community_profiles;
create policy "Users update their own community profile" on public.community_profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
drop policy if exists "Community posts are public" on public.community_posts;
create policy "Community posts are public" on public.community_posts for select using (true);
drop policy if exists "Users create their own posts" on public.community_posts;
create policy "Users create their own posts" on public.community_posts for insert to authenticated with check (author_id=auth.uid());
drop policy if exists "Authors delete their own posts" on public.community_posts;
create policy "Authors delete their own posts" on public.community_posts for delete to authenticated using (author_id=auth.uid());
drop policy if exists "Community reactions are public" on public.community_reactions;
create policy "Community reactions are public" on public.community_reactions for select using (true);
drop policy if exists "Users manage own reactions" on public.community_reactions;
create policy "Users manage own reactions" on public.community_reactions for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "Follow graph is public" on public.community_follows;
create policy "Follow graph is public" on public.community_follows for select using (true);
drop policy if exists "Users manage own follows" on public.community_follows;
create policy "Users manage own follows" on public.community_follows for all to authenticated using (follower_id=auth.uid()) with check (follower_id=auth.uid());
drop policy if exists "Users manage own blocks" on public.community_blocks;
create policy "Users manage own blocks" on public.community_blocks for all to authenticated using (blocker_id=auth.uid()) with check (blocker_id=auth.uid());
drop policy if exists "Users create reports" on public.community_reports;
create policy "Users create reports" on public.community_reports for insert to authenticated with check (reporter_id=auth.uid());
drop policy if exists "Users see own reports" on public.community_reports;
create policy "Users see own reports" on public.community_reports for select to authenticated using (reporter_id=auth.uid());
drop policy if exists "Participants read conversations" on public.community_conversations;
create policy "Participants read conversations" on public.community_conversations for select to authenticated using (auth.uid()=user_a or auth.uid()=user_b);
drop policy if exists "Participants start conversations" on public.community_conversations;
create policy "Participants start conversations" on public.community_conversations for insert to authenticated with check (auth.uid()=user_a or auth.uid()=user_b);
drop policy if exists "Participants read messages" on public.community_messages;
create policy "Participants read messages" on public.community_messages for select to authenticated using (exists(select 1 from public.community_conversations c where c.id=conversation_id and (auth.uid()=c.user_a or auth.uid()=c.user_b)));
drop policy if exists "Participants send messages as themselves" on public.community_messages;
create policy "Participants send messages as themselves" on public.community_messages for insert to authenticated with check (sender_id=auth.uid() and exists(select 1 from public.community_conversations c where c.id=conversation_id and (auth.uid()=c.user_a or auth.uid()=c.user_b)));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,3145728,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Avatar images are public" on storage.objects;
create policy "Avatar images are public" on storage.objects for select using(bucket_id='avatars');
drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar" on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar" on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar" on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);