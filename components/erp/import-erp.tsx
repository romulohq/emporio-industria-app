"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileUp, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateBR, formatMonthBR, formatNumberBR, parseBrNumber } from "@/lib/erp/br";
import type { ErpImportResult, ErpPreview } from "@/lib/erp/preview";

type OutlierEdit = { quantity: string; excluded: boolean };

/** Aceita "1.560,5", "1560,5" e "1560.5". */
function parseQuantityInput(text: string): number | null {
  const trimmed = text.trim();
  if (/^\d+\.\d+$/.test(trimmed)) return Number(trimmed);
  return parseBrNumber(trimmed);
}

function Section({ title, tone, children }: { title: string; tone: "amber" | "red" | "neutral"; children: React.ReactNode }) {
  const styles = {
    amber: "border-amber-200 bg-amber-50",
    red: "border-red-200 bg-red-50",
    neutral: "border-neutral-200 bg-white",
  }[tone];
  return (
    <div className={`space-y-2 rounded-lg border p-4 ${styles}`}>
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {children}
    </div>
  );
}

export function ImportErp() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"reading" | "importing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [preview, setPreview] = useState<ErpPreview | null>(null);
  const [result, setResult] = useState<ErpImportResult | null>(null);
  const [includeStatuses, setIncludeStatuses] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, OutlierEdit>>({});

  function reset() {
    setFile(null);
    setPreview(null);
    setError(null);
    setDetails([]);
    setIncludeStatuses(new Set());
    setEdits({});
    if (fileInput.current) fileInput.current.value = "";
  }

  async function readFile() {
    if (!file) return;
    setBusy("reading");
    setError(null);
    setDetails([]);
    setResult(null);
    setPreview(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/erp/preview", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Não foi possível ler o arquivo.");
        return;
      }
      const loaded = data as ErpPreview;
      setPreview(loaded);
      setIncludeStatuses(new Set());
      setEdits(Object.fromEntries(loaded.outliers.map((o) => [o.key, { quantity: String(o.quantity).replace(".", ","), excluded: false }])));
    } catch {
      setError("Falha de conexão ao enviar o arquivo.");
    } finally {
      setBusy(null);
    }
  }

  function buildOptions(): { options: object } | { problem: string } {
    const overrides: { key: string; quantity?: number | null; excluded?: boolean }[] = [];
    for (const outlier of preview?.outliers ?? []) {
      const edit = edits[outlier.key];
      if (!edit) continue;
      if (edit.excluded) {
        overrides.push({ key: outlier.key, excluded: true });
        continue;
      }
      const quantity = parseQuantityInput(edit.quantity);
      if (quantity == null || quantity < 0) return { problem: `Quantidade inválida na ordem ${outlier.orderNumber}.` };
      if (quantity !== outlier.quantity) overrides.push({ key: outlier.key, quantity });
    }
    return { options: { includeStatuses: [...includeStatuses], overrides } };
  }

  async function runImport() {
    if (!file || !preview) return;
    const built = buildOptions();
    if ("problem" in built) {
      setError(built.problem);
      return;
    }
    setBusy("importing");
    setError(null);
    setDetails([]);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("options", JSON.stringify(built.options));
      const response = await fetch("/api/erp/import", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Não foi possível importar.");
        setDetails(Array.isArray(data.details) ? data.details : []);
        return;
      }
      setResult(data as ErpImportResult);
      reset();
      router.refresh();
    } catch {
      setError("Falha de conexão ao importar.");
    } finally {
      setBusy(null);
    }
  }

  const nonConcludedByStatus = new Map<string, number>();
  for (const order of preview?.nonConcluded ?? []) {
    nonConcludedByStatus.set(order.status, (nonConcludedByStatus.get(order.status) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-sm text-neutral-600">
          Envie o relatório <span className="font-medium">Ordens de Produção</span> exportado do Everest (PDF; também aceita XLSX ou CSV com as
          mesmas colunas). Antes de gravar, você confere o resumo e os avisos.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.xlsx,.csv,application/pdf"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setResult(null);
              setError(null);
            }}
            className="block text-sm text-neutral-700 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-neutral-200"
          />
          <Button type="button" onClick={readFile} disabled={!file || busy !== null}>
            <FileUp className="h-4 w-4" />
            {busy === "reading" ? "Lendo…" : "Ler arquivo"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">{error}</p>
          {details.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Importação concluída</p>
            <p>
              {result.rowsTotal} ordens ({formatDateBR(result.period.start)} a {formatDateBR(result.period.end)}): {result.inserted} novas,{" "}
              {result.updated} atualizadas, {result.excluded} marcadas como excluídas, {result.withWarning} com aviso.
            </p>
          </div>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-sm font-semibold text-neutral-900">{preview.fileName}</p>
            <p className="text-sm text-neutral-600">
              {preview.units.join(", ")} · período {formatDateBR(preview.period.start)} a {formatDateBR(preview.period.end)} ·{" "}
              <span className="font-medium">{preview.totalRows} ordens</span>
              {preview.declaredTotal != null && <> (o relatório informa {preview.declaredTotal})</>}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {preview.statusCounts.map((s) => (
                <span key={s.status} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                  {s.status}: {s.count}
                </span>
              ))}
            </div>
          </div>

          {!preview.integrity.ok && (
            <Section title="Importação bloqueada — a conferência do total não fechou" tone="red">
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-red-800">
                {preview.integrity.messages.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              {preview.integrity.badPages.length > 0 && (
                <p className="text-sm font-medium text-red-900">Páginas com problema: {preview.integrity.badPages.join(", ")}</p>
              )}
              {preview.pages.length > 0 && (
                <p className="text-xs text-red-800">
                  Linhas lidas por página: {preview.pages.map((p) => `p.${p.page}: ${p.rowsRead}`).join(" · ")}
                </p>
              )}
            </Section>
          )}

          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Mês</th>
                  <th className="px-3 py-2 text-right">Ordens</th>
                  <th className="px-3 py-2 text-right">Unidades</th>
                  <th className="px-3 py-2 text-right">Kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {preview.months.map((m) => (
                  <tr key={m.month}>
                    <td className="px-3 py-2 font-medium text-neutral-900">{formatMonthBR(m.month)}</td>
                    <td className="px-3 py-2 text-right">{formatNumberBR(m.orders, 0)}</td>
                    <td className="px-3 py-2 text-right">{formatNumberBR(m.units, 0)}</td>
                    <td className="px-3 py-2 text-right">
                      {formatNumberBR(m.kg, 1)}
                      {m.withoutWeight > 0 && (
                        <span className="ml-1 text-xs text-amber-700" title="Ordens em unidade sem peso cadastrado ficam fora do kg">
                          (+{m.withoutWeight} sem peso)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.unitOverrides.length > 0 && (
            <Section title={`Itens de quilo tratados como kg (${preview.unitOverrides.length})`} tone="neutral">
              <p className="text-xs text-neutral-600">
                O relatório traz estes itens como {preview.unitOverrides[0].from}, mas são de quilo (KG na descrição ou setor Cozinha): entram como kg.
                A medida original do relatório fica guardada.
              </p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto text-sm text-neutral-800">
                {preview.unitOverrides.map((u) => (
                  <li key={u.code}>
                    <span className="font-mono text-xs">{u.code}</span> — {u.displayName ?? u.description}{" "}
                    <span className="text-xs text-neutral-500">
                      ({u.orders} {u.orders === 1 ? "ordem" : "ordens"})
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {preview.unknownCodes.length > 0 && (
            <Section title={`Códigos sem cadastro em Produtos ERP (${preview.unknownCodes.length})`} tone="amber">
              <p className="text-xs text-neutral-600">
                Podem ser importados; sem o cadastro só não entram na conversão para kg.{" "}
                <Link href="/cadastro-produtos-erp" className="font-medium text-orange-700 underline">
                  Cadastrar pendentes
                </Link>{" "}
                depois da importação.
              </p>
              <ul className="max-h-48 space-y-0.5 overflow-y-auto text-sm text-neutral-800">
                {preview.unknownCodes.map((u) => (
                  <li key={u.code}>
                    <span className="font-mono text-xs">{u.code}</span> — {u.description}{" "}
                    <span className="text-xs text-neutral-500">({u.orders} {u.orders === 1 ? "ordem" : "ordens"})</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {preview.nonConcluded.length > 0 && (
            <Section title={`Ordens que não estão CONCLUÍDO (${preview.nonConcluded.length})`} tone="amber">
              <div className="space-y-1">
                {[...nonConcludedByStatus.entries()].map(([status, count]) => (
                  <label key={status} className="flex items-center gap-2 text-sm text-neutral-800">
                    <input
                      type="checkbox"
                      checked={includeStatuses.has(status)}
                      onChange={(e) =>
                        setIncludeStatuses((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(status);
                          else next.delete(status);
                          return next;
                        })
                      }
                    />
                    Incluir as {count} ordens com situação <span className="font-semibold">{status}</span>
                  </label>
                ))}
                <p className="text-xs text-neutral-600">Sem marcar, elas são gravadas como excluídas (não entram na produtividade) e podem ser incluídas numa importação futura.</p>
              </div>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto text-sm text-neutral-800">
                {preview.nonConcluded.map((o) => (
                  <li key={o.key}>
                    Ordem {o.orderNumber} — {o.displayName ?? o.description} · {formatDateBR(o.launchDate)} · {formatNumberBR(o.quantity, 3)} {o.unitMeasure} ·{" "}
                    <span className="font-medium">{o.status}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {preview.outliers.length > 0 && (
            <Section title={`Quantidade fora do normal (${preview.outliers.length})`} tone="amber">
              <p className="text-xs text-neutral-600">Mais de 10 vezes a mediana das ordens do mesmo produto. Corrija o valor ou exclua a linha.</p>
              <div className="space-y-2">
                {preview.outliers.map((o) => {
                  const edit = edits[o.key] ?? { quantity: String(o.quantity), excluded: false };
                  return (
                    <div key={o.key} className="flex flex-wrap items-center gap-3 rounded-md bg-white p-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-neutral-900">
                          Ordem {o.orderNumber} — {o.displayName ?? o.description}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {formatDateBR(o.launchDate)} · lido {formatNumberBR(o.quantity, 3)} {o.unitMeasure} · mediana {formatNumberBR(o.median, 1)} (
                          {formatNumberBR(o.ratio, 1)}×)
                        </p>
                      </div>
                      <input
                        inputMode="decimal"
                        value={edit.quantity}
                        disabled={edit.excluded}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [o.key]: { ...edit, quantity: e.target.value } }))}
                        className="w-32 rounded-md border border-neutral-300 px-2 py-1 text-right disabled:bg-neutral-100 disabled:text-neutral-400"
                        aria-label={`Quantidade da ordem ${o.orderNumber}`}
                      />
                      <label className="flex items-center gap-1 text-xs text-neutral-700">
                        <input
                          type="checkbox"
                          checked={edit.excluded}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [o.key]: { ...edit, excluded: e.target.checked } }))}
                        />
                        Excluir
                      </label>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {preview.existing.count > 0 && (
            <Section title={`Ordens que já existem no banco (${preview.existing.count})`} tone="neutral">
              <p className="text-sm text-neutral-700">
                Serão atualizadas, não duplicadas.{" "}
                {preview.existing.changed.length > 0
                  ? `${preview.existing.changed.length} têm valores diferentes dos gravados:`
                  : "Nenhuma tem valor diferente do gravado."}
              </p>
              {preview.existing.changed.length > 0 && (
                <ul className="max-h-40 space-y-0.5 overflow-y-auto text-sm text-neutral-800">
                  {preview.existing.changed.map((c) => (
                    <li key={c.key}>
                      Ordem {c.orderNumber}: {c.changes.join("; ")}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {preview.parserWarnings.length > 0 && (
            <Section title="Observações da leitura" tone="neutral">
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-neutral-700">
                {preview.parserWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Section>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={runImport} disabled={!preview.integrity.ok || busy !== null || preview.totalRows === 0}>
              {busy === "importing" ? "Importando…" : "Importar"}
            </Button>
            <Button type="button" variant="ghost" onClick={reset} disabled={busy !== null}>
              Cancelar
            </Button>
            {!preview.integrity.ok ? (
              <span className="flex items-center gap-1 text-sm text-red-700">
                <XCircle className="h-4 w-4" /> Corrija o arquivo e leia de novo.
              </span>
            ) : (
              preview.unknownCodes.length + preview.nonConcluded.length + preview.outliers.length > 0 && (
                <span className="flex items-center gap-1 text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4" /> Revise os avisos acima antes de importar.
                </span>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
