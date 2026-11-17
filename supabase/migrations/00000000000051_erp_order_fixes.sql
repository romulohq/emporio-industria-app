-- Correções de produto em ordens do ERP lançadas com o item errado (ex.: "PI PAO DE QUEIJO 70G" que na verdade era
-- Pão de Queijo Pequeno). Fica numa tabela à parte, e não na própria ordem, para a correção sobreviver a uma nova
-- importação do mesmo relatório (o upsert da importação reescreve o produto da ordem com o que vem no arquivo).

create table if not exists erp_order_fixes (
  unit text not null,
  order_number integer not null,
  product_code text not null,
  original_product_code text,
  reason text,
  created_at timestamptz not null default now(),
  primary key (unit, order_number)
);

alter table erp_order_fixes enable row level security;
drop policy if exists erp_order_fixes_admin_all on erp_order_fixes;
create policy erp_order_fixes_admin_all on erp_order_fixes for all using (is_admin()) with check (is_admin());

-- Pão de queijo pequeno (kg) lançado como "PI PAO DE QUEIJO 70G" (un): são as ordens de quantidade pequena (390 a 780),
-- as de 3.937 a 6.825 são mesmo o pão de queijo 0,80.
insert into erp_order_fixes (unit, order_number, product_code, original_product_code, reason)
select '18 - FABRICA CONGELADOS', n, '9000027', '9000026', 'Lançado no ERP como PI PAO DE QUEIJO 70G; era Pão de Queijo Pequeno (kg)'
from unnest(array[2535, 2718, 2733, 2798, 2829, 2875, 2917, 2986, 3029, 3039, 3135, 3251]) as n
on conflict (unit, order_number) do nothing;
