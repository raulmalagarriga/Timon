import { z } from 'zod';

export const UpdateEmployeeSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(1).max(32).optional(),
  phone: z.string().min(6).max(30).optional(),
  notes: z.string().max(500).optional(),
  active: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export type UpdateEmployeeDto = z.infer<typeof UpdateEmployeeSchema>;
