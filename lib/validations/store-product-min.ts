import { z } from "zod";

export const storeProductMinRowSchema = z.object({
  product_id: z.string().uuid(),
  min_quantity: z.coerce.number().min(0, "Não pode ser negativo"),
});

export type StoreProductMinRow = z.infer<typeof storeProductMinRowSchema>;
