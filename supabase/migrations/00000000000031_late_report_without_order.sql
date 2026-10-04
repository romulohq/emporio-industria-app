-- A report that arrives after a delivery's orders were generated used to be
-- flagged for review only if an order for THAT product already existed. A
-- product with no order yet (every store was at/above minimum when the day
-- was generated — e.g. a newly added sector such as Embalagens) was silently
-- ignored, so the report was lost. Now such a report with a deficit is
-- flagged too, pointing at any generated order of that delivery date; the
-- admin's "update order" regeneration then creates the missing order.

create or replace function sync_store_report_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_min numeric(12,3);
  v_deficit numeric(12,3);
  v_order production_orders%rowtype;
  v_contribution production_order_contributions%rowtype;
  v_has_order boolean := false;
  v_has_contribution boolean := false;
  v_sector_id uuid;
  v_any_order_id uuid;
begin
  if new.delivery_date is null then
    return new;
  end if;

  select min_quantity into v_min from store_product_mins
    where store_id = new.store_id and product_id = new.product_id;
  if v_min is null then
    return new;
  end if;

  v_deficit := greatest(0, v_min - new.quantity_reported);

  select po.* into v_order
    from production_order_contributions poc
    join production_orders po on po.id = poc.order_id
    where poc.store_id = new.store_id
      and po.product_id = new.product_id
      and po.source = 'auto_route'
      and po.status in ('pending', 'in_progress')
      and po.delivery_date = new.delivery_date
    order by po.created_at desc
    limit 1
    for update of po;
  v_has_order := found;

  if v_has_order then
    select * into v_contribution
      from production_order_contributions
      where order_id = v_order.id and store_id = new.store_id;
    v_has_contribution := found;
  else
    select po.* into v_order
      from production_orders po
      where po.product_id = new.product_id
        and po.source = 'auto_route'
        and po.status in ('pending', 'in_progress')
        and po.delivery_date = new.delivery_date
      limit 1
      for update;
    v_has_order := found;
  end if;

  if not v_has_order then
    if v_deficit > 0 then
      select po.id into v_any_order_id
        from production_orders po
        where po.source = 'auto_route'
          and po.delivery_date = new.delivery_date
          and po.generated_at is not null
          and po.status <> 'cancelled'
        limit 1;
      if v_any_order_id is not null then
        update store_stock_reports set late_for_order_id = v_any_order_id where id = new.id;
      end if;
    end if;
    return new;
  end if;

  if v_order.generated_at is not null then
    update store_stock_reports set late_for_order_id = v_order.id where id = new.id;
    return new;
  end if;

  if v_has_contribution and v_contribution.locked then
    return new;
  end if;

  if v_deficit = 0 then
    if v_has_contribution then
      delete from production_order_contributions
        where order_id = v_order.id and store_id = new.store_id;
      if v_order.quantity - v_contribution.quantity <= 0 then
        update production_orders set status = 'cancelled' where id = v_order.id;
      else
        update production_orders set quantity = v_order.quantity - v_contribution.quantity where id = v_order.id;
      end if;
    end if;
    return new;
  end if;

  if v_has_contribution then
    update production_order_contributions
      set quantity = v_deficit, report_id = new.id, updated_at = now()
      where order_id = v_order.id and store_id = new.store_id;
    update production_orders
      set quantity = v_order.quantity + (v_deficit - v_contribution.quantity)
      where id = v_order.id;
  else
    select sector_id into v_sector_id from products where id = new.product_id;
    insert into production_order_contributions (order_id, store_id, sector_id, quantity, report_id, locked)
      values (v_order.id, new.store_id, v_sector_id, v_deficit, new.id, false);
    update production_orders set quantity = v_order.quantity + v_deficit where id = v_order.id;
  end if;

  return new;
end;
$$;
