import { HistoryView } from "../../../pedidos/_views/history-view";
import { OSORIO_ORDERS } from "@/lib/orders/units";

export default function HistoricoPedidosOsorioPage() {
  return <HistoryView ctx={OSORIO_ORDERS} />;
}
