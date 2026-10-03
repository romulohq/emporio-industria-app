import { requireUser } from "@/lib/auth/get-session";
import { PedidosTabs } from "@/components/orders/pedidos-tabs";
import { getTodaySendMonitor, type SendMonitorStatus } from "@/lib/orders/send-monitor";
import { formatBrDate } from "@/lib/dates";
import { WEEKDAY_LABELS, formatTime } from "@/lib/format/labels";

type MonitorLabelInput = { deadlineTime: string; submittedAt: string | null; carriedOver: boolean };

const STATUS_CONFIG: Record<SendMonitorStatus, { dot: string; label: (e: MonitorLabelInput) => string; card: string }> = {
  on_time: {
    dot: "bg-green-500",
    label: (e) => `Enviado às ${formatTime(e.submittedAt!)}`,
    card: "border-neutral-200 bg-white",
  },
  late: {
    dot: "bg-amber-500",
    label: (e) =>
      e.carriedOver
        ? `Enviado atrasado (de ontem), às ${formatTime(e.submittedAt!)}`
        : `Enviado atrasado, às ${formatTime(e.submittedAt!)}`,
    card: "border-amber-200 bg-amber-50",
  },
  pending: {
    dot: "bg-neutral-300",
    label: (e) => `Ainda não enviou — prazo até ${e.deadlineTime}`,
    card: "border-neutral-200 bg-white",
  },
  overdue: {
    dot: "bg-red-500",
    label: (e) =>
      e.carriedOver
        ? `Ainda não enviou — prazo era ontem às ${e.deadlineTime}`
        : `Ainda não enviou — prazo era ${e.deadlineTime}`,
    card: "border-red-200 bg-red-50",
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-2xl font-extrabold text-green-600">{counts.on_time}</p>
          <p className="text-xs text-neutral-500">No prazo</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-2xl font-extrabold text-red-600">{counts.overdue}</p>
          <p className="text-xs text-neutral-500">Sem enviar (atrasado)</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-2xl font-extrabold text-amber-600">{counts.late}</p>
          <p className="text-xs text-neutral-500">Pedidos enviados atrasados</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma loja tem prazo de envio hoje.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => {
            const config = STATUS_CONFIG[entry.status];
            return (
              <div key={`${entry.storeId}:${entry.deliveryDate}`} className={`rounded-lg border p-3 ${config.card}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${config.dot}`} />
                  <span className="font-semibold text-neutral-900">{entry.storeName}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Entrega: {WEEKDAY_LABELS[entry.deliveryWeekday]}, {formatBrDate(entry.deliveryDate)}
                </p>
                <p className="mt-1 text-sm text-neutral-700">{config.label(entry)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
