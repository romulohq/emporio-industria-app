create type weekday as enum (
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
);

create table if not exists store_delivery_days (
  store_id uuid not null references stores(id) on delete cascade,
  weekday weekday not null,
  primary key (store_id, weekday)
);
create index if not exists store_delivery_days_store_idx on store_delivery_days(store_id);

alter table store_delivery_days enable row level security;

drop policy if exists store_delivery_days_admin_only on store_delivery_days;
create policy store_delivery_days_admin_only on store_delivery_days for all
  using (is_admin()) with check (is_admin());
