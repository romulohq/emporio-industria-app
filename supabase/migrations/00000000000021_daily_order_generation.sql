-- Replaces route-based consolidation with day-of-delivery consolidation.
-- Orders are no longer created reactively on every store report; they are
-- generated once per delivery day (see lib/orders/generate-day-orders.ts)
-- for the stores scheduled to deliver that day, using each store's latest
-- report. This trigger only keeps an already-generated, still-open order in
-- sync when a store sends a correction — unless an admin has manually
-- pinned ("locked") that store's contribution to a specific past report.

alter table production_orders add column if not exists delivery_date date;
create index if not exists production_orders_delivery_date_idx
  on production_orders(delivery_date, source, status);

alter table production_order_contributions
  add column if not exists report_id uuid references store_stock_reports(id);
alter table production_order_contributions
  add column if not exists locked boolean not null default false;

create or replace function sync_store_report_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_min numeric(12,3);
  v_deficit numeric(12,3);
  v_order_id uuid;
  v_order_quantity numeric(12,3);
  v_existing_contribution numeric(12,3);
  v_locked boolean;
begin
  select min_quantity into v_min from store_product_mins
    where store_id = new.store_id and product_id = new.product_id;

  -- product not assigned to this store: nothing to reconcile
  if v_min is null then
    return new;
  end if;

  -- only touch an order that already has an (unlocked) open contribution
  -- from this store — new orders are only created by the daily generation
  select po.id, po.quantity, poc.quantity, poc.locked
    into v_order_id, v_order_quantity, v_existing_contribution, v_locked
    from production_order_contributions poc
    join production_orders po on po.id = poc.order_id
    where poc.store_id = new.store_id
      and po.product_id = new.product_id
      and po.source = 'auto_route'
      and po.status in ('pending', 'in_progress')
    order by po.created_at desc
    limit 1
    for update of po;

  if v_order_id is null or v_locked then
    return new;
  end if;

  v_deficit := greatest(0, v_min - new.quantity_reported);

  if v_deficit = 0 then
    -- store is back at/above minimum: withdraw its contribution
    delete from production_order_contributions
      where order_id = v_order_id and store_id = new.store_id;
    if v_order_quantity - v_existing_contribution <= 0 then
      update production_orders set status = 'cancelled' where id = v_order_id;
    else
      update production_orders set quantity = v_order_quantity - v_existing_contribution where id = v_order_id;
    end if;
    return new;
  end if;

  update production_order_contributions
    set quantity = v_deficit, report_id = new.id, updated_at = now()
    where order_id = v_order_id and store_id = new.store_id;

  update production_orders
    set quantity = v_order_quantity + (v_deficit - v_existing_contribution)
    where id = v_order_id;

  return new;
end;
$$;

drop trigger if exists trg_store_report_sync on store_stock_reports;
create trigger trg_store_report_sync
  after insert on store_stock_reports
  for each row execute function sync_store_report_order();
