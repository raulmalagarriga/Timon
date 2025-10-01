import { z } from 'zod';

export const CreateEmployeeSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(1).max(32).optional(),
  phone: z.string().min(6).max(30).optional(),
  notes: z.string().max(500).optional(),
  active: z.boolean().optional().default(true),
  position: z.number().int().min(0).optional(), // para ordenar RR manualmente
});

export type CreateEmployeeDto = z.infer<typeof CreateEmployeeSchema>;
