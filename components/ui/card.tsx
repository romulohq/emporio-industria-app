import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200/60 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-3 p-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-bold text-neutral-900", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}

const ICON_TONES: Record<string, string> = {
  orange: "bg-orange-50 text-orange-600",
  red: "bg-red-50 text-red-600",
  blue: "bg-blue-50 text-blue-600",
  green: "bg-green-50 text-green-600",
  violet: "bg-violet-50 text-violet-600",
};

const ICON_SIZES: Record<string, string> = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
};

export function CardIcon({
  tone = "orange",
  size = "sm",
  children,
}: {
  tone?: "orange" | "red" | "blue" | "green" | "violet";
  size?: "sm" | "md";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        ICON_SIZES[size],
        ICON_TONES[tone]
      )}
    >
      {children}
    </span>
  );
}
