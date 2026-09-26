import { z } from "zod";

export const createRouteSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da rota"),
  unit_id: z.string().uuid("Selecione uma unidade"),
});

export type CreateRouteInput = z.infer<typeof createRouteSchema>;
