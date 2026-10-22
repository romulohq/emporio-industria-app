"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A menu item with a submenu that only opens when it is clicked (and stays open while the user is
 * inside its section).
 */
export function SidebarGroup({
  label,
  icon,
  basePath,
  items,
}: {
  label: string;
  icon: React.ReactNode;
  /** the submenu counts as "inside" while the address starts with this path */
  basePath: string;
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const inside = pathname.startsWith(basePath);
  const [clicked, setClicked] = useState(false);
  const open = inside || clicked;

  return (
    <div>
      <button
        type="button"
        onClick={() => setClicked((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-orange-50 hover:text-orange-700",
          inside ? "text-orange-700" : "text-neutral-600"
        )}
      >
        {icon}
        {label}
        <ChevronDown className={cn("ml-auto h-4 w-4 text-neutral-400 transition-transform", open ? "" : "-rotate-90")} />
      </button>
      {open && (
        <div className="ml-[22px] mt-0.5 space-y-0.5 border-l border-neutral-200 pl-3">
          {items.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                "block rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-orange-50 hover:text-orange-700",
                pathname.startsWith(child.href) ? "font-medium text-orange-700" : "text-neutral-500"
              )}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
