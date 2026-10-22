-- Compras › Hortifrut: categoria nas matérias-primas, contagem diária do hortifrut, ligação dos itens
-- do cronograma com a ficha técnica (para calcular a demanda) e configurações do app (link da contagem).

alter table raw_materials
  add column if not exists category text not null default 'geral' check (category in ('geral', 'hortifruti'));
create index if not exists raw_materials_category_idx on raw_materials (category);

-- contagem diária: uma quantidade por matéria-prima por dia
create table if not exists hortifruti_counts (
  count_date date not null,
  raw_material_id uuid not null references raw_materials(id) on delete cascade,
  quantity numeric(12,3) not null check (quantity >= 0),
  counted_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (count_date, raw_material_id)
);
create index if not exists hortifruti_counts_material_idx on hortifruti_counts (raw_material_id, count_date desc);

alter table hortifruti_counts enable row level security;
drop policy if exists hortifruti_counts_select on hortifruti_counts;
create policy hortifruti_counts_select on hortifruti_counts for select using (auth.uid() is not null);
drop policy if exists hortifruti_counts_write on hortifruti_counts;
create policy hortifruti_counts_write on hortifruti_counts for all using (can_edit_recipes()) with check (can_edit_recipes());

-- item do cronograma -> ficha técnica de onde sai a demanda (um produto ou um subproduto)
alter table schedule_items
  add column if not exists recipe_product_id uuid references products(id) on delete set null,
  add column if not exists recipe_subproduct_id uuid references subproducts(id) on delete set null;

-- configurações simples (ex.: o código do link público de contagem do hortifrut)
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
drop policy if exists app_settings_admin on app_settings;
create policy app_settings_admin on app_settings for all using (is_admin()) with check (is_admin());
