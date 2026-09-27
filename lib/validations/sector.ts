import { z } from "zod";

export const updateSectorResponsibleSchema = z.object({
  id: z.string().uuid(),
  responsible_name: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
});
