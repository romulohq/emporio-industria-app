"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn(
          "w-full rounded-md border border-neutral-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-600",
          className
        )}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400 hover:text-neutral-600"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
