create table if not exists public.community_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id,post_id)
);
create index if not exists community_bookmarks_user_created_idx on public.community_bookmarks(user_id,created_at desc);
alter table public.community_bookmarks enable row level security;
drop policy if exists "Users read own saved community posts" on public.community_bookmarks;
create policy "Users read own saved community posts" on public.community_bookmarks for select to authenticated using (user_id=auth.uid());
drop policy if exists "Users save community posts" on public.community_bookmarks;
create policy "Users save community posts" on public.community_bookmarks for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "Users unsave community posts" on public.community_bookmarks;
create policy "Users unsave community posts" on public.community_bookmarks for delete to authenticated using (user_id=auth.uid());