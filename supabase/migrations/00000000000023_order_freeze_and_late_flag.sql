-- Once an order has been generated (button click or daily cron), it freezes:
-- further store reports no longer auto-update it. A report arriving before
-- noon (America/Sao_Paulo) on the day it was generated gets flagged as
-- "late" for admin review (via the ⋮ menu); anything after noon is ignored.

alter table production_orders add column if not exists generated_at timestamptz;

alter table store_stock_reports add column if not exists late_for_order_id uuid references production_orders(id);
alter table store_stock_reports add column if not exists late_acknowledged boolean not null default false;
create index if not exists store_stock_reports_late_idx
  on store_stock_reports(late_for_order_id) where late_for_order_id is not null and not late_acknowledged;

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
  v_cutoff timestamptz;
begin
  select min_quantity into v_min from store_product_mins
    where store_id = new.store_id and product_id = new.product_id;

  -- product not assigned to this store: nothing to reconcile
  if v_min is null then
    return new;
  end if;

  v_deficit := greatest(0, v_min - new.quantity_reported);

  -- does this store already contribute to an open order for this product?
  select po.* into v_order
    from production_order_contributions poc
    join production_orders po on po.id = poc.order_id
    where poc.store_id = new.store_id
      and po.product_id = new.product_id
      and po.source = 'auto_route'
      and po.status in ('pending', 'in_progress')
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
    -- not a contributor yet — is it scheduled for a day that already has an open order?
    select po.* into v_order
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
    v_has_order := found;
  end if;

  if not v_has_order then
    return new; -- nothing to reconcile against yet; the next generation will pick it up
  end if;

  -- order already generated/frozen: no more automatic changes — only flag as late
  if v_order.generated_at is not null then
    v_cutoff := ((v_order.generated_at at time zone 'America/Sao_Paulo')::date + time '12:00')
      at time zone 'America/Sao_Paulo';
    if new.created_at <= v_cutoff then
      update store_stock_reports set late_for_order_id = v_order.id where id = new.id;
    end if;
    return new;
  end if;

  if v_has_contribution and v_contribution.locked then
    return new; -- admin override wins
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
