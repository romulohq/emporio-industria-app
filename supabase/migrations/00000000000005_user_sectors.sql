create table user_sectors (
  user_id uuid not null references profiles(id) on delete cascade,
  sector_id uuid not null references sectors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, sector_id)
);
