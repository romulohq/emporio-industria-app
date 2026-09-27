import { z } from "zod";

export const createResponsibleSchema = z.object({
  sector_id: z.string().uuid(),
  role_name: z.string().trim().min(1, "Informe a função"),
  person_name: z.string().trim().min(1, "Informe o nome"),
});

export const updateResponsibleSchema = z.object({
  id: z.string().uuid(),
  role_name: z.string().trim().min(1, "Informe a função"),
  person_name: z.string().trim().min(1, "Informe o nome"),
});

export const responsibleIdSchema = z.object({
  id: z.string().uuid(),
});

export const assignProductResponsibleSchema = z.object({
  product_id: z.string().uuid(),
  responsible_id: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.string().uuid().safeParse(v).success, "ID inválido"),
});

export const saveResponsibleProductsSchema = z.object({
  responsible_id: z.string().uuid(),
  sector_id: z.string().uuid(),
  product_ids: z.array(z.string().uuid()),
});
