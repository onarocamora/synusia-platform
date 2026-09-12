import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { OpenAITemplateSchema, TemplateSchema } from '@/app/schemas/template-schema';
import { buildMetaPromptFaro } from '@/app/prompts/MetaPromptFaro';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      prompt,
      sector = 'Corporatiu',
      numFases = 3,
      includeMissionZero = false,
      idioma = 'ca',
    } = body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: "Cal proporcionar una descripció de cas ('prompt') vàlida." },
        { status: 400 }
      );
    }

    const metaPrompt = buildMetaPromptFaro({
      prompt: prompt.trim(),
      sector: String(sector).trim(),
      numFases: Number(numFases) || 3,
      includeMissionZero: Boolean(includeMissionZero),
      idioma: idioma as 'ca' | 'es' | 'en',
    });

    let rawContent: string | null = null;

    // 1. Execució amb GPT-4o (Model Flagship per a la creació de contingut complex)
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Ets l’enginyer pedagògic principal de Synusia. La teva missió és dissenyar simulacions d’auditoria de la IA hiper-realistes. Mai generis resums genèrics. Redacta dossiers extensos amb normativa o dades fictícies reals, i dissenya System Prompts profunds en primera persona amb Escalera de Concesiones.',
          },
          {
            role: 'user',
            content: metaPrompt,
          },
        ],
        response_format: zodResponseFormat(OpenAITemplateSchema, 'pedagogical_template'),
        temperature: 0.5,
      });

      rawContent = completion.choices[0]?.message?.content ?? null;
    } catch (primaryError) {
      console.warn('Error en la generació amb gpt-4o. Executant reintent...', primaryError);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Ets un generador d’estructures JSON per a plataformes de simulació d’auditoria de la IA. Respon ÚNICAMENT complint l’esquema Zod sol·licitat.',
          },
          {
            role: 'user',
            content: metaPrompt,
          },
        ],
        response_format: zodResponseFormat(OpenAITemplateSchema, 'pedagogical_template'),
        temperature: 0.3,
      });

      rawContent = completion.choices[0]?.message?.content ?? null;
    }

    if (!rawContent) {
      return NextResponse.json(
        { error: "La IA no ha generat cap contingut de sortida." },
        { status: 500 }
      );
    }

    // 2. Parseig i transformació de dades
    const jsonParsed = JSON.parse(rawContent);
    const parsedOpenAI = OpenAITemplateSchema.parse(jsonParsed);

    const missionsRecord: Record<string, any> = {};

    parsedOpenAI.scenario_context.missions.forEach((m, idx) => {
      const key = m.id_fase && m.id_fase.trim() !== '' ? m.id_fase : String(idx);

      const dossierText = m.dossier
        .map((d) => `[${d.doc_id}]: ${d.contingut}`)
        .join('\n\n');

      const codiFormatat = m.codi_desblocatge.startsWith('🔑')
        ? m.codi_desblocatge
        : `🔑 ${m.codi_desblocatge}`;

      missionsRecord[key] = {
        titol: m.briefing.titol || `Fase ${idx + 1}`,
        bot_name: m.bot_name || 'Agent d\'IA',
        bot_role: m.bot_role || 'Assessor',
        repte: `${m.briefing.problema} ${m.briefing.objectiu}`,
        consell: m.briefing.com_guanyar,
        evidenced_doc: dossierText,
        codi_desblocatge: codiFormatat,
        welcome_message: m.briefing.problema,
        system_prompt: m.system_prompt,
        seguent_missio: m.seguent_missio ?? undefined,
        briefing: m.briefing,
        dossier: dossierText,
        bots: m.bots.map((b) => ({
          id_bot: b.id_bot,
          bot_name: b.bot_name,
          role_title: b.role_title ?? undefined,
          system_prompt: b.system_prompt,
        })),
      };
    });

    const finalData = {
      id_template: parsedOpenAI.id_template || `CAS-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      titol: parsedOpenAI.titol || 'Cas d\'estudi d\'auditoria de la IA',
      is_official: Boolean(parsedOpenAI.is_official),
      scenario_context: {
        nom_cas: parsedOpenAI.scenario_context.nom_cas || parsedOpenAI.titol,
        welcome_message: parsedOpenAI.scenario_context.welcome_message || 'Benvinguts a la simulació.',
        missions: missionsRecord,
      },
    };

    return NextResponse.json(finalData);

  } catch (error: any) {
    console.error('Crash a /api/generate-template:', error);
    return NextResponse.json(
      { error: error?.message || 'Error intern en generar la plantilla pedagògica.' },
      { status: 500 }
    );
  }
}