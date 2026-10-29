/** Quem está com o cronograma aberto e em qual célula: a cor e o nome que cada pessoa tem na tela dos outros. */

export type Collaborator = {
  /** cada aba aberta tem a sua: quem usa duas abas aparece nas duas, como no Google Planilhas */
  tab: string;
  userId: string;
  name: string;
  color: string;
  /** "itemId:weekday" da célula selecionada, ou null */
  cell: string | null;
  /** está digitando nas observações */
  notes: boolean;
};

// todas com contraste suficiente para texto branco
export const PRESENCE_COLORS = [
  "#e11d48",
  "#2563eb",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
] as const;

/** A mesma pessoa tem sempre a mesma cor, em qualquer tela. */
export function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}

export function firstName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || "Alguém";
}

/** Todas as abas abertas, menos esta. */
export function otherTabs(all: Collaborator[], myTab: string): Collaborator[] {
  return all.filter((c) => c.tab !== myTab);
}

/** Uma entrada por pessoa (quem tem duas abas aparece uma vez nas bolinhas do topo). */
export function uniqueUsers(collaborators: Collaborator[]): Collaborator[] {
  const byUser = new Map<string, Collaborator>();
  for (const c of collaborators) if (!byUser.has(c.userId)) byUser.set(c.userId, c);
  return [...byUser.values()];
}

export function groupByCell(collaborators: Collaborator[]): Map<string, Collaborator[]> {
  const map = new Map<string, Collaborator[]>();
  for (const c of collaborators) {
    if (!c.cell) continue;
    map.set(c.cell, [...(map.get(c.cell) ?? []), c]);
  }
  return map;
}
