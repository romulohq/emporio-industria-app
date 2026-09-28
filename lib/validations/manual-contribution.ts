import { z } from "zod";

export const manualContributionSchema = z.object({
  order_id: z.string().uuid(),
  store_id: z.string().uuid(),
  report_id: z.string().uuid(),
});

export const clearContributionSchema = z.object({
  order_id: z.string().uuid(),
  store_id: z.string().uuid(),
});

export const lateReportIdSchema = z.object({
  report_id: z.string().uuid(),
});

export const keepCurrentOrderSchema = z.object({
  sector_id: z.string().uuid(),
  delivery_date: z.string().min(1),
  report_ids: z.array(z.string().uuid()).min(1),
});

export const regenerateWithLateReportsSchema = z.object({
  sector_id: z.string().uuid(),
  delivery_date: z.string().min(1),
  include_report_ids: z.array(z.string().uuid()),
  exclude_report_ids: z.array(z.string().uuid()),
});
