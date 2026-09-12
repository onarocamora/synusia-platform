'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';

interface TeamMetric {
    id_equip: string;
    nom_equip: string;
    missio_actual: string;
    moment_a_avg: number;
    moment_b_avg: number;
    prompts_total: number;
    evidence_cited_count: number;
    ab_test_count: number;
    hints_triggered_total: number;
}

export default function AdminAnalyticsDashboard() {
    const params = useParams();
    const sessionId = params.sessionId as string;

    const [loading, setLoading] = useState(true);
    const [teamMetrics, setTeamMetrics] = useState<TeamMetric[]>([]);
    const [globalStats, setGlobalStats] = useState({
        avgConfidenceA: 0,
        avgCertaintyB: 0,
        overconfidenceGap: 0,
        totalPrompts: 0,
        evidenceCitedRate: 0,
        abTestRate: 0,
        totalHints: 0,
    });

    const fetchAnalytics = async () => {
        if (!sessionId) return;

        try {
            // 1. Carregar equips de la sessió
            const { data: equipsData } = await supabase
                .from('equips')
                .select('id_equip, nom_equip, missio_actual')
                .eq('id_sessio', sessionId);

            if (!equipsData) return;

            // 2. Carregar analítiques de fase
            const { data: phaseData } = await supabase
                .from('phase_analytics')
                .select('*')
                .eq('id_sessio', sessionId);

            // 3. Carregar logs d'interacció per calcular rigor (Pattern Matching)
            const { data: logsData } = await supabase
                .from('logs_interaccio')
                .select('id_equip, is_evidence_cited, is_ab_test')
                .eq('actor', 'USER');

            // Procesar mètriques per equip
            let totalA = 0, countA = 0;
            let totalB = 0, countB = 0;
            let totalPromptsAll = 0;
            let totalEvidenceCited = 0;
            let totalAbTests = 0;
            let totalHints = 0;

            const processedTeams: TeamMetric[] = equipsData.map((eq) => {
                const teamPhases = phaseData?.filter((p) => p.id_equip === eq.id_equip) || [];
                const teamLogs = logsData?.filter((l) => l.id_equip === eq.id_equip) || [];

                const aRatings = teamPhases.map((p) => p.moment_a_confidence).filter(Boolean);
                const bRatings = teamPhases.map((p) => p.moment_b_certainty).filter(Boolean);

                const avgA = aRatings.length ? aRatings.reduce((a, b) => a + b, 0) / aRatings.length : 0;
                const avgB = bRatings.length ? bRatings.reduce((a, b) => a + b, 0) / bRatings.length : 0;

                if (avgA) { totalA += avgA; countA++; }
                if (avgB) { totalB += avgB; countB++; }

                const promptsCount = teamPhases.reduce((acc, p) => acc + (p.prompts_count || 0), 0);
                const hintsCount = teamPhases.reduce((acc, p) => acc + (p.hints_triggered || 0), 0);
                const evidenceCount = teamLogs.filter((l) => l.is_evidence_cited).length;
                const abCount = teamLogs.filter((l) => l.is_ab_test).length;

                totalPromptsAll += promptsCount;
                totalEvidenceCited += evidenceCount;
                totalAbTests += abCount;
                totalHints += hintsCount;

                return {
                    id_equip: eq.id_equip,
                    nom_equip: eq.nom_equip,
                    missio_actual: eq.missio_actual,
                    moment_a_avg: parseFloat(avgA.toFixed(1)),
                    moment_b_avg: parseFloat(avgB.toFixed(1)),
                    prompts_total: promptsCount,
                    evidence_cited_count: evidenceCount,
                    ab_test_count: abCount,
                    hints_triggered_total: hintsCount,
                };
            });

            const globalA = countA ? parseFloat((totalA / countA).toFixed(2)) : 0;
            const globalB = countB ? parseFloat((totalB / countB).toFixed(2)) : 0;

            setGlobalStats({
                avgConfidenceA: globalA,
                avgCertaintyB: globalB,
                overconfidenceGap: parseFloat((globalA - 2.0).toFixed(2)), // Baseline d'al·lucinació esperada = 2.0
                totalPrompts: totalPromptsAll,
                evidenceCitedRate: totalPromptsAll ? Math.round((totalEvidenceCited / totalPromptsAll) * 100) : 0,
                abTestRate: totalPromptsAll ? Math.round((totalAbTests / totalPromptsAll) * 100) : 0,
                totalHints: totalHints,
            });

            setTeamMetrics(processedTeams);
        } catch (err) {
            console.error('Error carregant el tauler docent:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
        // Refresh automàtic cada 5 segons per seguir la classe en directe
        const interval = setInterval(fetchAnalytics, 5000);
        return () => clearInterval(interval);
    }, [sessionId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono text-xs">
                ⚡ Carregant telemetria docent en temps real...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6 font-sans">
            {/* HEADER DE CONTROL */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-amber-500 font-bold">
                        PANEL DE SUPERVISIÓ DOCENT · SESSIONS 160 ALUMNES
                    </span>
                    <h1 className="text-2xl font-bold text-white mt-1">
                        Anàlisi Cognitiva i Telemetria en Temps Real
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-mono text-slate-400">Sincronitzat cada 5s</span>
                </div>
            </div>

            {/* CARDS DE MÈTRIQUES GLOBALS (PER AL DEBRIEFING) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <span className="text-xs text-slate-400 uppercase font-mono block mb-1">
                        🎲 Confiança Inicial (Moment A)
                    </span>
                    <div className="text-3xl font-bold text-amber-400">{globalStats.avgConfidenceA} / 5</div>
                    <p className="text-[11px] text-slate-500 mt-1">Fe inicial en les respostes del bot</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <span className="text-xs text-slate-400 uppercase font-mono block mb-1">
                        🔥 Gap de Sobreconfiança
                    </span>
                    <div className={`text-3xl font-bold ${globalStats.overconfidenceGap > 1 ? 'text-red-400' : 'text-emerald-400'}`}>
                        +{globalStats.overconfidenceGap}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Biaix d'automatització detectat</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <span className="text-xs text-slate-400 uppercase font-mono block mb-1">
                        📄 Taxa de Cita de Font (Contrasta)
                    </span>
                    <div className="text-3xl font-bold text-blue-400">{globalStats.evidenceCitedRate}%</div>
                    <p className="text-[11px] text-slate-500 mt-1">Prompts amb dades de la font primària</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <span className="text-xs text-slate-400 uppercase font-mono block mb-1">
                        💡 Pistes d'Estancament
                    </span>
                    <div className="text-3xl font-bold text-purple-400">{globalStats.totalHints}</div>
                    <p className="text-[11px] text-slate-500 mt-1">Activacions de la Válvula a l'aula</p>
                </div>
            </div>

            {/* TAULA DE MONITORITZACIÓ PER EQUIPS */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-slate-800 bg-slate-900/80">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-slate-200">
                        Estat i Mètriques dels Equips
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 uppercase text-[10px] font-mono text-slate-400 border-b border-slate-800">
                            <tr>
                                <th className="p-3">Equip</th>
                                <th className="p-3">Fase Activa</th>
                                <th className="p-3 text-center">Moment A (Aposta)</th>
                                <th className="p-3 text-center">Moment B (Seguretat)</th>
                                <th className="p-3 text-center">Prompts Totals</th>
                                <th className="p-3 text-center">Cites Font</th>
                                <th className="p-3 text-center">Tests A/B</th>
                                <th className="p-3 text-center">Pistes Rebutes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                            {teamMetrics.map((team) => (
                                <tr key={team.id_equip} className="hover:bg-slate-850/50 transition-colors">
                                    <td className="p-3 font-bold text-white font-sans">{team.nom_equip}</td>
                                    <td className="p-3">
                                        <span className="bg-slate-800 text-amber-400 px-2 py-1 rounded border border-slate-700 text-[10px]">
                                            📍 {team.missio_actual}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center font-bold text-amber-400">{team.moment_a_avg || '—'}</td>
                                    <td className="p-3 text-center font-bold text-emerald-400">{team.moment_b_avg || '—'}</td>
                                    <td className="p-3 text-center">{team.prompts_total}</td>
                                    <td className="p-3 text-center text-blue-400">{team.evidence_cited_count}</td>
                                    <td className="p-3 text-center text-purple-400">{team.ab_test_count}</td>
                                    <td className="p-3 text-center">
                                        {team.hints_triggered_total > 0 ? (
                                            <span className="text-red-400 font-bold">⚠️ {team.hints_triggered_total}</span>
                                        ) : (
                                            <span className="text-slate-500">0</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}