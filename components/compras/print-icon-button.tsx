"use client";

import { Printer } from "lucide-react";

/** Icon button that prints the page (everything not meant for paper is hidden with print: classes). */
export function PrintIconButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 print:hidden"
    >
      <Printer className="h-4 w-4" />
    </button>
  );
}
