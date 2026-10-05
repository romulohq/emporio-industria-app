import { z } from "zod";

export const productSchema = z.object({
  sector_id: z.string().uuid("Selecione um setor"),
  name: z.string().trim().min(2, "Informe o nome do produto"),
  sku: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  unit: z.string().trim().min(1, "Informe a unidade").default("und"),
  min_quantity: z.coerce.number().min(0, "Não pode ser negativo"),
  units_per_box: z.coerce.number().positive("Informe um valor maior que zero").default(1),
  current_quantity: z.coerce.number().min(0, "Não pode ser negativo").optional(),
  production_group: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
    }),
});

export type ProductInput = z.infer<typeof productSchema>;
