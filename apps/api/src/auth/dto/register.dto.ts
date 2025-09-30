import { z } from 'zod';

export const RegisterSchema = z.object({
  businessName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(10) // ajusta tu política
    .regex(/[A-Z]/, 'Debe incluir al menos 1 mayúscula')
    .regex(/[0-9]/, 'Debe incluir al menos 1 número')
    .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos 1 símbolo'),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
