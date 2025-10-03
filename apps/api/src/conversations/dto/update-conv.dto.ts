import { z } from 'zod';

export const UpdateConvSchema = z.object({
  status: z.enum([
    'nuevo','pendiente','atendiendo','pendiente_pago','completado','cerrado','en_espera_cliente'
  ]).optional(),
  assigneeId: z.string().uuid().nullable().optional(),   // null = desasignar
  labelIds: z.array(z.string().uuid()).optional(),       // reemplaza set completo
  note: z.string().max(1000).optional()                  // nota interna (opcional)
});

export type UpdateConvDto = z.infer<typeof UpdateConvSchema>;
