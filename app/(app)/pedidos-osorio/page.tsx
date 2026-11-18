import { MonitorView } from "../pedidos/_views/monitor-view";
import { OSORIO_ORDERS } from "@/lib/orders/units";

export default function PedidosOsorioPage() {
  return <MonitorView ctx={OSORIO_ORDERS} />;
}
