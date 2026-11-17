"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { loadProductionDayAction, saveProductionDay } from "@/app/(app)/produtividade/actions";
import type { ProductionDayData } from "@/lib/erp/manual-production";

export type CatalogOption = { code: string; name: string; unit: string; sector: string | null };

type Row = {
  key: string;
  scheduleItemId: string | null;
  name: string;
  label: string | null;
  producing: boolean;
  productCode: string | null;
  /** the product is only a guess from the name; the person still has to confirm it */
  suggested: boolean;
  quantity: string;
};

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);
const parseQuantity = (text: string): number | null => {
  const t = text.trim().replace(/\./g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const unitLabel = (unit: string | undefined) => (unit === "KG" ? "kg" : "un");

function rowsOf(data: ProductionDayData, byCode: Map<string, CatalogOption>): Row[] {
  const rows: Row[] = data.items.map((item) => ({
    key: item.scheduleItemId,
    scheduleItemId: item.scheduleItemId,
    name: item.name,
    label: item.label,
    producing: item.producing,
    productCode: item.productCode,
    suggested: item.suggested,
    quantity: item.quantity == null ? "" : fmt(item.quantity),
  }));
  // lines marked "Produzir" first, the rest (pré-preparo, descongelar…) after, in schedule order
  rows.sort((a, b) => Number(b.producing) - Number(a.producing));
  for (const extra of data.extras) {
    rows.push({
      key: `extra-${extra.productCode}`,
      scheduleItemId: null,
      name: byCode.get(extra.productCode)?.name ?? extra.productCode,
      label: null,
      producing: false,
      productCode: extra.productCode,
      suggested: false,
      quantity: fmt(extra.quantity),
    });
  }
  return rows;
}

export function InsertProductionDialog({
  onClose,
  onSaved,
  today,
  catalog,
}: {
  onClose: () => void;
  onSaved: () => void;
  today: string;
  catalog: CatalogOption[];
}) {
  const byCode = useMemo(() => new Map(catalog.map((c) => [c.code, c])), [catalog]);
  const [date, setDate] = useState(today);
  const [data, setData] = useState<ProductionDayData | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState("");

  // reads the day again whenever the date changes; an answer that arrives after another change is dropped
  useEffect(() => {
    let current = true;
    loadProductionDayAction(date).then((result) => {
      if (!current) return;
      setLoading(false);
      if ("error" in result) {
        setData(null);
        setRows([]);
        setError(result.error);
        return;
      }
      setError(null);
      setData(result.data);
      setRows(rowsOf(result.data, byCode));
    });
    return () => {
      current = false;
    };
  }, [date, byCode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const usedCodes = new Set(rows.map((r) => r.productCode).filter(Boolean));
  const update = (key: string, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => (parseQuantity(r.quantity) ?? 0) > 0).length;

  const addProduct = (code: string) => {
    const option = byCode.get(code);
    if (!option || usedCodes.has(code)) return;
    setRows((list) => [
      ...list,
      {
        key: `extra-${code}`,
        scheduleItemId: null,
        name: option.name,
        label: null,
        producing: false,
        productCode: code,
        suggested: false,
        quantity: "",
      },
    ]);
    setAdding("");
  };

  const save = () => {
    setError(null);
    const entries: { productCode: string; quantity: number; scheduleItemId: string | null }[] = [];
    for (const row of rows) {
      const quantity = parseQuantity(row.quantity);
      if (quantity === null || quantity === 0) continue;
      if (Number.isNaN(quantity) || quantity < 0) return setError(`Quantidade inválida em ${row.name}.`);
      if (!row.productCode) return setError(`Escolha o produto do ERP de ${row.name}.`);
      entries.push({ productCode: row.productCode, quantity, scheduleItemId: row.scheduleItemId });
    }
    startSaving(async () => {
      const result = await saveProductionDay({ date, entries });
      if (result.error) return setError(result.error);
      onSaved();
      onClose();
    });
  };

  // the products still free to pick, grouped by sector; the one already chosen in a row stays in its own list
  const optionsBySector = (selected: string | null) => {
    const groups = new Map<string, CatalogOption[]>();
    for (const c of catalog) {
      if (usedCodes.has(c.code) && c.code !== selected) continue;
      const sector = c.sector ?? "Outros";
      groups.set(sector, [...(groups.get(sector) ?? []), c]);
    }
    return [...groups.entries()];
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Inserir produção"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Inserir produção</h2>
            <p className="text-xs text-neutral-500">O que for lançado entra nos gráficos e totais do painel.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="max-w-[12rem]">
            <Label htmlFor="producao-data">Data da produção</Label>
            <Input
              id="producao-data"
              type="date"
              value={date}
              max={today}
              onChange={(e) => {
                if (!e.target.value) return;
                setLoading(true);
                setDate(e.target.value);
              }}
            />
          </div>

          {loading && <p className="text-sm text-neutral-500">Carregando o cronograma do dia…</p>}

          {!loading && data && (
            <>
              {data.weekend && (
                <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                  O cronograma não tem produção em sábado e domingo. Use &ldquo;Adicionar outro produto&rdquo; para lançar
                  o que foi produzido.
                </p>
              )}
              {!data.weekend && data.items.length === 0 && (
                <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                  Não há itens no cronograma deste dia. Use &ldquo;Adicionar outro produto&rdquo; para lançar o que foi
                  produzido.
                </p>
              )}

              {rows.length > 0 && (
                <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                  {rows.map((row) => {
                    const option = row.productCode ? byCode.get(row.productCode) : undefined;
                    const needsProduct = row.productCode === null || row.suggested;
                    const erpQuantity = row.productCode ? data.erp[row.productCode] : undefined;
                    return (
                      <li key={row.key} className="space-y-1.5 px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-neutral-900">{row.name}</p>
                            {row.label && (
                              <span
                                className={`mt-0.5 inline-block rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${
                                  row.producing ? "bg-orange-100 text-orange-800" : "bg-neutral-100 text-neutral-500"
                                }`}
                              >
                                {row.label}
                              </span>
                            )}
                            {!row.scheduleItemId && (
                              <span className="mt-0.5 inline-block text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                                fora do cronograma
                              </span>
                            )}
                          </div>
                          <div className="flex w-36 shrink-0 items-center gap-1.5">
                            <Input
                              inputMode="decimal"
                              placeholder="0"
                              aria-label={`Quantidade produzida de ${row.name}`}
                              value={row.quantity}
                              onChange={(e) => update(row.key, { quantity: e.target.value })}
                              className="text-right tabular-nums"
                            />
                            <span className="w-5 text-xs text-neutral-500">{option ? unitLabel(option.unit) : ""}</span>
                          </div>
                          {!row.scheduleItemId && (
                            <button
                              type="button"
                              aria-label={`Remover ${row.name}`}
                              onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {row.scheduleItemId && needsProduct && (
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 text-xs text-neutral-500">
                              {row.suggested ? "Produto no ERP (confira):" : "Qual produto do ERP é este?"}
                            </span>
                            <Select
                              aria-label={`Produto do ERP de ${row.name}`}
                              value={row.productCode ?? ""}
                              onChange={(e) => update(row.key, { productCode: e.target.value || null, suggested: false })}
                              className="py-1"
                            >
                              <option value="">Escolher…</option>
                              {optionsBySector(row.productCode).map(([sector, list]) => (
                                <optgroup key={sector} label={sector}>
                                  {list.map((c) => (
                                    <option key={c.code} value={c.code}>
                                      {c.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </Select>
                          </div>
                        )}
                        {row.scheduleItemId && !needsProduct && option && (
                          <p className="text-xs text-neutral-400">
                            Produto no ERP: {option.name}{" "}
                            <button
                              type="button"
                              className="underline hover:text-neutral-600"
                              onClick={() => update(row.key, { suggested: true })}
                            >
                              trocar
                            </button>
                          </p>
                        )}
                        {erpQuantity !== undefined && (
                          <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
                            O ERP já trouxe {fmt(erpQuantity)} {option ? unitLabel(option.unit) : ""} deste produto neste
                            dia: vale o valor do ERP, o que você digitar aqui não soma.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div>
                <Label htmlFor="producao-extra">Adicionar outro produto</Label>
                <Select id="producao-extra" value={adding} onChange={(e) => addProduct(e.target.value)}>
                  <option value="">Escolher um produto que não está na lista…</option>
                  {optionsBySector(null).map(([sector, list]) => (
                    <optgroup key={sector} label={sector}>
                      {list.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </div>
            </>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-5 py-3">
          <p className="text-xs text-neutral-500">
            {filled === 0 ? "Nenhum produto com quantidade." : `${filled} ${filled === 1 ? "produto" : "produtos"} com quantidade.`}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={save} disabled={saving || loading || !data}>
              {saving ? "Salvando…" : "Salvar produção"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
