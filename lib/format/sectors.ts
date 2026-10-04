/** Fixed display order of the Rui Barbosa sectors; any other sector follows alphabetically. */
export const SECTOR_DISPLAY_ORDER = ["Pão", "Confeitaria", "Embalagens"];

export function sectorRank(name: string): number {
  const index = SECTOR_DISPLAY_ORDER.indexOf(name);
  return index === -1 ? SECTOR_DISPLAY_ORDER.length : index;
}

export function compareSectorNames(a: string, b: string): number {
  return sectorRank(a) - sectorRank(b) || a.localeCompare(b);
}
