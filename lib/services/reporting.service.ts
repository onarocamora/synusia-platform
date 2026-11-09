// lib/services/reporting.service.ts

export type OrganizationType = 'CORPORATE' | 'EDUCATION' | 'PUBLIC';

export interface AggregateMetricsInput {
  sessionId: string;
  organizationName: string;
  organizationType: OrganizationType;
  totalTeams: number;
  averageScore: number;
  criticalVulnerabilityRate: number;
  submissionRate: number;
  cognitiveDebtRate: number;
  scaffoldingDependencyRate: number;
  avgScaffoldingInterventions: number;
  confidenceCalibration: {
    avgMomentAConfidence: number | null;
    avgMomentBCertainty: number | null;
  };
  profileDistribution: Record<string, number>;
  teamsBreakdown: Array<{
    teamId: string;
    teamName: string;
    score: number;
    profile: string;
    criticalErrorPassed: boolean;
    yieldedToAuthority: boolean;
    cognitiveDebt: boolean;
    scaffoldingCount: number;
  }>;
}

export interface DualReportOutput {
  reportType: OrganizationType;
  title: string;
  targetAudience: string;
  executiveSummary: string;
  keyIndicators: Array<{ label: string; value: string; riskLevel?: 'BAIX' | 'MITJÀ' | 'CRÍTIC' | 'OPTIM' }>;
  behavioralAnalysis: string;
  actionableRecommendations: string[];
}

export class ReportingService {
  static generateReport(data: AggregateMetricsInput): DualReportOutput {
    if (data.organizationType === 'EDUCATION') {
      return this.generateEducationalReport(data);
    }
    return this.generateCorporateReport(data);
  }

  // --- 1. NARRATIVA CORPORATIVA (COMPLIANCE / RISK AUDIT) ---
  private static generateCorporateReport(data: AggregateMetricsInput): DualReportOutput {
    const isCriticalRisk = data.criticalVulnerabilityRate >= 30;
    const isHighComplacency = data.cognitiveDebtRate >= 25;

    const complianceVerdict = isCriticalRisk
      ? 'NO CONFORME: Vulnerabilitat severa davant d’al·lucinacions algorítmiques en entorns operatius.'
      : 'CONFORME AMB OBSERVACIONS: Capacitat de supervisió humana operativa dins dels marges de tolerància.';

    return {
      reportType: 'CORPORATE',
      title: `Auditoria de Supervisió Humana (HITL) - ${data.organizationName}`,
      targetAudience: 'Comitè de Riscos, Compliance (Art. 14 EU AI Act) i Direcció d’Operacions',
      executiveSummary: `${complianceVerdict} En un total de ${data.totalTeams} equips operatius avaluats sota estrès de biaix algorítmic, la taxa de filtració d’errors crítics és del ${data.criticalVulnerabilityRate}% amb una submissió acrítica del ${data.submissionRate}%.`,
      keyIndicators: [
        {
          label: 'Índex de Resiliència HITL Global',
          value: `${data.averageScore} / 100`,
          riskLevel: data.averageScore >= 70 ? 'OPTIM' : data.averageScore >= 50 ? 'MITJÀ' : 'CRÍTIC',
        },
        {
          label: 'Taxa de Filtració d’Errors Crítics',
          value: `${data.criticalVulnerabilityRate}%`,
          riskLevel: isCriticalRisk ? 'CRÍTIC' : 'BAIX',
        },
        {
          label: 'Complaença Cega (Deute Cognitiu)',
          value: `${data.cognitiveDebtRate}%`,
          riskLevel: isHighComplacency ? 'CRÍTIC' : 'BAIX',
        },
        {
          label: 'Dependència de Suport Extern',
          value: `${data.scaffoldingDependencyRate}% dels equips`,
          riskLevel: data.scaffoldingDependencyRate > 40 ? 'MITJÀ' : 'OPTIM',
        },
      ],
      behavioralAnalysis: `L’anàlisi de calibratge indica una confiança inicial mitjana de ${data.confidenceCalibration.avgMomentAConfidence ?? 'N/D'} sobre 5. Un ${data.cognitiveDebtRate}% dels equips van manifestar una certesa màxima abans de verificar i posteriorment van validar comandes industrials amb errors greus de cost o normativa, evidenciant el risc d'automatització passiva.`,
      actionableRecommendations: [
        'Instaurar protocols de doble verificació obligatòria quan els sistemes d’IA suggereixin canvis de proveïdor o paràmetres de soldadura/qualitat.',
        'Desenvolupar formació específica en auditoria de fonts primàries per reduir la submissió a l’autoritat algorítmica.',
        'Restringir l’autonomia d’execució automàtica en aquells fluxos de treball on l’índex de resiliència de l’operador humà se situï per sota dels 60 punts.',
      ],
    };
  }

  // --- 2. NARRATIVA ACADÈMICA (RÚBRICA FORMATIVA) ---
  private static generateEducationalReport(data: AggregateMetricsInput): DualReportOutput {
    return {
      reportType: 'EDUCATION',
      title: `Rúbrica de Pensament Crític Digital - ${data.organizationName}`,
      targetAudience: 'Equip Docent, Coordinació Pedagògica i Alumnat',
      executiveSummary: `Avaluació competencial completada per a ${data.totalTeams} grups de treball. La puntuació competencial mitjana se situa en ${data.averageScore}/100, amb un ${data.scaffoldingDependencyRate}% dels grups requerint bastides pedagògiques socràtiques per desbloquejar el contrast documental.`,
      keyIndicators: [
        {
          label: 'Assoliment Competencial Mitjà',
          value: `${data.averageScore} / 100`,
          riskLevel: data.averageScore >= 70 ? 'OPTIM' : 'MITJÀ',
        },
        {
          label: 'Autonomia en el Contrast Documental',
          value: `${100 - data.scaffoldingDependencyRate}% resolució autònoma`,
          riskLevel: data.scaffoldingDependencyRate <= 30 ? 'OPTIM' : 'MITJÀ',
        },
        {
          label: 'Submissió a la Proposta del Bot',
          value: `${data.submissionRate}% dels grups`,
          riskLevel: data.submissionRate > 35 ? 'CRÍTIC' : 'BAIX',
        },
      ],
      behavioralAnalysis: `Distribució competencial observada: ${Object.entries(data.profileDistribution)
        .map(([perfil, count]) => `${perfil}: ${count} grup(s)`)
        .join(', ')}. La confiança declarada va passar d'una mitjana de ${data.confidenceCalibration.avgMomentAConfidence ?? 'N/D'} a ${data.confidenceCalibration.avgMomentBCertainty ?? 'N/D'} un cop enfrontats a les discrepàncies del dossier oficial.`,
      actionableRecommendations: [
        'Treballar a l’aula la lectura comparada de documents tècnics prèviament a la formulació de consultes a models d’intel·ligència artificial.',
        'Reforçar la formulació de preguntes obertes i socràtiques en lloc d’instruccions d’acceptació directa.',
        'Utilitzar les transcripcions dels equips amb perfil "Vulnerable a la Pressió" com a estudi de cas per a debats en grup gran.',
      ],
    };
  }
}