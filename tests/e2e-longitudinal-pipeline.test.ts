// tests/e2e-longitudinal-pipeline.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import OpenAI from 'openai';
import { runSemanticJudge, calculateBarsLevel } from '@/lib/evaluation/bars-evaluator';
import { LongitudinalAnalysisService } from '@/lib/services/longitudinal-analysis.service';
import {
  GOLDEN_DATASET,
  CRITICAL_ERROR_DESC,
  REQUIRED_EVIDENCE,
} from './fixtures/golden-transcripts';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function insertInteractionLogs(
  teamId: string,
  turns: Array<{ actor: string; text: string }>,
  baseTime: number
) {
  const payloadWithTime = turns.map((t, idx) => ({
    id_equip: teamId,
    actor: t.actor,
    text: t.text,
    creat_el: new Date(baseTime + idx * 1000).toISOString(),
  }));

  const res1 = await supabase.from('logs_interaccio').insert(payloadWithTime);
  if (!res1.error) return;

  const payloadSimple = turns.map((t) => ({
    id_equip: teamId,
    actor: t.actor,
    text: t.text,
  }));

  const res2 = await supabase.from('logs_interaccio').insert(payloadSimple);
  if (res2.error) {
    throw new Error(`Error inserint logs a PostgreSQL: ${res2.error.message}`);
  }
}

async function fetchInteractionLogs(teamId: string) {
  const { data, error } = await supabase
    .from('logs_interaccio')
    .select('actor, text, creat_el')
    .eq('id_equip', teamId)
    .order('creat_el', { ascending: true });

  if (error) {
    const fallback = await supabase
      .from('logs_interaccio')
      .select('actor, text')
      .eq('id_equip', teamId);

    if (fallback.error) {
      throw new Error(`Error recuperant logs de PostgreSQL: ${fallback.error.message}`);
    }
    // Devolvemos el mapeo directamente aquí
    return (fallback.data || []).map((r) => ({ actor: r.actor as string, text: r.text as string }));
  }

  return (data || []).map((r) => ({ actor: r.actor as string, text: r.text as string }));
}

describe('E2E Real: Pipeline d’Avaluació i Trajectòria Longitudinal', () => {
  const testTeamCode = `E2E-TEAM-${Date.now().toString().slice(-4)}`;
  let clientId: string;
  let isCreatedClient = false;
  let sessionPreId: string;
  let sessionPostId: string;
  let teamPreId: string;
  let teamPostId: string;

  const preCase = GOLDEN_DATASET.find((c) => c.id === 'CASE_LEVEL_1_YIELDED')!;
  const postCase = GOLDEN_DATASET.find((c) => c.id === 'CASE_LEVEL_3_AUDITOR')!;

  beforeAll(async () => {
    // 1. Reutilitzar client existent o crear-ne un amb tipus_client vàlid
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id_client')
      .limit(1)
      .maybeSingle();

    if (existingClient?.id_client) {
      clientId = existingClient.id_client;
    } else {
      clientId = randomUUID();
      isCreatedClient = true;
      const clientRes = await supabase.from('clients').insert({
        id_client: clientId,
        nom: 'Empresa Test E2E',
        tipus_client: 'EMPRESA',
      });
      if (clientRes.error) throw new Error(`Error creant client: ${clientRes.error.message}`);
    }

    // 2. Sessió 1 (Pre-Test: fa 1 dia)
    sessionPreId = randomUUID();
    teamPreId = randomUUID();
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const sess1Res = await supabase.from('sessions').insert({
      id_sessio: sessionPreId,
      id_client: clientId,
      pin: `P1${Math.floor(10 + Math.random() * 89)}`,
      codi: `P1${Math.floor(10 + Math.random() * 89)}`,
      creat_el: pastDate,
    });
    if (sess1Res.error) throw new Error(`Error creant sessió 1: ${sess1Res.error.message}`);

    const team1Res = await supabase.from('equips').insert({
      id_equip: teamPreId,
      id_sessio: sessionPreId,
      nom_equip: 'Equip E2E Validat',
      codi_equip: testTeamCode,
      creat_el: pastDate,
    });
    if (team1Res.error) throw new Error(`Error creant equip 1: ${team1Res.error.message}`);

    // 3. Sessió 2 (Post-Test: avui)
    sessionPostId = randomUUID();
    teamPostId = randomUUID();
    const currentDate = new Date().toISOString();

    const sess2Res = await supabase.from('sessions').insert({
      id_sessio: sessionPostId,
      id_client: clientId,
      pin: `P2${Math.floor(10 + Math.random() * 89)}`,
      codi: `P2${Math.floor(10 + Math.random() * 89)}`,
      creat_el: currentDate,
    });
    if (sess2Res.error) throw new Error(`Error creant sessió 2: ${sess2Res.error.message}`);

    const team2Res = await supabase.from('equips').insert({
      id_equip: teamPostId,
      id_sessio: sessionPostId,
      nom_equip: 'Equip E2E Validat',
      codi_equip: testTeamCode,
      creat_el: currentDate,
    });
    if (team2Res.error) throw new Error(`Error creant equip 2: ${team2Res.error.message}`);

    // 4. Inserció dels transcrits en brut a logs_interaccio en paral·lel
    const baseTimePast = Date.now() - 24 * 60 * 60 * 1000;
    const baseTimeCurrent = Date.now();
    await Promise.all([
      insertInteractionLogs(teamPreId, preCase.turns, baseTimePast),
      insertInteractionLogs(teamPostId, postCase.turns, baseTimeCurrent),
    ]);
  });

  afterAll(async () => {
    await supabase.from('team_evaluations').delete().in('id_equip', [teamPreId, teamPostId]);
    await supabase.from('logs_interaccio').delete().in('id_equip', [teamPreId, teamPostId]);
    await supabase.from('equips').delete().in('id_equip', [teamPreId, teamPostId]);
    await supabase.from('sessions').delete().in('id_sessio', [sessionPreId, sessionPostId]);
    if (isCreatedClient && clientId) {
      await supabase.from('clients').delete().eq('id_client', clientId);
    }
  });

  it('ha d’executar el pipeline complet: avaluar logs en brut amb GPT-4o, persistir a BD i calcular la trajectòria', async () => {
    // 1. Lectura en paral·lel dels logs de les dues sessions
    const [logs1, logs2] = await Promise.all([
      fetchInteractionLogs(teamPreId),
      fetchInteractionLogs(teamPostId),
    ]);

    expect(logs1.length).toBe(preCase.turns.length);
    expect(logs2.length).toBe(postCase.turns.length);

    // 2. Avaluació semàntica paral·lela amb GPT-4o (estalvia ~50% de temps)
    const [judge1, judge2] = await Promise.all([
      runSemanticJudge(openai, logs1, CRITICAL_ERROR_DESC, REQUIRED_EVIDENCE),
      runSemanticJudge(openai, logs2, CRITICAL_ERROR_DESC, REQUIRED_EVIDENCE),
    ]);

    // 3. Càlcul BARS
    const eval1 = calculateBarsLevel(judge1, preCase.momentAProbe);
    const eval2 = calculateBarsLevel(judge2, postCase.momentAProbe);

    expect(eval1.barsLevel).toBe(1);
    expect(judge1.error_detected).toBe(true);
    expect(judge1.yielded_to_authority).toBe(true);

    expect(eval2.barsLevel).toBe(3);
    expect(judge2.requested_primary_source).toBe(true);
    expect(judge2.yielded_to_authority).toBe(false);

    // 4. Persistència de les dues avaluacions a Supabase
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const currentDate = new Date().toISOString();

    await Promise.all([
      supabase.from('team_evaluations').insert({
        id_equip: teamPreId,
        id_sessio: sessionPreId,
        hitl_score: eval1.hitlScore,
        behavioral_profile: eval1.profile,
        creat_el: pastDate,
        evaluation_details: {
          ...judge1,
          bars_framework: { bars_level: eval1.barsLevel },
          telemetry_summary: { cognitive_debt_flag: eval1.isComplacent },
        },
      }),
      supabase.from('team_evaluations').insert({
        id_equip: teamPostId,
        id_sessio: sessionPostId,
        hitl_score: eval2.hitlScore,
        behavioral_profile: eval2.profile,
        creat_el: currentDate,
        evaluation_details: {
          ...judge2,
          bars_framework: { bars_level: eval2.barsLevel },
          telemetry_summary: { cognitive_debt_flag: eval2.isComplacent },
        },
      }),
    ]);

    // 5. Verificació de la trajectòria calculada pel servei
    const trajectory = await LongitudinalAnalysisService.getTeamTrajectory(testTeamCode);

    expect(trajectory).not.toBeNull();
    expect(trajectory?.totalSessions).toBe(2);
    expect(trajectory?.delta).not.toBeNull();
    expect(trajectory?.delta?.barsLevelDelta).toBe(2); // Salt de N1 a N3
    expect(trajectory?.delta?.automationBiasResolved).toBe(true);
    expect(trajectory?.delta?.maturityStatus).toBe('SALT_QUALITATIU');
  }, 45000);
});