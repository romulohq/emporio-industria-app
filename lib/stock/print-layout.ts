/**
 * Fitting the "Estoque da câmara" printout on one A4 portrait page: the row height is computed from how
 * many products and sectors there are, so the report fills the whole sheet instead of stopping halfway.
 */

// printable height of an A4 portrait page with 8 mm margins
const PAGE_HEIGHT_MM = 281;
// title block (brand, title, rule), legend line and a safety margin so the report never spills to a 2nd page
const TITLE_MM = 17;
const LEGEND_MM = 8;
const SAFETY_MM = 10;

const SECTION_HEADER_MM = 5;
const SECTION_GAP_MM = 2.5;

const MIN_ROW_MM = 3.2;
const MAX_ROW_MM = 9;

export type StockPrintLayout = {
  rowMm: number;
  fontMm: number;
  barMm: number;
  sectionHeaderMm: number;
  sectionGapMm: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Rows are laid out in two balanced columns; one column may end up half a row and half a header taller. */
export function stockPrintLayout(rowCount: number, sectionCount: number): StockPrintLayout {
  const available = PAGE_HEIGHT_MM - TITLE_MM - LEGEND_MM - SAFETY_MM;
  const sections = sectionCount * (SECTION_HEADER_MM + SECTION_GAP_MM);
  const rowMm = clamp((2 * available - sections - SECTION_HEADER_MM) / (Math.max(1, rowCount) + 1), MIN_ROW_MM, MAX_ROW_MM);
  return {
    rowMm,
    fontMm: clamp(rowMm * 0.45, 2.4, 3),
    barMm: clamp(rowMm * 0.4, 2.2, 3.4),
    sectionHeaderMm: SECTION_HEADER_MM,
    sectionGapMm: SECTION_GAP_MM,
  };
}

/** Height of the taller of the two columns for a given layout (worst case of the balancing), in mm. */
export function tallestColumnMm(layout: StockPrintLayout, rowCount: number, sectionCount: number): number {
  const total = rowCount * layout.rowMm + sectionCount * (layout.sectionHeaderMm + layout.sectionGapMm);
  return total / 2 + layout.rowMm / 2 + layout.sectionHeaderMm / 2;
}
