-- Adds a submission deadline per store delivery day (default: 2 days before,
-- 23:59), and links each stock report to the exact delivery cycle it was
-- submitted for, so a stale report from a past cycle is never reused and a
-- store that hasn't reported for the upcoming cycle shows up as missing.

alter table store_delivery_days add column if not exists send_weekday weekday;
alter table store_delivery_days add column if not exists deadline_time time not null default '23:59';
alter table store_delivery_days add column if not exists is_custom boolean not null default false;

update store_delivery_days
set send_weekday = (case weekday
  when 'monday' then 'saturday'
  when 'tuesday' then 'sunday'
  when 'wednesday' then 'monday'
  when 'thursday' then 'tuesday'
  when 'friday' then 'wednesday'
  when 'saturday' then 'thursday'
  when 'sunday' then 'friday'
end)::weekday
where send_weekday is null;

alter table store_delivery_days alter column send_weekday set not null;

alter table store_stock_reports add column if not exists delivery_date date;
create index if not exists store_stock_reports_delivery_date_idx
  on store_stock_reports(store_id, product_id, delivery_date, created_at desc);

-- Reactive sync now keys strictly off delivery_date (the exact cycle a
-- report was submitted for) instead of inferring it from the store's
-- weekly schedule — a report with no delivery_date (legacy row) or one
-- that doesn't match an existing cycle's order is simply not reconciled.
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
  if new.delivery_date is null then
    return new;
  end if;

  select min_quantity into v_min from store_product_mins
    where store_id = new.store_id and product_id = new.product_id;
  if v_min is null then
    return new;
  end if;

  v_deficit := greatest(0, v_min - new.quantity_reported);

  -- does this store already contribute to THIS cycle's order for this product?
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
    -- not a contributor yet — does an order already exist for this exact cycle?
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
    return new; -- no order for this cycle yet; the next generation will pick it up
  end if;

  -- order already generated/frozen: no more automatic changes — only flag as late
  if v_order.generated_at is not null then
    v_cutoff := ((v_order.generated_at at time zone 'America/Fortaleza')::date + time '12:00')
      at time zone 'America/Fortaleza';
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
