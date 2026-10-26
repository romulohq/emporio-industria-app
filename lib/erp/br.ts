/** Número no padrão brasileiro: "1.560,000000" = 1560, "2,89" = 2.89. Devolve null se não for um número válido. */
export function parseBrNumber(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (!/^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(text)) return null;
  const value = Number(text.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Data dd/mm/aaaa → aaaa-mm-dd (valida o dia no calendário). */
export function parseBrDate(raw: string | Date | null | undefined): string | null {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  if (raw == null) return null;
  const match = String(raw).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (date.getUTCFullYear() !== Number(yyyy) || date.getUTCMonth() !== Number(mm) - 1 || date.getUTCDate() !== Number(dd)) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

/** aaaa-mm-dd → dd/mm/aaaa */
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [yyyy, mm, dd] = iso.slice(0, 10).split("-");
  return `${dd}/${mm}/${yyyy}`;
}

/** aaaa-mm → mm/aaaa */
export function formatMonthBR(month: string): string {
  const [yyyy, mm] = month.split("-");
  return `${mm}/${yyyy}`;
}

export function formatNumberBR(value: number, maxDigits = 2): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: maxDigits }).format(value);
}

/** Texto sem acento, em maiúsculas — para comparar situações e títulos de coluna. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}
