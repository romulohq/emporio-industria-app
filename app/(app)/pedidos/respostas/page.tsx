import { ResponsesView } from "../_views/responses-view";
import { RUI_ORDERS } from "@/lib/orders/units";

export default function RespostasLojasPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  return <ResponsesView ctx={RUI_ORDERS} searchParams={searchParams} />;
}
