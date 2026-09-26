import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ProductionUnit } from "@/lib/types/database.types";

export function UnitFilter({
  units,
  active,
  basePath = "/pedidos",
}: {
  units: ProductionUnit[];
  active: string;
  basePath?: string;
}) {
  return (
    <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-100 p-1">
      {units.map((unit) => (
        <Link
          key={unit.slug}
          href={`${basePath}?unit=${unit.slug}`}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            active === unit.slug
              ? "bg-orange-600 text-white"
              : "text-neutral-600 hover:text-neutral-900"
          )}
        >
          {unit.name}
        </Link>
      ))}
    </div>
  );
}
