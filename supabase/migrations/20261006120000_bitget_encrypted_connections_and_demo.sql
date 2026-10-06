alter table public.bitget_connections
  drop constraint if exists bitget_connections_mode_check;
alter table public.bitget_connections
  add constraint bitget_connections_mode_check check (mode in ('paper', 'demo', 'live'));
create unique index if not exists bitget_connections_one_per_user on public.bitget_connections(user_id);

drop policy if exists "Owners manage Bitget connections" on public.bitget_connections;
revoke all on public.bitget_connections from anon, public, authenticated;

create or replace function public.prevent_unverified_bitget_live()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.mode = 'paper' then
    new.live_enabled := false;
  elsif new.encryption_version <> 'aes-256-gcm-v1' or new.last_validated_at is null then
    raise exception 'Bitget credentials must be encrypted and verified before enabling trading';
  elsif new.mode = 'demo' then
    new.live_enabled := false;
  elsif new.mode = 'live' then
    new.live_enabled := true;
  end if;
  return new;
end;
$$;

comment on table public.bitget_connections is 'Encrypted Bitget API credentials; application key material remains server-only. Writes use the service role after account verification.';

alter table public.security_events
  drop constraint if exists security_events_event_type_check;
alter table public.security_events
  add constraint security_events_event_type_check check (event_type in (
    'mfa_required', 'mfa_verified', 'control_change', 'paper_exit',
    'passkey_signin', 'passkey_registered', 'passkey_removed', 'bitget_order_attempt'
  ));
