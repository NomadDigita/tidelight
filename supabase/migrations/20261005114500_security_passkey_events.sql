alter table public.security_events
  drop constraint if exists security_events_event_type_check;

alter table public.security_events
  add constraint security_events_event_type_check
  check (event_type in (
    'mfa_required',
    'mfa_verified',
    'control_change',
    'paper_exit',
    'passkey_signin',
    'passkey_registered',
    'passkey_removed'
  ));
