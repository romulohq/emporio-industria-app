import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
    confirmPassword: z.string().min(6, "Confirme a nova senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
