alter table public.futures_live_access_requests
  add column reviewed_by uuid references auth.users(id) on delete set null;
