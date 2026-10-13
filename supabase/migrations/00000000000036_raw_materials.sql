-- Matérias-primas: cadastro dos insumos usados nas fichas técnicas e nos subprodutos.
-- Cada linha de ficha passa a poder apontar para uma matéria-prima cadastrada (ou para um subproduto).

create table if not exists raw_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  unit text not null default 'kg',
  code text,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create unique index if not exists raw_materials_name_key on raw_materials (lower(trim(name)));

alter table recipe_items add column if not exists raw_material_id uuid references raw_materials(id) on delete restrict;
create index if not exists recipe_items_raw_material_idx on recipe_items(raw_material_id);

-- a line is exactly one of: raw material, subproduct or (legacy) free-text input
alter table recipe_items drop constraint if exists recipe_items_check;
alter table recipe_items
  add constraint recipe_items_one_ingredient_check
  check (num_nonnulls(ingredient_name, subproduct_id, raw_material_id) = 1);

alter table raw_materials enable row level security;
drop policy if exists raw_materials_select on raw_materials;
create policy raw_materials_select on raw_materials for select using (auth.uid() is not null);
drop policy if exists raw_materials_write on raw_materials;
create policy raw_materials_write on raw_materials for all using (can_edit_recipes()) with check (can_edit_recipes());
