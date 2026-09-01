import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  full_name: z.string().trim().min(2, "Informe o nome"),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
  is_admin: z.coerce.boolean().default(false),
  sector_ids: z.array(z.string().uuid()).default([]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSectorsSchema = z.object({
  user_id: z.string().uuid(),
  is_admin: z.coerce.boolean(),
  sector_ids: z.array(z.string().uuid()).default([]),
});

export type UpdateUserSectorsInput = z.infer<typeof updateUserSectorsSchema>;
