// lib/services/telemetry.service.ts
import { supabaseAdmin } from '@/lib/supabase';
import { TelemetryPayloadSchema } from '@/lib/schemas/telemetry.schema';
import {
  CanonicalMissionId,
  CanonicalHurdleType,
  CanonicalMomentType,
} from '@/lib/constants/domain';

export class TelemetryService {
  /**
   * Registra un obstacle o bloqueig d'entrada (Jailbreak, missatge vague, seguretat)
   */
  static async logHurdle(params: {
    idSessio: string | null;
    idEquip: string;
    nomEquip: string;
    missio: CanonicalMissionId;
    hurdleType: CanonicalHurdleType;
    text: string;
    organizationId?: string | null;
  }) {
    try {
      await supabaseAdmin.from('telemetry_logs').insert([
        {
          id_sessio: params.idSessio,
          id_equip: params.idEquip,
          tipo_evento: 'HURDLE_TRIGGERED',
          metrics_payload: {
            actor: 'OPERATOR',
            nom_equip: params.nomEquip,
            missio: params.missio,
            hurdle_type: params.hurdleType,
            text: params.text,
            organization_id: params.organizationId ?? null,
            timestamp: new Date().toISOString(),
          },
        },
      ]);
    } catch (err) {
      console.error('Error logHurdle:', err);
    }
  }

  /**
   * Registra el torn de l'operador a telemetry_logs i a logs_interaccio
   */
  static async logUserPrompt(params: {
    idSessio: string | null;
    idEquip: string;
    nomEquip: string;
    missio: CanonicalMissionId;
    text: string;
    promptsCount: number;
    isEvidenceCited: boolean;
    isAbTest: boolean;
    organizationId?: string | null;
  }) {
    try {
      const parsedPayload = TelemetryPayloadSchema.parse({
        actor: 'OPERATOR',
        nom_equip: params.nomEquip,
        missio: params.missio,
        text: params.text,
        prompts_count: params.promptsCount,
        is_evidence_cited: params.isEvidenceCited,
        is_ab_test: params.isAbTest,
        timestamp: new Date().toISOString(),
      });

      const metricsPayload = {
        ...parsedPayload,
        organization_id: params.organizationId ?? null,
      };

      await Promise.all([
        supabaseAdmin.from('telemetry_logs').insert([
          {
            id_sessio: params.idSessio,
            id_equip: params.idEquip,
            tipo_evento: 'PROMPT_SUBMISSION',
            metrics_payload: metricsPayload,
          },
        ]),
        supabaseAdmin.from('logs_interaccio').insert([
          {
            id_equip: params.idEquip,
            id_missio: params.missio,
            actor: 'USER',
            text: params.text,
            tokens_consumits: 0,
            is_evidence_cited: params.isEvidenceCited,
            is_ab_test: params.isAbTest,
          },
        ]),
      ]);
    } catch (err) {
      console.error('Error logUserPrompt:', err);
    }
  }

  /**
   * Registra la resposta de l'agent a telemetry_logs i logs_interaccio
   */
  static async logBotResponse(params: {
    idSessio: string | null;
    idEquip: string;
    nomEquip: string;
    missio: CanonicalMissionId;
    botName: string;
    text: string;
    latencyMs: number;
    tokensUsed: number;
    hasVictoryKey: boolean;
    promptsCount: number;
    isEvidenceCited: boolean;
    isAbTest: boolean;
    momentAConfidence?: number | null;
    momentBCertainty?: number | null;
    organizationId?: string | null;
  }) {
    try {
      const parsedPayload = TelemetryPayloadSchema.parse({
        actor: 'IA_BOT',
        bot_name: params.botName,
        nom_equip: params.nomEquip,
        missio: params.missio,
        text: params.text,
        latency_ms: params.latencyMs,
        tokens_used: params.tokensUsed,
        unlocked_key: params.hasVictoryKey,
        moment_a_confidence: params.momentAConfidence ?? null,
        moment_b_certainty: params.momentBCertainty ?? null,
        is_evidence_cited: params.isEvidenceCited,
        is_ab_test: params.isAbTest,
        prompts_count: params.promptsCount,
        timestamp: new Date().toISOString(),
      });

      const metricsPayload = {
        ...parsedPayload,
        organization_id: params.organizationId ?? null,
      };

      await Promise.all([
        supabaseAdmin.from('telemetry_logs').insert([
          {
            id_sessio: params.idSessio,
            id_equip: params.idEquip,
            tipo_evento: params.hasVictoryKey ? 'MILESTONE_COMPLETED' : 'RESPOSTA_IA',
            metrics_payload: metricsPayload,
          },
        ]),
        supabaseAdmin.from('logs_interaccio').insert([
          {
            id_equip: params.idEquip,
            id_missio: params.missio,
            actor: 'IA_BOT',
            text: params.text,
            tokens_consumits: params.tokensUsed,
          },
        ]),
      ]);
    } catch (err) {
      console.error('Error logBotResponse:', err);
    }
  }

  /**
   * Registra una intervenció de bastida socràtica davant d'estancament cognitiu
   */
  static async logScaffolding(params: {
    idSessio: string | null;
    idEquip: string;
    nomEquip: string;
    missio: CanonicalMissionId;
    promptsCount: number;
    scaffoldingPrompt: string;
    organizationId?: string | null;
  }) {
    try {
      await supabaseAdmin.from('telemetry_logs').insert([
        {
          id_sessio: params.idSessio,
          id_equip: params.idEquip,
          tipo_evento: 'SCAFFOLDING_TRIGGERED',
          metrics_payload: {
            actor: 'SYSTEM',
            nom_equip: params.nomEquip,
            missio: params.missio,
            prompts_count: params.promptsCount,
            intervention_type: 'SOCRATIC_PROBE',
            details: params.scaffoldingPrompt,
            organization_id: params.organizationId ?? null,
            timestamp: new Date().toISOString(),
          },
        },
      ]);
    } catch (err) {
      console.error('Error logScaffolding:', err);
    }
  }

  /**
   * Registra una valoració a la sonda de confiança (Moment A o Moment B)
   */
  static async logConfidenceProbe(params: {
    idSessio: string | null;
    idEquip: string;
    nomEquip: string;
    missio: CanonicalMissionId;
    momentType: CanonicalMomentType;
    score: number;
    organizationId?: string | null;
  }) {
    try {
      await supabaseAdmin.from('telemetry_logs').insert([
        {
          id_sessio: params.idSessio,
          id_equip: params.idEquip,
          tipo_evento: 'CONFIDENCE_PROBE',
          metrics_payload: {
            actor: 'OPERATOR',
            nom_equip: params.nomEquip,
            missio: params.missio,
            moment_type: params.momentType,
            score: params.score,
            organization_id: params.organizationId ?? null,
            timestamp: new Date().toISOString(),
          },
        },
      ]);
    } catch (err) {
      console.error('Error logConfidenceProbe:', err);
    }
  }

  /**
   * Actualitza el progrés de la fase quan s'ha assolit legítimament
   */
  static async completePhaseIfWon(params: {
    idSessio: string | null;
    idEquip: string;
    missio: CanonicalMissionId;
    promptsCount: number;
    momentAConfidence?: number | null;
    momentBCertainty?: number | null;
  }) {
    try {
      await Promise.all([
        supabaseAdmin
          .from('phase_analytics')
          .update({ is_completed: true, actualitzat_el: new Date().toISOString() })
          .eq('id_equip', params.idEquip)
          .eq('id_missio', params.missio),

        supabaseAdmin.from('pilot_evaluation_metrics').upsert(
          {
            id_sessio: params.idSessio,
            id_equip: params.idEquip,
            fase_id: params.missio,
            moment_a_confianca: params.momentAConfidence ? Number(params.momentAConfidence) : null,
            moment_b_seguretat: params.momentBCertainty ? Number(params.momentBCertainty) : null,
            prompts_enviats: params.promptsCount,
            completat_el: new Date().toISOString(),
          },
          { onConflict: 'id_equip,fase_id' }
        ),
      ]);
    } catch (err) {
      console.error('Error completePhaseIfWon:', err);
    }
  }
}