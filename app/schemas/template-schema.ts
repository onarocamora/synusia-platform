import { z } from 'zod';

// ---------------------------------------------------------------------------
// 1. ESQUEMA AMB GUARDRAILS DE QUALITAT PER A OPENAI (Strict Mode + Validacions)
// ---------------------------------------------------------------------------
const OpenAIBotConfigSchema = z.object({
    id_bot: z.string(),
    bot_name: z.string(),
    role_title: z.string().nullable(),
    system_prompt: z.string().min(50, {
        message: "El prompt de l'interlocutor ha de tenir almenys 50 caràcters."
    }),
});

const OpenAIMissionBriefingSchema = z.object({
    titol: z.string().min(3),
    rol: z.string().min(3),
    problema: z.string().min(15),
    objectiu: z.string().min(15),
    com_guanyar: z.string().min(15),
});

const OpenAIDossierDocSchema = z.object({
    doc_id: z.string(),
    contingut: z.string().min(120, {
        message: "El document del dossier ha de contenir text o dades corporatives d'almenys 120 caràcters."
    }),
});

const OpenAIMissionConfigSchema = z.object({
    id_fase: z.string(),
    bot_name: z.string().min(2),
    bot_role: z.string().min(3),
    system_prompt: z.string().min(350, {
        message: "El System Prompt de la missió ha de ser un text complet de simulació d'almenys 350 caràcters."
    }),
    codi_desblocatge: z.string().min(3),
    briefing: OpenAIMissionBriefingSchema,
    dossier: z.array(OpenAIDossierDocSchema).min(1, {
        message: "Cada fase ha de contenir almenys 1 document de dossier d'evidències."
    }),
    seguent_missio: z.string().nullable(),
    bots: z.array(OpenAIBotConfigSchema),
});

export const OpenAITemplateSchema = z.object({
    id_template: z.string().min(3),
    titol: z.string().min(5),
    is_official: z.boolean(),
    scenario_context: z.object({
        nom_cas: z.string().min(5),
        welcome_message: z.string().min(20),
        missions: z.array(OpenAIMissionConfigSchema),
    }),
});

// ---------------------------------------------------------------------------
// 2. ESQUEMES FINALS D'APLICACIÓ (Compatibles amb Supabase i Frontend)
// ---------------------------------------------------------------------------
export const BotConfigSchema = z.object({
    id_bot: z.string(),
    bot_name: z.string(),
    role_title: z.string().optional(),
    system_prompt: z.string(),
});

export const MissionBriefingSchema = z.object({
    titol: z.string(),
    rol: z.string(),
    problema: z.string(),
    objectiu: z.string(),
    com_guanyar: z.string(),
});

export const MissionConfigSchema = z.object({
    bot_name: z.string(),
    bot_role: z.string(),
    system_prompt: z.string(),
    codi_desblocatge: z.string(),
    briefing: MissionBriefingSchema,
    dossier: z.record(z.string(), z.string()),
    seguent_missio: z.string().optional(),
    bots: z.array(BotConfigSchema).optional().default([]),
});

export const ScenarioContextSchema = z.object({
    nom_cas: z.string(),
    welcome_message: z.string(),
    missions: z.record(z.string(), MissionConfigSchema),
});

export const TemplateSchema = z.object({
    id_template: z.string(),
    titol: z.string(),
    is_official: z.boolean().optional().default(false),
    scenario_context: ScenarioContextSchema,
});

export type TemplateSchemaType = z.infer<typeof TemplateSchema>;
export type MissionConfigType = z.infer<typeof MissionConfigSchema>;