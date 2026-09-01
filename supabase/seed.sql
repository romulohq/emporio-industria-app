insert into sectors (name, slug) values
  ('Cozinha', 'cozinha'),
  ('Salgados', 'salgados'),
  ('Folheados', 'folheados'),
  ('Pães', 'paes'),
  ('Embalagem', 'embalagem')
on conflict (slug) do nothing;
