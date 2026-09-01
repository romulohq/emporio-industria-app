import { z } from "zod";

export const createStoreSchema = z.object({
  route_id: z.string().uuid("Selecione uma rota"),
  name: z.string().trim().min(2, "Informe o nome da loja"),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;

export const updateStoreSchema = z.object({
  id: z.string().uuid(),
  route_id: z.string().uuid("Selecione uma rota"),
  name: z.string().trim().min(2, "Informe o nome da loja"),
  active: z.coerce.boolean(),
});

export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
