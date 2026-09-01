import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/format/labels";
import type { OrderStatus } from "@/lib/types/database.types";

const TONE: Record<OrderStatus, "neutral" | "green" | "amber" | "red" | "blue"> = {
  pending: "neutral",
  in_progress: "blue",
  completed: "green",
  cancelled: "red",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={TONE[status]}>{STATUS_LABELS[status]}</Badge>;
}
