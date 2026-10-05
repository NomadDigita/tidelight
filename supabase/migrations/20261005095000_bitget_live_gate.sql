create or replace function public.prevent_unverified_bitget_live()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.live_enabled is true or new.mode = 'live' then
    raise exception 'Bitget live execution is disabled until credential encryption and verification are enabled';
  end if;
  new.live_enabled := false;
  new.mode := 'paper';
  return new;
end;
$$;

drop trigger if exists bitget_live_gate on public.bitget_connections;
create trigger bitget_live_gate
before insert or update on public.bitget_connections
for each row execute function public.prevent_unverified_bitget_live();

comment on table public.bitget_connections is 'Credential metadata only. Live execution is fail-closed until the verified encryption gate is replaced.';
