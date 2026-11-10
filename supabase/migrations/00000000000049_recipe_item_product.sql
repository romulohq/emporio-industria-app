-- Um produto (ex.: Molho de tomate, Recheio de frango) pode ser ingrediente da ficha técnica de outro: a linha
-- aponta para o produto, e a árvore abre a ficha dele. Cada linha continua com exatamente um ingrediente.

alter table recipe_items add column if not exists product_id uuid references products(id) on delete restrict;
create index if not exists recipe_items_product_idx on recipe_items(product_id);

alter table recipe_items drop constraint if exists recipe_items_one_ingredient_check;
alter table recipe_items add constraint recipe_items_one_ingredient_check
  check (num_nonnulls(ingredient_name, subproduct_id, raw_material_id, product_id) = 1);
