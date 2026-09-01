import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-600",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
