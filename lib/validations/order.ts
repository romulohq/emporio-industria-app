import { z } from "zod";

export const createOrderSchema = z.object({
  product_id: z.string().uuid("Selecione um produto"),
  quantity: z.coerce.number().positive("Informe uma quantidade maior que zero"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  notes: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  order_id: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
