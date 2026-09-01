alter table production_units enable row level security;
alter table delivery_routes enable row level security;
alter table stores enable row level security;
alter table store_product_mins enable row level security;
alter table store_stock_reports enable row level security;
alter table production_order_contributions enable row level security;

-- production_units / delivery_routes: same open-read pattern as sectors
drop policy if exists production_units_select on production_units;
create policy production_units_select on production_units for select
  using (auth.role() = 'authenticated');
drop policy if exists production_units_admin_write on production_units;
create policy production_units_admin_write on production_units for all
  using (is_admin()) with check (is_admin());

drop policy if exists delivery_routes_select on delivery_routes;
create policy delivery_routes_select on delivery_routes for select
  using (auth.role() = 'authenticated');
drop policy if exists delivery_routes_admin_write on delivery_routes;
create policy delivery_routes_admin_write on delivery_routes for all
  using (is_admin()) with check (is_admin());

-- stores / store_product_mins / store_stock_reports: admin-only.
-- The public report form never uses this RLS path (it goes through the
-- service-role admin client after validating the store's access token),
-- so no policy is needed here for anonymous/authenticated insert.
drop policy if exists stores_admin_only on stores;
create policy stores_admin_only on stores for all
  using (is_admin()) with check (is_admin());

drop policy if exists store_product_mins_admin_only on store_product_mins;
create policy store_product_mins_admin_only on store_product_mins for all
  using (is_admin()) with check (is_admin());

drop policy if exists store_stock_reports_admin_select on store_stock_reports;
create policy store_stock_reports_admin_select on store_stock_reports for select
  using (is_admin());

-- production_order_contributions: same visibility as the orders they belong to.
-- No insert/update/delete policy — only the sync_store_report_order() trigger
-- (security definer) writes here, mirroring how stock_movements is immutable.
drop policy if exists production_order_contributions_select on production_order_contributions;
create policy production_order_contributions_select on production_order_contributions for select
  using (is_admin() or has_sector_access(sector_id));
