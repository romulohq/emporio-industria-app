import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-600",
        className
      )}
      {...props}
    />
  )
);
Select.displayName = "Select";
