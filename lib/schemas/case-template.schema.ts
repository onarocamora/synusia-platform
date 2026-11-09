// lib/schemas/case-template.schema.ts
import { z } from 'zod';

export const BotPersonaSchema = z.object({
  id_bot: z.string().min(2, "L'id_bot ha de tenir com a mínim 2 caràcters"),
  bot_name: z.string().min(2, 'Cal especificar el nom del bot'),
  role_title: z.string().min(2, 'Cal especificar el càrrec o rol del bot'),
  system_prompt: z.string().min(20, 'El prompt del bot ha de tenir com a mínim 20 caràcters'),
});

export const MissionScenarioSchema = z.object({
  bot_name: z.string().default('Assistent'),
  bot_role: z.string().default('Interlocutor'),
  system_prompt: z.string().min(20, 'El system prompt de la missió és obligatori'),
  codi_desblocatge: z.string().optional().default(''),
  // Trampa i contraprova forense imprescindibles per a l'avaluació BARS
  bot_trap_data: z
    .string()
    .min(15, "Cal detallar la trampa o al·lucinació concreta que defensarà la IA (bot_trap_data)"),
  dossier_ground_truth: z
    .string()
    .min(15, "Cal detallar l'evidència o clàusula exacta del dossier que desmunta l'error (dossier_ground_truth)"),
  bots: z.array(BotPersonaSchema).optional().default([]),
});

export const ScaffoldingRulesSchema = z.object({
  stagnation_turn_threshold: z
    .number()
    .int()
    .min(2)
    .max(10)
    .default(4)
    .describe("Nombre de torns sense avançar per disparar la intervenció socràtica"),
  max_scaffolding_interventions: z.number().int().min(1).default(3),
  socratic_guidance_prompt: z
    .string()
    .min(20, 'Cal definir la directriu socràtica per guiar sense donar la solució'),
});

export const AssessmentMetricsSchema = z.object({
  critical_error_description: z
    .string()
    .min(25, "La descripció de l'error crític per al Jutge Semàntic ha de ser precisa (mínim 25 caràcters)"),
  required_evidence: z
    .string()
    .min(25, "Cal especificar quina evidència documental exacta s'exigeix a l'equip (mínim 25 caràcters)"),
  injection_turn: z
    .number()
    .int()
    .min(1)
    .max(8)
    .default(3)
    .describe("Torn en què s'injecta l'error crític al xat"),
  confidence_probes: z
    .object({
      moment_a_turn: z.number().int().default(2),
      moment_b_turn: z.number().int().default(6),
    })
    .default({ moment_a_turn: 2, moment_b_turn: 6 }),
});

export const PedagogicalTemplateSchema = z.object({
  id_template: z
    .string()
    .regex(/^[A-Z0-9_-]{4,64}$/, "L'id_template ha de ser un codi en majúscules o identificador alfanumèric (ex: CAS_OMNIA_2026)"),
  titol: z.string().min(5, 'El títol del cas ha de tenir com a mínim 5 caràcters'),
  descripcio: z.string().min(10, 'Cal una breu descripció operativa del cas'),
  system_prompt: z.string().min(30, 'El prompt base del cas ha de tenir contingut contextual suficient'),
  critical_error_prompt: z
    .string()
    .min(30, "La directriu d'injecció de l'al·lucinació al model ha de ser explícita i detallada"),
  scaffolding_rules: ScaffoldingRulesSchema,
  assessment_metrics: AssessmentMetricsSchema,
  scenario_context: z.object({
    missions: z.record(z.string(), MissionScenarioSchema).refine(
      (m) => Object.keys(m).length > 0,
      'Cal definir com a mínim una missió dins de scenario_context.missions'
    ),
  }),
});

export type PedagogicalTemplate = z.infer<typeof PedagogicalTemplateSchema>;
export type MissionScenario = z.infer<typeof MissionScenarioSchema>;
export type AssessmentMetrics = z.infer<typeof AssessmentMetricsSchema>;