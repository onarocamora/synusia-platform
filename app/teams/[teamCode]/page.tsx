// app/teams/[teamCode]/progress/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LongitudinalAnalysisService } from '@/lib/services/longitudinal-analysis.service';
import { PrintButton } from '@/components/reports/PrintButton';

interface TeamProgressPageProps {
  params: Promise<{ teamCode: string }> | { teamCode: string };
}

export const dynamic = 'force-dynamic';

export default async function TeamProgressPage({ params }: TeamProgressPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const teamCode = decodeURIComponent(resolvedParams.teamCode || '').trim();

  if (!teamCode) {
    notFound();
  }

  const trajectory = await LongitudinalAnalysisService.getTeamTrajectory(teamCode);

  if (!trajectory || trajectory.chronology.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <div className="max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            📊
          </div>
          <h1 className="text-xl font-bold text-slate-900">Històric No Disponible</h1>
          <p className="mt-2 text-sm text-slate-600">
            No s&apos;han trobat avaluacions registrades per a l&apos;equip <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-sky-700">{teamCode}</code>.
          </p>
          <div className="mt-6">
            <Link
              href="/admin"
              className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500"
            >
              Tornar al tauler
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { delta, chronology, teamName } = trajectory;
  const isMultiSession = chronology.length >= 2 && delta !== null;
  const preSession = chronology[0];
  const postSession = chronology[chronology.length - 1];

  return (
    <div className="min-h-screen bg-slate-50 py-8 text-slate-800 print:bg-white print:py-0">
      <div className="mx-auto mb-6 flex max-w-5xl items-center justify-between px-4 print:hidden sm:px-6">
        <Link href="/admin" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          &larr; Tornar al tauler
        </Link>
        <PrintButton />
      </div>

      <main className="mx-auto max-w-5xl rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200/60 sm:p-12 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        <header className="border-b border-slate-200 pb-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  Auditoria Longitudinal HITL
                </span>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                  Model Pre vs. Post-Test
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Evolució de Competències: {teamName}
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Identificador: <code className="font-mono font-bold text-sky-700">{teamCode}</code> &bull; Sessions Avaluades: {chronology.length}
              </p>
            </div>

            {isMultiSession && delta && (
              <div className="rounded-lg bg-slate-50 p-4 text-xs ring-1 ring-slate-200 sm:text-right">
                <div className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Diagnòstic d&apos;Impacte</div>
                <div className={`mt-1 font-bold text-sm ${
                  delta.maturityStatus === 'SALT_QUALITATIU' ? 'text-emerald-700' :
                  delta.maturityStatus === 'PROGRESSIÓ_MODERADA' ? 'text-sky-700' :
                  delta.maturityStatus === 'REGRESSIÓ' ? 'text-rose-600' : 'text-slate-700'
                }`}>
                  {delta.maturityStatus.replace('_', ' ')}
                </div>
                <div className="mt-1 text-slate-500">
                  Increment BARS: <strong className="text-slate-800">+{delta.barsLevelDelta} nivells</strong> ({delta.scoreDelta > 0 ? `+${delta.scoreDelta}` : delta.scoreDelta} pts)
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Indicadors Comparatius Clau (només si hi ha Pre i Post) */}
        {isMultiSession && delta ? (
          <section className="my-8">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              Diferencials d&apos;Aprenentatge (Delta Pre-Test &rarr; Post-Test)
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                <div className="text-xs font-medium text-slate-500">Maduresa BARS</div>
                <div className="my-2 text-2xl font-black text-slate-900">
                  N{preSession.barsLevel} &rarr; N{postSession.barsLevel}
                </div>
                <span className="text-[10px] font-semibold text-emerald-600">
                  {delta.barsLevelDelta >= 0 ? `+${delta.barsLevelDelta} nivell(s)` : `${delta.barsLevelDelta} nivell(s)`}
                </span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                <div className="text-xs font-medium text-slate-500">Biaix d&apos;Automatització</div>
                <div className="my-2 text-2xl font-black">
                  {delta.automationBiasResolved ? (
                    <span className="text-emerald-600">Eliminat</span>
                  ) : postSession.criticalErrorPassed ? (
                    <span className="text-rose-600">Persistent</span>
                  ) : (
                    <span className="text-slate-800">Controlat</span>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-slate-400">Resistència a al·lucinacions</span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                <div className="text-xs font-medium text-slate-500">Velocitat Detecció</div>
                <div className="my-2 text-2xl font-black text-slate-900">
                  {delta.detectionSpeedDelta !== null ? (
                    `${delta.detectionSpeedDelta > 0 ? `+${delta.detectionSpeedDelta}` : delta.detectionSpeedDelta} torns`
                  ) : (
                    'N/A'
                  )}
                </div>
                <span className="text-[10px] font-semibold text-sky-600">
                  {delta.detectionSpeedDelta && delta.detectionSpeedDelta > 0 ? 'Reacció més ràpida' : 'Temps de contrast'}
                </span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                <div className="text-xs font-medium text-slate-500">Deute Cognitiu</div>
                <div className="my-2 text-2xl font-black">
                  {delta.cognitiveDebtResolved ? (
                    <span className="text-emerald-600">Calibrat</span>
                  ) : postSession.cognitiveDebt ? (
                    <span className="text-amber-600">Actiu</span>
                  ) : (
                    <span className="text-slate-700">Òptim</span>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-slate-400">Autonomia crítica</span>
              </div>
            </div>
          </section>
        ) : (
          <section className="my-8 rounded-lg bg-sky-50 p-4 text-xs text-sky-900 ring-1 ring-sky-200">
            <strong>Sessió Diagnòstica Inicial (Pre-Test):</strong> Aquest equip disposa actualment d&apos;una sola sessió completada. Quan participi en un segon cas d&apos;auditoria, es calcularan automàticament els indicadors comparatius d&apos;evolució.
          </section>
        )}

        {/* Taula Cronològica de Sessions */}
        <section className="my-8">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
            Trajectòria Pas a Pas de l&apos;Equip
          </h2>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-4 py-3">Sessió / Cas</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Nivell BARS</th>
                  <th className="px-4 py-3">Perfil Assignat</th>
                  <th className="px-4 py-3">Error Filtrat</th>
                  <th className="px-4 py-3">Exigència Font</th>
                  <th className="px-4 py-3">Evidència Textual Registrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {chronology.map((snap, idx) => {
                  const isPre = idx === 0;
                  const isPost = idx === chronology.length - 1 && chronology.length > 1;

                  return (
                    <tr key={snap.sessionId} className="align-top hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{snap.caseTitle}</div>
                        <div className="text-[11px] font-mono text-sky-700">
                          Sala: {snap.sessionCode}
                          {isPre && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.2 font-sans font-bold text-slate-600">PRE-TEST</span>}
                          {isPost && <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.2 font-sans font-bold text-emerald-800">POST-TEST</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(snap.evaluatedAt).toLocaleDateString('ca-ES')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-black text-slate-950">
                          Nivell {snap.barsLevel}
                        </span>
                        <div className="text-[10px] text-slate-400 font-medium">({snap.hitlScore}/100)</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {snap.profile}
                      </td>
                      <td className="px-4 py-3">
                        {snap.criticalErrorPassed ? (
                          <span className="font-bold text-rose-600">SÍ (Filtrat)</span>
                        ) : (
                          <span className="font-bold text-emerald-600">NO (Contingut)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {snap.requestedPrimarySource ? (
                          <span className="font-bold text-emerald-700">Exigida</span>
                        ) : (
                          <span className="text-slate-400">No sol·licitada</span>
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        {snap.evidenceQuote ? (
                          <div className="rounded bg-slate-50 p-2 text-[10px] text-slate-700 ring-1 ring-slate-200">
                            &ldquo;{snap.evidenceQuote}&rdquo;
                          </div>
                        ) : (
                          <span className="italic text-slate-400">Sense cites rellevants</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-4 text-[11px] leading-relaxed text-slate-500">
          <div className="mb-1 font-bold uppercase tracking-wider text-slate-700">
            Validesa Científica de la Trajectòria
          </div>
          Aquest informe de progressió longitudinal mesura l&apos;adquisició de competències crítiques d&apos;auditoria en sistemes IA segons l&apos;escala <strong>BARS / NOTECHS</strong>. La transició d&apos;estats entre casos independents reflecteix la reducció empírica del biaix d&apos;automatització en compliment dels requisits formatius de l&apos;<strong>Article 14 del Reglament (UE) 2024/1689 (EU AI Act)</strong>.
        </footer>
      </main>
    </div>
  );
}