-- Um envio que chega depois do prazo e SEM nenhuma ordem gerada para aquela entrega não tinha
-- onde ser marcado como atrasado (late_for_order_id aponta para uma ordem). Esta marca guarda
-- exatamente esse caso: o envio aparece como "enviado atrasado, aguardando aprovação" e, ao
-- aprovar, a ordem é gerada com ele.

alter table store_stock_reports
  add column if not exists late_without_order boolean not null default false;

create index if not exists store_stock_reports_late_without_order_idx
  on store_stock_reports (delivery_date)
  where late_without_order and not late_acknowledged;
