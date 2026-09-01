-- Replicates the spreadsheet's "Pedido a Separar" (deficit) + per-route SUMIF consolidation,
-- but as a live production_orders row instead of a spreadsheet formula.
create or replace function sync_store_report_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_route_id uuid;
  v_sector_id uuid;
  v_min numeric(12,3);
  v_deficit numeric(12,3);
  v_order_id uuid;
  v_order_quantity numeric(12,3);
  v_existing_contribution numeric(12,3);
  v_new_total numeric(12,3);
begin
  select route_id into v_route_id from stores where id = new.store_id;
  select min_quantity into v_min from store_product_mins
    where store_id = new.store_id and product_id = new.product_id;

  -- product not assigned to this store: nothing to reconcile
  if v_min is null then
    return new;
  end if;

  select sector_id into v_sector_id from products where id = new.product_id;
  v_deficit := greatest(0, v_min - new.quantity_reported);

  select id, quantity into v_order_id, v_order_quantity
    from production_orders
    where route_id = v_route_id and product_id = new.product_id
      and source = 'auto_route' and status in ('pending', 'in_progress')
    order by created_at desc
    limit 1
    for update;

  select quantity into v_existing_contribution
    from production_order_contributions
    where order_id = v_order_id and store_id = new.store_id;

  if v_deficit = 0 then
    -- store is back at/above minimum: withdraw its contribution, if any
    if v_order_id is not null and v_existing_contribution is not null then
      delete from production_order_contributions
        where order_id = v_order_id and store_id = new.store_id;
      v_new_total := v_order_quantity - v_existing_contribution;
      if v_new_total <= 0 then
        update production_orders set status = 'cancelled' where id = v_order_id;
      else
        update production_orders set quantity = v_new_total where id = v_order_id;
      end if;
    end if;
    return new;
  end if;

  if v_order_id is null then
    insert into production_orders (product_id, route_id, quantity, status, priority, source, requested_by)
      values (new.product_id, v_route_id, v_deficit, 'pending', 'medium', 'auto_route', null)
      returning id into v_order_id;
    insert into production_order_contributions (order_id, store_id, sector_id, quantity)
      values (v_order_id, new.store_id, v_sector_id, v_deficit);
  elsif v_existing_contribution is not null then
    -- replace (not accumulate) — each report is a fresh snapshot of that store's stock
    update production_order_contributions
      set quantity = v_deficit, updated_at = now()
      where order_id = v_order_id and store_id = new.store_id;
    update production_orders
      set quantity = v_order_quantity + (v_deficit - v_existing_contribution)
      where id = v_order_id;
  else
    insert into production_order_contributions (order_id, store_id, sector_id, quantity)
      values (v_order_id, new.store_id, v_sector_id, v_deficit);
    update production_orders
      set quantity = v_order_quantity + v_deficit
      where id = v_order_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_store_report_sync on store_stock_reports;
create trigger trg_store_report_sync
  after insert on store_stock_reports
  for each row execute function sync_store_report_order();
