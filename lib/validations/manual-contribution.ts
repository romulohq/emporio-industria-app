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
