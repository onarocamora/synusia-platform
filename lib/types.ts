export type TipusClient = 'ACADEMIC' | 'CORPORATE';
export type EstatSessio = 'EN_CURS' | 'FINALITZADA';
export type TipusEventoTelemetry = 'PROMPT_SUBMISSION' | 'HURDLE_TRIGGERED' | 'MILESTONE_COMPLETED';

export interface Client {
  id_client: string;
  nom: string;
  tipus_client: TipusClient;
  sector: string;
  credits_disponibles: number;
  creat_el?: string;
}

export interface Mission {
  titol?: string;
  repte?: string;
  objectius?: string[];
  welcome_message?: string;
  bot_name?: string;
  system_prompt?: string;
  codi_desblocatge?: string;
  seguent_missio?: string;
  consell?: string;
}

export interface ScenarioContext {
  welcome_message?: string;
  repte?: string;
  objectius?: string[];
  consell?: string;
  bot_name?: string;
  system_prompt?: string;
  missions?: Record<string, Mission>;
}

export interface PedagogicalTemplate {
  id_template: string;
  titol: string;
  scenario_context: ScenarioContext;
  interaction_protocols: {
    hurdles?: Array<{
      id_hurdle: string;
      trigger_condition: string;
      resistance_type: string;
      prompt_feedback: string;
    }>;
  };
  assessment_metrics: Record<string, unknown>;
}

export interface Sessio {
  id_sessio: string;
  pin_acces: string;
  estat: EstatSessio;
  id_client: string;
  id_template: string;
  id_facilitador?: string | null;
  creat_el?: string;
}

export interface Equip {
  id_equip: string;
  id_sessio: string;
  nom_equip: string;
  missio_actual: string;
  integrants?: Record<string, unknown> | string[] | null;
  dossier_actiu?: Record<string, unknown> | null;
  creat_el?: string;
}

export interface MetricsPayload {
  user_prompt?: string;
  bot_response?: string;
  reflection_interval_seconds?: number;
  iteration_cycles?: number;
  hurdle_id_triggered?: string;
  bias_detected?: boolean;
  prompt_length?: number;
  [key: string]: unknown;
}

export interface TelemetryLog {
  id_log?: string;
  id_sessio: string;
  id_equip: string;
  tipo_evento: TipusEventoTelemetry;
  metrics_payload: MetricsPayload;
  creat_el?: string;
}

async function fetchData(url: string): Promise<any> {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

function parseJson(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    throw error;
  }
}

const userInput = prompt("Introdueix el teu input: ");