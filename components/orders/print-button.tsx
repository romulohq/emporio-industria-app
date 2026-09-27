"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="gap-1.5">
      <Printer className="h-4 w-4" />
      Imprimir / Salvar PDF
    </Button>
  );
}
