create table if not exists store_stock_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  product_id uuid not null references products(id),
  quantity_reported numeric(12,3) not null check (quantity_reported >= 0),
  submission_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists store_stock_reports_store_product_idx on store_stock_reports(store_id, product_id, created_at desc);
create index if not exists store_stock_reports_submission_idx on store_stock_reports(submission_id);

alter table production_orders add column if not exists route_id uuid references delivery_routes(id);
alter table production_orders add column if not exists source text not null default 'manual' check (source in ('manual', 'auto_route'));
alter table production_orders alter column requested_by drop not null;
create index if not exists production_orders_route_idx on production_orders(route_id, status);

create table if not exists production_order_contributions (
  order_id uuid not null references production_orders(id) on delete cascade,
  store_id uuid not null references stores(id),
  sector_id uuid not null references sectors(id),
  quantity numeric(12,3) not null check (quantity > 0),
  updated_at timestamptz not null default now(),
  primary key (order_id, store_id)
);
create index if not exists production_order_contributions_sector_idx on production_order_contributions(sector_id);
