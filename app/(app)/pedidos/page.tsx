import { MonitorView } from "./_views/monitor-view";
import { RUI_ORDERS } from "@/lib/orders/units";

export default function PedidosPage() {
  return <MonitorView ctx={RUI_ORDERS} />;
}
