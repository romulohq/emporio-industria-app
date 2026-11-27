/**
 * Folha de contagem da câmara (A4 em pé): a altura das linhas e o tamanho da letra são calculados pela
 * quantidade de produtos e de setores, para a lista ocupar a folha toda e deixar, no fim, o espaço fixo
 * de "Produtos para empacotar" — sem sobrar um vazio no meio da página.
 */

// altura útil de uma A4 em pé com margem de 10 mm
const PAGE_BODY_MM = 277;
// cabeçalho (logo, título e linha), campos de data e responsável, bloco de anotações e uma folga de segurança
const HEADER_MM = 12.5;
const FIELDS_MM = 11;
const NOTES_TITLE_MM = 6.5;
/** altura do cartão livre de "Produtos para empacotar" */
export const NOTES_CARD_MM = 19;
const NOTES_GAP_MM = 4;
const SAFETY_MM = 2;

/** altura sobrando para a lista de produtos */
export const LIST_AVAILABLE_MM = PAGE_BODY_MM - HEADER_MM - FIELDS_MM - NOTES_GAP_MM - NOTES_TITLE_MM - NOTES_CARD_MM - SAFETY_MM;

/** altura da página inteira, para o bloco de anotações ficar sempre colado no fim */
export const PAGE_MIN_HEIGHT_MM = PAGE_BODY_MM - 2;

const SECTION_HEADER_MM = 5;
const SECTION_GAP_MM = 2;

const MIN_ROW_MM = 3.4;
const MAX_ROW_MM = 7;

export type CountSheetLayout = {
  rowMm: number;
  fontMm: number;
  sectionHeaderMm: number;
  sectionGapMm: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A lista corre em duas colunas equilibradas; uma delas pode ficar meia linha e meio título mais alta. */
export function countSheetLayout(rowCount: number, sectionCount: number): CountSheetLayout {
  const sections = sectionCount * (SECTION_HEADER_MM + SECTION_GAP_MM);
  const rowMm = clamp((2 * LIST_AVAILABLE_MM - sections - SECTION_HEADER_MM) / (Math.max(1, rowCount) + 1), MIN_ROW_MM, MAX_ROW_MM);
  return {
    rowMm,
    fontMm: clamp(rowMm * 0.52, 2.2, 3.2),
    sectionHeaderMm: SECTION_HEADER_MM,
    sectionGapMm: SECTION_GAP_MM,
  };
}

/** Altura da mais alta das duas colunas para um encaixe (pior caso do equilíbrio), em mm. */
export function tallestColumnMm(layout: CountSheetLayout, rowCount: number, sectionCount: number): number {
  const total = rowCount * layout.rowMm + sectionCount * (layout.sectionHeaderMm + layout.sectionGapMm);
  return total / 2 + layout.rowMm / 2 + layout.sectionHeaderMm / 2;
}
