-- Fichas técnicas e subprodutos.
-- Subproduto (SP): preparo intermediário (ex.: cebola caramelizada = cebola + óleo refogados) que tem a
-- sua própria ficha técnica e pode entrar como ingrediente na ficha de produtos ou de outros SPs.
-- Ficha técnica: rendimento + modo de preparo + linhas de ingredientes (insumo livre ou um SP).

create table if not exists subproducts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  unit text not null default 'kg',
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create unique index if not exists subproducts_name_key on subproducts (lower(trim(name)));

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid unique references products(id) on delete cascade,
  subproduct_id uuid unique references subproducts(id) on delete cascade,
  yield_quantity numeric check (yield_quantity is null or yield_quantity > 0),
  yield_unit text not null default '',
  instructions text not null default '',
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  check ((product_id is null) <> (subproduct_id is null))
);

create table if not exists recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  position integer not null default 0,
  ingredient_name text check (ingredient_name is null or length(trim(ingredient_name)) > 0),
  subproduct_id uuid references subproducts(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit text not null check (length(trim(unit)) > 0),
  check ((ingredient_name is null) <> (subproduct_id is null))
);
create index if not exists recipe_items_recipe_idx on recipe_items(recipe_id, position);
create index if not exists recipe_items_subproduct_idx on recipe_items(subproduct_id);

-- anyone signed in reads; admins and people linked to at least one sector edit
create or replace function can_edit_recipes()
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (select 1 from user_sectors where user_id = auth.uid());
$$;

alter table subproducts enable row level security;
alter table recipes enable row level security;
alter table recipe_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['subproducts', 'recipes', 'recipe_items'] loop
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('create policy %I on %I for select using (auth.uid() is not null)', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format('create policy %I on %I for all using (can_edit_recipes()) with check (can_edit_recipes())', t || '_write', t);
  end loop;
end $$;
