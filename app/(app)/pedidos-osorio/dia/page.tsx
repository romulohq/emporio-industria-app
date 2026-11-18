import { DayView } from "../../pedidos/_views/day-view";
import { OSORIO_ORDERS } from "@/lib/orders/units";

export default function OrdensPorDiaOsorioPage() {
  return <DayView ctx={OSORIO_ORDERS} />;
}
