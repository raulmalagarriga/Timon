import { z } from 'zod';

export const SendMessageSchema = z.object({
  type: z.enum(['text','image','document','audio','template']),
  text: z.string().min(1).max(4000).optional(),  // requerido si type='text'
  mediaUrl: z.string().url().optional(),         // para image/document/audio
  template: z.object({
    name: z.string(),
    language: z.string().default('es'),
    components: z.any().optional()
  }).optional()
});

export type SendMessageDto = z.infer<typeof SendMessageSchema>;
