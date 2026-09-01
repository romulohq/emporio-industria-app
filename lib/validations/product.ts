import { z } from "zod";

export const productSchema = z.object({
  sector_id: z.string().uuid("Selecione um setor"),
  name: z.string().trim().min(2, "Informe o nome do produto"),
  sku: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  unit: z.string().trim().min(1, "Informe a unidade").default("un"),
  min_quantity: z.coerce.number().min(0, "Não pode ser negativo"),
  current_quantity: z.coerce.number().min(0, "Não pode ser negativo").optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
