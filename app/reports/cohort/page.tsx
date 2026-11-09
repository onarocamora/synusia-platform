// app/reports/cohort/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CohortAnalysisService } from '@/lib/services/cohort-analysis.service';
import { PrintButton } from '@/components/reports/PrintButton';

interface CohortPageProps {
  searchParams: Promise<{ pre?: string; post?: string; title?: string }> | { pre?: string; post?: string; title?: string };
}

export const dynamic = 'force-dynamic';

export default async function CohortAuditPage({ searchParams }: CohortPageProps) {
  const resolvedParams = await Promise.resolve(searchParams);
  const preId = resolvedParams.pre;
  const postId = resolvedParams.post;
  const title = resolvedParams.title || 'Cohort d’Operacions Crítiques';

  if (!preId || !postId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-lg font-bold text-slate-900">Paràmetres Insuficients</h1>
          <p className="mt-2 text-xs text-slate-600">
            Per generar l&apos;auditoria de cohort cal especificar els identificadors de les dues sessions: <code>?pre=SESSION_A&post=SESSION_B</code>.
          </p>
        </div>
      </div>
    );
  }

  const report = await CohortAnalysisService.generateReport(preId, postId, title);

  if (!report) {
    notFound();
  }

  const { metrics, distributionPre, distributionPost, teamDeltas } = report;

  return (
    <div className="min-h-screen bg-slate-100 py-8 text-slate-800 print:bg-white print:py-0">
      <div className="mx-auto mb-6 flex max-w-5xl items-center justify-between px-4 print:hidden sm:px-6">
        <Link href="/admin" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          &larr; Tornar al tauler
        </Link>
        <PrintButton />
      </div>

      <main className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200/80 sm:p-12 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        {/* Capçalera Oficial */}
        <header className="border-b border-slate-200 pb-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-900 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                  Certificat Oficial d&apos;Auditoria HITL
                </span>
                <span className="rounded bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-800">
                  EU AI Act &bull; Art. 14 / NIST AI RMF
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Mitigació del Biaix d&apos;Automatització: {report.cohortName}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Organització: <strong>{report.clientName}</strong> &bull; Equips Avaluats: <strong>{report.evaluatedTeams}</strong> (Dades Pseudonimitzades)
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left sm:text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Veredicte de Conformitat</div>
              <div className={`mt-1 text-sm font-black ${
                report.complianceVerdict === 'COMPLIMENT_EXCEL·LENT' ? 'text-emerald-700' :
                report.complianceVerdict === 'COMPLIMENT_SATISFACTORI' ? 'text-sky-700' : 'text-amber-700'
              }`}>
                {report.complianceVerdict.replace('_', ' ')}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                Data d&apos;Emissió: {new Date().toLocaleDateString('ca-ES')}
              </div>
            </div>
          </div>
        </header>

        {/* Resum de l'Impacte Executiu */}
        <section className="my-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            Indicadors Clau de Mitigació de Risc Cognitiu (Cohort Sencera)
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-center">
              <div className="text-xs font-medium text-slate-500">Taxa Biaix Automatització (ABR)</div>
              <div className="my-2 text-2xl font-black text-slate-900">
                {metrics.abrPre}% &rarr; <span className="text-emerald-600">{metrics.abrPost}%</span>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                -{metrics.abrReduction}% punts
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-center">
              <div className="text-xs font-medium text-slate-500">Maduresa Mitjana BARS</div>
              <div className="my-2 text-2xl font-black text-slate-900">
                {metrics.meanBarsPre} &rarr; <span className="text-indigo-600">{metrics.meanBarsPost}</span>
              </div>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                +{metrics.deltaBarsMean} nivells
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-center">
              <div className="text-xs font-medium text-slate-500">Prevalença Deute Cognitiu</div>
              <div className="my-2 text-2xl font-black text-slate-900">
                {metrics.cognitiveDebtPreRate}% &rarr; <span className="text-emerald-600">{metrics.cognitiveDebtPostRate}%</span>
              </div>
              <span className="text-[10px] font-medium text-slate-400">
                Excessiva confiança reduïda
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-center">
              <div className="text-xs font-medium text-slate-500">Exigència Fonts Primàries</div>
              <div className="my-2 text-2xl font-black text-slate-900">
                {metrics.primarySourceDemandPreRate}% &rarr; <span className="text-sky-600">{metrics.primarySourceDemandPostRate}%</span>
              </div>
              <span className="text-[10px] font-medium text-slate-400">
                Auditoria activa de dossiers
              </span>
            </div>
          </div>
        </section>

        {/* Transició de Maduresa BARS */}
        <section className="my-8 rounded-xl border border-slate-200 p-6">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
            Distribució de la Població per Nivells NOTECHS / BARS (Pre vs. Post)
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="mb-3 text-xs font-bold text-slate-700">Fase Basal (Pre-Test)</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>N0 (Complaença Cega):</span> <strong>{distributionPre.level0} equips</strong>
                </div>
                <div className="flex justify-between">
                  <span>N1 (Dubte No Operatiu):</span> <strong>{distributionPre.level1} equips</strong>
                </div>
                <div className="flex justify-between">
                  <span>N2 (Fricció Assertiva):</span> <strong>{distributionPre.level2} equips</strong>
                </div>
                <div className="flex justify-between">
                  <span>N3 (Auditor Calibrat):</span> <strong>{distributionPre.level3} equips</strong>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-emerald-50/40 p-4 ring-1 ring-emerald-200/60">
              <div className="mb-3 text-xs font-bold text-emerald-900">Fase Consolidada (Post-Test)</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>N0 (Complaença Cega):</span> <strong className="text-emerald-700">{distributionPost.level0} equips</strong>
                </div>
                <div className="flex justify-between">
                  <span>N1 (Dubte No Operatiu):</span> <strong className="text-emerald-700">{distributionPost.level1} equips</strong>
                </div>
                <div className="flex justify-between">
                  <span>N2 (Fricció Assertiva):</span> <strong className="text-emerald-700">{distributionPost.level2} equips</strong>
                </div>
                <div className="flex justify-between">
                  <span>N3 (Auditor Calibrat):</span> <strong className="text-emerald-700">{distributionPost.level3} equips</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Matriu Forense Pseudonimitzada (GDPR & Labor Law Compliant) */}
        <section className="my-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Registre Individual Pseudonimitzat (Cadena de Custòdia)
            </h2>
            <span className="text-[11px] text-slate-400">
              Identificadors dissociats de dades personals (GDPR Rec. 26)
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-4 py-3">Identificador</th>
                  <th className="px-4 py-3">Nivell Basal</th>
                  <th className="px-4 py-3">Nivell Assolit</th>
                  <th className="px-4 py-3">Progressió (&Delta;)</th>
                  <th className="px-4 py-3">Biaix d&apos;Automatització</th>
                  <th className="px-4 py-3">Deute Cognitiu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {teamDeltas.map((t) => (
                  <tr key={t.pseudoId} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-800">{t.pseudoId}</td>
                    <td className="px-4 py-2.5 text-slate-500">Nivell {t.preBarsLevel}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">Nivell {t.postBarsLevel}</td>
                    <td className="px-4 py-2.5">
                      <span className={`font-bold ${t.deltaBars > 0 ? 'text-emerald-600' : t.deltaBars === 0 ? 'text-slate-500' : 'text-rose-600'}`}>
                        {t.deltaBars > 0 ? `+${t.deltaBars}` : t.deltaBars}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {t.biasResolved ? (
                        <span className="font-semibold text-emerald-600">Resolt / Contingut</span>
                      ) : (
                        <span className="text-slate-400">Sense canvi de risc</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.cognitiveDebtEliminated ? (
                        <span className="font-semibold text-emerald-600">Eliminat</span>
                      ) : (
                        <span className="text-slate-400">Calibrat</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Declaració Formal de Conformitat Art. 14 */}
        <footer className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 text-[11px] leading-relaxed text-slate-600">
          <div className="mb-2 font-bold uppercase tracking-wider text-slate-900">
            Declaració de Compliment: Article 14 del Reglament (UE) 2024/1689 (EU AI Act)
          </div>
          Aquest certificat acredita que l&apos;organització ha sotmès els seus operadors humans a un entorn d&apos;auditoria empírica controlada per verificar la seva capacitat d&apos;intervenció crítica sobre sistemes algorítmics d&apos;alt risc. La reducció documentada del biaix d&apos;automatització del <strong>{metrics.abrPre}%</strong> al <strong>{metrics.abrPost}%</strong> satisfà els requisits de vigilància humana efectiva i prevenció de submissió cega establerts a l&apos;Article 14.4(b) de la legislació comunitària i a la funció GOVERN del marc NIST AI RMF.
        </footer>
      </main>
    </div>
  );
}