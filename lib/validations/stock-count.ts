import { z } from "zod";

export const stockCountEntrySchema = z.object({
  product_id: z.string().uuid(),
  boxes: z.number().min(0).max(1_000_000),
});

export const saveStockCountSchema = z.object({
  count_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(stockCountEntrySchema).min(1),
});
