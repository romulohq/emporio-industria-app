import type { MovementType, OrderPriority, OrderStatus } from "@/lib/types/database.types";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendente",
  in_progress: "Em produção",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const STATUS_ORDER: OrderStatus[] = ["pending", "in_progress", "completed", "cancelled"];

export const PRIORITY_LABELS: Record<OrderPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export const PRIORITY_ORDER: OrderPriority[] = ["low", "medium", "high"];

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  entry: "Entrada",
  exit: "Saída",
  adjustment: "Ajuste",
};

export const MOVEMENT_ORDER: MovementType[] = ["entry", "exit", "adjustment"];

export function formatQuantity(value: number, unit: string) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value)} ${unit}`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
