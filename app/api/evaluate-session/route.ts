// app/api/evaluate-session/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import OpenAI from 'openai';
import {
  MIN_TURNS_THRESHOLD,
  calculateBarsLevel,
  runSemanticJudge,
} from '@/lib/evaluation/bars-evaluator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Evita el timeout per defecte (10-15s) quan GPT-4o avalua diversos equips en paral·lel

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function evaluateSingleTeam(
  equip: { id_equip: string; nom_equip: string; id_sessio: string; id_client?: string | null },
  template: any
) {
  const metricsConfig = template?.assessment_metrics || {};
  const criticalErrorDescription =
    metricsConfig.critical_error_description || 'Inconsistència o al·lucinació greu del model.';
  const requiredEvidence =
    metricsConfig.required_evidence || 'Verificació activa i contrast amb la font de veritat.';

  // 1. Cercar logs d'interacció (suport poliglota id_equip / team_id)
  let logsRes = await supabase
    .from('logs_interaccio')
    .select('actor, text, creat_el')
    .eq('id_equip', equip.id_equip)
    .order('creat_el', { ascending: true });

  if (logsRes.error && (logsRes.error.code === '42703' || logsRes.error.message?.includes('does not exist'))) {
    logsRes = await supabase
      .from('logs_interaccio')
      .select('actor, text, created_at')
      .eq('team_id', equip.id_equip)
      .order('created_at', { ascending: true }) as any;
  }

  const logs = logsRes.data || [];

  // 2. Filtre de suficiència empírica (Data Sufficiency Threshold)
  if (logs.length < MIN_TURNS_THRESHOLD) {
    console.log(`[evaluate-session] Equip "${equip.nom_equip}": dades insuficients (${logs.length} torns < ${MIN_TURNS_THRESHOLD}). Marcat com a NO AVALUABLE.`);

    await supabase.from('team_evaluations').delete().eq('id_equip', equip.id_equip);
    await supabase.from('team_evaluations').insert({
      id_equip: equip.id_equip,
      id_sessio: equip.id_sessio,
      hitl_score: null,
      behavioral_profile: 'Dades Insuficients (No Avaluable)',
      evaluation_details: {
        insufficient_data: true,
        turns_count: logs.length,
        min_required: MIN_TURNS_THRESHOLD,
        reason: `L'equip té ${logs.length} torns d'interacció. Es requereix un mínim de ${MIN_TURNS_THRESHOLD} torns per establir una avaluació psicomètrica vàlida.`
      }
    });

    return {
      idEquip: equip.id_equip,
      nomEquip: equip.nom_equip,
      insufficientData: true,
      turnsCount: logs.length,
    };
  }

  // 3. Extracció de telemetria objectiva
  const { data: telemetryData } = await supabase
    .from('telemetry_logs')
    .select('tipo_evento, metrics_payload, creat_el')
    .eq('id_equip', equip.id_equip)
    .order('creat_el', { ascending: true });

  const telemetry = telemetryData || [];
  const scaffoldingEvents = telemetry.filter((t) => t.tipo_evento === 'SCAFFOLDING_TRIGGERED');
  const probeEvents = telemetry.filter((t) => t.tipo_evento === 'CONFIDENCE_PROBE');

  const momentAProbe = probeEvents.find(
    (p) => p.metrics_payload?.moment_type === 'MOMENT_A'
  )?.metrics_payload?.score ?? null;

  const momentBProbe = probeEvents.find(
    (p) => p.metrics_payload?.moment_type === 'MOMENT_B'
  )?.metrics_payload?.score ?? null;

  // 4. Extracció semàntica congelada (Jutge Semàntic BARS)
  console.log(`[evaluate-session] Inferència BARS per a "${equip.nom_equip}" (${logs.length} torns)...`);
  const evalResult = await runSemanticJudge(
    openai,
    logs,
    criticalErrorDescription,
    requiredEvidence
  );

  // 5. Càlcul psicomètric determinista
  const { barsLevel, hitlScore, profile, isComplacent } = calculateBarsLevel(evalResult, momentAProbe);

  // 6. Integració de l'evidència textual amb la telemetria
  const enrichedDetails = {
    ...evalResult,
    bars_framework: {
      bars_level: barsLevel,
      standard: 'NOTECHS / EU AI Act Art. 14 / NIST AI RMF MEASURE 2.7',
    },
    telemetry_summary: {
      scaffolding_interventions: scaffoldingEvents.length,
      moment_a_confidence: momentAProbe,
      moment_b_certainty: momentBProbe,
      cognitive_debt_flag: isComplacent,
    },
  };

  // 7. Persistència resilient (suport poliglota id_equip / team_id)
  await supabase.from('team_evaluations').delete().eq('id_equip', equip.id_equip);
  let insertRes = await supabase.from('team_evaluations').insert({
    id_equip: equip.id_equip,
    id_sessio: equip.id_sessio,
    hitl_score: hitlScore,
    behavioral_profile: profile,
    evaluation_details: enrichedDetails,
  });

  if (insertRes.error && (insertRes.error.code === '42703' || insertRes.error.message?.includes('does not exist'))) {
    console.warn(`[evaluate-session] Provant inserció amb nomenclatura anglesa (team_id / session_id)...`);
    await supabase.from('team_evaluations').delete().eq('team_id', equip.id_equip);
    insertRes = await supabase.from('team_evaluations').insert({
      team_id: equip.id_equip,
      session_id: equip.id_sessio,
      hitl_score: hitlScore,
      behavioral_profile: profile,
      evaluation_details: enrichedDetails,
    });
  }

  if (insertRes.error) {
    console.error(`[evaluate-session] ❌ Error a PostgreSQL desant "${equip.nom_equip}":`, insertRes.error);
    throw new Error(`Error BD (${equip.nom_equip}): ${insertRes.error.message}`);
  }

  console.log(`[evaluate-session] 💾 "${equip.nom_equip}" desat -> BARS Nivell ${barsLevel} (${hitlScore}/100)`);

  return {
    idEquip: equip.id_equip,
    nomEquip: equip.nom_equip,
    score: hitlScore,
    barsLevel,
    profile,
    details: enrichedDetails,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const idEquip = body.idEquip || body.id_equip;
    const idSessio = body.idSessio || body.id_sessio || body.sessionId;

    if (!idEquip && !idSessio) {
      return NextResponse.json({ error: 'Cal indicar idSessio o bé idEquip' }, { status: 400 });
    }

    // Modalitat A: Sessió sencera
    if (idSessio) {
      console.log(`[evaluate-session] Iniciant auditoria BARS per a la sessió: ${idSessio}`);

      const { data: sessionData, error: sessionErr } = await supabase
        .from('sessions')
        .select('*')
        .eq('id_sessio', idSessio)
        .maybeSingle();

      if (sessionErr || !sessionData) {
        return NextResponse.json({ error: `Sessió ${idSessio} no trobada` }, { status: 404 });
      }

      let template: any = null;
      if (sessionData.id_template) {
        const { data: tpl } = await supabase
          .from('pedagogical_templates')
          .select('*')
          .eq('id_template', sessionData.id_template)
          .maybeSingle();
        template = tpl;
      }

      const { data: equips, error: equipsErr } = await supabase
        .from('equips')
        .select('id_equip, nom_equip, id_sessio')
        .eq('id_sessio', idSessio);

      console.log(`[evaluate-session] Equips trobats a la sessió: ${equips?.length || 0}`);

      if (equipsErr || !equips || equips.length === 0) {
        return NextResponse.json({ error: 'La sessió no té equips registrats' }, { status: 404 });
      }

      const evaluationPromises = equips.map((eq) =>
        evaluateSingleTeam({ ...eq, id_client: sessionData.id_client }, template)
      );

      const results = await Promise.allSettled(evaluationPromises);

      const successfulEvaluations = results.filter(
        (r) => r.status === 'fulfilled' && !(r.value as any).insufficientData
      );
      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => (r as PromiseRejectedResult).reason?.message);

      if (errors.length > 0 && successfulEvaluations.length === 0 && results.every((r) => r.status === 'rejected')) {
        console.error('[evaluate-session] Tots els equips han fallat:', errors);
        return NextResponse.json(
          { error: `Error desant a la base de dades: ${errors[0]}` },
          { status: 500 }
        );
      }

      const summary = results.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        return {
          idEquip: equips[i].id_equip,
          nomEquip: equips[i].nom_equip,
          error: (r as PromiseRejectedResult).reason?.message || 'Error desconegut',
        };
      });

      return NextResponse.json({
        success: true,
        sessionId: idSessio,
        totalEquips: equips.length,
        results: summary,
      });
    }

    // Modalitat B: Equip únic
    const { data: equip, error: equipError } = await supabase
      .from('equips')
      .select('id_equip, nom_equip, id_sessio')
      .eq('id_equip', idEquip)
      .maybeSingle();

    if (equipError || !equip) {
      return NextResponse.json({ error: `Equip no trobat: ${idEquip}` }, { status: 404 });
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id_sessio, id_client, id_template')
      .eq('id_sessio', equip.id_sessio)
      .maybeSingle();

    let template: any = null;
    if (session?.id_template) {
      const { data: tpl } = await supabase
        .from('pedagogical_templates')
        .select('*')
        .eq('id_template', session.id_template)
        .maybeSingle();
      template = tpl;
    }

    const result = await evaluateSingleTeam(
      {
        id_equip: equip.id_equip,
        nom_equip: equip.nom_equip,
        id_sessio: equip.id_sessio,
        id_client: session?.id_client,
      },
      template
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('❌ Error general a evaluate-session:', error);
    return NextResponse.json({ error: error.message || 'Error intern' }, { status: 500 });
  }
}