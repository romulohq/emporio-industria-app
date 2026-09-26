alter table store_delivery_days
  add column if not exists period text not null default 'morning' check (period in ('morning', 'afternoon'));
alter table store_delivery_days
  add column if not exists position integer not null default 0;

create index if not exists store_delivery_days_weekday_idx
  on store_delivery_days(weekday, period, position);
