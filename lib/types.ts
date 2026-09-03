export type TipusClient = 'ACADEMIC' | 'CORPORATE';
export type EstatSessio = 'EN_CURS' | 'FINALITZADA';
export type TipusEventoTelemetry = 'PROMPT_SUBMISSION' | 'HURDLE_TRIGGERED' | 'MILESTONE_COMPLETED';

// 1. Clients Table (Monetization Core)
export interface Client {
  id_client: string;
  nom: string;
  tipus_client: TipusClient;
  sector: string;
  credits_disponibles: number;
  creat_el?: string;
}

// 2. Pedagogical Templates Table (Decoupled Scenario Logic)
export interface PedagogicalTemplate {
  id_template: string;
  titol: string;
  scenario_context: {
    welcome_message?: string;
    repte?: string;
    objectius?: string[];
    consell?: string;
    bot_name?: string;
    system_prompt?: string;
    missions?: Record<string, {
      titol?: string;
      repte?: string;
      objectius?: string[];
      welcome_message?: string;
      bot_name?: string;
      system_prompt?: string;
      codi_desblocatge?: string;
      seguent_missio?: string;
      consell?: string;
    }>;
  };
  interaction_protocols: {
    hurdles?: Array<{
      id_hurdle: string;
      trigger_condition: string;
      resistance_type: string;
      prompt_feedback: string;
    }>;
  };
  assessment_metrics: Record<string, any>;
}

// 3. Sessions Table (Live Classroom Execution)
export interface Sessio {
  id_sessio: string;
  pin_acces: string;
  estat: EstatSessio;
  id_client: string;
  id_template: string;
  id_facilitador?: string | null;
  creat_el?: string;
}

// 4. Teams Table (Student Groups)
export interface Equip {
  id_equip: string;
  id_sessio: string;
  nom_equip: string;
  missio_actual: string;
  integrants?: Record<string, any> | string[] | null;
  dossier_actiu?: Record<string, any> | null;
  creat_el?: string;
}

// 5. Telemetry Logs Table (Behavioral Analytics Engine)
export interface TelemetryLog {
  id_log?: string;
  id_sessio: string;
  id_equip: string;
  tipo_evento: TipusEventoTelemetry;
  metrics_payload: {
    user_prompt?: string;
    bot_response?: string;
    reflection_interval_seconds?: number;
    iteration_cycles?: number;
    hurdle_id_triggered?: string;
    bias_detected?: boolean;
    prompt_length?: number;
    [key: string]: any;
  };
  creat_el?: string;
}
