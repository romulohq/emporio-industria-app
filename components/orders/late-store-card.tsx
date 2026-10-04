"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { includeLateStore, dismissLateStore } from "@/app/(app)/pedidos/dia/actions";
import { formatDateTime } from "@/lib/format/labels";

export function LateStoreCard({
  storeId,
  storeName,
  deliveryDate,
  deliveryLabel,
  sentAt,
}: {
  storeId: string;
  storeName: string;
  deliveryDate: string;
  deliveryLabel: string;
  sentAt: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"include" | "dismiss" | null>(null);

  async function run(kind: "include" | "dismiss") {
    setPending(kind);
    const formData = new FormData();
    formData.set("store_id", storeId);
    formData.set("delivery_date", deliveryDate);
    await (kind === "include" ? includeLateStore(formData) : dismissLateStore(formData));
    setPending(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-neutral-900">{storeName}</p>
        <p className="text-xs text-orange-800">
          Chegou um pedido atrasado · {formatDateTime(sentAt)} · entrega {deliveryLabel}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => run("include")}
          disabled={pending !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending === "include" ? "animate-spin" : ""}`} />
          Atualizar ordem de produção
        </button>
        <button
          type="button"
          onClick={() => run("dismiss")}
          disabled={pending !== null}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Não considerar o pedido
        </button>
      </div>
    </div>
  );
}
