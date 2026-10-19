-- Excluir um usuário não pode apagar nem bloquear o histórico: os registros que ele criou ou
-- alterou continuam, só perdem o nome do autor (a coluna vira nula).

alter table stock_movements alter column created_by drop not null;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('late_report_decisions', 'decided_by'),
      ('order_regenerations', 'triggered_by'),
      ('production_orders', 'assigned_to'),
      ('production_orders', 'completed_by'),
      ('production_orders', 'requested_by'),
      ('products', 'created_by'),
      ('raw_materials', 'created_by'),
      ('recipes', 'updated_by'),
      ('schedule_cells', 'updated_by'),
      ('stock_counts', 'counted_by'),
      ('stock_movements', 'created_by'),
      ('subproducts', 'created_by')
    ) as t(tbl, col)
  loop
    execute format('alter table %I drop constraint if exists %I', r.tbl, r.tbl || '_' || r.col || '_fkey');
    execute format(
      'alter table %I add constraint %I foreign key (%I) references profiles(id) on delete set null',
      r.tbl, r.tbl || '_' || r.col || '_fkey', r.col
    );
  end loop;
end $$;
