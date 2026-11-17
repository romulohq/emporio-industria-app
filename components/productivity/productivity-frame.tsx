"use client";

import { useEffect, useRef, useState } from "react";
import { InsertProductionDialog, type CatalogOption } from "@/components/productivity/insert-production-dialog";

/** The productivity dashboard (a static page in an iframe) plus the "Inserir produção" window its button opens. */
export function ProductivityFrame({ today, catalog }: { today: string; catalog: CatalogOption[] }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if ((e.data as { type?: string } | null)?.type === "produtividade:inserir-producao") setOpen(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <>
      <iframe
        key={version}
        ref={frame}
        src="/relatorios/produtividade-congelados.html"
        title="Produtividade Fábrica Congelados"
        className="block h-[calc(100dvh-3rem)] w-full rounded-xl border border-neutral-200 bg-white md:h-[calc(100dvh-4rem)]"
      />
      {open && (
        <InsertProductionDialog
          onClose={() => setOpen(false)}
          onSaved={() => setVersion((v) => v + 1)}
          today={today}
          catalog={catalog}
        />
      )}
    </>
  );
}
