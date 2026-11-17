/** Regras de "Inserir produção": sugerir o produto do ERP de um item do cronograma e não contar em dobro. */

const ABBREVIATIONS: Record<string, string> = {
  COX: "COXINHA",
  EMP: "EMPADA",
  FOLH: "FOLHEADO",
  CAT: "CATUPIRY",
  TERYAKI: "TERIYAKI",
  CROISSAINT: "CROISSANT",
};
const STOPWORDS = new Set(["DE", "DO", "DA", "C", "E", "COM", "UND", "UN", "PCT", "CX", "KG"]);

function tokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ABBREVIATIONS[t] ?? t)
    .filter((t) => !STOPWORDS.has(t));
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  const [longer, shorter] = a.length > b.length ? [a, b] : [b, a];
  return longer.slice(i + 1) === shorter.slice(i);
}

const sameToken = (a: string, b: string) => a === b || (a.length >= 6 && b.length >= 6 && editDistanceAtMostOne(a, b));

/** Quanto dois nomes se parecem: 0 a 1 (palavras em comum sobre o total de palavras diferentes). */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const common = ta.filter((x) => tb.some((y) => sameToken(x, y))).length;
  return common / (ta.length + tb.length - common);
}

/** Código do produto do ERP mais parecido com o nome do item do cronograma; null quando não há um parecido o bastante. */
export function suggestProductCode(itemName: string, catalog: { product_code: string; display_name: string }[]): string | null {
  let best: { code: string; score: number } | null = null;
  let tie = false;
  for (const c of catalog) {
    const score = nameSimilarity(itemName, c.display_name);
    if (!best || score > best.score) {
      best = { code: c.product_code, score };
      tie = false;
    } else if (score === best.score) {
      tie = true;
    }
  }
  return best && best.score >= 0.6 && !tie ? best.code : null;
}

export type ManualEntry = { id: string; productCode: string; date: string; quantity: number; seq: number };

/**
 * Lançamentos manuais que entram na conta: se o ERP já trouxe o mesmo produto no mesmo dia, vale o ERP
 * (o lançamento manual preenche o dia só até a importação chegar, sem somar duas vezes).
 */
export function manualEntriesToCount<T extends { productCode: string; date: string }>(
  manual: T[],
  erp: { product_code: string; launch_date: string; excluded: boolean }[]
): T[] {
  const covered = new Set(erp.filter((o) => !o.excluded).map((o) => `${o.launch_date}#${o.product_code}`));
  return manual.filter((m) => !covered.has(`${m.date}#${m.productCode}`));
}

/** One line of the "Inserir produção" dialog: a schedule item of the day, with the ERP product it produces. */
export type ProductionDayItem = {
  scheduleItemId: string;
  name: string;
  /** what the schedule says for that day ("Produzir", "2x Produzir", "Pré-preparo"…) */
  label: string;
  /** the schedule marks the day as production ("Produzir") */
  producing: boolean;
  productCode: string | null;
  /** the code was guessed from the name (not confirmed yet) */
  suggested: boolean;
  /** quantity already typed for that day, in the product's unit of measure */
  quantity: number | null;
};

export type ProductionDayData = {
  date: string;
  /** Saturday or Sunday: the schedule has no day */
  weekend: boolean;
  items: ProductionDayItem[];
  /** products typed for the day that are not a schedule line */
  extras: { productCode: string; quantity: number }[];
  /** what the ERP already brought for the day, by product code (these win over the typed value) */
  erp: Record<string, number>;
};

export type ProductionEntry = { productCode: string; quantity: number; scheduleItemId: string | null };
