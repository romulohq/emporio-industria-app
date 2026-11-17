-- Produção lançada à mão na aba Produtividade ("Inserir produção"). Entra nos gráficos junto com as ordens
-- importadas do ERP; quando o ERP já trouxe o mesmo produto no mesmo dia, o valor do ERP vale (sem somar duas vezes).
-- product_code é o código do catálogo ERP (erp_product_catalog), sem FK para não travar a limpeza do catálogo.

create table if not exists manual_productions (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  production_date date not null,
  product_code text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  schedule_item_id uuid references schedule_items(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_date, product_code)
);
create index if not exists manual_productions_date_idx on manual_productions (production_date);

drop trigger if exists trg_manual_productions_updated_at on manual_productions;
create trigger trg_manual_productions_updated_at before update on manual_productions
  for each row execute function set_updated_at();

alter table manual_productions enable row level security;
drop policy if exists manual_productions_select on manual_productions;
create policy manual_productions_select on manual_productions for select using (auth.uid() is not null);
drop policy if exists manual_productions_write on manual_productions;
create policy manual_productions_write on manual_productions for all
  using (has_osorio_access()) with check (has_osorio_access());

-- produto do ERP que cada item do cronograma produz (guardado na 1ª vez que alguém escolhe, vale nas próximas)
alter table schedule_items add column if not exists erp_product_code text;
