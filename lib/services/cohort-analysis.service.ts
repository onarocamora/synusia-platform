// lib/services/cohort-analysis.service.ts
import { supabaseAdmin } from '@/lib/supabase';

export interface CohortDistribution {
  level0: number; // Complaença Cega
  level1: number; // Dubte no operatiu
  level2: number; // Fricció assertiva
  level3: number; // Auditor calibrat
}

export interface PseudonymizedTeamDelta {
  pseudoId: string; // Ex: "EQ-01" per preservar el GDPR / privacitat laboral
  teamCode: string;
  preBarsLevel: number;
  postBarsLevel: number;
  deltaBars: number;
  biasResolved: boolean;
  cognitiveDebtEliminated: boolean;
}

export interface CohortAuditReport {
  cohortName: string;
  clientName: string;
  preDate: string;
  postDate: string;
  totalTeams: number;
  evaluatedTeams: number;
  metrics: {
    abrPre: number; // Automation Bias Rate Pre-Test (%)
    abrPost: number; // Automation Bias Rate Post-Test (%)
    abrReduction: number; // Reducció neta en punts percentuals
    meanBarsPre: number;
    meanBarsPost: number;
    deltaBarsMean: number;
    cognitiveDebtPreRate: number; // % equips amb deute cognitiu inicial
    cognitiveDebtPostRate: number; // % equips amb deute cognitiu residual
    primarySourceDemandPreRate: number; // % equips que demanaven font primària
    primarySourceDemandPostRate: number;
  };
  distributionPre: CohortDistribution;
  distributionPost: CohortDistribution;
  teamDeltas: PseudonymizedTeamDelta[];
  complianceVerdict: 'COMPLIMENT_EXCEL·LENT' | 'COMPLIMENT_SATISFACTORI' | 'RISC_RESIDUAL_DETECTAT';
}

export class CohortAnalysisService {
  static async generateReport(
    preSessionId: string,
    postSessionId: string,
    cohortLabel = 'Cohort Corporativa'
  ): Promise<CohortAuditReport | null> {
    // 1. Obtenir dades de les dues sessions
    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select('id_sessio, creat_el, clients (nom)')
      .in('id_sessio', [preSessionId, postSessionId]);

    if (!sessions || sessions.length < 2) return null;

    const preSession = sessions.find((s) => s.id_sessio === preSessionId)!;
    const postSession = sessions.find((s) => s.id_sessio === postSessionId)!;
    const clientData = Array.isArray(preSession.clients) ? preSession.clients[0] : preSession.clients;
    const clientName = clientData?.nom || 'Organització Auditada';

    // 2. Obtenir equips i avaluacions d'ambdues sessions
    const [evalsPreRes, evalsPostRes] = await Promise.all([
      supabaseAdmin
        .from('team_evaluations')
        .select('id_equip, hitl_score, evaluation_details, equips (nom_equip, codi_equip)')
        .eq('id_sessio', preSessionId),
      supabaseAdmin
        .from('team_evaluations')
        .select('id_equip, hitl_score, evaluation_details, equips (nom_equip, codi_equip)')
        .eq('id_sessio', postSessionId),
    ]);

    const evalsPre = evalsPreRes.data || [];
    const evalsPost = evalsPostRes.data || [];

    // Mapejar avaluacions per clau d'equip (codi_equip o nom_equip)
    const getTeamKey = (row: any) => {
      const eq = Array.isArray(row.equips) ? row.equips[0] : row.equips;
      return (eq?.codi_equip || eq?.nom_equip || '').trim().toUpperCase();
    };

    const preMap = new Map<string, any>();
    evalsPre.forEach((r) => {
      const k = getTeamKey(r);
      if (k) preMap.set(k, r);
    });

    const postMap = new Map<string, any>();
    evalsPost.forEach((r) => {
      const k = getTeamKey(r);
      if (k) postMap.set(k, r);
    });

    // Buscar parelles coincidents
    const commonKeys = Array.from(preMap.keys()).filter((k) => postMap.has(k));
    const evaluatedTeams = commonKeys.length;

    if (evaluatedTeams === 0) return null;

    let errorPassedPreCount = 0;
    let errorPassedPostCount = 0;
    let totalBarsPre = 0;
    let totalBarsPost = 0;
    let cognitiveDebtPreCount = 0;
    let cognitiveDebtPostCount = 0;
    let sourceDemandPreCount = 0;
    let sourceDemandPostCount = 0;

    const distPre: CohortDistribution = { level0: 0, level1: 0, level2: 0, level3: 0 };
    const distPost: CohortDistribution = { level0: 0, level1: 0, level2: 0, level3: 0 };

    const teamDeltas: PseudonymizedTeamDelta[] = [];

    commonKeys.forEach((key, index) => {
      const pre = preMap.get(key);
      const post = postMap.get(key);

      const dPre = pre.evaluation_details || {};
      const dPost = post.evaluation_details || {};

      const lvlPre = Number(dPre.bars_framework?.bars_level ?? Math.round((pre.hitl_score || 0) / 33));
      const lvlPost = Number(dPost.bars_framework?.bars_level ?? Math.round((post.hitl_score || 0) / 33));

      totalBarsPre += lvlPre;
      totalBarsPost += lvlPost;

      if (lvlPre === 0) distPre.level0++;
      if (lvlPre === 1) distPre.level1++;
      if (lvlPre === 2) distPre.level2++;
      if (lvlPre === 3) distPre.level3++;

      if (lvlPost === 0) distPost.level0++;
      if (lvlPost === 1) distPost.level1++;
      if (lvlPost === 2) distPost.level2++;
      if (lvlPost === 3) distPost.level3++;

      if (dPre.critical_error_passed) errorPassedPreCount++;
      if (dPost.critical_error_passed) errorPassedPostCount++;

      if (dPre.telemetry_summary?.cognitive_debt_flag) cognitiveDebtPreCount++;
      if (dPost.telemetry_summary?.cognitive_debt_flag) cognitiveDebtPostCount++;

      if (dPre.requested_primary_source) sourceDemandPreCount++;
      if (dPost.requested_primary_source) sourceDemandPostCount++;

      teamDeltas.push({
        pseudoId: `EQ-${String(index + 1).padStart(2, '0')}`,
        teamCode: key,
        preBarsLevel: lvlPre,
        postBarsLevel: lvlPost,
        deltaBars: lvlPost - lvlPre,
        biasResolved: Boolean(dPre.critical_error_passed && !dPost.critical_error_passed),
        cognitiveDebtEliminated: Boolean(dPre.telemetry_summary?.cognitive_debt_flag && !dPost.telemetry_summary?.cognitive_debt_flag),
      });
    });

    const abrPre = Math.round((errorPassedPreCount / evaluatedTeams) * 100);
    const abrPost = Math.round((errorPassedPostCount / evaluatedTeams) * 100);
    const meanBarsPre = Number((totalBarsPre / evaluatedTeams).toFixed(2));
    const meanBarsPost = Number((totalBarsPost / evaluatedTeams).toFixed(2));

    let complianceVerdict: CohortAuditReport['complianceVerdict'] = 'RISC_RESIDUAL_DETECTAT';
    if (abrPost <= 15 && meanBarsPost >= 2.5) {
      complianceVerdict = 'COMPLIMENT_EXCEL·LENT';
    } else if (abrPost <= 35 && meanBarsPost >= 2.0) {
      complianceVerdict = 'COMPLIMENT_SATISFACTORI';
    }

    return {
      cohortName: cohortLabel,
      clientName,
      preDate: preSession.creat_el,
      postDate: postSession.creat_el,
      totalTeams: Math.max(evalsPre.length, evalsPost.length),
      evaluatedTeams,
      metrics: {
        abrPre,
        abrPost,
        abrReduction: abrPre - abrPost,
        meanBarsPre,
        meanBarsPost,
        deltaBarsMean: Number((meanBarsPost - meanBarsPre).toFixed(2)),
        cognitiveDebtPreRate: Math.round((cognitiveDebtPreCount / evaluatedTeams) * 100),
        cognitiveDebtPostRate: Math.round((cognitiveDebtPostCount / evaluatedTeams) * 100),
        primarySourceDemandPreRate: Math.round((sourceDemandPreCount / evaluatedTeams) * 100),
        primarySourceDemandPostRate: Math.round((sourceDemandPostCount / evaluatedTeams) * 100),
      },
      distributionPre: distPre,
      distributionPost: distPost,
      teamDeltas,
      complianceVerdict,
    };
  }
}