import { z } from "zod";

const line = z
  .object({
    name: z.string().trim().max(80).nullable(),
    subproduct_id: z.string().uuid().nullable(),
    quantity: z.number().positive("A quantidade precisa ser maior que zero.").max(1_000_000),
    unit: z.string().trim().min(1, "Informe a unidade de cada ingrediente.").max(12),
  })
  .refine((l) => (l.name && l.name.length > 0) !== (l.subproduct_id !== null), {
    message: "Cada linha precisa de um insumo ou de um subproduto.",
  });

export const saveRecipeSchema = z
  .object({
    product_id: z.string().uuid().nullable(),
    subproduct_id: z.string().uuid().nullable(),
    yield_quantity: z.number().positive().max(1_000_000).nullable(),
    yield_unit: z.string().trim().max(12),
    instructions: z.string().max(5000),
    items: z.array(line).max(60),
  })
  .refine((r) => (r.product_id === null) !== (r.subproduct_id === null), { message: "Receita sem dono." });

export const createSubproductSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do subproduto.").max(80),
  unit: z.string().trim().min(1).max(12),
});

export const renameSubproductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, "Informe o nome do subproduto.").max(80),
  unit: z.string().trim().min(1).max(12),
});
