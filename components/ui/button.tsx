import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-orange-600 text-white hover:bg-orange-700",
  secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "bg-transparent text-neutral-700 hover:bg-neutral-100",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = "primary", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
      variants[variant],
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";
