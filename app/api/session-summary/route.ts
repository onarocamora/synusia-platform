// app/api/session-summary/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ReportingService, OrganizationType } from '@/lib/services/reporting.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId') || searchParams.get('id_sessio');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Falta el paràmetre sessionId o id_sessio' },
        { status: 400 }
      );
    }

   // 1. Obtenir en paral·lel: Avaluacions d'equips + Dades de l'Organització (Client)
    const [evaluationsRes, sessionRes] = await Promise.all([
      supabaseAdmin
        .from('team_evaluations')
        .select(`
          id_equip,
          id_sessio,
          hitl_score,
          behavioral_profile,
          evaluation_details,
          equips (
            nom_equip
          )
        `)
        .eq('id_sessio', sessionId),
      supabaseAdmin
        .from('sessions')
        .select(`
          id_sessio,
          id_client,
          clients (
            nom,
            tipus_organitzacio
          )
        `)
        .eq('id_sessio', sessionId)
        .maybeSingle(),
    ]);

    let teams = evaluationsRes.data;
    let error = evaluationsRes.error;

    // Fallback retrocompatible si la BD encara té les columnes antigues en anglès
    if (error && (error.code === '42703' || error.message?.includes('does not exist'))) {
      const fallback = await supabaseAdmin
        .from('team_evaluations')
        .select(`
          team_id,
          session_id,
          hitl_score,
          behavioral_profile,
          evaluation_details
        `)
        .eq('session_id', sessionId);
      teams = fallback.data as any;
      error = fallback.error;
    }

    if (error) {
      console.error('Error consultant team_evaluations:', error);
      return NextResponse.json({ error: 'Error intern consultant avaluacions' }, { status: 500 });
    }

    if (!teams || teams.length === 0) {
      return NextResponse.json(
        { error: 'No hi ha dades per a aquesta sessió' },
        { status: 404 }
      );
    }

    const totalTeams = teams.length;

    // Resolució del nom i tipus d'organització (Corporate vs Educació)
    const sessionData = sessionRes.data as any;
    const clientNode = sessionData?.clients
      ? (Array.isArray(sessionData.clients) ? sessionData.clients[0] : sessionData.clients)
      : null;

    const organizationName: string = clientNode?.nom || 'Organització';
    const organizationType: OrganizationType =
      (clientNode?.tipus_organitzacio as OrganizationType) || 'CORPORATE';

    // 2. Acumuladors per a mètriques globals i d'estrès cognitiu
    let criticalErrorsPassedCount = 0;
    let yieldedToAuthorityCount = 0;
    let cognitiveDebtCount = 0;
    let teamsWithScaffoldingCount = 0;
    let totalScaffoldingInterventions = 0;
    let totalVaguePrompts = 0;
    let totalJailbreakAttempts = 0;

    let sumMomentAConfidence = 0;
    let countMomentA = 0;
    let sumMomentBCertainty = 0;
    let countMomentB = 0;

    const profileDistribution: Record<string, number> = {};

    teams.forEach((t: any) => {
      const profile = t.behavioral_profile || 'DESCONEGUT';
      profileDistribution[profile] = (profileDistribution[profile] || 0) + 1;

      const details = (t.evaluation_details as Record<string, any>) || {};
      const telemetry = details.telemetry_summary || {};

      if (details.critical_error_passed) criticalErrorsPassedCount++;
      if (details.yielded_to_authority) yieldedToAuthorityCount++;

      // Deute cognitiu (automation complacency)
      if (telemetry.cognitive_debt_flag) cognitiveDebtCount++;

      // Dependència de bastides pedagògiques
      const scaffoldingCount = telemetry.scaffolding_interventions || 0;
      totalScaffoldingInterventions += scaffoldingCount;
      if (scaffoldingCount > 0) teamsWithScaffoldingCount++;

      // Obstacles i filtres de seguretat
      totalVaguePrompts += telemetry.vague_prompts_count || 0;
      totalJailbreakAttempts += telemetry.jailbreak_attempts || 0;

      // Sondes de confiança
      if (typeof telemetry.moment_a_confidence === 'number') {
        sumMomentAConfidence += telemetry.moment_a_confidence;
        countMomentA++;
      }
      if (typeof telemetry.moment_b_certainty === 'number') {
        sumMomentBCertainty += telemetry.moment_b_certainty;
        countMomentB++;
      }
    });

    const averageScore = Math.round(
      teams.reduce((acc: number, t: any) => acc + (t.hitl_score || 0), 0) / totalTeams
    );

    // 3. Generació de l'informe agregat
    const aggregateReport = {
      sessionId,
      totalTeams,
      averageScore,
      
      // Mètriques de Riscos i Decisió Humana (HITL)
      criticalVulnerabilityRate: Math.round((criticalErrorsPassedCount / totalTeams) * 100),
      submissionRate: Math.round((yieldedToAuthorityCount / totalTeams) * 100),
      cognitiveDebtRate: Math.round((cognitiveDebtCount / totalTeams) * 100),

      // Mètriques d'Autonomia i Bastides Socràtiques
      scaffoldingDependencyRate: Math.round((teamsWithScaffoldingCount / totalTeams) * 100),
      avgScaffoldingInterventions: Number((totalScaffoldingInterventions / totalTeams).toFixed(1)),

      // Calibratge de Confiança Percebuda
      confidenceCalibration: {
        avgMomentAConfidence: countMomentA > 0 ? Number((sumMomentAConfidence / countMomentA).toFixed(2)) : null,
        avgMomentBCertainty: countMomentB > 0 ? Number((sumMomentBCertainty / countMomentB).toFixed(2)) : null,
      },

      // Incidències d'Interacció
      hurdlesSummary: {
        totalVaguePrompts,
        totalJailbreakAttempts,
      },

      profileDistribution,

      // Desglossament individualitzat per equip
      teamsBreakdown: teams.map((t: any) => {
        const details = (t.evaluation_details as Record<string, any>) || {};
        const telemetry = details.telemetry_summary || {};
        const teamName = Array.isArray(t.equips)
          ? t.equips[0]?.nom_equip
          : t.equips?.nom_equip || 'Equip';

        return {
          teamId: t.id_equip || t.team_id,
          teamName,
          score: t.hitl_score,
          profile: t.behavioral_profile,
          criticalErrorPassed: Boolean(details.critical_error_passed),
          yieldedToAuthority: Boolean(details.yielded_to_authority),
          cognitiveDebt: Boolean(telemetry.cognitive_debt_flag),
          scaffoldingCount: telemetry.scaffolding_interventions || 0,
          confidenceMomentA: telemetry.moment_a_confidence ?? null,
          certaintyMomentB: telemetry.moment_b_certainty ?? null,
          turnDetected: details.turn_detected ?? null,
          evaluatorNotes: details.summary || details.reasoning || null,
        };
      }),
    };


    const teamsBreakdown = teams.map((t: any) => {
      const details = (t.evaluation_details as Record<string, any>) || {};
      const telemetry = details.telemetry_summary || {};
      const teamName = Array.isArray(t.equips)
        ? t.equips[0]?.nom_equip
        : t.equips?.nom_equip || 'Equip';

      return {
        teamId: t.id_equip || t.team_id,
        teamName,
        score: t.hitl_score,
        profile: t.behavioral_profile,
        criticalErrorPassed: Boolean(details.critical_error_passed),
        yieldedToAuthority: Boolean(details.yielded_to_authority),
        cognitiveDebt: Boolean(telemetry.cognitive_debt_flag),
        scaffoldingCount: telemetry.scaffolding_interventions || 0,
        confidenceMomentA: telemetry.moment_a_confidence ?? null,
        certaintyMomentB: telemetry.moment_b_certainty ?? null,
        turnDetected: details.turn_detected ?? null,
        evaluatorNotes: details.summary || details.reasoning || null,
      };
    });

    const criticalVulnerabilityRate = Math.round((criticalErrorsPassedCount / totalTeams) * 100);
    const submissionRate = Math.round((yieldedToAuthorityCount / totalTeams) * 100);
    const cognitiveDebtRate = Math.round((cognitiveDebtCount / totalTeams) * 100);
    const scaffoldingDependencyRate = Math.round((teamsWithScaffoldingCount / totalTeams) * 100);
    const avgScaffoldingInterventions = Number((totalScaffoldingInterventions / totalTeams).toFixed(1));

    // Generació automàtica de la narrativa (Corporate vs Acadèmica)
    const dualReport = ReportingService.generateReport({
      sessionId,
      organizationName,
      organizationType,
      totalTeams,
      averageScore,
      criticalVulnerabilityRate,
      submissionRate,
      cognitiveDebtRate,
      scaffoldingDependencyRate,
      avgScaffoldingInterventions,
      confidenceCalibration: {
        avgMomentAConfidence: countMomentA > 0 ? Number((sumMomentAConfidence / countMomentA).toFixed(2)) : null,
        avgMomentBCertainty: countMomentB > 0 ? Number((sumMomentBCertainty / countMomentB).toFixed(2)) : null,
      },
      profileDistribution,
      teamsBreakdown,
    });

    return NextResponse.json({
      sessionId,
      totalTeams,
      averageScore,
      criticalVulnerabilityRate,
      submissionRate,
      cognitiveDebtRate,
      scaffoldingDependencyRate,
      avgScaffoldingInterventions,
      confidenceCalibration: {
        avgMomentAConfidence: countMomentA > 0 ? Number((sumMomentAConfidence / countMomentA).toFixed(2)) : null,
        avgMomentBCertainty: countMomentB > 0 ? Number((sumMomentBCertainty / countMomentB).toFixed(2)) : null,
      },
      hurdlesSummary: {
        totalVaguePrompts,
        totalJailbreakAttempts,
      },
      profileDistribution,
      teamsBreakdown,
      dualReport,
    });

    return NextResponse.json(aggregateReport);
  } catch (err: any) {
    console.error('Error a session-summary:', err);
    return NextResponse.json({ error: err.message || 'Error intern processant el resum' }, { status: 500 });
  }
}