-- Lembretes pessoais do painel: cada usuária vê, cria e altera apenas os próprios.

create table if not exists user_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  text text not null check (length(trim(text)) between 1 and 300),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists user_reminders_user_idx on user_reminders(user_id, done, created_at);

alter table user_reminders enable row level security;
drop policy if exists user_reminders_own on user_reminders;
create policy user_reminders_own on user_reminders
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
