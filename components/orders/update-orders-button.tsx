"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { updateDayOrders } from "@/app/(app)/pedidos/dia/actions";

/** "Atualizar ordem de produção": spins while it works, then reloads the screen and says it is done. */
export function UpdateOrdersButton({ lateCount }: { lateCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await updateDayOrders();
        if (result.error) {
          setMessage({ ok: false, text: result.error });
          return;
        }
        const time = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Fortaleza",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date());
        const moved = result.movedProducts ?? 0;
        setMessage({
          ok: true,
          text: `Ordens atualizadas às ${time}${moved > 0 ? ` · ${moved} ${moved === 1 ? "produto mudou" : "produtos mudaram"} de setor` : ""}`,
        });
        router.refresh();
      } catch {
        setMessage({ ok: false, text: "Não foi possível atualizar. Tente novamente." });
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        aria-busy={pending}
        title={lateCount === 0 ? "Atualizar as ordens com todos os envios das lojas" : "Incluir os pedidos atrasados e atualizar as ordens"}
        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-wait disabled:hover:bg-orange-600"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Atualizando..." : "Atualizar ordem de produção"}
        {!pending && lateCount > 0 && (
          <span className="rounded-full bg-white px-1.5 text-[10px] font-bold leading-4 text-orange-700">{lateCount}</span>
        )}
      </button>
      {message && (
        <p role="status" className={`text-[11px] ${message.ok ? "text-green-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
