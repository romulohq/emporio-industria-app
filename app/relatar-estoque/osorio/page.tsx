import type { Metadata } from "next";
import { StorePickerScreen } from "../_store-picker";
import { OSORIO_ORDERS } from "@/lib/orders/units";

export const metadata: Metadata = {
  title: "Relatar estoque de congelados",
  robots: { index: false, follow: false },
};

export default async function EscolherLojaOsorioPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <StorePickerScreen ctx={OSORIO_ORDERS} title="Relatar estoque de congelados" erro={erro} />;
}
