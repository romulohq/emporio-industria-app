-- Um produto cadastrado por engano pode ser reclassificado como subproduto (SP) ou matéria-prima (MP).
-- O item sai da lista de produtos (fica inativo e marcado como convertido, para não perder o histórico
-- de contagens e pedidos) e passa a existir no cadastro de destino.

alter table products
  add column if not exists converted_to text check (converted_to in ('subproduct', 'raw_material')),
  add column if not exists converted_id uuid;
