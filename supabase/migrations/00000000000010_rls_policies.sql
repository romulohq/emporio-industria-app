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
