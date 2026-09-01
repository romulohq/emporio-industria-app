-- generic updated_at bump
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();
create trigger trg_orders_updated_at before update on production_orders
  for each row execute function set_updated_at();
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- auto-create profile row on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- force production_orders.sector_id to match the product's sector (ignore client input)
create or replace function set_order_sector()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select sector_id into new.sector_id from products where id = new.product_id;
  if new.sector_id is null then
    raise exception 'Produto inválido: setor não encontrado';
  end if;
  return new;
end;
$$;
create trigger trg_orders_set_sector before insert on production_orders
  for each row execute function set_order_sector();

-- keep stock_movements.sector_id in sync with the product
create or replace function set_movement_sector()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select sector_id into new.sector_id from products where id = new.product_id;
  return new;
end;
$$;
create trigger trg_movements_set_sector before insert on stock_movements
  for each row execute function set_movement_sector();

-- apply the ledger entry to product stock (single source of truth for balance updates)
create or replace function apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update products
    set current_quantity = current_quantity + new.quantity
    where id = new.product_id;
  return new;
end;
$$;
create trigger trg_movements_apply after insert on stock_movements
  for each row execute function apply_stock_movement();

-- on order completion, write the stock entry + stamp completion metadata
create or replace function handle_order_completion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at = now();
    new.completed_by = auth.uid();
    insert into stock_movements
      (product_id, movement_type, quantity, reason, production_order_id, created_by)
    values
      (new.product_id, 'entry', new.quantity,
       'Produção concluída (pedido)', new.id, auth.uid());
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelled_at = now();
  end if;
  return new;
end;
$$;
create trigger trg_orders_completion before update on production_orders
  for each row execute function handle_order_completion();
