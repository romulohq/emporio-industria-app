import { describe, expect, it } from "vitest";
import { groupLateReportsByStore } from "@/lib/orders/group-late-by-store";

const row = (reportId: string, storeId: string, storeName: string, sectorId: string, deliveryDate: string, createdAt: string) => ({
  reportId, storeId, storeName, sectorId, deliveryDate, createdAt,
});

describe("groupLateReportsByStore", () => {
  it("collapses a store's many product rows (and sectors) into one entry", () => {
    const groups = groupLateReportsByStore([
      row("r1", "m", "Mondubim", "conf", "2026-10-05", "2026-10-03T23:18:00Z"),
      row("r2", "m", "Mondubim", "conf", "2026-10-05", "2026-10-03T23:18:00Z"),
      row("r3", "m", "Mondubim", "pao", "2026-10-05", "2026-10-03T23:18:05Z"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].reportIds).toEqual(["r1", "r2", "r3"]);
    expect(groups[0].sentAt).toBe("2026-10-03T23:18:00Z");
  });

  it("keeps different stores and delivery dates apart, sorted by date then name", () => {
    const groups = groupLateReportsByStore([
      row("a", "s2", "Passaré", "conf", "2026-10-06", "2026-10-04T10:00:00Z"),
      row("b", "s1", "Mondubim", "conf", "2026-10-05", "2026-10-03T10:00:00Z"),
      row("c", "s3", "Kennedy", "conf", "2026-10-05", "2026-10-03T11:00:00Z"),
    ]);
    expect(groups.map((g) => `${g.deliveryDate} ${g.storeName}`)).toEqual([
      "2026-10-05 Kennedy",
      "2026-10-05 Mondubim",
      "2026-10-06 Passaré",
    ]);
  });
});
