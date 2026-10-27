/**
 * Itens de quilo vêm do Everest com UM = UNID (ex.: "PI CANJA KG"). Aqui se decide a medida que vale:
 *  1. a medida cadastrada no catálogo (Produtos ERP), se houver — é decisão de quem cadastrou;
 *  2. UM KG do relatório;
 *  3. "KG" na descrição sem gramagem na frente ("PI CANJA KG"; "1KG" ou "1,5 KG" são unidades de 1 kg);
 *  4. produto do setor Cozinha (todos os itens de Cozinha são em kg);
 *  5. a UM do relatório.
 */
export type CatalogUnitInfo = { unitMeasure: string | null; sector: string | null };

/** "KG" solto na descrição, sem número antes. */
export function descriptionIsKg(description: string): boolean {
  const matches = description.toUpperCase().matchAll(/(?<![A-Z0-9])(\d+(?:[.,]\d+)?\s*)?KG(?![A-Z0-9])/g);
  for (const match of matches) if (!match[1]) return true;
  return false;
}

export function effectiveUnitMeasure(
  row: { unitMeasure: string; description: string },
  catalog?: CatalogUnitInfo | null
): string {
  if (catalog?.unitMeasure === "KG" || catalog?.unitMeasure === "UNID") return catalog.unitMeasure;
  if (row.unitMeasure === "KG") return "KG";
  if (descriptionIsKg(row.description)) return "KG";
  if (catalog?.sector === "Cozinha") return "KG";
  return row.unitMeasure;
}
