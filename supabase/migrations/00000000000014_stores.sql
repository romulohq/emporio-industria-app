create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references delivery_routes(id),
  name text not null,
  access_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists stores_route_idx on stores(route_id);
