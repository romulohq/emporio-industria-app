create extension if not exists "pgcrypto";
create type order_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type order_priority as enum ('low', 'medium', 'high');
create type movement_type as enum ('entry', 'exit', 'adjustment');
create table sectors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table user_sectors (
  user_id uuid not null references profiles(id) on delete cascade,
  sector_id uuid not null references sectors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, sector_id)
);
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
-- generic updated_at bump
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();
create trigger trg_orders_updated_at before update on production_orders
  for each row execute function set_updated_at();
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- auto-create profile row on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- force production_orders.sector_id to match the product's sector (ignore client input)
create or replace function set_order_sector()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select sector_id into new.sector_id from products where id = new.product_id;
  if new.sector_id is null then
    raise exception 'Produto inválido: setor não encontrado';
  end if;
  return new;
end;
$$;
create trigger trg_orders_set_sector before insert on production_orders
  for each row execute function set_order_sector();

-- keep stock_movements.sector_id in sync with the product
create or replace function set_movement_sector()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select sector_id into new.sector_id from products where id = new.product_id;
  return new;
end;
$$;
create trigger trg_movements_set_sector before insert on stock_movements
  for each row execute function set_movement_sector();

-- apply the ledger entry to product stock (single source of truth for balance updates)
create or replace function apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update products
    set current_quantity = current_quantity + new.quantity
    where id = new.product_id;
  return new;
end;
$$;
create trigger trg_movements_apply after insert on stock_movements
  for each row execute function apply_stock_movement();

-- on order completion, write the stock entry + stamp completion metadata
create or replace function handle_order_completion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at = now();
    new.completed_by = auth.uid();
    insert into stock_movements
      (product_id, movement_type, quantity, reason, production_order_id, created_by)
    values
      (new.product_id, 'entry', new.quantity,
       'Produção concluída (pedido)', new.id, auth.uid());
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelled_at = now();
  end if;
  return new;
end;
$$;
create trigger trg_orders_completion before update on production_orders
  for each row execute function handle_order_completion();
-- helper functions (security definer to avoid recursive RLS)
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create or replace function has_sector_access(check_sector_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from user_sectors
    where user_id = auth.uid() and sector_id = check_sector_id
  );
$$;

alter table sectors enable row level security;
alter table profiles enable row level security;
alter table user_sectors enable row level security;
alter table products enable row level security;
alter table production_orders enable row level security;
alter table stock_movements enable row level security;

-- sectors: everyone logged in can read; only admin manages
create policy sectors_select on sectors for select
  using (auth.role() = 'authenticated');
create policy sectors_admin_write on sectors for all
  using (is_admin()) with check (is_admin());

-- profiles: self or admin can read; self updates own row, admin updates any
create policy profiles_select on profiles for select
  using (id = auth.uid() or is_admin());
create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on profiles for update
  using (is_admin()) with check (is_admin());

-- user_sectors: user sees own memberships; only admin assigns/removes
create policy user_sectors_select on user_sectors for select
  using (user_id = auth.uid() or is_admin());
create policy user_sectors_admin_write on user_sectors for all
  using (is_admin()) with check (is_admin());

-- products: sector members (their own sector) + admin (all sectors)
create policy products_select on products for select
  using (is_admin() or has_sector_access(sector_id));
create policy products_insert on products for insert
  with check (is_admin() or has_sector_access(sector_id));
create policy products_update on products for update
  using (is_admin() or has_sector_access(sector_id))
  with check (is_admin() or has_sector_access(sector_id));
create policy products_delete on products for delete
  using (is_admin());

-- production_orders
create policy orders_select on production_orders for select
  using (is_admin() or has_sector_access(sector_id));
create policy orders_insert on production_orders for insert
  with check (is_admin() or has_sector_access(sector_id));
create policy orders_update on production_orders for update
  using (is_admin() or has_sector_access(sector_id))
  with check (is_admin() or has_sector_access(sector_id));
create policy orders_delete on production_orders for delete
  using (is_admin());

-- stock_movements: append-only ledger, no update/delete policy for anyone
create policy movements_select on stock_movements for select
  using (is_admin() or has_sector_access(sector_id));
create policy movements_insert on stock_movements for insert
  with check (is_admin() or has_sector_access(sector_id));
insert into sectors (name, slug) values
  ('Cozinha', 'cozinha'),
  ('Salgados', 'salgados'),
  ('Folheados', 'folheados'),
  ('Pães', 'paes'),
  ('Embalagem', 'embalagem')
on conflict (slug) do nothing;
