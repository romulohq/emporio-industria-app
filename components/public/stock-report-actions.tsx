"use client";

import { useState } from "react";
import { Download, Share2 } from "lucide-react";
import type { SentReport } from "@/app/relatar-estoque/[token]/actions";

/** Download or share the PDF of the report a store just sent. The PDF library loads only on click. */
export function StockReportActions({ report }: { report: SentReport }) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buildFile(): Promise<File> {
    const { buildStockReportPdf, stockReportFileName } = await import("@/lib/pdf/stock-report-pdf");
    const blob = buildStockReportPdf(report).output("blob");
    return new File([blob], stockReportFileName(report), { type: "application/pdf" });
  }

  function download(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function run(kind: "download" | "share") {
    setBusy(kind);
    setError(null);
    try {
      const file = await buildFile();
      if (kind === "share" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Estoque — ${report.storeName}` });
      } else {
        download(file);
      }
    } catch (e) {
      // closing the share sheet is not an error
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError("Não foi possível gerar o PDF. Tente novamente.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => run("share")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-60"
        >
          <Share2 className="h-4 w-4" />
          {busy === "share" ? "Gerando..." : "Compartilhar PDF"}
        </button>
        <button
          type="button"
          onClick={() => run("download")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {busy === "download" ? "Gerando..." : "Baixar PDF"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
