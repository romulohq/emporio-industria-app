-- Pedidos Osório: pedidos de congelados da Fábrica Osório de Paiva para as lojas, no mesmo modelo dos pedidos do Rui.
-- As lojas do Osório são cadastros próprios (link, mínimos, dias de entrega e rota próprios), ligados a rotas da unidade Osório.

-- Unidade em que a loja conta e pede (ex.: "pct"), usada só nos pedidos; vazia = a unidade normal do produto.
-- A contagem de estoque da fábrica e o ERP continuam na unidade do produto (und/kg).
alter table products add column if not exists order_unit text;

-- rota inicial do Osório: as lojas entram nela e são divididas depois em Rotas › Osório
insert into delivery_routes (unit_id, name, slug)
select u.id, 'Rota Osório', 'rota-osorio'
from production_units u
where u.slug = 'osorio-de-paiva'
on conflict (slug) do nothing;
