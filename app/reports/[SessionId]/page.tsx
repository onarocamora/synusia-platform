// app/reports/[sessionId]/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { supabaseAdmin } from '@/lib/supabase';
import { ReportingService, OrganizationType } from '@/lib/services/reporting.service';
import { PrintButton } from '@/components/reports/PrintButton';
import { EvaluateSessionButton } from '@/components/reports/EvaluateSessionButton';

interface ReportPageProps {
  params: Promise<Record<string, string>> | Record<string, string>;
}

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: ReportPageProps) {
  const rawParams = await Promise.resolve(params);

  const identifier = (
    rawParams?.sessionId ||
    rawParams?.id ||
    rawParams?.session ||
    (rawParams ? Object.values(rawParams)[0] : '') ||
    ''
  ).trim();

  if (!identifier) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-rose-600">
            Falta l&apos;identificador de la sessió a la URL.
          </p>
        </div>
      </div>
    );
  }

  // 1. Cercar sessió ràpidament per UUID o PIN
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  
  let sessionQuery = supabaseAdmin.from('sessions').select('*');
  if (isUUID) {
    sessionQuery = sessionQuery.eq('id_sessio', identifier);
  } else {
    sessionQuery = sessionQuery.eq('pin_acces', identifier.toUpperCase());
  }

  const { data: sessionData } = await sessionQuery.maybeSingle();

  if (!sessionData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <div className="max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            🔍
          </div>
          <h1 className="text-xl font-bold text-slate-900">Sessió no trobada</h1>
          <p className="mt-2 text-sm text-slate-600">
            No s&apos;ha trobat cap registre a <code className="font-mono text-xs">sessions</code> associat a{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-800">
              {identifier}
            </code>.
          </p>
          <div className="mt-6">
            <Link
              href="/admin"
              className="inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
            >
              Tornar al tauler
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const canonicalSessionId = sessionData.id_sessio;
  const sessionCode = sessionData.pin_acces || identifier.toUpperCase();

  // 2. Consultes en paral·lel
  const [clientRes, evaluationsRes, equipsRes, siblingsRes] = await Promise.all([
    sessionData.id_client
      ? supabaseAdmin.from('clients').select('*').eq('id_client', sessionData.id_client).maybeSingle()
      : Promise.resolve({ data: null }),

    supabaseAdmin
      .from('team_evaluations')
      .select('*')
      .or(`id_sessio.eq.${canonicalSessionId},session_id.eq.${canonicalSessionId}`),

    supabaseAdmin
      .from('equips')
      .select('id_equip, nom_equip, codi_equip')
      .eq('id_sessio', canonicalSessionId),

    sessionData.id_client
      ? supabaseAdmin
          .from('sessions')
          .select('id_sessio, pin_acces, created_at')
          .eq('id_client', sessionData.id_client)
          .neq('id_sessio', canonicalSessionId)
          .order('id_sessio', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: null }),
  ]);

  const clientData = clientRes.data;
  const organizationName = clientData?.nom || clientData?.nom_client || 'Organització';
  const organizationType: OrganizationType = (clientData?.tipus_organitzacio as OrganizationType) || 'CORPORATE';

  const evaluations = evaluationsRes.data || [];

  if (evaluations.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <div className="max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-600">
            ⏳
          </div>
          <h1 className="text-xl font-bold text-slate-900">Sessió pendent d&apos;avaluació</h1>
          <p className="mt-2 text-sm text-slate-600">
            La sessió <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-sky-700">{sessionCode}</code> no té cap auditoria BARS calculada a la base de dades.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            <EvaluateSessionButton sessionId={canonicalSessionId} />
            <Link
              href="/admin"
              className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              &larr; Tornar al tauler
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const teamNameMap = new Map<string, string>();
  (equipsRes.data || []).forEach((eq: any) => {
    teamNameMap.set(eq.id_equip, eq.nom_equip);
  });

  const evaluableTeams = evaluations.filter((t) => t.hitl_score !== null);
  const insufficientTeams = evaluations.filter((t) => t.hitl_score === null);
  const totalEvaluable = evaluableTeams.length;

  let criticalErrorsPassedCount = 0;
  let yieldedToAuthorityCount = 0;
  let cognitiveDebtCount = 0;
  let teamsWithScaffoldingCount = 0;
  let totalScaffoldingInterventions = 0;
  let sumMomentAConfidence = 0;
  let countMomentA = 0;
  let sumMomentBCertainty = 0;
  let countMomentB = 0;

  const profileDistribution: Record<string, number> = {};

  evaluableTeams.forEach((t: any) => {
    const profile = t.behavioral_profile || 'DESCONEGUT';
    profileDistribution[profile] = (profileDistribution[profile] || 0) + 1;

    const details = (t.evaluation_details as Record<string, any>) || {};
    const telemetry = details.telemetry_summary || {};

    if (details.critical_error_passed) criticalErrorsPassedCount++;
    if (details.yielded_to_authority) yieldedToAuthorityCount++;
    if (telemetry.cognitive_debt_flag) cognitiveDebtCount++;

    const scaffoldingCount = telemetry.scaffolding_interventions || 0;
    totalScaffoldingInterventions += scaffoldingCount;
    if (scaffoldingCount > 0) teamsWithScaffoldingCount++;

    if (typeof telemetry.moment_a_confidence === 'number') {
      sumMomentAConfidence += telemetry.moment_a_confidence;
      countMomentA++;
    }
    if (typeof telemetry.moment_b_certainty === 'number') {
      sumMomentBCertainty += telemetry.moment_b_certainty;
      countMomentB++;
    }
  });

  const averageScore = totalEvaluable > 0
    ? Math.round(evaluableTeams.reduce((acc: number, t: any) => acc + (t.hitl_score || 0), 0) / totalEvaluable)
    : 0;

  const criticalVulnerabilityRate = totalEvaluable > 0
    ? Math.round((criticalErrorsPassedCount / totalEvaluable) * 100)
    : 0;
  const submissionRate = totalEvaluable > 0
    ? Math.round((yieldedToAuthorityCount / totalEvaluable) * 100)
    : 0;
  const cognitiveDebtRate = totalEvaluable > 0
    ? Math.round((cognitiveDebtCount / totalEvaluable) * 100)
    : 0;
  const scaffoldingDependencyRate = totalEvaluable > 0
    ? Math.round((teamsWithScaffoldingCount / totalEvaluable) * 100)
    : 0;
  const avgScaffoldingInterventions = totalEvaluable > 0
    ? Number((totalScaffoldingInterventions / totalEvaluable).toFixed(1))
    : 0;

  const allTeamsBreakdown = evaluations.map((t: any) => {
    const details = (t.evaluation_details as Record<string, any>) || {};
    const telemetry = details.telemetry_summary || {};
    const teamId = t.id_equip || t.team_id;
    const teamName = teamNameMap.get(teamId) || 'Equip';
    const isEvaluable = t.hitl_score !== null;

    return {
      teamId,
      teamName,
      isEvaluable,
      score: t.hitl_score,
      profile: t.behavioral_profile || 'Dades Insuficients',
      criticalErrorPassed: Boolean(details.critical_error_passed),
      yieldedToAuthority: Boolean(details.yielded_to_authority),
      requestedSource: Boolean(details.requested_primary_source),
      cognitiveDebt: Boolean(telemetry.cognitive_debt_flag),
      scaffoldingCount: telemetry.scaffolding_interventions || 0,
      justification: details.justification_summary || details.reason || 'Sense dictamen registrat.',
      evidence: {
        detectionQuote: details.detection_evidence?.user_quote || null,
        detectionTurn: details.detection_evidence?.turn_detected || null,
        yieldedQuote: details.yielded_evidence?.user_quote || null,
        yieldedTurn: details.yielded_evidence?.turn_yielded || null,
        botPromptQuote: details.yielded_evidence?.bot_prompt_quote || null,
        sourceQuote: details.primary_source_evidence?.user_quote || null,
        sourceTurn: details.primary_source_evidence?.turn_requested || null,
      },
    };
  });

  const report = ReportingService.generateReport({
    sessionId: canonicalSessionId,
    organizationName,
    organizationType,
    totalTeams: totalEvaluable,
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
    teamsBreakdown: allTeamsBreakdown as any,
  });

  const siblingSessions = (siblingsRes.data || []) as any[];

  return (
    <>
      {/* FULL D'ESTILS D'IMPRESSIÓ PERICIAL (A4 EXECUTION) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 14mm 12mm 14mm;
          }

          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 11px !important;
          }
        
          thead {
            display: table-header-group !important; /* Repite la cabecera en cada página */
            }
            tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important; /* Nunca corta una fila por la mitad */
            }

            thead {
            display: table-header-group !important; /* Repeteix la capçalera de la taula a la pàgina 2 */
        }

        tbody tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important; /* Cap fila queda partida per la meitat */
        }
        }

          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .print-table-row {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Ocultar enllaços i navegació web */
          a[href]::after {
            content: "" !important;
          }

          /* Eliminar ombres que embruten la impressió */
          * {
            box-shadow: none !important;
            text-shadow: none !important;
          }
        }
      `}} />

      <div className="min-h-screen bg-slate-50 py-8 text-slate-800 print:bg-white print:py-0">
        
        {/* Barra superior de navegació (només pantalla) */}
        <div className="mx-auto mb-6 flex max-w-5xl items-center justify-between px-4 print:hidden sm:px-6">
          <Link
            href="/admin"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            &larr; Tornar al tauler
          </Link>
          <PrintButton />
        </div>

        <main className="mx-auto max-w-5xl rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200/60 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0 sm:p-12">
          
          {/* Segell superior exclusiu per al document imprès */}
          <div className="hidden print:flex items-center justify-between border-b border-slate-300 pb-3 mb-6 text-[9px] font-mono tracking-wider text-slate-400 uppercase">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Synusia Logo"
                width={110}
                height={30}
                className="object-contain h-6 w-auto"
                priority
                />
                <span>&bull;</span>
              <span>INFORME PERICIAL DE SUPERVISIÓ HUMANA (HITL)</span>
            </div>
            <div className="text-right font-medium">
              DOCUMENT CONFIDENCIAL &bull; CUSTÒDIA CORPORATIVA
            </div>
          </div>

          {/* Capçalera del Dictamen */}
          <header className="border-b border-slate-200 pb-6 print:pb-4 print-avoid-break">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Auditoria BARS / NOTECHS
                  </span>
                  <span className="rounded bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold text-sky-800">
                    EU AI Act Art. 14
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                    NIST MEASURE 2.7
                  </span>
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl print:text-2xl">
                  Avaluació de Supervisió Humana (HITL)
                </h1>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Organització: <strong className="text-slate-800">{organizationName}</strong> &bull; Sala: <code className="font-mono font-bold text-sky-700">{sessionCode}</code> &bull; Data: {new Date().toLocaleDateString('ca-ES')}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200 print:bg-slate-100/60 sm:text-right shrink-0">
                <div>
                  <span className="font-semibold text-slate-700">Equips Avaluats:</span>{' '}
                  <strong className="text-slate-900">{totalEvaluable}</strong> de {evaluations.length}
                </div>
                {insufficientTeams.length > 0 && (
                  <div className="mt-0.5 text-amber-700 font-medium text-[10px]">
                    ({insufficientTeams.length} no avaluables per activitat insuficient)
                  </div>
                )}
                <div className="mt-1 text-[10px] text-slate-500">
                  Identificador: <span className="font-mono">{canonicalSessionId.slice(0, 8)}...</span>
                </div>
              </div>
            </div>
          </header>

          {/* Resum Executiu */}
          <section className="my-6 rounded-lg border-l-4 border-sky-600 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700 print-avoid-break print:bg-slate-50/80">
            <h2 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Resum Executiu
            </h2>
            <p className="text-justify">{report.executiveSummary}</p>
          </section>

          {/* Indicadors Psicomètrics de Cohort */}
          <section className="my-6 print-avoid-break">
            <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Indicadors Psicomètrics de Cohort (Mostra Válida: {totalEvaluable} equips)
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center print:border-slate-300">
                <div className="text-[11px] font-medium text-slate-500">Mitjana HITL (BARS)</div>
                <div className="my-1.5 text-2xl font-black text-slate-900">{averageScore}/100</div>
                <span className="text-[9px] font-semibold text-slate-400">Escala de 4 nivells</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center print:border-slate-300">
                <div className="text-[11px] font-medium text-slate-500">Taxa Error Filtrat (ABR)</div>
                <div className="my-1.5 text-2xl font-black text-rose-600">{criticalVulnerabilityRate}%</div>
                <span className="text-[9px] font-semibold text-rose-500">Automation Bias</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center print:border-slate-300">
                <div className="text-[11px] font-medium text-slate-500">Submissió a Autoritat</div>
                <div className="my-1.5 text-2xl font-black text-amber-600">{submissionRate}%</div>
                <span className="text-[9px] font-semibold text-amber-600">Claudicació davant bot</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center print:border-slate-300">
                <div className="text-[11px] font-medium text-slate-500">Deute Cognitiu Sever</div>
                <div className="my-1.5 text-2xl font-black text-slate-800">{cognitiveDebtRate}%</div>
                <span className="text-[9px] font-semibold text-slate-400">Confiança descalibrada</span>
              </div>
            </div>
          </section>

          {/* Taula de Desglossament amb Evidències Forenses */}
          <section className="my-6">
            <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Evidència Forense per Equip (BARS / NOTECHS)
            </h2>
            <div className="overflow-hidden rounded-lg border border-slate-200 print:border-slate-300">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-700 text-[10px] uppercase tracking-wider print:bg-slate-100">
                  <tr>
                    <th className="px-3 py-2.5">Equip</th>
                    <th className="px-3 py-2.5">BARS</th>
                    <th className="px-3 py-2.5">Classificació</th>
                    <th className="px-3 py-2.5">Error Filtrat</th>
                    <th className="px-3 py-2.5">Submissió</th>
                    <th className="px-3 py-2.5">Evidència Literal (Transcript)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                  {allTeamsBreakdown.map((t) => (
                    <tr key={t.teamId} className="align-top hover:bg-slate-50/50 print-table-row">
                      <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">{t.teamName}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {t.isEvaluable ? (
                          <span className="font-mono text-xs font-black text-slate-900">{t.score}/100</span>
                        ) : (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500">
                            N/A
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-800">{t.profile}</div>
                        <div className="mt-0.5 text-[10px] text-slate-500 leading-tight">{t.justification}</div>
                      </td>
                      <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                        {!t.isEvaluable ? (
                          <span className="text-slate-400">N/A</span>
                        ) : t.criticalErrorPassed ? (
                          <span className="font-bold text-rose-600">SÍ (Filtrat)</span>
                        ) : (
                          <span className="font-bold text-emerald-600">NO (Aturat)</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {!t.isEvaluable ? (
                          <span className="text-slate-400">N/A</span>
                        ) : t.yieldedToAuthority ? (
                          <span className="font-bold text-amber-600">Submís</span>
                        ) : (
                          <span className="font-semibold text-emerald-700">Resistent</span>
                        )}
                      </td>
                      <td className="max-w-xs px-3 py-2.5">
                        {t.isEvaluable && t.evidence.yieldedQuote && (
                          <div className="mb-1 rounded bg-amber-50 p-1.5 text-[9.5px] text-amber-900 ring-1 ring-amber-200">
                            <span className="font-bold">Claudicació (Torn {t.evidence.yieldedTurn}):</span> &ldquo;{t.evidence.yieldedQuote}&rdquo;
                          </div>
                        )}
                        {t.isEvaluable && t.evidence.detectionQuote && (
                          <div className="rounded bg-sky-50 p-1.5 text-[9.5px] text-sky-900 ring-1 ring-sky-200">
                            <span className="font-bold">Detecció (Torn {t.evidence.detectionTurn}):</span> &ldquo;{t.evidence.detectionQuote}&rdquo;
                          </div>
                        )}
                        {t.isEvaluable && !t.evidence.yieldedQuote && !t.evidence.detectionQuote && (
                          <span className="italic text-slate-400 text-[10px]">Sense cites registrades</span>
                        )}
                        {!t.isEvaluable && (
                          <span className="text-[10px] text-slate-400">Menys de 4 torns d&apos;interacció</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recomanacions Accionables */}
          <section className="my-6 border-t border-slate-100 pt-5 print-avoid-break">
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Recomanacions Accionables de Govern i Formació
            </h2>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {report.actionableRecommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Mòdul Longitudinal de Cohort (Exclusivament pantalla; amagat en PDF) */}
          <section className="my-8 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/70 to-slate-50 p-6 print:hidden">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-indigo-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Auditoria de Cohort
                  </span>
                  <span className="text-xs font-bold text-indigo-950">
                    Certificació Longitudinal (EU AI Act Art. 14 / NIST)
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Emet l&apos;informe agregat amb dades pseudonimitzades per certificar la reducció de l&apos;Automation Bias Rate.
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-indigo-100 pt-4">
              {siblingSessions.length > 0 ? (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Selecciona la sessió de contrast d&apos;aquesta organització:
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {siblingSessions.map((sibling) => {
                      const siblingLabel = sibling.pin_acces || sibling.id_sessio.slice(0, 6).toUpperCase();
                      const siblingDate = sibling.created_at ? new Date(sibling.created_at).toLocaleDateString('ca-ES') : '';

                      return (
                        <Link
                          key={sibling.id_sessio}
                          href={`/reports/cohort?pre=${sibling.id_sessio}&post=${canonicalSessionId}&title=Cohort+${encodeURIComponent(organizationName)}`}
                          className="flex items-center justify-between rounded-lg border border-indigo-200/80 bg-white p-3 text-xs shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50/50"
                        >
                          <div>
                            <div className="font-bold text-slate-800">
                              Sala {siblingLabel} {siblingDate && `(${siblingDate})`}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Comparar com a Pre-Test &rarr; Aquesta sessió (Post-Test)
                            </div>
                          </div>
                          <span className="font-bold text-indigo-600">&rarr;</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Aquesta és l&apos;única sessió registrada per a <strong>{organizationName}</strong>. Tan bon punt es completi una segona sessió, apareixerà aquí l&apos;enllaç per emetre automàticament el certificat de cohort.
                </div>
              )}
            </div>
          </section>

          {/* Declaració Formal i Segell Legal de Conformitat Metodològica */}
          <footer className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500 print-avoid-break print:bg-slate-100/60 print:border-slate-300">
            <div className="mb-1 font-bold uppercase tracking-wider text-slate-700 text-[9px]">
              Marc Metodològic i Cadena de Custòdia Legal
            </div>
            Aquest document constitueix un dictamen pericial d&apos;auditoria cognitiva emès conforme a les exigències de supervisió humana establertes a l&apos;<strong>Article 14 del Reglament (UE) 2024/1689 (EU AI Act)</strong> i la categoria <strong>MEASURE (2.7) del NIST AI Risk Management Framework 1.0</strong>. Les qualificacions s&apos;assignen de forma determinista mitjançant una escala d&apos;avaluació conductual empírica (BARS) adaptada de l&apos;estàndard <strong>NOTECHS</strong>, contrastant els logs d&apos;interacció en temps real amb la font primària de veritat.
          </footer>
        </main>
      </div>
    </>
  );
}