import { Badge } from "@/components/ui/badge";
import { PRIORITY_LABELS } from "@/lib/format/labels";
import type { OrderPriority } from "@/lib/types/database.types";

const TONE: Record<OrderPriority, "neutral" | "green" | "amber" | "red" | "blue"> = {
  low: "neutral",
  medium: "amber",
  high: "red",
};

export function PriorityBadge({ priority }: { priority: OrderPriority }) {
  return <Badge tone={TONE[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}
