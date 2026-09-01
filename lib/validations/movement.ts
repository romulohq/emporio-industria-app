import { z } from "zod";

export const createMovementSchema = z.object({
  product_id: z.string().uuid(),
  movement_type: z.enum(["entry", "exit", "adjustment"]),
  quantity: z.coerce.number().refine((v) => v !== 0, "Quantidade não pode ser zero"),
  reason: z.string().trim().min(2, "Informe o motivo da movimentação"),
});

export type CreateMovementInput = z.infer<typeof createMovementSchema>;
