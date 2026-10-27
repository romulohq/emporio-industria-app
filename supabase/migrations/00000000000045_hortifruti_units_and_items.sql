-- Hortifrúti: ajuste da lista de matérias-primas contadas.
--  * abacaxi, cebolinha, coentro, hortelã e salsinha são contados em unidade (os demais seguem em kg);
--  * vagem, folha de louro e páprica saem da contagem e do estoque do hortifrúti — continuam cadastradas como
--    matéria-prima comum (a páprica tem ficha técnica), só deixam de aparecer na contagem diária;
--  * entram gengibre, alho poró e manjericão (em kg).

update raw_materials
set unit = 'und'
where category = 'hortifruti'
  and name ~* '^mp (abacaxi|cebolinha|coentro|hortel.*|salsinha)$';

update raw_materials
set category = 'geral'
where category = 'hortifruti'
  and name ~* '^mp (vagem|folha de louro|p.*prica picante)$';

insert into raw_materials (name, unit, category)
values ('MP GENGIBRE', 'kg', 'hortifruti'),
       ('MP ALHO PORÓ', 'kg', 'hortifruti'),
       ('MP MANJERICÃO', 'kg', 'hortifruti')
on conflict do nothing;
