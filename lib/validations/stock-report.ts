import { z } from "zod";

export const stockReportRowSchema = z.object({
  product_id: z.string().uuid(),
  quantity_reported: z.coerce.number().min(0, "Não pode ser negativo"),
});

export type StockReportRow = z.infer<typeof stockReportRowSchema>;
