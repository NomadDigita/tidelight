alter table public.community_profiles add column if not exists handle_changed_at timestamptz not null default now();
alter table public.community_profiles drop constraint if exists community_profiles_handle_check;
update public.community_profiles set handle=lower(handle);
alter table public.community_profiles add constraint community_profiles_handle_check check (handle ~ '^[a-z0-9]{4,8}$');
create unique index if not exists community_profiles_handle_lower_uidx on public.community_profiles (lower(handle));
create or replace function public.enforce_community_handle_cooldown()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.handle is distinct from old.handle then
    if old.handle_changed_at is not null and now() < old.handle_changed_at + interval '3 months' then
      raise exception 'Username changes are limited to once every three months.' using errcode = 'P0001';
    end if;
    new.handle := lower(new.handle);
    new.handle_changed_at := now();
  else
    new.handle_changed_at := old.handle_changed_at;
  end if;
  return new;
end;
$$;
drop trigger if exists community_handle_cooldown on public.community_profiles;
create trigger community_handle_cooldown before update on public.community_profiles for each row execute function public.enforce_community_handle_cooldown();