/** Equipe do cronograma: cores das pessoas, iniciais e a carga de tarefas por dia. */

export type GridCook = { id: string; section: string; name: string; color: string };

// todas com contraste suficiente para texto branco; a primeira ainda livre do setor vai para a próxima pessoa
export const COOK_COLORS = [
  "#1e40af",
  "#7e22ce",
  "#ea580c",
  "#15803d",
  "#be123c",
  "#0f766e",
  "#a16207",
  "#475569",
] as const;

/** A primeira cor da lista que ninguém do setor usa; se todas estão em uso, recomeça pela lista. */
export function nextCookColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()));
  return COOK_COLORS.find((c) => !taken.has(c)) ?? COOK_COLORS[used.length % COOK_COLORS.length];
}

export const cookInitial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

/**
 * Quantas tarefas cada pessoa tem em cada dia: só conta marcações que existem (têm texto), e só de quem
 * ainda está na equipe. Chave do resultado: "pessoa:dia".
 */
export function cookLoad(
  cells: Record<string, string>,
  cellCooks: Record<string, string[]>,
  itemIds: Set<string>
): Map<string, number> {
  const load = new Map<string, number>();
  for (const [key, label] of Object.entries(cells)) {
    if (!label) continue;
    const [itemId, weekday] = key.split(":");
    if (!itemIds.has(itemId)) continue;
    for (const cookId of new Set(cellCooks[key] ?? [])) {
      const k = `${cookId}:${weekday}`;
      load.set(k, (load.get(k) ?? 0) + 1);
    }
  }
  return load;
}
