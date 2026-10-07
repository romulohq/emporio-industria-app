-- Cronograma semanal de produção da Fábrica Osório de Paiva, no modelo da planilha
-- "CRONOGRAMA PRODUÇÃO SEMANAL FÁBRICA": produtos em quatro blocos, e por dia da semana
-- (segunda a sexta) uma ação marcada (Produzir, 2x Produzir, Pré-preparo, ...). Só o modelo é
-- carregado (lista de produtos e observações); as semanas começam vazias.

create table if not exists schedule_items (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('salgados', 'folheados', 'paes', 'cozinha')),
  name text not null,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists schedule_items_section_idx on schedule_items(section, position);

create table if not exists schedule_weeks (
  week_start date primary key,
  notes text not null default '',
  holidays smallint[] not null default '{}',
  updated_at timestamptz not null default now(),
  check (extract(isodow from week_start) = 1)
);

create table if not exists schedule_cells (
  week_start date not null,
  item_id uuid not null references schedule_items(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 5),
  label text not null check (length(label) between 1 and 60),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  primary key (week_start, item_id, weekday)
);
create index if not exists schedule_cells_week_idx on schedule_cells(week_start);

-- anyone signed in can read the schedule; admins and people with a Fábrica Osório sector edit it
create or replace function has_osorio_access()
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from user_sectors us
    join sectors s on s.id = us.sector_id
    join production_units u on u.id = s.unit_id
    where us.user_id = auth.uid() and u.slug = 'osorio-de-paiva'
  );
$$;

alter table schedule_items enable row level security;
alter table schedule_weeks enable row level security;
alter table schedule_cells enable row level security;

do $$
declare t text;
begin
  foreach t in array array['schedule_items', 'schedule_weeks', 'schedule_cells'] loop
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('create policy %I on %I for select using (auth.uid() is not null)', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format('create policy %I on %I for all using (has_osorio_access()) with check (has_osorio_access())', t || '_write', t);
  end loop;
end $$;

insert into schedule_items (section, name, position)
select v.section, v.name, v.position
from (values
  ('salgados', 'COX. DE CARNE DE SOL', 1),
  ('salgados', 'COX. FRANGO', 2),
  ('salgados', 'COX. DE FRANGO CAT', 3),
  ('salgados', 'EMP. DE CARNE DO SOL', 4),
  ('salgados', 'EMP. DE FRANGO - UND', 5),
  ('salgados', 'EMP. DE FRANGO CATUPIRY', 6),
  ('salgados', 'EMP. DE 3 QUEIJOS', 7),
  ('salgados', 'EMP. DE PALMITO', 8),
  ('salgados', 'EMP. DE CAMARÃO', 9),
  ('salgados', 'PAO DE QUEIJO PEQUENO', 10),
  ('salgados', 'PAO DE QUEIJO GRANDE', 11),
  ('salgados', 'PÃO DE QUEIJO GRANDE COM PARMESÃO', 12),
  ('salgados', 'ENROLADO SALSICHA', 13),
  ('salgados', 'MINI COXINHA', 14),
  ('salgados', 'MINI CROQUETE', 15),
  ('salgados', 'MINI BOLINHA DE C. SOL', 16),
  ('salgados', 'MINI BOLINHA DE QUEIJO', 17),
  ('folheados', 'CROISSAINT', 1),
  ('folheados', 'MINI CROISSANT', 2),
  ('folheados', 'FOLH. DE SALSICHA', 3),
  ('folheados', 'FOLH. FRANGO C/ BACON', 4),
  ('folheados', 'ESFIRRA DE QUEIJO', 5),
  ('folheados', 'ESFIRRA DE CARNE', 6),
  ('folheados', 'ESFIRRA DE FRANGO', 7),
  ('paes', 'PÃO CARIOCA', 1),
  ('paes', 'PÃO CARIOCA INTEGRAL', 2),
  ('paes', 'PÃO SOVADO', 3),
  ('paes', 'BISNAGUINHA (pct)', 4),
  ('paes', 'BAGUETE (pct)', 5),
  ('paes', 'PÃO DE COCO', 6),
  ('cozinha', 'RECHEIO DE FRANGO', 1),
  ('cozinha', 'RECHEIO DE C. DE SOL', 2),
  ('cozinha', 'RECHEIO DE CARNE MOÍDA', 3),
  ('cozinha', 'RECHEIO DE ESFIHA', 4),
  ('cozinha', 'CANJA', 5),
  ('cozinha', 'SOPA DE CARNE', 6),
  ('cozinha', 'CALDO DE CARNE MOÍDA', 7),
  ('cozinha', 'SOPA DE PEIXE', 8),
  ('cozinha', 'MOLHO DOGUINHO', 9),
  ('cozinha', 'MOLHO DA CASA', 10),
  ('cozinha', 'MOLHO BRANCO', 11),
  ('cozinha', 'MOLHO MOSTARDA E MEL', 12),
  ('cozinha', 'MOLHO BOLONHESA', 13),
  ('cozinha', 'MOLHO DE TOMATE', 14),
  ('cozinha', 'MOLHO DE ERVAS FINAS', 15),
  ('cozinha', 'MOLHO DE LARANJA', 16),
  ('cozinha', 'MOLHO MADEIRA', 17),
  ('cozinha', 'MOLHO TERYAKI', 18),
  ('cozinha', 'MOLHO BARBECUE', 19),
  ('cozinha', 'MOLHO BRANCO', 20),
  ('cozinha', 'MOLHO ABACAXI CARAMELIZADO', 21),
  ('cozinha', 'PATÊ DE FRANGO', 22),
  ('cozinha', 'PATÊ DE PRESUNTO', 23),
  ('cozinha', 'PATÊ DE ALHO', 24),
  ('cozinha', 'MARINADA CARNE', 25),
  ('cozinha', 'MARINADA PEIXE', 26),
  ('cozinha', 'MARINADA FRANGO', 27),
  ('cozinha', 'FILÉ DE FRANGO EMPANADO', 28),
  ('cozinha', 'FILÉ DE FRANGO GRELHADO', 29),
  ('cozinha', 'BIFE GRELHADO', 30),
  ('cozinha', 'FRICASSÊ', 31),
  ('cozinha', 'ESTROGONOFE DE FRANGO', 32),
  ('cozinha', 'SOBREPALETA SUÍNA', 33),
  ('cozinha', 'SOBREPALETA SUÍNA EMP', 34),
  ('cozinha', 'CUPIM', 35),
  ('cozinha', 'MARINADA DE CARNE', 36),
  ('cozinha', 'BOLINHA DE PEIXE', 37),
  ('cozinha', 'PEIXE EMPANADO', 38),
  ('cozinha', 'COXA E SOBRECOXA', 39),
  ('cozinha', 'LINGUIÇA TOSCANA', 40),
  ('cozinha', 'BARBECUE', 41),
  ('cozinha', 'PURÊ DE BATATA', 42)
) as v(section, name, position)
where not exists (select 1 from schedule_items i where i.section = v.section and i.name = v.name and i.position = v.position);

insert into schedule_weeks (week_start, notes)
values ('2026-10-05', 'Obs 1: Todas as sopas 2 x vezes por semana .
Obs 2: Recheio de frango toda quarta e quinta ( não ficar frango pra outra semana)
Obs 3: Carne recheio esfiha 1 x por semana')
on conflict (week_start) do nothing;
