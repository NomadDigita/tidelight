alter table public.research_sources add constraint research_sources_id_run_unique unique (id, research_run_id);
alter table public.research_evidence drop constraint research_evidence_source_id_fkey;
alter table public.research_evidence add constraint research_evidence_source_run_fkey
  foreign key (source_id, research_run_id) references public.research_sources(id, research_run_id)
  on delete set null (source_id);
create index research_evidence_source_run_idx on public.research_evidence(source_id, research_run_id);
