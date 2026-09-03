import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Tipus d'esdeveniments dominis de l'aplicació
export type ApplicationEventType =
    | 'PROMPT_SUBMISSION'
    | 'VAGUE_REJECTION'
    | 'KEY_ATTEMPT_SUCCESS'
    | 'KEY_ATTEMPT_FAILED'
    | 'MILESTONE_COMPLETED'
    | 'SYSTEM_ERROR';

// Tipus d'esdeveniments oficials permesos per la clàusula CHECK de PostgreSQL
export type DbEventType =
    | 'PROMPT_SUBMISSION'
    | 'HURDLE_TRIGGERED'
    | 'MILESTONE_COMPLETED'
    | 'PROMPT_ENVIAT'
    | 'RESPOSTA_IA'
    | 'CODI_OVERRIDE'
    | 'SURVEY_SUBMIT_PRE_TEST'
    | 'SURVEY_SUBMIT_POST_TEST';

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

        // Estrutura exacta segons la taula telemetry_logs
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