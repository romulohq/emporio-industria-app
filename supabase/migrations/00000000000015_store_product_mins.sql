create table if not exists store_product_mins (
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  min_quantity numeric(12,3) not null default 0 check (min_quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (store_id, product_id)
);
create index if not exists store_product_mins_product_idx on store_product_mins(product_id);
