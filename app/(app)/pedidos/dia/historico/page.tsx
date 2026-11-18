import { HistoryView } from "../../_views/history-view";
import { RUI_ORDERS } from "@/lib/orders/units";

export default function HistoricoPedidosPage() {
  return <HistoryView ctx={RUI_ORDERS} />;
}
