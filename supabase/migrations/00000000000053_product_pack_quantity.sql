-- Quanto cada pacote (unidade do pedido do Osório) contém, na unidade do produto (ex.: bife = 0,35 kg por pacote).
-- Os pedidos e romaneios do Osório ficam em pacotes, sem multiplicar; o campo serve para um levantamento futuro
-- da quantidade enviada em kg/und (pacotes x quantidade por pacote).
alter table products add column if not exists pack_quantity numeric(12,3) check (pack_quantity is null or pack_quantity > 0);

-- pesos dos pacotes que já constam na planilha "CONGELADOS - CAFÉ" (aba Página3)
update products p set pack_quantity = v.q
from (values
  ('MOLHO BOLONHESA', 1), ('MOLHO DE TOMATE', 1), ('MOLHO ERVAS FINAS', 1), ('MOLHO DE LARANJA', 1), ('MOLHO MADEIRA', 1),
  ('MOLHO TERIYAKI', 1), ('MOLHO BARBECUE', 1), ('MOLHO BRANCO', 1), ('MOLHO DE ABACAXI CARAMELIZADO', 1),
  ('MOLHO DE MOSTARDA E MEL', 1), ('FRICASSÊ DE FRANGO', 1), ('STROGONOFFE DE FRANGO', 1),
  ('BIFE DE CARNE', 0.35), ('PALETA SUÍNA', 0.35), ('PEIXE EMPANADO', 0.45), ('BOLINHA DE PEIXE', 0.64),
  ('LINGUIÇA TOSCANA', 0.65), ('FILÉ DE FRANGO EMPANADO', 0.35), ('FILÉ DE FRANGO GRELHADO', 0.35), ('CUPIM', 0.4)
) as v(name, q)
where p.name = v.name
  and p.sector_id in (select s.id from sectors s join production_units u on u.id = s.unit_id where u.slug = 'osorio-de-paiva');
