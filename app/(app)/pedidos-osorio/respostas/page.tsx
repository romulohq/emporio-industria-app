import { ResponsesView } from "../../pedidos/_views/responses-view";
import { OSORIO_ORDERS } from "@/lib/orders/units";

export default function RespostasLojasOsorioPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  return <ResponsesView ctx={OSORIO_ORDERS} searchParams={searchParams} />;
}
