-- "Inserir produção" (Produtividade): liga cada item do cronograma de produção ao seu produto do ERP e cadastra em
-- "Produtos ERP" os produtos que o ERP já trouxe nas ordens importadas mas que faltavam no cadastro (por isso não
-- apareciam na lista de produtos, ex.: Coxa e Sobrecoxa).

insert into erp_product_catalog (product_code, display_name, sector, group_name, unit_measure, unit_weight_kg) values
  ('9000076', 'EMPADA DE PALMITO', 'Salgados', 'Empadas', 'UNID', 0.09),
  ('9000183', 'EMPADA DE CAMARÃO', 'Salgados', 'Empadas', 'UNID', 0.09),
  ('9000382', 'EMPADA DE 3 QUEIJOS', 'Salgados', 'Empadas', 'UNID', 0.09),
  ('9000381', 'PÃO DE QUEIJO GRANDE COM PARMESÃO', 'Salgados', 'Pão de queijo', 'UNID', 0.08),
  ('9000370', 'COXA E SOBRECOXA', 'Cozinha', 'Proteínas e pratos', 'KG', 1),
  ('9000375', 'PALETA SUÍNA EMPANADA', 'Cozinha', 'Proteínas e pratos', 'KG', 1),
  ('9000387', 'PÃO DE COCO LAGOA', 'Pães', 'Pães', 'KG', 1)
on conflict (product_code) do nothing;

-- só preenche o que ainda não tinha vínculo (o que alguém já escolheu fica como está)
update schedule_items i set erp_product_code = v.code
from (values
  ('RECHEIO DE CARNE MOÍDA', '4000128'), ('SOPA DE PEIXE', '9000185'), ('MOLHO DOGUINHO', '4000131'),
  ('MOLHO DA CASA', '4000092'), ('MOLHO BRANCO', '9000353'), ('MOLHO MOSTARDA E MEL', '9000354'),
  ('MOLHO BOLONHESA', '9000352'), ('MOLHO DE TOMATE', '9000350'), ('MOLHO DE ERVAS FINAS', '9000358'),
  ('MOLHO DE LARANJA', '9000357'), ('MOLHO MADEIRA', '9000351'), ('MOLHO TERYAKI', '9000349'),
  ('MOLHO BARBECUE', '9000348'), ('MOLHO ABACAXI CARAMELIZADO', '9000347'), ('PATÊ DE PRESUNTO', '9000032'),
  ('PATÊ DE ALHO', '9000028'), ('FILÉ DE FRANGO EMPANADO', '9000369'), ('FILÉ DE FRANGO GRELHADO', '9000368'),
  ('FRICASSÊ', '9000355'), ('SOBREPALETA SUÍNA', '9000374'), ('SOBREPALETA SUÍNA EMP', '9000375'),
  ('CUPIM', '9000380'), ('BOLINHA DE PEIXE', '9000378'), ('PEIXE EMPANADO', '9000376'),
  ('COXA E SOBRECOXA', '9000370'), ('PURÊ DE BATATA', '9000379'),
  ('MINI CROISSANT', '9000015'), ('FOLH. FRANGO C/ BACON', '9000204'),
  ('BAGUETE (pct)', '9000291'), ('PÃO DE COCO', '9000387'),
  ('COX. DE CARNE DE SOL', '9000001'), ('EMP. DE CARNE DO SOL', '9000003'), ('EMP. DE FRANGO - UND', '9000004'),
  ('EMP. DE FRANGO CATUPIRY', '9000005'), ('EMP. DE 3 QUEIJOS', '9000382'), ('EMP. DE PALMITO', '9000076'),
  ('EMP. DE CAMARÃO', '9000183'), ('PAO DE QUEIJO GRANDE', '9000026'), ('PÃO DE QUEIJO GRANDE COM PARMESÃO', '9000381'),
  ('MINI COXINHA', '9000014'), ('MINI CROQUETE', '9000016'), ('MINI BOLINHA DE C. SOL', '9000012')
) as v(name, code)
where i.name = v.name and i.erp_product_code is null;
