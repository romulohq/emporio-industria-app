-- Cronograma em tempo real: as marcações, os feriados/observações e a lista de produtos passam a ser
-- transmitidos pelo Supabase Realtime, para quem está com a semana aberta ver as mudanças dos outros na hora.
-- replica identity full: o evento de exclusão (limpar uma célula) leva a linha inteira, não só a chave.

alter table schedule_cells replica identity full;
alter table schedule_weeks replica identity full;
alter table schedule_items replica identity full;

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['schedule_cells', 'schedule_weeks', 'schedule_items'] loop
      if not exists (
        select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
