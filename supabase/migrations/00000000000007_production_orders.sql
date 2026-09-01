create table production_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  sector_id uuid not null references sectors(id),
  quantity numeric(12,3) not null check (quantity > 0),
  status order_status not null default 'pending',
  priority order_priority not null default 'medium',
  notes text,
  requested_by uuid not null references profiles(id) default auth.uid(),
  assigned_to uuid references profiles(id),
  completed_by uuid references profiles(id),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index production_orders_sector_status_idx on production_orders(sector_id, status);
