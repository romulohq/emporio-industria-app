import { RomaneioView } from "../../_views/romaneio-view";
import { RUI_ORDERS } from "@/lib/orders/units";

export default function ImprimirRomaneioPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; loja?: string }>;
}) {
  return <RomaneioView ctx={RUI_ORDERS} searchParams={searchParams} />;
}
