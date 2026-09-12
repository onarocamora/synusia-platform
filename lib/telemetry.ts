import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Tipus d'esdeveniments dominis de l'aplicació (Ampliat amb mètriques FARO V3)
export type ApplicationEventType =
    | 'PROMPT_SUBMISSION'
    | 'VAGUE_REJECTION'
    | 'KEY_ATTEMPT_SUCCESS'
    | 'KEY_ATTEMPT_FAILED'
    | 'MILESTONE_COMPLETED'
    | 'CONFIDENCE_BET_A'
    | 'CERTAINTY_BET_B'
    | 'SYSTEM_ERROR';

// 2. Tipus d'esdeveniments oficials permesos per la clàusula CHECK de PostgreSQL a telemetry_logs
export type DbEventType =
    | 'PROMPT_SUBMISSION'
    | 'HURDLE_TRIGGERED'
    | 'MILESTONE_COMPLETED'
    | 'PROMPT_ENVIAT'
    | 'RESPOSTA_IA'
    | 'CODI_OVERRIDE'
    | 'SURVEY_SUBMIT_PRE_TEST'
    | 'SURVEY_SUBMIT_POST_TEST';

// 3. Estructura de la taula phase_analytics per als Moments A i B
export interface PhaseAnalytics {
    id_analytic?: string;
    id_equip: string;
    id_sessio: string;
    id_missio: string;
    moment_a_confidence?: number | null; // 1 a 5 (Aposta pre-verificació)
    moment_b_certainty?: number | null;  // 1 a 5 (Seguretat post-verificació)
    prompts_count: number;
    time_spent_seconds: number;
    hints_triggered: number;
    errors_identified_count: number;
    is_completed: boolean;
    creat_el?: string;
    actualitzat_el?: string;
}

// 4. Payload per a la ruta API /api/chat
export interface ChatApiPayload {
    id_sessio: string;
    id_equip: string;
    id_missio: string;
    prompt: string;
    system_prompt: string;
    moment_a_confidence?: number;
    moment_b_certainty?: number;
    chat_history?: { role: 'user' | 'assistant'; content: string }[];
}

// 5. Interfície de Telemetria Enriquida (Manté compatibilitat i afegeix els nous camps)
export interface TelemetryPayload {
    sessionId: string; // Requereix UUID vàlid
    teamId: string;    // Requereix UUID vàlid
    teamName?: string;
    actor: 'ALUMNE' | 'IA_BOT' | 'SISTEMA';
    eventType: ApplicationEventType;
    mission: string;
    text?: string;
    metrics?: {
        latencyMs?: number;
        inputLength?: number;
        isVague?: boolean;
        failedAttemptsCount?: number;
        tokensUsed?: number;
        // Nous camps de telemetria FARO V3
        momentAConfidence?: number;
        momentBCertainty?: number;
        isEvidenceCited?: boolean;
        isAbTest?: boolean;
    };
}

// Mapeig automàtic cap als valors de la clàusula CHECK de PostgreSQL
function mapToDbEventType(appEvent: ApplicationEventType): DbEventType {
    switch (appEvent) {
        case 'VAGUE_REJECTION':
        case 'KEY_ATTEMPT_FAILED':
            return 'HURDLE_TRIGGERED';
        case 'KEY_ATTEMPT_SUCCESS':
        case 'MILESTONE_COMPLETED':
            return 'MILESTONE_COMPLETED';
        case 'PROMPT_SUBMISSION':
        case 'CONFIDENCE_BET_A':
        case 'CERTAINTY_BET_B':
            return 'PROMPT_SUBMISSION';
        default:
            return 'RESPOSTA_IA';
    }
}

export async function logTelemetry(payload: TelemetryPayload): Promise<void> {
    try {
        if (!payload.sessionId || !payload.teamId) {
            console.warn('⚠️ Telemetria omesa: Falten UUIDs de sessió o equip.');
            return;
        }

        const dbEventType = mapToDbEventType(payload.eventType);

        // Estructura exacta segons la taula telemetry_logs
        const record = {
            id_sessio: payload.sessionId,
            id_equip: payload.teamId,
            tipo_evento: dbEventType, // ✅ Complint la clàusula CHECK
            metrics_payload: {       // ✅ Tot el detall enriquit dins del JSONB
                actor: payload.actor,
                event_subtype: payload.eventType,
                missio: payload.mission,
                nom_equip: payload.teamName || 'EQUIP_ANÒNIM',
                contingut_text: payload.text || '',
                latency_ms: payload.metrics?.latencyMs || 0,
                input_length: payload.metrics?.inputLength || 0,
                is_vague: payload.metrics?.isVague || false,
                tokens_used: payload.metrics?.tokensUsed || 0,
                // Registre dels noves mètriques d'auditoria cognitiva
                moment_a_confidence: payload.metrics?.momentAConfidence ?? null,
                moment_b_certainty: payload.metrics?.momentBCertainty ?? null,
                is_evidence_cited: payload.metrics?.isEvidenceCited || false,
                is_ab_test: payload.metrics?.isAbTest || false,
                timestamp: new Date().toISOString()
            }
        };

        const { error } = await supabase.from('telemetry_logs').insert([record]);
        if (error) {
            console.error('⚠️ Error desant la telemetria a Supabase:', error.message);
        }
    } catch (err: unknown) {
        console.error('❌ Fallada crítica al mòdul de telemetria:', err instanceof Error ? err.message : err);
    }
}