/**
 * Rendimento automático: quando a ficha não tem rendimento digitado, vale a soma dos ingredientes.
 * Pesos entram em kg (g ÷ 1000) e volumes em litros (mL ÷ 1000), com 1 L contando como 1 kg; itens em
 * unidade, pacote ou caixa não têm como entrar na soma e ficam de fora (o aviso conta quantos foram).
 */

const TO_KG: Record<string, number> = { kg: 1, g: 0.001, l: 1, ml: 0.001 };

export type AutoYield = { quantity: number; unit: "kg"; ignored: number };

export function autoYield(lines: { quantity: number; unit: string }[]): AutoYield | null {
  let total = 0;
  let counted = 0;
  let ignored = 0;
  for (const line of lines) {
    const factor = TO_KG[line.unit.trim().toLowerCase()];
    if (factor === undefined || !(line.quantity > 0)) {
      ignored += 1;
      continue;
    }
    total += line.quantity * factor;
    counted += 1;
  }
  if (counted === 0) return null;
  return { quantity: Math.round(total * 1000) / 1000, unit: "kg", ignored };
}
