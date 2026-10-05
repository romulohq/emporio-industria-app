export type CycleReportLike = {
  id: string;
  created_at: string;
  late_for_order_id: string | null;
  late_acknowledged: boolean;
};

export type SendClassification = { state: "on_time" | "late" | "refused"; sentAt: number } | null;

/**
 * How a store's reports for ONE delivery count, given that delivery's send deadline:
 * on time > waiting for approval > approved > refused > nothing to approve.
 * "late" means a report arrived after the deadline and an admin hasn't decided yet; once it is
 * approved (the order was updated with it) it counts like on time, and once refused it counts as
 * not sent. Reports that arrived late but changed nothing (never flagged) count as sent.
 * `sentAt` is the earliest report of the winning kind. Null when there are no reports.
 */
export function classifyCycleReports(
  reports: CycleReportLike[],
  deadlineMs: number,
  lastDecisionByReport: Map<string, string>
): SendClassification {
  const earliest = { inTime: Infinity, awaiting: Infinity, approved: Infinity, refused: Infinity, auto: Infinity };
  for (const r of reports) {
    const sentAt = new Date(r.created_at).getTime();
    const kind =
      sentAt <= deadlineMs
        ? "inTime"
        : r.late_for_order_id === null
          ? "auto"
          : !r.late_acknowledged
            ? "awaiting"
            : lastDecisionByReport.get(r.id) === "kept"
              ? "refused"
              : "approved";
    earliest[kind] = Math.min(earliest[kind], sentAt);
  }

  if (earliest.inTime < Infinity) return { state: "on_time", sentAt: earliest.inTime };
  if (earliest.awaiting < Infinity) return { state: "late", sentAt: earliest.awaiting };
  if (earliest.approved < Infinity) return { state: "on_time", sentAt: earliest.approved };
  if (earliest.refused < Infinity) return { state: "refused", sentAt: earliest.refused };
  if (earliest.auto < Infinity) return { state: "on_time", sentAt: earliest.auto };
  return null;
}
