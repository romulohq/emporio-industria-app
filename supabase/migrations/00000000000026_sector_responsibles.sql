-- Registers the people who work within a sector (e.g. "Confeiteira 1" — Rebeca)
-- and lets each product be assigned to at most one of them, replacing the old
-- single free-text "responsible" field on sectors.

create table if not exists sector_responsibles (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references sectors(id),
  role_name text not null,
  person_name text not null,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sector_responsibles_sector_idx on sector_responsibles(sector_id, display_order);

alter table products add column if not exists responsible_id uuid references sector_responsibles(id) on delete set null;

create or replace function check_product_responsible_sector()
returns trigger language plpgsql as $$
declare
  v_sector_id uuid;
begin
  if new.responsible_id is not null then
    select sector_id into v_sector_id from sector_responsibles where id = new.responsible_id;
    if v_sector_id is distinct from new.sector_id then
      raise exception 'O responsável pertence a outro setor';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_product_responsible_sector on products;
create trigger trg_check_product_responsible_sector
  before insert or update of responsible_id, sector_id on products
  for each row execute function check_product_responsible_sector();

alter table sector_responsibles enable row level security;

drop policy if exists sector_responsibles_select on sector_responsibles;
create policy sector_responsibles_select on sector_responsibles for select
  using (auth.role() = 'authenticated');

drop policy if exists sector_responsibles_admin_write on sector_responsibles;
create policy sector_responsibles_admin_write on sector_responsibles for all
  using (is_admin()) with check (is_admin());

-- preserve any responsible name already saved on a sector as its first entry
insert into sector_responsibles (sector_id, role_name, person_name)
select id, 'Responsável', responsible_name
from sectors
where responsible_name is not null and trim(responsible_name) <> '';

alter table sectors drop column if exists responsible_name;
