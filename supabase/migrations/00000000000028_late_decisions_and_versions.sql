-- Real per-store deadlines (migration 027) replace the old fixed-noon late
-- cutoff: a report arriving after an order was already generated/frozen is
-- always flagged for review now, regardless of time of day. Adds order
-- versioning (snapshot the prior state instead of silently overwriting it)
-- and a permanent audit trail of "regenerate" vs "keep current" decisions.

alter table production_orders add column if not exists current_version integer not null default 1;

create table if not exists order_regenerations (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references sectors(id),
  delivery_date date not null,
  version_number integer not null,
  reason text,
  triggered_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  snapshot jsonb not null
);
create index if not exists order_regenerations_sector_date_idx
  on order_regenerations(sector_id, delivery_date);

create table if not exists late_report_decisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references store_stock_reports(id),
  sector_id uuid not null references sectors(id),
  delivery_date date not null,
  decision text not null check (decision in ('regenerated', 'kept')),
  decided_by uuid references profiles(id),
  decided_at timestamptz not null default now()
);
create index if not exists late_report_decisions_report_idx on late_report_decisions(report_id);

alter table order_regenerations enable row level security;
alter table late_report_decisions enable row level security;

drop policy if exists order_regenerations_select on order_regenerations;
create policy order_regenerations_select on order_regenerations for select
  using (is_admin() or has_sector_access(sector_id));
drop policy if exists order_regenerations_admin_insert on order_regenerations;
create policy order_regenerations_admin_insert on order_regenerations for insert
  with check (is_admin());

drop policy if exists late_report_decisions_select on late_report_decisions;
create policy late_report_decisions_select on late_report_decisions for select
  using (is_admin() or has_sector_access(sector_id));
drop policy if exists late_report_decisions_admin_insert on late_report_decisions;
create policy late_report_decisions_admin_insert on late_report_decisions for insert
  with check (is_admin());

-- A report arriving once the order is frozen is always flagged for review
-- now (the store's real deadline, not this moment, decides whether it also
-- displays as "atrasado" — see lib/delivery-schedule.ts's isLateForCycle).
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
