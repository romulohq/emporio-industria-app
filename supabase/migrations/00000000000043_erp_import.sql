-- Importação do relatório "Ordens de Produção" do ERP Everest 3.0 (hoje: unidade 18 - FABRICA CONGELADOS).
-- Alimenta a futura aba "Produtividade". Tabelas novas e independentes de products/production_orders do app
-- (prefixo erp_), então não há conflito com o fluxo de pedidos. Tudo só para administradores.

create table if not exists erp_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_path text,
  unit text,
  period_start date,
  period_end date,
  rows_total integer not null default 0,
  rows_inserted integer not null default 0,
  rows_updated integer not null default 0,
  rows_with_warning integer not null default 0,
  imported_by uuid references profiles(id) on delete set null,
  imported_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists erp_imports_created_idx on erp_imports (created_at desc);

create table if not exists erp_production_orders (
  id uuid primary key default gen_random_uuid(),
  unit text not null,
  order_number integer not null,
  product_code text not null,
  erp_description text not null,
  packaging text,
  unit_measure text,
  item_type text,
  launch_date date not null,
  quantity numeric(14,6) not null,
  unit_cost numeric(14,4),
  status text not null,
  excluded boolean not null default false,
  note text,
  import_id uuid references erp_imports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit, order_number)
);
create index if not exists erp_production_orders_date_idx on erp_production_orders (unit, launch_date);
create index if not exists erp_production_orders_product_idx on erp_production_orders (product_code);

create table if not exists erp_product_catalog (
  product_code text primary key,
  display_name text not null,
  sector text check (sector in ('Pães', 'Salgados', 'Folheados', 'Cozinha')),
  group_name text,
  unit_measure text,
  unit_weight_kg numeric(10,4),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_erp_orders_updated_at on erp_production_orders;
create trigger trg_erp_orders_updated_at before update on erp_production_orders
  for each row execute function set_updated_at();
drop trigger if exists trg_erp_catalog_updated_at on erp_product_catalog;
create trigger trg_erp_catalog_updated_at before update on erp_product_catalog
  for each row execute function set_updated_at();

alter table erp_imports enable row level security;
alter table erp_production_orders enable row level security;
alter table erp_product_catalog enable row level security;

drop policy if exists erp_imports_admin_all on erp_imports;
create policy erp_imports_admin_all on erp_imports for all using (is_admin()) with check (is_admin());
drop policy if exists erp_production_orders_admin_all on erp_production_orders;
create policy erp_production_orders_admin_all on erp_production_orders for all using (is_admin()) with check (is_admin());
drop policy if exists erp_product_catalog_admin_all on erp_product_catalog;
create policy erp_product_catalog_admin_all on erp_product_catalog for all using (is_admin()) with check (is_admin());

-- Bucket privado para guardar o arquivo original (sem policy: só o servidor, com a service role, lê e grava).
insert into storage.buckets (id, name, public)
values ('erp-reports', 'erp-reports', false)
on conflict (id) do nothing;
