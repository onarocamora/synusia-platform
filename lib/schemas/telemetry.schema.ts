// lib/schemas/telemetry.schema.ts
import { z } from 'zod';
import {
  CANONICAL_ACTORS,
  CANONICAL_EVENT_TYPES,
  CANONICAL_HURDLES,
  normalizeMissionId,
} from '@/lib/constants/domain';

export const TelemetryEventTypeSchema = z.enum(CANONICAL_EVENT_TYPES);

export const TelemetryPayloadSchema = z.object({
  actor: z.enum(CANONICAL_ACTORS),
  nom_equip: z.string().default('Desconegut'),
  missio: z
    .union([z.string(), z.number()])
    .transform((val) => normalizeMissionId(val)),
  text: z.string(),
  bot_name: z.string().optional(),
  latency_ms: z.number().int().nonnegative().optional(),
  tokens_used: z.number().int().nonnegative().optional(),
  unlocked_key: z.boolean().optional(),
  moment_a_confidence: z.number().min(1).max(5).nullable().optional(),
  moment_b_certainty: z.number().min(1).max(5).nullable().optional(),
  is_evidence_cited: z.boolean().default(false),
  is_ab_test: z.boolean().default(false),
  prompts_count: z.number().int().nonnegative().default(1),
  hurdle_type: z.enum(CANONICAL_HURDLES).optional(),
  timestamp: z.string(),
});

export const ConfidencePayloadSchema = z.object({
  id_sessio: z.string().uuid().nullable().optional(),
  id_equip: z.string().uuid({ message: 'id_equip must be a valid UUID' }),
  missio_actual: z
    .union([z.string(), z.number()])
    .transform((val) => normalizeMissionId(val)),
  moment_a_confianca: z.number().min(1).max(5).nullable().optional(),
  moment_b_seguretat: z.number().min(1).max(5).nullable().optional(),
  prompts_enviats: z.number().int().nonnegative().default(0),
  timestamp: z.string().optional(),
});

export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;
export type ConfidencePayload = z.infer<typeof ConfidencePayloadSchema>;