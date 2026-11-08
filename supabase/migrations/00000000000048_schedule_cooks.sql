-- Equipe do cronograma de produção: as pessoas de cada setor (ex.: as cozinheiras da Cozinha) e quem faz
-- cada atividade da semana. A atribuição fica na própria célula (cook_ids), então some junto quando a
-- marcação é limpa e já acompanha o tempo real das células.

create table if not exists schedule_cooks (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('salgados', 'folheados', 'paes', 'cozinha')),
  name text not null check (length(trim(name)) between 1 and 40),
  color text not null default '#2563eb',
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists schedule_cooks_section_idx on schedule_cooks(section, position);

alter table schedule_cells add column if not exists cook_ids uuid[] not null default '{}';

alter table schedule_cooks enable row level security;
drop policy if exists schedule_cooks_select on schedule_cooks;
create policy schedule_cooks_select on schedule_cooks for select using (auth.uid() is not null);
drop policy if exists schedule_cooks_write on schedule_cooks;
create policy schedule_cooks_write on schedule_cooks for all using (has_osorio_access()) with check (has_osorio_access());

alter table schedule_cooks replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'schedule_cooks'
     ) then
    alter publication supabase_realtime add table public.schedule_cooks;
  end if;
end $$;
