-- A store that reports late (after that day's order was already generated)
-- should join the already-open order for its delivery day instantly, instead
-- of waiting for the next "Gerar agora" / daily cron run to pick it up.

create or replace function sync_store_report_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_min numeric(12,3);
  v_deficit numeric(12,3);
  v_order_id uuid;
  v_order_quantity numeric(12,3);
  v_existing_contribution numeric(12,3);
  v_locked boolean;
  v_sector_id uuid;
begin
  select min_quantity into v_min from store_product_mins
    where store_id = new.store_id and product_id = new.product_id;

  -- product not assigned to this store: nothing to reconcile
  if v_min is null then
    return new;
  end if;

  v_deficit := greatest(0, v_min - new.quantity_reported);

  -- case 1: this store already has an open, unlocked contribution for this
  -- product somewhere — keep it in sync (same "replace, not accumulate" rule)
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

  if v_order_id is not null then
    if v_locked then
      return new;
    end if;

    if v_deficit = 0 then
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
  end if;

  -- case 2: store isn't part of any open order yet for this product. If it's
  -- scheduled to deliver on a day that already has a generated (open) order
  -- for this product, join it now instead of waiting for the next generation.
  if v_deficit = 0 then
    return new;
  end if;

  select po.id, po.quantity into v_order_id, v_order_quantity
    from production_orders po
    where po.product_id = new.product_id
      and po.source = 'auto_route'
      and po.status in ('pending', 'in_progress')
      and po.delivery_date >= current_date
      and exists (
        select 1 from store_delivery_days sdd
        where sdd.store_id = new.store_id
          and sdd.weekday = (case extract(isodow from po.delivery_date)::int
            when 1 then 'monday'
            when 2 then 'tuesday'
            when 3 then 'wednesday'
            when 4 then 'thursday'
            when 5 then 'friday'
            when 6 then 'saturday'
            when 7 then 'sunday'
          end)::weekday
      )
    order by po.delivery_date asc
    limit 1
    for update;

  if v_order_id is null then
    return new; -- no already-generated order to join; the next daily generation will pick it up
  end if;

  select sector_id into v_sector_id from products where id = new.product_id;

  insert into production_order_contributions (order_id, store_id, sector_id, quantity, report_id, locked)
    values (v_order_id, new.store_id, v_sector_id, v_deficit, new.id, false);

  update production_orders set quantity = v_order_quantity + v_deficit where id = v_order_id;

  return new;
end;
$$;
