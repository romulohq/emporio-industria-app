alter table sectors add column if not exists unit_id uuid references production_units(id);
create index if not exists sectors_unit_idx on sectors(unit_id);
