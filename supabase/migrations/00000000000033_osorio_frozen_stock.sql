-- Controle de estoque da câmara (congelados) da Fábrica Osório de Paiva, no modelo da planilha
-- "EDP FABRICA - ESTOQUE MÍNIMO CONGELADOS e CONTAGEM": contagem diária em caixas x unidades por
-- caixa, comparada com o estoque mínimo. Produtos distribuídos nos setores da fábrica. Só o modelo
-- (produtos, mínimos, unidades por caixa) é carregado; as contagens começam vazias.

alter table products add column if not exists units_per_box numeric(12,3) not null default 1 check (units_per_box > 0);

create table if not exists stock_counts (
  id uuid primary key default gen_random_uuid(),
  count_date date not null,
  product_id uuid not null references products(id) on delete cascade,
  sector_id uuid not null references sectors(id),
  boxes numeric(12,3) not null check (boxes >= 0),
  units_per_box numeric(12,3) not null check (units_per_box > 0),
  stock_units numeric(14,3) generated always as (boxes * units_per_box) stored,
  counted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (count_date, product_id)
);
create index if not exists stock_counts_date_idx on stock_counts(count_date);

create or replace function set_stock_count_sector()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select sector_id into new.sector_id from products where id = new.product_id;
  return new;
end;
$$;
drop trigger if exists trg_stock_counts_sector on stock_counts;
create trigger trg_stock_counts_sector before insert or update on stock_counts
  for each row execute function set_stock_count_sector();
drop trigger if exists trg_stock_counts_updated_at on stock_counts;
create trigger trg_stock_counts_updated_at before update on stock_counts
  for each row execute function set_updated_at();

alter table stock_counts enable row level security;
drop policy if exists stock_counts_select on stock_counts;
create policy stock_counts_select on stock_counts for select
  using (is_admin() or has_sector_access(sector_id));
drop policy if exists stock_counts_insert on stock_counts;
create policy stock_counts_insert on stock_counts for insert
  with check (is_admin() or has_sector_access(sector_id));
drop policy if exists stock_counts_update on stock_counts;
create policy stock_counts_update on stock_counts for update
  using (is_admin() or has_sector_access(sector_id))
  with check (is_admin() or has_sector_access(sector_id));

-- products (minimum stock in units; units per box as in the sheet's "Und" column)
insert into products (sector_id, name, unit, min_quantity, units_per_box, active)
select s.id, v.name, v.unit, v.min_quantity, v.units_per_box, v.active
from (values
  ('salgados', 'COXINHA DE CARNE DO SOL', 'und', 2600, 120, true),
  ('salgados', 'COXINHA DE FRANGO', 'und', 5700, 120, true),
  ('salgados', 'COXINHA DE FRANGO C/ CATUPIRY', 'und', 5790, 120, true),
  ('salgados', 'EMPADA DE CARNE DO SOL', 'und', 1000, 120, true),
  ('salgados', 'EMPADA DE FRANGO', 'und', 3960, 120, true),
  ('salgados', 'EMPADA DE FRANGO CATUPIRY', 'und', 3100, 120, true),
  ('salgados', 'EMPADA DE PALMITO', 'und', 1000, 120, true),
  ('salgados', 'EMPADA DE CAMARÃO', 'und', 1000, 120, true),
  ('salgados', 'EMPADA DE 3 QUEIJOS', 'und', 1000, 120, true),
  ('salgados', 'PAO DE QUEIJO PEQUENO', 'kg', 670, 20, true),
  ('salgados', 'PAO DE QUEIJO GRANDE', 'und', 7760, 240, true),
  ('salgados', 'PÃO DE QUEIJO GRANDE COM PARMESÃO', 'und', 3880, 240, true),
  ('salgados', 'ENROLADINHO DE SALSICHA', 'und', 2610, 120, true),
  ('salgados', 'MINI COXINHA', 'kg', 230, 20, true),
  ('salgados', 'MINI CROQUETE', 'kg', 220, 20, true),
  ('salgados', 'MINI BOLINHA DE CARNE DE SOL', 'und', 210, 20, true),
  ('salgados', 'MINI BOLINHA DE QUEIJO', 'kg', 210, 20, true),
  ('folheados', 'CROISSAINT', 'und', 14000, 200, true),
  ('folheados', 'ESFIRRA DE QUEIJO', 'und', 3180, 120, true),
  ('folheados', 'ESFIRRA DE FRANGO', 'und', 3180, 120, true),
  ('folheados', 'ESFIRRA DE CARNE', 'und', 3180, 120, true),
  ('folheados', 'FOLHEADO FRANGO COM BACON', 'und', 3230, 120, true),
  ('folheados', 'FOLHEADO SALSICHA', 'und', 3000, 120, true),
  ('paes', 'PÃO CARIOCA (pct 150 und/) *Estoque max', 'und', 1620, 2, true),
  ('paes', 'PÃO SOVADO (pct 150 und/)', 'und', 400, 2, true),
  ('paes', 'PÃO INTEGRAL', 'und', 130, 2, true),
  ('paes', 'PÃO DE COCO LAGOA (pct)', 'und', 180, 8, true),
  ('paes', 'BAGUETE (pct)', 'und', 180, 12, true),
  ('paes', 'BISNAGUINHA (PCT)', 'und', 400, 20, true),
  ('cozinha', 'MOLHO DOGUINHO CX (12 UND)', 'und', 170, 12, true),
  ('cozinha', 'MOLHO BOLONHESA', 'und', 30, 20, true),
  ('cozinha', 'MOLHO DE TOMATE', 'und', 30, 20, true),
  ('cozinha', 'MOLHO ERVAS FINAS', 'und', 30, 20, true),
  ('cozinha', 'MOLHO DE LARANJA', 'und', 30, 20, true),
  ('cozinha', 'MOLHO MADEIRA', 'und', 30, 20, true),
  ('cozinha', 'MOLHO TERIYAKI', 'und', 30, 20, true),
  ('cozinha', 'MOLHO BARBECUE', 'und', 30, 20, true),
  ('cozinha', 'MOLHO BRANCO', 'und', 30, 20, true),
  ('cozinha', 'MOLHO DE ABACAXI CARAMELIZADO', 'und', 30, 20, true),
  ('cozinha', 'MOLHO DE MOSTARDA E MEL', 'und', 30, 20, true),
  ('cozinha', 'MOLHO DA CASA', 'und', 30, 20, true),
  ('cozinha', 'RECHEIO DE FRANGO', 'und', 830, 20, true),
  ('cozinha', 'RECHEIO DE CARNE DE SOL', 'und', 330, 20, true),
  ('cozinha', 'RECHEIO DE CARNE MOÍDA', 'und', 150, 20, true),
  ('cozinha', 'RECHEIO PARA ESFIRRA', 'und', 3, 20, true),
  ('cozinha', 'FRICASSÊ DE FRANGO', 'und', 80, 10, true),
  ('cozinha', 'FILÉ DE FRANGO GRELHADO', 'und', 80, 10, true),
  ('cozinha', 'FILÉ DE FRANGO EMPANADO', 'und', 80, 10, true),
  ('cozinha', 'COXA E SOBRECOXA', 'und', 80, 10, true),
  ('cozinha', 'STROGONOFFE DE FRANGO', 'und', 80, 20, true),
  ('cozinha', 'BIFE DE CARNE', 'und', 80, 10, true),
  ('cozinha', 'BIFE DE CARNE EMPANADO', 'und', 40, 10, false),
  ('cozinha', 'PALETA SUÍNA', 'und', 80, 10, true),
  ('cozinha', 'PALETA SUÍNA EMPANADA', 'und', 80, 10, true),
  ('cozinha', 'PEIXE EMPANADO', 'und', 80, 10, true),
  ('cozinha', 'BOLINHA DE PEIXE', 'und', 80, 10, true),
  ('cozinha', 'PURÊ DE BATATA', 'und', 80, 20, true),
  ('cozinha', 'LINGUIÇA TOSCANA', 'und', 80, 20, true),
  ('cozinha', 'CUPIM', 'und', 80, 14, true),
  ('cozinha', 'CANJA CX (12 UND)', 'und', 310, 12, true),
  ('cozinha', 'SOPA DE CARNE (12 UND)', 'und', 290, 12, true),
  ('cozinha', 'CALDO DE CARNE MOÍDA CX (12 UND)', 'und', 290, 12, true),
  ('cozinha', 'SOPA DE PEIXE CX (12 UND)', 'und', 270, 12, true),
  ('cozinha', 'PATÊ DE FRANGO(24 UND)', 'und', 320, 24, true),
  ('cozinha', 'PATÊ DE PRESUNTO CX (24 UND)', 'und', 160, 24, true),
  ('cozinha', 'PATÊ DE ALHO CX (24 UND)', 'und', 160, 24, true),
  ('cozinha', 'QUEIJO MUSSARELA FATIADO ( 60 UND)', 'und', 500, 80, true),
  ('cozinha', 'PRESUNTO FATIADO ( 60 UND)', 'und', 500, 80, true)
) as v(sector_slug, name, unit, min_quantity, units_per_box, active)
join sectors s on s.slug = v.sector_slug
where not exists (select 1 from products p where p.name = v.name and p.sector_id = s.id);
