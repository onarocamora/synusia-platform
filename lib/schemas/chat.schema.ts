// lib/schemas/chat.schema.ts
import { z } from 'zod';
import { normalizeMissionId, CanonicalMissionId } from '@/lib/constants/domain';

export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, 'El missatge no pot estar buit'),
});

export const ChatRequestBodySchema = z
  .object({
    id_equip: z.string().uuid({ message: 'id_equip ha de ser un UUID vàlid' }),
    id_sessio: z.string().uuid().optional(),
    
    // Normalització canònica estricta (MISION_1 .. MISION_4)
    missio_actual: z
      .union([z.string(), z.number()])
      .default('MISION_1')
      .transform((val): CanonicalMissionId => normalizeMissionId(val)),

    bot_id: z.string().optional().nullable(),
    historial_missatges: z.array(MessageSchema).optional(),
    messages: z.array(MessageSchema).optional(),
    id_template: z.string().optional().nullable(),
    idTemplate: z.string().optional().nullable(),
    moment_a_confidence: z.number().min(1).max(5).nullable().optional(),
    moment_b_certainty: z.number().min(1).max(5).nullable().optional(),
  })
  .refine(
    (data) =>
      (data.historial_missatges && data.historial_missatges.length > 0) ||
      (data.messages && data.messages.length > 0),
    {
      message: "Cal aportar un array d'historial ('messages' o 'historial_missatges') amb almenys un missatge",
    }
  );

// Tipus principals i àlies de compatibilitat
export type Message = z.infer<typeof MessageSchema>;
export type ChatMessage = Message;
export const ChatMessageSchema = MessageSchema;
export type ChatRequestBody = z.infer<typeof ChatRequestBodySchema>;