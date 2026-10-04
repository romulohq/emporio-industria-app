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

export const lateStoreSchema = z.object({
  store_id: z.string().uuid(),
  delivery_date: z.string().min(1),
});
