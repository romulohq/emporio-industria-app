import { jsPDF } from "jspdf";
import { formatQuantity } from "@/lib/format/labels";
import { slugify } from "@/lib/format/slugify";
import type { SentReport } from "@/app/relatar-estoque/[token]/actions";

const TIME_ZONE = "America/Fortaleza";

const INK: [number, number, number] = [23, 23, 23];
const MUTED: [number, number, number] = [115, 115, 115];
const HAIRLINE: [number, number, number] = [235, 235, 235];
const ACCENT: [number, number, number] = [234, 88, 12];
const TINT: [number, number, number] = [255, 247, 237];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 20;
const ROW_H = 6.4;
const BOTTOM = PAGE_H - 22;

/** "04/10/2026 às 10:28", always in America/Fortaleza regardless of the viewer's device. */
export function formatSentAt(iso: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} às ${get("hour")}:${get("minute")}`;
}

export function stockReportFileName(report: SentReport): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(report.sentAt));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `estoque-${slugify(report.storeName)}-${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}.pdf`;
}

export function buildStockReportPdf(report: SentReport): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const itemCount = report.groups.reduce((sum, g) => sum + g.items.length, 0);

  const text = (value: string, x: number, y: number, opts: { size: number; bold?: boolean; color: [number, number, number]; align?: "left" | "right"; spacing?: number }) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size);
    doc.setTextColor(...opts.color);
    doc.setCharSpace(opts.spacing ?? 0);
    doc.text(value, x, y, { align: opts.align ?? "left" });
    doc.setCharSpace(0);
  };

  const rule = (y: number) => {
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  };

  // header
  text("EMPÓRIO DO PÃO", MARGIN, 22, { size: 8, bold: true, color: ACCENT, spacing: 1.2 });
  text("Relatório de estoque", MARGIN, 37, { size: 24, bold: true, color: INK });
  text(report.storeName, MARGIN, 46, { size: 13, bold: true, color: ACCENT });

  // send date/time and item count, set on a soft tinted band so they read at a glance
  doc.setFillColor(...TINT);
  doc.roundedRect(MARGIN, 53, PAGE_W - MARGIN * 2, 17, 2, 2, "F");
  text("ENVIADO EM", MARGIN + 5, 59, { size: 6.5, bold: true, color: MUTED, spacing: 0.9 });
  text(formatSentAt(report.sentAt), MARGIN + 5, 66, { size: 13, bold: true, color: INK });
  text("ITENS INFORMADOS", PAGE_W - MARGIN - 5, 59, { size: 6.5, bold: true, color: MUTED, align: "right", spacing: 0.9 });
  text(String(itemCount), PAGE_W - MARGIN - 5, 66, { size: 13, bold: true, color: INK, align: "right" });

  let y = 84;
  const continuationHeader = () => {
    text(report.storeName, MARGIN, 18, { size: 8, bold: true, color: MUTED });
    text(`Enviado em ${formatSentAt(report.sentAt)}`, PAGE_W - MARGIN, 18, { size: 8, color: MUTED, align: "right" });
    rule(22);
    y = 34;
  };

  for (const group of report.groups) {
    // keep a section heading together with at least its first rows
    if (y + 10 + ROW_H * 2 > BOTTOM) {
      doc.addPage();
      continuationHeader();
    }
    text(group.sectorName.toUpperCase(), MARGIN, y, { size: 7.5, bold: true, color: MUTED, spacing: 1 });
    y += 4;
    rule(y);

    for (const item of group.items) {
      if (y + ROW_H > BOTTOM) {
        doc.addPage();
        continuationHeader();
        text(`${group.sectorName.toUpperCase()} (continuação)`, MARGIN, y, { size: 7.5, bold: true, color: MUTED, spacing: 1 });
        y += 4;
        rule(y);
      }
      const baseline = y + ROW_H - 2;
      text(item.name, MARGIN, baseline, { size: 9.5, color: INK });
      text(formatQuantity(item.quantity, item.unit), PAGE_W - MARGIN, baseline, {
        size: 9.5,
        bold: true,
        color: INK,
        align: "right",
      });
      y += ROW_H;
      rule(y);
    }
    y += 10;
  }

  // footer on every page
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    text("Empório do Pão · Relatório gerado automaticamente", MARGIN, PAGE_H - 12, { size: 7, color: MUTED });
    text(`Página ${page} de ${pages}`, PAGE_W - MARGIN, PAGE_H - 12, { size: 7, color: MUTED, align: "right" });
  }

  return doc;
}
