import { requireUser } from "@/lib/auth/get-session";
import { PedidosTabs } from "@/components/orders/pedidos-tabs";
import { getTodaySendMonitor, type SendMonitorStatus } from "@/lib/orders/send-monitor";
import { formatBrDate } from "@/lib/dates";
import { WEEKDAY_LABELS, formatTime, formatDateTime } from "@/lib/format/labels";

type MonitorLabelInput = { deadlineTime: string; submittedAt: string | null; carriedOver: boolean };

const STATUS_CONFIG: Record<SendMonitorStatus, { dot: string; label: (e: MonitorLabelInput) => string; card: string }> = {
  on_time: {
    dot: "bg-green-500",
    label: (e) => `Enviado às ${formatTime(e.submittedAt!)}`,
    card: "border-neutral-200 bg-white",
  },
  late: {
    dot: "bg-violet-500",
    label: (e) => `Enviado atrasado, aguardando aprovação · ${formatDateTime(e.submittedAt!)}`,
    card: "border-violet-200 bg-violet-50",
  },
  pending: {
    dot: "bg-neutral-300",
    label: (e) => `Ainda não enviou — prazo até ${e.deadlineTime}`,
    card: "border-neutral-200 bg-white",
  },
  overdue: {
    dot: "bg-orange-400",
    label: (e) =>
      e.carriedOver
        ? `Ainda não enviou — prazo era ontem às ${e.deadlineTime}`
        : `Ainda não enviou — prazo era ${e.deadlineTime}`,
    card: "border-orange-200 bg-orange-50",
  },
};

export default async function PedidosPage() {
  const { profile } = await requireUser();
  const entries = await getTodaySendMonitor();

  const counts = {
    on_time: entries.filter((e) => e.status === "on_time").length,
    late: entries.filter((e) => e.status === "late").length,
    overdue: entries.filter((e) => e.status === "overdue").length,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Pedidos</h1>

      <PedidosTabs isAdmin={profile.is_admin} />

      <div>
        <h2 className="text-lg font-bold text-neutral-900">Envios de hoje</h2>
        <p className="text-sm text-neutral-500">
          Lojas cujo prazo de envio de estoque é hoje, para alguma entrega futura — mais quem ficou
          atrasado ontem e ainda não resolveu.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { value: counts.on_time, label: "No prazo", color: "text-green-600" },
          { value: counts.overdue, label: "Sem enviar", color: "text-orange-500" },
          { value: counts.late, label: "Pedidos enviados atrasados", color: "text-violet-600" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-baseline gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5"
          >
            <span className={`text-lg font-extrabold leading-none ${stat.color}`}>{stat.value}</span>
            <span className="text-xs text-neutral-500">{stat.label}</span>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma loja tem prazo de envio hoje.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {entries.map((entry) => {
            const config = STATUS_CONFIG[entry.status];
            return (
              <div key={`${entry.storeId}:${entry.deliveryDate}`} className={`rounded-lg border px-3 py-2 ${config.card}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${config.dot}`} />
                  <span className="truncate text-sm font-semibold text-neutral-900">{entry.storeName}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-neutral-500">
                    Entrega {WEEKDAY_LABELS[entry.deliveryWeekday]}, {formatBrDate(entry.deliveryDate)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-neutral-600">{config.label(entry)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
