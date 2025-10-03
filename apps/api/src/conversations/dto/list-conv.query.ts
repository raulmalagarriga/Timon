import { z } from 'zod';

export const ListConvQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum([
    'nuevo','pendiente','atendiendo','pendiente_pago','completado','cerrado','en_espera_cliente'
  ]).optional(),
  assigneeId: z.string().uuid().optional(),
  take: z.string().transform(v => parseInt(v, 10)).optional(),
  cursor: z.string().uuid().optional(),
});

export type ListConvQuery = z.infer<typeof ListConvQuerySchema>;
