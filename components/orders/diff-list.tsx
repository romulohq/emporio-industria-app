import type { DiffItem } from "@/lib/orders/diff-day-orders";
import { formatQuantity } from "@/lib/format/labels";

export function DiffList({ title, items, tone }: { title: string; items: DiffItem[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide ${tone}`}>{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item.productId} className="flex items-center justify-between text-sm">
            <span className="text-neutral-800">{item.productName}</span>
            <span className="font-medium text-neutral-900">
              {formatQuantity(item.before, item.unit)} → {formatQuantity(item.after, item.unit)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
