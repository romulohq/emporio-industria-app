import type {
  DeliveryPeriod,
  MovementType,
  OrderPriority,
  OrderStatus,
  Weekday,
} from "@/lib/types/database.types";

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

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

export const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  monday: "Seg",
  tuesday: "Ter",
  wednesday: "Qua",
  thursday: "Qui",
  friday: "Sex",
  saturday: "Sáb",
  sunday: "Dom",
};

export const WEEKDAY_ORDER: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const PERIOD_LABELS: Record<DeliveryPeriod, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
};

export const PERIOD_ORDER: DeliveryPeriod[] = ["morning", "afternoon"];

export function formatQuantity(value: number, unit: string) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value)} ${unit}`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date(value));
}
