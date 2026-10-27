-- Itens de quilo (ex.: "PI CANJA KG") vêm do Everest com UM = UNID. Na importação eles passam a ser gravados
-- em KG (unit_measure); a UM que o relatório trouxe fica guardada aqui, como veio.
alter table erp_production_orders add column if not exists erp_unit_measure text;
