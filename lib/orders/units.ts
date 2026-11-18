/**
 * Os pedidos existem em duas frentes com as mesmas telas: "Pedidos Rui" (produção da Unidade Rui Barbosa:
 * Confeitaria, Pão e Embalagens, dividida por setor) e "Pedidos Osório" (congelados da Fábrica Osório de Paiva,
 * em pacotes, uma lista de produtos sem divisão por setor). Cada tela recebe um destes contextos.
 */
export type OrdersContext = {
  key: "rui" | "osorio";
  /** unidade de produção (production_units.slug) cujas lojas e produtos a tela mostra */
  unitSlug: string;
  /** endereço base das telas desta frente */
  basePath: string;
  title: string;
  /** as ordens são divididas por setor (com responsáveis e impressão por colaborador) */
  bySector: boolean;
  /** endereço do link geral onde a loja escolhe o seu nome para pedir */
  storePickerPath: string;
};

export const RUI_ORDERS: OrdersContext = {
  key: "rui",
  unitSlug: "rui-barbosa",
  basePath: "/pedidos",
  title: "Pedidos Rui",
  bySector: true,
  storePickerPath: "/relatar-estoque",
};

export const OSORIO_ORDERS: OrdersContext = {
  key: "osorio",
  unitSlug: "osorio-de-paiva",
  basePath: "/pedidos-osorio",
  title: "Pedidos Osório",
  bySector: false,
  storePickerPath: "/relatar-estoque/osorio",
};

/** Unidade em que a loja pede: a "unidade do pedido" do produto (ex.: pct) quando houver, senão a unidade dele. */
export function orderUnitOf(product: { unit: string; order_unit?: string | null }): string {
  return product.order_unit?.trim() || product.unit;
}
