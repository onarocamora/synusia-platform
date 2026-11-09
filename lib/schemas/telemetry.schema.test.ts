// lib/schemas/telemetry.schema.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeMissionId } from '@/lib/constants/domain';
import { ConfidencePayloadSchema, TelemetryPayloadSchema } from './telemetry.schema';

describe('Domain Normalizers & Schemas', () => {
  describe('normalizeMissionId', () => {
    it('normalizes legacy string formats and numbers to canonical identifiers', () => {
      expect(normalizeMissionId(0)).toBe('MISION_1');
      expect(normalizeMissionId('0')).toBe('MISION_1');
      expect(normalizeMissionId('fase_0')).toBe('MISION_1');
      expect(normalizeMissionId('fase_1')).toBe('MISION_1');
      expect(normalizeMissionId(2)).toBe('MISION_2');
      expect(normalizeMissionId('FASE_3')).toBe('MISION_3');
      expect(normalizeMissionId('MISION_4')).toBe('MISION_4');
      expect(normalizeMissionId(null)).toBe('MISION_1');
    });
  });

  describe('ConfidencePayloadSchema', () => {
    const validBase = {
      id_equip: '123e4567-e89b-12d3-a456-426614174000',
      missio_actual: 'fase_2',
      moment_a_confianca: 4,
      moment_b_seguretat: 5,
      prompts_enviats: 3,
    };

    it('accepts valid input and transforms mission to canonical format', () => {
      const parsed = ConfidencePayloadSchema.safeParse(validBase);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.missio_actual).toBe('MISION_2');
        expect(parsed.data.moment_a_confianca).toBe(4);
      }
    });

    it('rejects invalid UUIDs for id_equip', () => {
      const invalid = { ...validBase, id_equip: 'not-a-uuid' };
      const parsed = ConfidencePayloadSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('rejects confidence ratings outside the 1-5 range', () => {
      const invalidLow = { ...validBase, moment_a_confianca: 0 };
      const invalidHigh = { ...validBase, moment_b_seguretat: 6 };
      expect(ConfidencePayloadSchema.safeParse(invalidLow).success).toBe(false);
      expect(ConfidencePayloadSchema.safeParse(invalidHigh).success).toBe(false);
    });

    it('allows null or omitted confidence values', () => {
      const parsed = ConfidencePayloadSchema.safeParse({
        ...validBase,
        moment_a_confianca: null,
        moment_b_seguretat: undefined,
      });
      expect(parsed.success).toBe(true);
    });
  });

  describe('TelemetryPayloadSchema', () => {
    it('enforces snake_case fields and default fallbacks', () => {
      const parsed = TelemetryPayloadSchema.safeParse({
        actor: 'OPERATOR',
        missio: '1',
        text: 'Proposta de repartiment logístic',
        timestamp: new Date().toISOString(),
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.nom_equip).toBe('Desconegut');
        expect(parsed.data.is_evidence_cited).toBe(false);
        expect(parsed.data.missio).toBe('MISION_1');
      }
    });
  });
});