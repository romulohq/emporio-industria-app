export type LateReportLike = {
  reportId: string;
  storeId: string;
  storeName: string;
  sectorId: string;
  deliveryDate: string;
  createdAt: string;
};

export type LateStoreGroup = {
  storeId: string;
  storeName: string;
  deliveryDate: string;
  reportIds: string[];
  /** when the store's late order arrived (its earliest late report) */
  sentAt: string;
};

/** One entry per store and delivery date, however many products/sectors its late order spans. */
export function groupLateReportsByStore(rows: LateReportLike[]): LateStoreGroup[] {
  const groups = new Map<string, LateStoreGroup>();
  for (const row of rows) {
    const key = `${row.storeId}:${row.deliveryDate}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        storeId: row.storeId,
        storeName: row.storeName,
        deliveryDate: row.deliveryDate,
        reportIds: [row.reportId],
        sentAt: row.createdAt,
      });
      continue;
    }
    group.reportIds.push(row.reportId);
    if (row.createdAt < group.sentAt) group.sentAt = row.createdAt;
  }
  return [...groups.values()].sort(
    (a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.storeName.localeCompare(b.storeName)
  );
}
