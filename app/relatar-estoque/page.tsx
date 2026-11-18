import type { Metadata } from "next";
import { StorePickerScreen } from "./_store-picker";
import { RUI_ORDERS } from "@/lib/orders/units";

export const metadata: Metadata = {
  title: "Relatar estoque Confeitaria e Pães embalados",
  robots: { index: false, follow: false },
};

export default async function EscolherLojaPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <StorePickerScreen ctx={RUI_ORDERS} title="Relatar estoque Confeitaria e Pães embalados" erro={erro} />;
}
