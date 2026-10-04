import { describe, expect, it } from "vitest";
import { buildStockReportPdf, formatSentAt, stockReportFileName } from "@/lib/pdf/stock-report-pdf";
import type { SentReport } from "@/app/relatar-estoque/[token]/actions";

const item = (n: number) => ({ name: `PRODUTO ${n}`, unit: "und", quantity: n });

const report = (counts: number[]): SentReport => ({
  storeName: "Guará Jacarecanga",
  // 2026-10-04 13:28 UTC = 10:28 in Fortaleza
  sentAt: "2026-10-04T13:28:00Z",
  groups: counts.map((count, i) => ({
    sectorName: ["Pão", "Confeitaria", "Embalagens"][i] ?? `Setor ${i}`,
    items: Array.from({ length: count }, (_, k) => item(k + 1)),
  })),
});

describe("stock report pdf", () => {
  it("formats the send time in America/Fortaleza, not UTC", () => {
    expect(formatSentAt("2026-10-04T13:28:00Z")).toBe("04/10/2026 às 10:28");
    expect(formatSentAt("2026-10-05T02:30:00Z")).toBe("04/10/2026 às 23:30");
  });

  it("names the file after the store and the local send time", () => {
    expect(stockReportFileName(report([1]))).toBe("estoque-guara-jacarecanga-20261004-1028.pdf");
  });

  it("builds a valid single-page pdf for a small report", () => {
    const doc = buildStockReportPdf(report([3, 2]));
    expect(doc.getNumberOfPages()).toBe(1);
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("paginates a full report (69 items) across pages", () => {
    const doc = buildStockReportPdf(report([12, 29, 28]));
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
