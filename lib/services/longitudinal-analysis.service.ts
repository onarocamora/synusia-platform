// lib/services/longitudinal-analysis.service.ts
import { supabaseAdmin } from '@/lib/supabase';

export type MaturityStatus =
  | 'REGRESSIÓ'
  | 'ESTANCAMENT'
  | 'PROGRESSIÓ_MODERADA'
  | 'SALT_QUALITATIU';

export interface TrajectoryDelta {
  barsLevelDelta: number;
  scoreDelta: number;
  detectionSpeedDelta: number | null; // Nombre de torns guanyats
  automationBiasResolved: boolean;
  cognitiveDebtResolved: boolean;
  maturityStatus: MaturityStatus;
}

export interface SessionEvaluationSnapshot {
  sessionId: string;
  sessionCode: string;
  caseTitle: string;
  evaluatedAt: string;
  barsLevel: number;
  hitlScore: number;
  profile: string;
  criticalErrorPassed: boolean;
  yieldedToAuthority: boolean;
  requestedPrimarySource: boolean;
  cognitiveDebt: boolean;
  turnDetected: number | null;
  scaffoldingCount: number;
  evidenceQuote: string | null;
}

export interface LongitudinalTrajectory {
  teamIdentifier: string;
  teamName: string;
  totalSessions: number;
  chronology: SessionEvaluationSnapshot[];
  delta: TrajectoryDelta | null;
}

/**
 * Funció pura de computació de deltes entre la primera sessió (Pre-Test) i la darrera (Post-Test)
 */
export function computeTrajectoryDelta(
  chronology: SessionEvaluationSnapshot[]
): TrajectoryDelta | null {
  if (chronology.length < 2) return null;

  const pre = chronology[0];
  const post = chronology[chronology.length - 1];

  const barsLevelDelta = post.barsLevel - pre.barsLevel;
  const scoreDelta = post.hitlScore - pre.hitlScore;

  // Càlcul d'acceleració en la detecció (menys torns = més ràpid)
  let detectionSpeedDelta: number | null = null;
  if (pre.turnDetected !== null && post.turnDetected !== null) {
    detectionSpeedDelta = pre.turnDetected - post.turnDetected;
  }

  // Comprovació de resolució de biaix i deute
  const automationBiasResolved = pre.criticalErrorPassed && !post.criticalErrorPassed;
  const cognitiveDebtResolved = pre.cognitiveDebt && !post.cognitiveDebt;

  let maturityStatus: MaturityStatus = 'ESTANCAMENT';
  if (barsLevelDelta > 1 || (pre.barsLevel <= 1 && post.barsLevel === 3)) {
    maturityStatus = 'SALT_QUALITATIU';
  } else if (barsLevelDelta > 0) {
    maturityStatus = 'PROGRESSIÓ_MODERADA';
  } else if (barsLevelDelta < 0) {
    maturityStatus = 'REGRESSIÓ';
  }

  return {
    barsLevelDelta,
    scoreDelta,
    detectionSpeedDelta,
    automationBiasResolved,
    cognitiveDebtResolved,
    maturityStatus,
  };
}

export class LongitudinalAnalysisService {
  /**
   * Obté la trajectòria d'un equip al llarg del temps cercant per codi d'equip o nom d'equip
   */
  static async getTeamTrajectory(teamKey: string): Promise<LongitudinalTrajectory | null> {
    const cleanKey = teamKey.trim();

    // 1. Cercar instàncies de l'equip a la base de dades
    const { data: teamInstances, error: teamErr } = await supabaseAdmin
      .from('equips')
      .select('id_equip, nom_equip, codi_equip, id_sessio, creat_el')
      .or(`codi_equip.eq.${cleanKey},nom_equip.ilike.${cleanKey},id_equip.eq.${cleanKey}`);

    if (teamErr || !teamInstances || teamInstances.length === 0) {
      return null;
    }

    const teamIds = teamInstances.map((t) => t.id_equip);
    const resolvedName = teamInstances[0].nom_equip || cleanKey;

    // 2. Cercar avaluacions associades a aquests equips
    let { data: rawEvals } = await supabaseAdmin
      .from('team_evaluations')
      .select('*')
      .in('id_equip', teamIds);

    if (!rawEvals || rawEvals.length === 0) {
      const fallback = await supabaseAdmin
        .from('team_evaluations')
        .select('*')
        .in('team_id', teamIds);
      rawEvals = fallback.data || [];
    }

    const validEvals = (rawEvals || []).filter((e) => e.hitl_score !== null);
    if (validEvals.length === 0) {
      return {
        teamIdentifier: cleanKey,
        teamName: resolvedName,
        totalSessions: teamInstances.length,
        chronology: [],
        delta: null,
      };
    }

    // 3. Obtenir metadades de les sessions associades
    const sessionIds = validEvals.map((e) => e.id_sessio || e.session_id);
    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select(`
        id_sessio,
        pin,
        codi,
        creat_el,
        pedagogical_templates (
          titol
        )
      `)
      .in('id_sessio', sessionIds);

    const sessionMap = new Map<string, any>();
    sessions?.forEach((s) => sessionMap.set(s.id_sessio, s));

    // 4. Mapejar cronologia ordenada
    const chronology: SessionEvaluationSnapshot[] = validEvals.map((ev) => {
      const sId = ev.id_sessio || ev.session_id;
      const sData = sessionMap.get(sId);
      const tpl = Array.isArray(sData?.pedagogical_templates)
        ? sData.pedagogical_templates[0]
        : sData?.pedagogical_templates;

      const details = (ev.evaluation_details as Record<string, any>) || {};
      const telemetry = details.telemetry_summary || {};
      const barsFramework = details.bars_framework || {};

      return {
        sessionId: sId,
        sessionCode: sData?.pin || sData?.codi || sId.slice(0, 6).toUpperCase(),
        caseTitle: tpl?.titol || 'Cas d’Auditoria HITL',
        evaluatedAt: ev.creat_el || ev.created_at || new Date().toISOString(),
        barsLevel: Number(barsFramework.bars_level ?? Math.round((ev.hitl_score || 0) / 33)),
        hitlScore: ev.hitl_score ?? 0,
        profile: ev.behavioral_profile || 'Desconegut',
        criticalErrorPassed: Boolean(details.critical_error_passed),
        yieldedToAuthority: Boolean(details.yielded_to_authority),
        requestedPrimarySource: Boolean(details.requested_primary_source),
        cognitiveDebt: Boolean(telemetry.cognitive_debt_flag),
        turnDetected: details.detection_evidence?.turn_detected ?? null,
        scaffoldingCount: telemetry.scaffolding_interventions || 0,
        evidenceQuote:
          details.yielded_evidence?.user_quote ||
          details.detection_evidence?.user_quote ||
          null,
      };
    });

    chronology.sort((a, b) => new Date(a.evaluatedAt).getTime() - new Date(b.evaluatedAt).getTime());

    // 5. Computar deltes comparatius
    const delta = computeTrajectoryDelta(chronology);

    return {
      teamIdentifier: cleanKey,
      teamName: resolvedName,
      totalSessions: chronology.length,
      chronology,
      delta,
    };
  }
}