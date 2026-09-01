create table if not exists delivery_routes (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references production_units(id),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists delivery_routes_unit_idx on delivery_routes(unit_id);
