create or replace function public.list_expired_community_media(p_before timestamptz,p_limit integer default 1000)
returns table(name text)
language sql
security definer
set search_path = storage, public
as $$
  select objects.name
  from storage.objects
  where objects.bucket_id='community-media'
    and objects.created_at<p_before
  order by objects.created_at asc
  limit least(greatest(coalesce(p_limit,1000),1),1000);
$$;
revoke all on function public.list_expired_community_media(timestamptz,integer) from public,anon,authenticated;
grant execute on function public.list_expired_community_media(timestamptz,integer) to service_role;