-- Registro de alterações do produto: quem mudou o setor, o responsável ou a situação (ativo/inativo),
-- de onde para onde e quando. O gatilho cobre qualquer caminho de alteração (formulário, lista do
-- responsável, conversão em SP/MP); quando a mudança vem de um script ou do servidor, "quem" fica vazio.

create table if not exists product_changes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  product_name text not null,
  field text not null,
  old_value text,
  new_value text,
  changed_by uuid references profiles(id) on delete set null,
  changed_by_name text,
  changed_at timestamptz not null default now()
);
create index if not exists product_changes_product_idx on product_changes (product_id, changed_at desc);
create index if not exists product_changes_recent_idx on product_changes (changed_at desc);

alter table product_changes enable row level security;
drop policy if exists product_changes_admin_select on product_changes;
create policy product_changes_admin_select on product_changes for select using (is_admin());

create or replace function log_product_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_user_name text;
begin
  if v_user is not null then
    select coalesce(full_name, email) into v_user_name from profiles where id = v_user;
  end if;

  if new.sector_id is distinct from old.sector_id then
    insert into product_changes (product_id, product_name, field, old_value, new_value, changed_by, changed_by_name)
    values (
      new.id, new.name, 'Setor',
      (select s.name || ' (' || coalesce(u.name, '—') || ')' from sectors s left join production_units u on u.id = s.unit_id where s.id = old.sector_id),
      (select s.name || ' (' || coalesce(u.name, '—') || ')' from sectors s left join production_units u on u.id = s.unit_id where s.id = new.sector_id),
      v_user, v_user_name
    );
  end if;

  if new.responsible_id is distinct from old.responsible_id then
    insert into product_changes (product_id, product_name, field, old_value, new_value, changed_by, changed_by_name)
    values (
      new.id, new.name, 'Responsável',
      (select r.person_name || ' (' || s.name || ')' from sector_responsibles r join sectors s on s.id = r.sector_id where r.id = old.responsible_id),
      (select r.person_name || ' (' || s.name || ')' from sector_responsibles r join sectors s on s.id = r.sector_id where r.id = new.responsible_id),
      v_user, v_user_name
    );
  end if;

  if new.active is distinct from old.active then
    insert into product_changes (product_id, product_name, field, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.name, 'Situação', case when old.active then 'Ativo' else 'Inativo' end, case when new.active then 'Ativo' else 'Inativo' end, v_user, v_user_name);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_product_changes on products;
create trigger trg_log_product_changes
  after update of sector_id, responsible_id, active on products
  for each row execute function log_product_changes();
