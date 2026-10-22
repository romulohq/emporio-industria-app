"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw, Smartphone } from "lucide-react";
import { rotateCountToken } from "@/app/(app)/compras/hortifrut/actions";

/** The link that opens the daily hortifruti count on a phone, without login. */
export function HortifrutLinkCard({ token }: { token: string | null }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const path = token ? `/contar-hortifrut/${token}` : null;

  function generate() {
    if (token && !window.confirm("Gerar um link novo? O link atual deixa de funcionar.")) return;
    setError(null);
    startTransition(async () => {
      const result = await rotateCountToken();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  async function copy() {
    if (!path) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <Smartphone className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Contagem pelo celular</h2>
            <p className="text-xs text-neutral-500">
              Quem conta o hortifrut abre este link no celular, sem precisar de login, e informa o estoque. O link é
              fixo, use sempre o mesmo: cada contagem enviada atualiza o estoque do hortifrut com os últimos valores.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {path && (
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Link copiado" : "Copiar link"}
            </button>
          )}
          {!token && (
            <button
              type="button"
              onClick={generate}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
              Gerar link
            </button>
          )}
        </div>
      </div>
      {path && (
        <p className="mt-3 break-all rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          <a href={path} target="_blank" rel="noreferrer" className="text-orange-700 hover:underline">
            {path}
          </a>
        </p>
      )}
      {token && (
        <p className="mt-2 text-right">
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="text-[11px] text-neutral-400 hover:text-red-600 hover:underline disabled:opacity-50"
          >
            Trocar o link (o atual deixa de funcionar)
          </button>
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
