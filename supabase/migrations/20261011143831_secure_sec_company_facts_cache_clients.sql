create policy sec_company_facts_cache_client_deny
on public.sec_company_facts_cache
for all
to anon, authenticated
using (false)
with check (false);
