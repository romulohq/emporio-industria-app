create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  sector_id uuid not null references sectors(id),
  movement_type movement_type not null,
  quantity numeric(12,3) not null check (quantity <> 0),
  reason text,
  production_order_id uuid references production_orders(id),
  created_by uuid not null references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint movement_sign_check check (
    (movement_type = 'entry' and quantity > 0) or
    (movement_type = 'exit' and quantity < 0) or
    (movement_type = 'adjustment')
  )
);
create index stock_movements_product_idx on stock_movements(product_id, created_at desc);
create index stock_movements_sector_idx on stock_movements(sector_id);
