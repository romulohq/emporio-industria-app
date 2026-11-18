import { RomaneioView } from "../../../pedidos/_views/romaneio-view";
import { OSORIO_ORDERS } from "@/lib/orders/units";

export default function ImprimirRomaneioOsorioPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; loja?: string }>;
}) {
  return <RomaneioView ctx={OSORIO_ORDERS} searchParams={searchParams} />;
}
