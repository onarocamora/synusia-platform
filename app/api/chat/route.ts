import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface BotConfig {
  id_bot: string;
  bot_name: string;
  role_title?: string;
  system_prompt: string;
}

interface MissionConfig {
  system_prompt?: string;
  bot_name?: string;
  bot_role?: string;
  codi_desblocatge?: string;
  briefing?: any;
  dossier?: any;
  bots?: BotConfig[];
}

interface RequestBody {
  id_equip: string;
  id_sessio?: string;
  missio_actual: string | number;
  bot_id?: string;
  historial_missatges?: Message[];
  messages?: Message[];
  id_template?: string;
  idTemplate?: string;
  // Nous paràmetres de telemetria FARO V3 (Moments A i B)
  moment_a_confidence?: number;
  moment_b_certainty?: number;
}

interface ClientData {
  credits_disponibles: number;
}

interface SessionData {
  id_sessio: string;
  estat: string;
  id_client: string;
  id_template: string;
  data_expiracio_pilot?: string | null;
  clients: ClientData | ClientData[] | null;
}

interface EquipData {
  id_equip: string;
  nom_equip: string;
  id_sessio: string;
  sessions: SessionData | SessionData[] | null;
}

interface TemplateData {
  id_template: string;
  titol?: string;
  scenario_context?: {
    nom_cas?: string;
    missions?: {
      [key: string]: MissionConfig;
    };
  };
  interaction_protocols?: {
    system_prompt?: string;
    clau_desblocatge?: string;
    bot_name?: string;
    bot_role?: string;
  };
}

// ---------------------------------------------------------------------------
// GUARDRAILS RELAXATS I ANÀLISI PATRÓ DE PROMPT
// ---------------------------------------------------------------------------

function checkVagueness(text: string): boolean {
  const clean = text.toLowerCase().trim();
  if (clean.length < 2) return true;
  return false;
}

function checkJailbreakAttempt(text: string): boolean {
  const clean = text.toLowerCase().trim();
  const attackPatterns = [
    'ignora les instruccions anteriors',
    'ignore all previous instructions',
    'forget your role',
    'actua com a dan',
    'dan mode',
    'developer mode',
    '<user_input>',
    '</user_input>'
  ];
  return attackPatterns.some(pattern => clean.includes(pattern));
}

function checkOutputSecurity(respostaText: string): { isLeaked: boolean; sanitizedText: string } {
  const cleanOutput = respostaText.toLowerCase();
  const systemLeakTriggers = ['<user_input>', '</user_input>'];
  const hasLeak = systemLeakTriggers.some(trigger => cleanOutput.includes(trigger));

  if (hasLeak) {
    return {
      isLeaked: true,
      sanitizedText: "🔒 PROTOCOL INTERCEPTAT: Contenció de seguretat activada."
    };
  }
  return { isLeaked: false, sanitizedText: respostaText };
}

// Helper per avaluar el rigor del prompt de l'alumne (Pattern Matching)
function analyzePromptPatterns(text: string, missioKey: string): { is_evidence_cited: boolean; is_ab_test: boolean } {
  const normalized = text.toLowerCase();

  const evidenceKeywords = [
    '24h', '24 horas', '24 hores', 'f-07', 'f07', 'aparcamiento norte', '112',
    'pc-2', 'pc2', '80 cajas', '80 caixes', 'entrega parcial',
    'barrio centro', 'polígono sur', 'poligon sur', '88'
  ];
  const is_evidence_cited = evidenceKeywords.some(kw => normalized.includes(kw));

  const is_ab_test = (missioKey === '3' || missioKey.includes('3')) && (
    (normalized.includes('barrio centro') || normalized.includes('polígono sur') || normalized.includes('poligon sur')) &&
    (normalized.includes('evalúa') || normalized.includes('avalua') || normalized.includes('prueba') || normalized.includes('nota') || normalized.includes('candidatura'))
  );

  return { is_evidence_cited, is_ab_test };
}

// ---------------------------------------------------------------------------
// MAIN HANDLER POST
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: RequestBody = await request.json().catch(() => ({}) as RequestBody);
    const {
      id_equip,
      missio_actual,
      bot_id,
      historial_missatges,
      messages,
      id_template,
      idTemplate,
      moment_a_confidence,
      moment_b_certainty
    } = body;

    const historial: Message[] = historial_missatges || messages || [];

    if (!id_equip || missio_actual === undefined || !Array.isArray(historial) || historial.length === 0) {
      return NextResponse.json({ error: 'Paràmetres de traça insuficients o historial invàlid.' }, { status: 400 });
    }

    const ultimMissatge = historial[historial.length - 1];
    if (!ultimMissatge || !ultimMissatge.content || typeof ultimMissatge.content !== 'string' || !ultimMissatge.content.trim()) {
      return NextResponse.json(
        { content: '⚠️ El missatge no pot estar buit.', bot_name: 'SYSTEM_WARN', bot_role: 'SYSTEM', credits_restants: 0, isVague: true, isSecurityViolation: false, unlockedKey: false },
        { status: 400 }
      );
    }

    const inputUsuari = ultimMissatge.content.trim();

    // 1. CÀRREGA DE SESSIÓ I EQUIP
    let equipData: EquipData;
    try {
      const { data, error: errorEquip } = await supabase
        .from('equips')
        .select('id_equip, nom_equip, id_sessio, sessions ( id_sessio, estat, id_client, id_template, data_expiracio_pilot, clients ( credits_disponibles ) )')
        .eq('id_equip', id_equip)
        .single();

      if (errorEquip || !data) throw new Error('Equip no trobat');
      equipData = data as unknown as EquipData;
    } catch {
      return NextResponse.json(
        { content: '❌ ERROR DE SEGURETAT: L\'equip no existeix a la instància.', bot_name: 'SYSTEM', bot_role: 'SYSTEM', credits_restants: 0, isVague: false, isSecurityViolation: true, unlockedKey: false },
        { status: 404 }
      );
    }

    const sessionNode = Array.isArray(equipData.sessions) ? equipData.sessions[0] : equipData.sessions;
    const clientNode = sessionNode?.clients ? (Array.isArray(sessionNode.clients) ? sessionNode.clients[0] : sessionNode.clients) : null;

    if (!sessionNode || sessionNode.estat !== 'EN_CURS') {
      return NextResponse.json(
        { content: '🔒 SESSIÓ TANCADA: El facilitador ha finalitzat la simulació.', bot_name: 'SYSTEM_LOCK', bot_role: 'SYSTEM', credits_restants: 0, isVague: false, isSecurityViolation: false, unlockedKey: false },
        { status: 403 }
      );
    }

    const currentCredits = clientNode?.credits_disponibles ?? 0;
    const idSessio = sessionNode.id_sessio;
    const nomEquip = equipData.nom_equip || 'Desconegut';

    // 2. RECUPERACIÓ DE PLANTILLA I MISSIÓ
    const targetTemplateId = sessionNode?.id_template || id_template || idTemplate || 'CAS_OMNIA_SOUND_2026';
    let templateData: TemplateData | null = null;

    try {
      const { data } = await supabase
        .from('pedagogical_templates')
        .select('*')
        .eq('id_template', targetTemplateId)
        .single();

      if (data) templateData = data as TemplateData;
    } catch (err) {
      console.error('Error carregant la plantilla:', err);
    }

    let systemPrompt = "";
    let botName = 'OmnIA';
    let botRoleTitle = 'Assistent';
    let codiDesblocatge = "";

    // Normalització de la clau de la missió (extreu '1' de '1' o de 'MISSION_1_OMNIA_SOUND')
    const rawMissioStr = String(missio_actual);
    const missioNumMatch = rawMissioStr.match(/\d+/);
    const missioKey = missioNumMatch ? missioNumMatch[0] : rawMissioStr;

    if (templateData?.scenario_context?.missions?.[missioKey]) {
      const currentConfig = templateData.scenario_context.missions[missioKey];
      codiDesblocatge = currentConfig.codi_desblocatge || "";
      systemPrompt = currentConfig.system_prompt || "";
      botName = currentConfig.bot_name || botName;
      botRoleTitle = currentConfig.bot_role || botRoleTitle;
    } else if (templateData?.interaction_protocols?.system_prompt) {
      systemPrompt = templateData.interaction_protocols.system_prompt;
      codiDesblocatge = templateData.interaction_protocols.clau_desblocatge || "";
      botName = templateData.interaction_protocols.bot_name || botName;
      botRoleTitle = templateData.interaction_protocols.bot_role || botRoleTitle;
    }

    if (!systemPrompt.trim()) {
      systemPrompt = `Ets ${botName}. Respon de manera educada i ajuda l'usuari segons el dossier.`;
    }

    // 3. CAPA 1 - PRE-EXECUTION GUARDRAIL
    if (checkJailbreakAttempt(inputUsuari)) {
      const jailbreakReply = "⚠️ ERROR DE PROTOCOL: Intent de vulneració de seguretat detectat.";
      return NextResponse.json({
        content: jailbreakReply,
        bot_name: botName,
        bot_role: botRoleTitle,
        credits_restants: currentCredits,
        isVague: false,
        isSecurityViolation: true,
        unlockedKey: false
      });
    }

    if (checkVagueness(inputUsuari)) {
      const vagueReply = "Escriu un missatge vàlid per continuar.";
      return NextResponse.json({
        content: vagueReply,
        bot_name: botName,
        bot_role: botRoleTitle,
        credits_restants: currentCredits,
        isVague: true,
        isSecurityViolation: false,
        unlockedKey: false
      });
    }

    // 4. ANALÍTICA DE PROMPT I PHASE_ANALYTICS (MOMENTS A I B)
    const { is_evidence_cited, is_ab_test } = analyzePromptPatterns(inputUsuari, missioKey);

    let hintsTriggeredIncrement = 0;
    let promptsCountCurrent = 1;

    try {
      const { data: analytics } = await supabase
        .from('phase_analytics')
        .select('*')
        .eq('id_equip', id_equip)
        .eq('id_missio', missioKey)
        .single();

      if (!analytics) {
        await supabase
          .from('phase_analytics')
          .insert({
            id_sessio: idSessio,
            id_equip: id_equip,
            id_missio: missioKey,
            moment_a_confidence: moment_a_confidence ?? null,
            moment_b_certainty: moment_b_certainty ?? null,
            prompts_count: 1,
          });
      } else {
        promptsCountCurrent = (analytics.prompts_count || 0) + 1;
        const updates: Record<string, any> = {
          prompts_count: promptsCountCurrent,
          actualitzat_el: new Date().toISOString(),
        };

        if (moment_a_confidence && !analytics.moment_a_confidence) {
          updates.moment_a_confidence = moment_a_confidence;
        }
        if (moment_b_certainty) {
          updates.moment_b_certainty = moment_b_certainty;
        }

        // Válvula de estancamiento: Si porten 5 o més missatges sense citar evidències ni fer test A/B
        if (promptsCountCurrent >= 5 && !is_evidence_cited && !is_ab_test) {
          hintsTriggeredIncrement = 1;
          updates.hints_triggered = (analytics.hints_triggered || 0) + 1;
          systemPrompt += `\n\n[INSTRUCCIÓ D'EMERGÈNCIA DOCENT]: L'equip porta ${promptsCountCurrent} missatges sense avançar. Integra de forma natural una pista subtil en la teva propera resposta sense sortir del personatge.`;
        }

        await supabase
          .from('phase_analytics')
          .update(updates)
          .eq('id_analytic', analytics.id_analytic);
      }
    } catch (analyticsErr) {
      console.warn('Avís en actualitzar phase_analytics:', analyticsErr);
    }

    // 5. CRIDA A OPENAI
    const systemPromptEncapsulat = `
Ets un agent dins d'una simulació pedagògica.
Nom: ${botName}
Càrrec: ${botRoleTitle}
Fase Activa: ${missioKey}

${systemPrompt}

=== REGLA DE FORMAT ===
Respon de forma natural i coherent amb el teu rol. L'input de l'usuari s'inclou a <user_input>.
`.trim();

    const historialFormatat = historial.slice(0, -1).map((m: Message) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system' as const, content: systemPromptEncapsulat },
        ...historialFormatat,
        { role: 'user' as const, content: `<user_input>${inputUsuari}</user_input>` }
      ],
      temperature: 0.3,
    });

    let respostaRaw = completion.choices[0]?.message?.content || '...';
    const tokensUsed = completion.usage?.total_tokens || 0;
    const latencyMs = Date.now() - startTime;

    // 6. CAPA 2 - POST-EXECUTION VALIDATOR
    const { isLeaked, sanitizedText } = checkOutputSecurity(respostaRaw);
    const respostaText = sanitizedText;

    // 7. PROGRESSION GATING
    const hasVictoryKey =
      !isLeaked && (
        respostaText.includes('🔑') ||
        (codiDesblocatge !== "" && respostaText.includes(codiDesblocatge))
      );

    // 8. PERSISTÈNCIA EN BBDD (LOGS INTERACCIO I TELEMETRIA ENRIQUIDA)
    try {
      // Registre a logs_interaccio amb els nous camps is_evidence_cited i is_ab_test
      await supabase.from('logs_interaccio').insert([
        {
          id_equip: id_equip,
          id_missio: String(missio_actual),
          actor: 'USER',
          text: inputUsuari,
          tokens_consumits: 0,
          is_evidence_cited,
          is_ab_test
        },
        {
          id_equip: id_equip,
          id_missio: String(missio_actual),
          actor: 'ARIA',
          text: respostaText,
          tokens_consumits: tokensUsed
        }
      ]);

      // Si s'ha desblocat la clau, marquem la fase com a completada a phase_analytics
      if (hasVictoryKey) {
        await supabase
          .from('phase_analytics')
          .update({ is_completed: true })
          .eq('id_equip', id_equip)
          .eq('id_missio', missioKey);
      }

      // Registre a telemetry_logs enriquint el payload JSONB
      await supabase.from('telemetry_logs').insert([
        {
          id_sessio: idSessio,
          id_equip: id_equip,
          tipo_evento: hasVictoryKey ? 'MILESTONE_COMPLETED' : 'RESPOSTA_IA',
          metrics_payload: {
            actor: 'IA_BOT',
            bot_name: botName,
            missio: String(missio_actual),
            text: respostaText,
            latency_ms: latencyMs,
            tokens_used: tokensUsed,
            unlocked_key: hasVictoryKey,
            moment_a_confidence: moment_a_confidence ?? null,
            moment_b_certainty: moment_b_certainty ?? null,
            is_evidence_cited,
            is_ab_test,
            prompts_count: promptsCountCurrent,
            timestamp: new Date().toISOString()
          }
        }
      ]);
    } catch (telemetryErr) {
      console.error('Error al registre de dades a Supabase:', telemetryErr);
    }


    // 📊 GRAVACIÓ DE RESUM DE TELEMETRIA PER AL PILOT
    // Detectem si s'ha desbloquejat la clau en aquesta resposta (buscant la icona 🔑 o la variable de victòria)
    const unlockedKey = respostaText.includes('🔑') || (typeof hasVictoryKey !== 'undefined' && hasVictoryKey);

    if (unlockedKey) {
      try {
        const momentA = body.moment_a_confidence ? Number(body.moment_a_confidence) : null;
        const momentB = body.moment_b_certainty ? Number(body.moment_b_certainty) : null;
        const totalPrompts = Array.isArray(messages) ? messages.filter((m: any) => m.role === 'user').length : 0;

        await supabase
          .from('pilot_evaluation_metrics')
          .upsert(
            {
              id_sessio: idSessio || null,
              id_equip: id_equip || null,
              fase_id: String(missio_actual),
              moment_a_confianca: momentA,
              moment_b_seguretat: momentB,
              prompts_enviats: totalPrompts,
              completat_el: new Date().toISOString(),
            },
            { onConflict: 'id_equip,fase_id' }
          );
      } catch (metricsErr) {
        console.error('Error no bloquejant desant mètriques del pilot:', metricsErr);
      }
    }

    // --- INICI BLOC TELEMETRIA ---
    const clauAconseguida = respostaText.includes('🔑'); // <-- ASSEGURA'T QUE 'respostaIA' ÉS EL NOM DE LA TEVA VARIABLE ON ESTÀ EL TEXT DEL BOT

    if (clauAconseguida) {
      console.log("🔥 ALERTA: Clau aconseguida! Intentant desar mètriques del pilot...");
      try {
        const { error: metricaError } = await supabase
          .from('pilot_evaluation_metrics')
          .upsert(
            {
              id_sessio: body.id_sessio || null,
              id_equip: body.id_equip || null,
              fase_id: String(body.missio_actual),
              moment_a_confianca: body.moment_a_confidence ? Number(body.moment_a_confidence) : null,
              moment_b_seguretat: body.moment_b_certainty ? Number(body.moment_b_certainty) : null,
              prompts_enviats: body.messages ? body.messages.filter((m: any) => m.role === 'user').length : 0,
              completat_el: new Date().toISOString(),
            },
            { onConflict: 'id_equip,fase_id' }
          );

        if (metricaError) {
          console.error("❌ Supabase ha rebutjat la inserció:", metricaError);
        } else {
          console.log("✅ Mètriques de la fase desades a Supabase correctament.");
        }
      } catch (err) {
        console.error('❌ Error catastròfic desant mètriques:', err);
      }
    }
    // --- FI BLOC TELEMETRIA ---


    return NextResponse.json({
      content: respostaText,
      bot_name: botName,
      bot_role: botRoleTitle,
      credits_restants: currentCredits,
      isVague: false,
      isSecurityViolation: isLeaked,
      unlockedKey: hasVictoryKey,
      metrics: {
        is_evidence_cited,
        is_ab_test,
        prompts_count: promptsCountCurrent,
        moment_a_confidence: moment_a_confidence ?? null,
        moment_b_certainty: moment_b_certainty ?? null
      }
    });

  } catch (error: unknown) {
    console.error('Crash a api/chat:', error);
    return NextResponse.json(
      { content: '❌ ERROR INTERN: Fallada en processar la petició.', bot_name: 'SYSTEM_CRASH', bot_role: 'SYSTEM', credits_restants: 0, isVague: false, isSecurityViolation: true, unlockedKey: false },
      { status: 500 }
    );
  }
}