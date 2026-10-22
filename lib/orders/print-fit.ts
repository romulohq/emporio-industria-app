/**
 * Fitting one sector of the day order on one A4 landscape page (store names turned vertical, row
 * height and type size computed from how many products and stores the sector has).
 */

// printable area of an A4 landscape page with 8 mm margins
const PAGE_WIDTH_MM = 281;
const PAGE_HEIGHT_MM = 194;
// title block of the first page (brand, title, rule) plus the sector heading
const RESERVED_HEIGHT_MM = 36;
const PRODUCT_COLUMN_MM = 50;
const TOTAL_COLUMN_MM = 15;
const MIN_ROW_MM = 3.1;
const MAX_ROW_MM = 7;

export type SectorPrintLayout = {
  /** the sector fits on one page at a readable size */
  fit: boolean;
  rowMm: number;
  fontMm: number;
  headerMm: number;
  storeColumnMm: number;
};

export function sectorPrintLayout(rows: number, stores: number, longestStoreName: number): SectorPrintLayout {
  const safeRows = Math.max(1, rows);
  const storeColumnMm = Math.max(4, (PAGE_WIDTH_MM - PRODUCT_COLUMN_MM - TOTAL_COLUMN_MM) / Math.max(1, stores));
  const provisionalFont = 2.6;
  // store names are printed upright; vertical (rotated) when the columns are too narrow for them
  const headerMm = Math.min(34, Math.max(10, longestStoreName * provisionalFont * 0.55 + 3));
  const available = PAGE_HEIGHT_MM - RESERVED_HEIGHT_MM - headerMm;
  const fitted = available / safeRows;
  const rowMm = Math.min(MAX_ROW_MM, fitted);
  return {
    fit: fitted >= MIN_ROW_MM,
    rowMm: Math.max(rowMm, MIN_ROW_MM),
    fontMm: Math.min(3.1, Math.max(1.9, rowMm * 0.62)),
    headerMm,
    storeColumnMm,
  };
}

/** Print-only CSS for one sector's table; `scope` is the CSS class of the sector section. */
export function sectorPrintCss(scope: string, layout: SectorPrintLayout): string {
  const { fit, rowMm, fontMm, headerMm } = layout;
  const row = `${rowMm.toFixed(2)}mm`;
  const font = `${fontMm.toFixed(2)}mm`;
  const common = `.${scope} table { width: 100%; table-layout: fixed; border-collapse: collapse; }
.${scope} th:first-child, .${scope} td:first-child { width: ${PRODUCT_COLUMN_MM}mm; text-align: left; }
.${scope} th:last-child, .${scope} td:last-child { width: ${TOTAL_COLUMN_MM}mm; }
.${scope} th, .${scope} td { padding: 0 1mm !important; line-height: 1.1 !important; font-size: ${font} !important; }
.${scope} td:first-child { overflow: hidden; white-space: nowrap; text-overflow: clip; }
.${scope} th .store-name { display: block; writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; margin: 0 auto; max-height: ${headerMm.toFixed(1)}mm; }
.${scope} thead tr { height: ${headerMm.toFixed(1)}mm; }`;
  const sizing = fit
    ? `
.${scope} tbody tr { height: ${row}; }
.${scope} { break-inside: avoid; }`
    : `
.${scope} tbody tr { break-inside: avoid; }`;
  return `@media print { ${common}${sizing}
}`;
}
