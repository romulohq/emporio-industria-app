create table products (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references sectors(id),
  name text not null,
  sku text unique,
  unit text not null default 'un',
  current_quantity numeric(12,3) not null default 0 check (current_quantity >= 0),
  min_quantity numeric(12,3) not null default 0 check (min_quantity >= 0),
  is_low_stock boolean generated always as (current_quantity < min_quantity) stored,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_sector_idx on products(sector_id);
create index products_low_stock_idx on products(is_low_stock) where is_low_stock;
