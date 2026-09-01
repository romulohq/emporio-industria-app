import { Badge } from "@/components/ui/badge";

export function LowStockBadge({ isLow }: { isLow: boolean }) {
  if (!isLow) return <Badge tone="green">OK</Badge>;
  return <Badge tone="red">Estoque baixo</Badge>;
}
