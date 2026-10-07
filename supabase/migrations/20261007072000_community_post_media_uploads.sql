alter table public.community_posts add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.community_posts drop constraint if exists community_posts_media_array_check;
alter table public.community_posts add constraint community_posts_media_array_check check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 4);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media','community-media',true,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf','audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm','audio/x-m4a'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Community media is publicly readable" on storage.objects;
create policy "Community media is publicly readable" on storage.objects for select using (bucket_id='community-media');
drop policy if exists "Members upload community media to their folder" on storage.objects;
create policy "Members upload community media to their folder" on storage.objects for insert to authenticated with check (bucket_id='community-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Members update their community media" on storage.objects;
create policy "Members update their community media" on storage.objects for update to authenticated using (bucket_id='community-media' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='community-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Members delete their community media" on storage.objects;
create policy "Members delete their community media" on storage.objects for delete to authenticated using (bucket_id='community-media' and (storage.foldername(name))[1]=auth.uid()::text);