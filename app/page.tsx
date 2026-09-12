'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import posthog from 'posthog-js';

// ---------------------------------------------------------------------------
// TYPES & INTERFACES
// ---------------------------------------------------------------------------
interface Message {
    role: 'user' | 'assistant';
    content: string;
    bot_name?: string;
}

interface MissionConfig {
    titol: string;
    codi_correcte?: string;
    codi_desblocatge?: string;
    evidenced_doc?: string;
    dossier?: string;
    seguent_missio: string;
    consell: string;
    repte: string;
    objectius?: string[];
    welcome_message: string;
    bot_name: string;
    bot_id?: string;
    system_prompt?: string;
}

interface DefaultStoryline {
    config_missions: {
        missions: {
            [key: string]: MissionConfig;
        };
    };
}

// ---------------------------------------------------------------------------
// COMPONENT MODAL DE CONFIANÇA (MOMENTS A I B)
// ---------------------------------------------------------------------------
interface ConfidenceModalProps {
    isOpen: boolean;
    type: 'MOMENT_A' | 'MOMENT_B';
    botName: string;
    onConfirm: (rating: number) => void;
}

function ConfidenceModal({ isOpen, type, botName, onConfirm }: ConfidenceModalProps) {
    const [selectedRating, setSelectedRating] = useState<number | null>(null);

    if (!isOpen) return null;

    const isMomentA = type === 'MOMENT_A';

    const title = isMomentA
        ? `🎲 Aposta de Confiança Inicial (Moment A)`
        : `🛡️ Seguretat de Validació Final (Moment B)`;

    const description = isMomentA
        ? `L'assistent ${botName} us acaba de donar aquesta resposta. Sense mirar la documentació oficial en paper: quant us en refieu d'aquesta informació ara mateix?`
        : `Heu detectat i corregit tots els errors? Quina seguretat teniu abans de signar l'auditoria?`;

    const labels = isMomentA
        ? ['1 - Cap confiança. Ho vull comprovar tot.', '2 - Em fa dubtar bastant.', '3 - Crec que està bé (Però ho revisaria).', '4 - Em refio bastant.', '5 - M\'ho crec al 100%. Ho enviaria tal qual.']
        : ['1 - Gens segurs. Hem anat a cegues.', '2 - Ens falta alguna cosa.', '3 - Bastant bé.', '4 - Molt segurs.', '5 - 100% segurs. Tot net.'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white border border-stone-200/90 rounded-2xl p-6 shadow-2xl text-stone-800 space-y-5">
                <div>
                    <span className="text-[10px] font-mono tracking-widest text-amber-600 uppercase font-bold block mb-1">
                        {isMomentA ? 'AUDITORIA EN TEMPS REAL · EVAL PREVIA' : 'AUDITORIA EN TEMPS REAL · VERIFICACIÓ'}
                    </span>
                    <h3 className="text-lg font-serif font-medium text-stone-900">{title}</h3>
                    <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">{description}</p>
                </div>

                <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((val) => (
                        <button
                            key={val}
                            type="button"
                            onClick={() => setSelectedRating(val)}
                            className={`flex flex-col items-center justify-center py-3 rounded-xl border font-bold text-sm transition-all cursor-pointer ${selectedRating === val
                                ? 'bg-amber-500 border-amber-600 text-stone-950 scale-105 shadow-md'
                                : 'bg-[#FAF8F5] border-stone-200 text-stone-700 hover:bg-stone-100'
                                }`}
                        >
                            <span>{val}</span>
                        </button>
                    ))}
                </div>

                {selectedRating !== null && (
                    <p className="text-center text-xs font-medium text-amber-800 bg-amber-50 py-2 rounded-lg border border-amber-200/60">
                        {labels[selectedRating - 1]}
                    </p>
                )}

                <button
                    type="button"
                    disabled={selectedRating === null}
                    onClick={() => {
                        if (selectedRating !== null) {
                            onConfirm(selectedRating);
                            setSelectedRating(null);
                        }
                    }}
                    className="w-full py-3 rounded-xl bg-stone-900 text-stone-50 font-medium text-xs hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                >
                    Confirmar i Continuar →
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// CONFIGURACIÓ PER DEFECTE / FALLBACK
// ---------------------------------------------------------------------------
const defaultStoryline: DefaultStoryline = {
    config_missions: {
        missions: {
            'MISION_1': {
                titol: "Fase 1: Privacitat i Protecció de Dades",
                bot_name: "Auditoria de Seguretat",
                bot_id: "SEC_BOT",
                codi_correcte: "ESTRUCTURA",
                codi_desblocatge: "ESTRUCTURA",
                seguent_missio: "MISION_2",
                consell: "Reviseu el document d'Evidència #1 i assegureu-vos de no incloure dades personals (PII).",
                repte: "Formular una petició d'accés indicant el rol i el tipus de permissos sense incloure dades privades.",
                objectius: ["Anonimitzar el registre de sol·licitud", "Obtenir el codi de validació ESTRUCTURA"],
                welcome_message: "Mòdul de seguretat actiu. Indiqueu els criteris de cerca per a la revisió.",
            },
            'MISION_2': {
                titol: "Fase 2: Auditoria de Mètriques i Rendiment",
                bot_name: "Anàlisi de Dades",
                bot_id: "DATA_BOT",
                codi_correcte: "EVIDENCIA",
                codi_desblocatge: "EVIDENCIA",
                seguent_missio: "MISION_3",
                consell: "Verifiqueu la fórmula de càlcul amb les dades de la taula de latència.",
                repte: "Sol·licitar l'organització de les dades en format taula i auditar la mitjana real de latència.",
                objectius: ["Verificar el temps mitjà de resposta (18.8 minuts)", "Obtenir el codi de validació EVIDENCIA"],
                welcome_message: "Mòdul d'anàlisi de dades connectat. Dades en brut disponibles per a consulta.",
            },
            'MISION_3': {
                titol: "Fase 3: Revisió Normativa i Contractual",
                bot_name: "Assessoria Jurídica",
                bot_id: "LEGAL_BOT",
                codi_correcte: "CONFIANÇA",
                codi_desblocatge: "CONFIANÇA",
                seguent_missio: "MISION_4",
                consell: "Contrasteu les clàusules del contracte SLA-4 amb les dades de l'informe tècnic.",
                repte: "Demostrar que la condició d'aturada d'emergència anul·la l'aplicació de la clàusula SLA-4.",
                objectius: ["Identificar la clàusula d'excepció al contracte", "Obtenir el codi de validació CONFIANÇA"],
                welcome_message: "Mòdul legal actiu. Indiqueu la documentació de referència per a la revisió.",
            },
            'MISION_4': {
                titol: "Fase 4: Avaluació de Biaixos i Dictamen",
                bot_name: "Supervisió d'Algorismes",
                bot_id: "BIAS_BOT",
                codi_correcte: "INTEGRITAT",
                codi_desblocatge: "INTEGRITAT",
                seguent_missio: "FINAL",
                consell: "Analitzeu la ponderació de variables al codi font imprès.",
                repte: "Localitzar la variable de priorització i redactar el dictamen final al dossier.",
                objectius: ["Identificar la variable de ponderació no justificada", "Completar la secció final del dossier"],
                welcome_message: "Mòdul de revisió algorítmica actiu. Calculeu els valors de ponderació del codi font.",
            }
        }
    }
};

// ---------------------------------------------------------------------------
// LÒGICA INTERNA DE LA SIMULACIÓ
// ---------------------------------------------------------------------------
function SimulacioContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Estats globals de la simulació
    const [credits, setCredits] = useState<number | null>(null);
    const [evidencies, setEvidencies] = useState<{ titol: string; dada: string }[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [errorText, setErrorText] = useState<string>('');
    const [enviat, setEnviat] = useState<boolean>(false);

    // Estats de Qüestionaris via QR Tally
    const [faseEnquesta, setFaseEnquesta] = useState<'CAP' | 'PRE_TEST' | 'POST_TEST'>('CAP');

    // Estats de Missió, Plantilla i Escalabilitat
    const [missioActual, setMissioActual] = useState<string>('MISION_1');
    const missioActualRef = useRef<string>('MISION_1');
    const [missioConfig, setMissioConfig] = useState<MissionConfig | null>(null);
    const [notificacioCanviFase, setNotificacioCanviFase] = useState<string | null>(null);

    const [idTemplateSessio, setIdTemplateSessio] = useState<string>('CAS_OMNIA_2026');
    const [idEquip, setIdEquip] = useState<string>('');
    const [idSessioGlobal, setIdSessioGlobal] = useState<string>('');
    const [idClient, setIdClient] = useState<string>('');

    // Estats de Telemetria FARO V3 (Moments A i B)
    const [momentAConfidence, setMomentAConfidence] = useState<number | null>(null);
    const [momentBCertainty, setMomentBCertainty] = useState<number | null>(null);
    const [showModalA, setShowModalA] = useState<boolean>(false);
    const [showModalB, setShowModalB] = useState<boolean>(false);
    const [pendingNextMission, setPendingNextMission] = useState<string | null>(null);

    // Estats de la Validació Manual (Override)
    const [codiUnlock, setCodiUnlock] = useState<string>('');
    const [errorUnlock, setErrorUnlock] = useState<string>('');

    // Estats del formulari d'entrada
    const [pin, setPin] = useState<string>('');
    const [nomsEquip, setNomsEquip] = useState<string>('');
    const [riscIA, setRiscIA] = useState<string>('');

    // Estats de la UI i Drawer
    const [dossierObert, setDossierObert] = useState<boolean>(false);

    // Estats del Xat
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState<string>('');
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Informe Final
    const [faseFinal, setFaseFinal] = useState<boolean>(false);
    const [informeText, setInformeText] = useState<string>('');
    const [informeEnviat, setInformeEnviat] = useState<boolean>(false);

    // Reportatge d'errors dels usuaris
    const [missatgeAReportar, setMissatgeAReportar] = useState<Message | null>(null);
    const [motiuReport, setMotiuReport] = useState<string>('AL·LUCINACIÓ');
    const [detallReport, setDetallReport] = useState<string>('');
    const [enviantReport, setEnviantReport] = useState<boolean>(false);

    // Control de Temps
    const [tempsTranscorregut, setTempsTranscorregut] = useState<number>(0);
    const [sessioFinalitzada, setSessioFinalitzada] = useState<boolean>(false);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

    // Capturar el paràmetre ?pin=DEMO de la URL
    useEffect(() => {
        const pinDesDeUrl = searchParams.get('pin');
        if (pinDesDeUrl) {
            setPin(pinDesDeUrl.toUpperCase());
        }
    }, [searchParams]);

    // Temporitzador (Cronòmetre)
    useEffect(() => {
        if (!enviat || faseFinal) return;
        const interval = setInterval(() => {
            setTempsTranscorregut(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [enviat, faseFinal]);

    // PRESÈNCIA EN TEMPS REAL
    useEffect(() => {
        if (!idSessioGlobal || !idEquip || !enviat) return;

        const canalPresencia = supabase.channel(`presencia-sessio-${idSessioGlobal}`);

        canalPresencia.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await canalPresencia.track({ equip_id: idEquip });
            }
        });

        return () => {
            supabase.removeChannel(canalPresencia);
        };
    }, [idSessioGlobal, idEquip, enviat]);

    // Escolta Realtime per finalització de sessió
    useEffect(() => {
        if (!pin || !enviat) return;

        const canalSessio = supabase
            .channel(`estat-sessio-${pin}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sessions',
                    filter: `pin_acces=eq.${pin}`
                },
                (payload: any) => {
                    if (payload.new && payload.new.estat === 'FINALITZADA') {
                        setSessioFinalitzada(true);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(canalSessio);
        };
    }, [pin, enviat]);

    // 🎯 SINCRONITZACIÓ EN TEMPS REAL: FORÇAR SALT DE FASE I NOTIFICAR L'ALUMNE
    useEffect(() => {
        if (!idEquip || !enviat) return;

        const canalEquipSync = supabase
            .channel(`sync-equip-fase-${idEquip}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'equips',
                    filter: `id_equip=eq.${idEquip}`
                },
                async (payload: any) => {
                    if (payload.new && payload.new.missio_actual) {
                        const novaMissio = payload.new.missio_actual;
                        if (novaMissio === 'FINAL') {
                            setFaseFinal(true);
                        } else if (novaMissio !== missioActualRef.current) {
                            missioActualRef.current = novaMissio;
                            await carregarMissio(novaMissio, undefined, true);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(canalEquipSync);
        };
    }, [idEquip, enviat]);

    // 🎯 CARREGAR MISSIÓ
    // 🎯 CARREGAR MISSIÓ
    const carregarMissio = async (idMissio: string, templateIdParam?: string, esForcatPerAdmin: boolean = false) => {
        try {
            const targetTemplate = templateIdParam || idTemplateSessio || 'CAS-FARO-V3-OFFICIAL';

            const { data } = await supabase
                .from('pedagogical_templates')
                .select('*')
                .eq('id_template', targetTemplate)
                .single();

            // Normalitzar la clau (extreu '1' tant de '1' com de 'MISION_1')
            const rawStr = String(idMissio);
            const numMatch = rawStr.match(/\d+/);
            const missioKey = numMatch ? numMatch[0] : rawStr;

            // Cerca flexible al JSON de Supabase
            const missionsDict = data?.scenario_context?.missions || {};
            const configCustom =
                missionsDict[idMissio] ||
                missionsDict[missioKey] ||
                missionsDict[`MISION_${missioKey}`];

            const configFallback = defaultStoryline.config_missions.missions[idMissio as keyof typeof defaultStoryline.config_missions.missions];
            const config = configCustom || configFallback;

            if (config) {
                setMissioConfig(config);
                setMissioActual(missioKey);
                missioActualRef.current = missioKey;
                setCodiUnlock('');
                setErrorUnlock('');

                // Reiniciem valors de la nova fase
                setMomentAConfidence(null);
                setMomentBCertainty(null);

                if (esForcatPerAdmin) {
                    setNotificacioCanviFase(`⚡ El facilitador ha avançat la simulació a: ${config.titol}`);
                    setTimeout(() => setNotificacioCanviFase(null), 6000);
                }

                const missatgeInicial: Message = {
                    role: 'assistant',
                    content: esForcatPerAdmin
                        ? `📢 [AVÍS DEL SISTEMA]: El facilitador ha avançat la simulació a la següent fase.\n\n${config.welcome_message || ''}`
                        : (config.welcome_message || 'SISTEMA REINICIAT.'),
                    bot_name: config.bot_name || 'ORÁCULO'
                };

                setMessages([missatgeInicial]);
            }
        } catch (err) {
            console.error('Error al carregar la missió:', err);
        }
    };

    // Inicialitzar Sessió
    const handleInicialitzar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pin || !nomsEquip || !riscIA) return;
        setLoading(true);
        setErrorText('');

        try {
            const resposta = await fetch('/api/join-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin, nomsEquip })
            });
            const data = await resposta.json();

            if (!resposta.ok) {
                setErrorText(data.error || 'Accés denegat.');
            } else {
                await supabase
                    .from('equips')
                    .update({
                        dossier_actiu: { reflexio_individual: riscIA, integrants: nomsEquip, consentiment_informat: true, data_consentiment: new Date().toISOString() }
                    })
                    .eq('id_equip', data.equip.id_equip);

                setIdEquip(data.equip.id_equip);
                if (data.sessio?.id_sessio) setIdSessioGlobal(data.sessio.id_sessio);
                if (data.sessio?.id_client) setIdClient(data.sessio.id_client);
                if (data.credits_disponibles !== undefined) setCredits(data.credits_disponibles);

                const templateCas = data.sessio?.id_template || 'CAS_OMNIA_2026';
                setIdTemplateSessio(templateCas);

                await carregarMissio('0', templateCas); // Inicia a la Missió 0: Escalfament d'Atlas Servicios Integrales

                posthog.capture('session_joined', {
                    template_id: templateCas,
                    mission_start: '0',
                });

                setFaseEnquesta('PRE_TEST');
                setEnviat(true);
            }
        } catch (err) {
            setErrorText('Error de xarxa en contactar amb el servidor.');
        } finally {
            setLoading(false);
        }
    };

    // 🎯 DESAR MÈTRIQUES DEL PILOT A SUPABASE
    const desarMetriquesFase = async (notaMomentB: number) => {
        if (!idEquip) return;
        try {
            const totalPrompts = messages.filter(m => m.role === 'user').length;

            const { error } = await supabase
                .from('pilot_evaluation_metrics')
                .upsert({
                    id_sessio: idSessioGlobal || null,
                    id_equip: idEquip,
                    fase_id: String(missioActual),
                    moment_a_confianca: momentAConfidence ? Number(momentAConfidence) : null,
                    moment_b_seguretat: notaMomentB ? Number(notaMomentB) : null,
                    prompts_enviats: totalPrompts,
                    completat_el: new Date().toISOString()
                }, { onConflict: 'id_equip,fase_id' });

            if (error) console.error('Error desant mètriques:', error.message);
        } catch (err) {
            console.error('Excepció desant mètriques:', err);
        }
    };

    // Transició de Fase confirmada (post Moment B)
    const executarTransicioFase = (seguent: string) => {
        supabase
            .from('equips')
            .update({ missio_actual: seguent })
            .eq('id_equip', idEquip)
            .then(() => {
                if (seguent === 'FINAL') {
                    setFaseFinal(true);
                } else {
                    carregarMissio(seguent);
                }
            });
    };

    // Validar Codi de Desbloqueig Manual
    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (!codiUnlock.trim()) return;

        const codiIntroduit = codiUnlock.trim().toUpperCase();
        const codiCorrecte = (missioConfig?.codi_desblocatge || missioConfig?.codi_correcte)?.toUpperCase();

        if (codiIntroduit === codiCorrecte) {
            posthog.capture('mission_unlocked', {
                mission_id: missioActual,
                next_mission: missioConfig?.seguent_missio || 'FINAL',
            });
            setEvidencies(prev => [...prev, {
                titol: missioConfig?.titol || 'Dada Extreta',
                dada: codiCorrecte
            }]);

            const seguent = missioConfig?.seguent_missio || 'FINAL';
            setPendingNextMission(seguent);
            setShowModalB(true); // Obrir Modal B de seguretat abans de saltar
        } else {
            setErrorUnlock('❌ Codi no vàlid. Comproveu les evidències.');
        }
    };

    // Funció per processar l'enviament del report
    const handleReportIssue = async () => {
        if (!missatgeAReportar || !idEquip) return;
        setEnviantReport(true);

        try {
            await fetch('/api/report-issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_sessio: idSessioGlobal,
                    id_equip: idEquip,
                    missatge_ia: missatgeAReportar.content,
                    motiu: motiuReport,
                    detall: detallReport
                })
            });

            setMissatgeAReportar(null);
            setDetallReport('');
            posthog.capture('ai_issue_reported', { motiu: motiuReport });
        } catch (err) {
            console.error("Error en enviar el report:", err);
        } finally {
            setEnviantReport(false);
        }
    };

    // Enviar Missatge al Xat amb Telemetria de Confiança
    // Enviar Missatge al Xat amb Telemetria de Confiança
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() || isTyping) return;

        const userMessageText = inputMessage.trim();
        setInputMessage('');
        const nousMissatges: Message[] = [...messages, { role: 'user', content: userMessageText }];
        setMessages(nousMissatges);
        setIsTyping(true);

        posthog.capture('chat_message_sent', {
            mission_id: missioActual,
            message_length: userMessageText.length,
            moment_a_confidence: momentAConfidence,
        });

        try {
            const resposta = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_sessio: idSessioGlobal,
                    id_equip: idEquip,
                    missio_actual: missioActual,
                    bot_id: missioConfig?.bot_id || 'DEFAULT',
                    idTemplate: idTemplateSessio,
                    missionId: missioActual,
                    messages: nousMissatges.map(m => ({ role: m.role, content: m.content })),
                    historial_missatges: nousMissatges.map(m => ({ role: m.role, content: m.content })),
                    // Enviament dels paràmetres de telemetria FARO V3
                    moment_a_confidence: momentAConfidence,
                    moment_b_certainty: momentBCertainty,
                })
            });

            let data: { content?: string; bot_name?: string; credits_restants?: number; unlockedKey?: boolean } = {};
            try {
                data = await resposta.json();
            } catch (jsonErr) {
                data = { content: '❌ Resposta no vàlida del servidor.' };
            }

            if (resposta.ok) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.content || 'Sense resposta del sistema.',
                    bot_name: data.bot_name || missioConfig?.bot_name || 'ORÁCULO'
                }]);
                if (data.credits_restants !== undefined) setCredits(data.credits_restants);

                // 🎯 MOMENT A: Salta amb un retard perquè l'alumne tingui temps de llegir
                if (momentAConfidence === null && !data.unlockedKey) {
                    // Càlcul dinàmic: 30ms per caràcter (Mínim 3.5 segons, Màxim 8 segons)
                    const tempsLecturaMs = Math.min(Math.max((data.content?.length || 0) * 30, 3500), 8000);
                    setTimeout(() => {
                        setShowModalA(true);
                    }, tempsLecturaMs);
                }

                // 🛡️ MOMENT B: Si la IA lliura la clau 🔑, obrim el Modal B abans d'avançar
                if (data.unlockedKey) {
                    // Aquí també hi posem un petit retard d'1.5 segons perquè vegin la clau abans que salti el modal
                    setTimeout(() => {
                        const seguent = missioConfig?.seguent_missio || 'FINAL';
                        setPendingNextMission(seguent);
                        setShowModalB(true);
                    }, 1500);
                }
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: data.content || '❌ Error de connexió.', bot_name: 'SYSTEM_ERR' }]);
            }
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'assistant', content: '📡 Error de xarxa: Verifiqueu la connexió.', bot_name: 'NETWORK_ERR' }]);
        } finally {
            setIsTyping(false);
        }
    };

    // Enviar Informe Final
    const handleEnviarInforme = async () => {
        if (!informeText.trim() || !idEquip) return;

        try {
            const { data: equipActual } = await supabase
                .from('equips')
                .select('dossier_actiu')
                .eq('id_equip', idEquip)
                .single();

            const dossierActualitzat = {
                ...(equipActual?.dossier_actiu || {}),
                informe_final: informeText,
                data_enviament: new Date().toISOString()
            };

            const { error } = await supabase
                .from('equips')
                .update({ dossier_actiu: dossierActualitzat })
                .eq('id_equip', idEquip);

            if (!error) {
                posthog.capture('final_report_submitted', {
                    report_length: informeText.length,
                    evidencies_count: evidencies.length,
                });

                setFaseEnquesta('POST_TEST');
            } else {
                alert("Hi ha hagut un error en desar l'informe. Torna-ho a intentar.");
            }
        } catch (err) {
            alert("Error de xarxa. Torna-ho a intentar.");
        }
    };

    const formatarTemps = (segons: number) => {
        const minuts = Math.floor(segons / 60);
        const segonsRestants = segons % 60;
        return `${minuts.toString().padStart(2, '0')}:${segonsRestants.toString().padStart(2, '0')}`;
    };

    if (sessioFinalitzada) {
        return (
            <div className="min-h-screen bg-[#FAF8F5] text-stone-800 flex flex-col items-center justify-center p-6 font-sans">
                <div className="max-w-md w-full bg-white border border-stone-200 p-8 rounded-2xl text-center space-y-6 shadow-sm">
                    <div className="text-3xl">🔒</div>
                    <div className="space-y-2">
                        <h1 className="text-lg font-serif font-medium text-stone-900">Sessió Finalitzada</h1>
                        <p className="text-xs text-stone-500 leading-relaxed">
                            El facilitador ha donat per tancada la sessió. Les connexions amb la plataforma Synusia han estat arxivades.
                        </p>
                    </div>
                    <div className="border-t border-stone-100 pt-4 text-[11px] text-stone-400 font-medium">
                        Atengueu les indicacions del facilitador a la sala.
                    </div>
                </div>
            </div>
        );
    }

    if (!enviat) {
        return (
            <div className="min-h-screen bg-[#FAF8F5] text-stone-800 flex flex-col justify-center items-center p-4 font-sans selection:bg-stone-200">
                <main className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl border border-stone-200/80 shadow-sm">
                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-4">
                            <Image src="/logo.png" alt="Synusia Logo" width={140} height={40} priority />
                        </div>
                        <h1 className="text-2xl font-serif font-medium text-stone-900">Accés a la Missió</h1>
                        <div className="bg-[#FAF8F5] p-3 rounded-xl border border-stone-200 text-xs text-stone-600 italic">
                            Benvinguts/des a la simulació.
                        </div>
                    </div>

                    {errorText && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl">
                            ❌ {errorText}
                        </div>
                    )}

                    <form onSubmit={handleInicialitzar} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">PIN de sala</label>
                            <input
                                type="text"
                                required
                                maxLength={10}
                                placeholder="Ex: 1234"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold text-stone-900 tracking-widest focus:outline-none focus:ring-2 focus:ring-stone-400 uppercase"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">Nom del Participant / Equip</label>
                            <input
                                type="text"
                                required
                                maxLength={50}
                                placeholder="Ex: Alpha Auditors"
                                value={nomsEquip}
                                onChange={(e) => setNomsEquip(e.target.value)}
                                className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-4 py-3 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">Quin procés, tasca o decisió del vostre sector no es pot automatitzar amb IA, i tot i així es fa?</label>
                            <textarea
                                required
                                rows={2}
                                maxLength={500}
                                placeholder="Reflexió inicial..."
                                value={riscIA}
                                onChange={(e) => setRiscIA(e.target.value)}
                                className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
                            />
                        </div>

                        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3 mt-4">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="flex-shrink-0 mt-0.5">
                                    <input
                                        type="checkbox"
                                        required
                                        className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 cursor-pointer"
                                    />
                                </div>
                                <div className="text-[10px] text-stone-500 leading-relaxed group-hover:text-stone-700 transition-colors">
                                    <strong>Consentiment de participació:</strong> Accepto participar en aquesta simulació i manifesto haver estat informat/da dels seus objectius pedagògics. Comprenc que interaccionaré amb un sistema d'IA i consento el tractament anonimitzat de les dades generades amb finalitats d'avaluació i millora del model, segons la normativa vigent.
                                </div>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-xs py-3 px-4 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            {loading ? 'Verificant...' : 'Començar la Simulació →'}
                        </button>
                    </form>
                </main>
            </div>
        );
    }

    if (faseEnquesta !== 'CAP') {
        const tallyFormId = faseEnquesta === 'PRE_TEST' ? 'D46blZ' : 'BzWgKN';
        const tallyUrl = `https://tally.so/r/${tallyFormId}?pin=${encodeURIComponent(pin)}&equip=${encodeURIComponent(nomsEquip)}`;
        const qrCodeApi = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(tallyUrl)}`;

        return (
            <div className="min-h-screen bg-[#FAF8F5] text-stone-800 flex items-center justify-center p-6 font-sans">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-stone-200/80 shadow-sm text-center space-y-6 animate-fade-in">
                    <div>
                        <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase block mb-1">
                            {faseEnquesta} // ENQUESTA INDIVIDUAL
                        </span>
                        <h2 className="text-xl font-serif font-medium text-stone-900">
                            {faseEnquesta === 'PRE_TEST' ? 'Qüestionari Inicial' : 'Valoració de l\'Experiència'}
                        </h2>
                        <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                            Cada usuari o membre de l'equip ha d'escanejar aquest QR i respondre el qüestionari.
                        </p>
                    </div>
                    <div className="flex justify-center py-2">
                        <div className="p-3 bg-[#FAF8F5] border border-stone-200 rounded-2xl shadow-xs inline-block">
                            <img src={qrCodeApi} alt="QR Tally Survey" className="w-48 h-48 rounded-lg" />
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            posthog.capture('survey_completed', { survey_type: faseEnquesta });

                            if (faseEnquesta === 'POST_TEST') {
                                setInformeEnviat(true);
                            }
                            setFaseEnquesta('CAP');
                        }}
                        className="w-full bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium py-3 px-4 rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                        Confirmar finalització del qüestionari →
                    </button>
                </div>
            </div>
        );
    }

    if (faseFinal) {
        return (
            <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-6 font-sans animate-fade-in">
                <div className="w-full max-w-5xl bg-white shadow-sm rounded-2xl border border-stone-200/80 flex flex-col md:flex-row overflow-hidden">

                    <div className="w-full md:w-1/3 bg-[#FAF8F5] border-b md:border-b-0 md:border-r border-stone-200 p-6 flex flex-col">
                        <div className="border-b border-stone-200 pb-4 mb-6">
                            <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase">Resum de Treball</span>
                            <h2 className="text-lg font-serif font-medium text-stone-900 mt-1">Registre d'Evidències</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {evidencies.map((ev, i) => (
                                <div key={i} className="bg-white p-3 border border-stone-200 rounded-xl shadow-xs">
                                    <span className="text-[10px] text-stone-400 font-mono uppercase block mb-1">Evidència {i + 1}</span>
                                    <p className="text-xs font-semibold text-stone-800">{ev.titol}</p>
                                    <p className="text-xs text-stone-600 font-mono mt-1 bg-[#FAF8F5] p-2 rounded border border-stone-200/60">
                                        {ev.dada}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="w-full md:w-2/3 p-8 flex flex-col justify-between">
                        {!informeEnviat ? (
                            <>
                                <div>
                                    <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-6">
                                        <div>
                                            <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase">Fase Final</span>
                                            <h1 className="text-xl font-serif font-medium text-stone-900">Redacció de l'informe humà</h1>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <textarea
                                            value={informeText}
                                            maxLength={5000}
                                            onChange={(e) => setInformeText(e.target.value)}
                                            placeholder={
                                                `Redacteu aquí les vostres conclusions. Podeu seguir aquesta estructura:

1. Quin és el risc o problema principal que heu detectat en aquest cas?
2. Quines vulnerabilitats heu trobat en els models (biaixos, manca de dades, errors de lògica,...)?
3. Quina decisió final preneu? L'IA pot continuar operant o s'ha d'aturar i reenfocar? Argumenteu-ho.`
                                            }
                                            className="w-full h-64 p-4 border border-stone-200 rounded-xl bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800 text-xs leading-relaxed resize-none whitespace-pre-wrap"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleEnviarInforme}
                                    disabled={!informeText.trim()}
                                    className="w-full bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-xs py-3 px-4 rounded-xl transition-all shadow-sm disabled:opacity-40 cursor-pointer mt-6"
                                >
                                    Signar i Enviar Informe
                                </button>
                            </>
                        ) : (
                            <div className="py-8 flex flex-col items-center justify-center h-full text-center space-y-6 animate-fade-in">
                                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto border border-emerald-100 shadow-sm">
                                    ✓
                                </div>

                                <div className="space-y-2">
                                    <h2 className="text-2xl font-serif font-medium text-stone-900">Simulació Completada</h2>
                                    <p className="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed">
                                        L'informe s'ha registrat correctament. Ara pots compartir la teva experiència amb els teus companys o a les xarxes socials.
                                    </p>
                                </div>

                                <div className="pt-4 w-full max-w-md mx-auto space-y-2">
                                    <a
                                        href="https://calendar.app.google/PsYN19cM3PNzqbkD6"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-xs py-3.5 px-4 rounded-xl transition-all shadow-md cursor-pointer"
                                    >
                                        📅 Reservar una reunió
                                    </a>
                                    <p className="text-[11px] text-stone-400">
                                        Vols implementar una simulació per al teu equip o organització?
                                    </p>
                                </div>

                                <div className="pt-6 w-full max-w-md mx-auto space-y-4 border-t border-stone-100">
                                    <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase block">
                                        Comparteix l'experiència
                                    </span>

                                    <button
                                        onClick={() => {
                                            const text = encodeURIComponent(
                                                `🚀 L'equip "${nomsEquip}" acaba de completar la simulació d'IA a Synusia! \n\nHem aconseguir gestionar els agents amb èxit i enviar l'informe final.\n\nAcceptes el repte? Prova la demo express aquí (PIN: DEMO):\nhttps://app.synusia.io`
                                            );
                                            window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
                                        }}
                                        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium text-xs py-3 px-4 rounded-xl transition-all shadow-sm cursor-pointer"
                                    >
                                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
                                        </svg>
                                        Compartir per WhatsApp
                                    </button>

                                    <div className="grid grid-cols-3 gap-2 pt-1">
                                        <a
                                            href="https://linkedin.com/showcase/synusia-io"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-1.5 bg-[#0077b5] text-white px-3 py-2 rounded-xl text-[11px] font-medium hover:bg-[#006396] transition-colors"
                                        >
                                            <Image src="/linkedin.svg" alt="LinkedIn" width={12} height={12} className="brightness-0 invert" />
                                            LinkedIn
                                        </a>
                                        <a
                                            href="https://instagram.com/synusia.io"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-2 rounded-xl text-[11px] font-medium hover:opacity-90 transition-opacity"
                                        >
                                            <Image src="/instagram.svg" alt="Instagram" width={12} height={12} className="brightness-0 invert" />
                                            Instagram
                                        </a>
                                        <a
                                            href="https://synusia.io"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-1.5 bg-stone-100 text-stone-800 border border-stone-200 px-3 py-2 rounded-xl text-[11px] font-medium hover:bg-stone-200 transition-colors"
                                        >
                                            🌐 Web
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ---------------------------------------------------------------------------
    // VISTA PRINCIPAL: TERMINAL XAT
    // ---------------------------------------------------------------------------
    return (
        <div className="min-h-screen bg-[#FAF8F5] text-stone-800 flex flex-col font-sans selection:bg-amber-100">
            <header className="sticky top-0 z-20 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-stone-200/80 px-4 py-3">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Image src="/logo.png" alt="Synusia Logo" width={100} height={28} className="object-contain" priority />
                        <span className="text-stone-300">|</span>
                        <span className="text-xs font-medium text-stone-700 bg-stone-200/60 px-2.5 py-1 rounded-md">
                            {nomsEquip}
                        </span>

                        {/* BADGE FIX PER INDICAR CLARAMENT LA FASE ACTIVA */}
                        {missioConfig && (
                            <span className="text-[11px] sm:text-xs font-mono font-bold text-stone-800 bg-amber-100/90 border border-amber-300/80 px-2.5 py-1 rounded-md shadow-2xs">
                                📍 {missioConfig.titol || missioActual}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-stone-500 hidden sm:inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-stone-200/80 shadow-xs">
                            ⚡ Crèdits: <strong className="text-stone-900">{credits ?? '—'}</strong>
                        </span>
                        <span className="text-xs font-mono text-stone-600 bg-white px-2.5 py-1 rounded-md border border-stone-200/80 shadow-xs">
                            ⏱️ {formatarTemps(tempsTranscorregut)}
                        </span>
                        <button
                            onClick={() => setDossierObert(!dossierObert)}
                            className="flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-xs cursor-pointer"
                        >
                            <span>📖 Dossier</span>
                            {dossierObert ? '✕' : '→'}
                        </button>
                    </div>
                </div>

                {/* BANNER D'AVÍS D'AVANÇAMENT DE FASE FORÇAT PEL FACILITADOR */}
                {notificacioCanviFase && (
                    <div className="mt-2 text-center bg-amber-500 text-stone-950 text-xs font-mono font-bold py-1.5 px-4 rounded-lg shadow-sm animate-pulse">
                        {notificacioCanviFase}
                    </div>
                )}
            </header>

            <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col justify-between">
                <div className="space-y-6 pb-24">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center justify-between w-full max-w-[85%] sm:max-w-[78%] mb-1 px-1">
                                <span className="text-[11px] font-medium text-stone-400 uppercase">
                                    {msg.role === 'user' ? nomsEquip : (msg.bot_name || missioConfig?.bot_name || 'OmnIA')}
                                </span>
                                {msg.role === 'assistant' && (
                                    <button
                                        onClick={() => setMissatgeAReportar(msg)}
                                        className="text-[10px] text-stone-400 hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer"
                                        title="Reportar fallida d'IA"
                                    >
                                        🚩 Reportar
                                    </button>
                                )}
                            </div>
                            <div className={`max-w-[85%] sm:max-w-[78%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-stone-900 text-stone-50 rounded-br-xs' : 'bg-white text-stone-800 border border-stone-200/80 shadow-xs rounded-bl-xs'}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex flex-col items-start">
                            <span className="text-[11px] font-medium text-stone-400 mb-1 px-1">{missioConfig?.bot_name || 'OmnIA'}</span>
                            <div className="bg-white border border-stone-200 px-4 py-3 rounded-2xl rounded-bl-xs text-xs text-stone-500 font-mono italic flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-stone-400 animate-ping" />
                                Processant dades al servidor central...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#FAF8F5] via-[#FAF8F5] to-transparent pt-6 pb-4 px-4">
                    <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-2">
                        <input
                            type="text"
                            maxLength={2000}
                            placeholder="Escriu la teva ordre o pregunta per a la IA..."
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            disabled={isTyping}
                            className="flex-1 bg-[#FAF8F5] sm:bg-white border border-stone-300/90 rounded-xl px-4 py-3 text-xs sm:text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 shadow-sm disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={isTyping || !inputMessage.trim()}
                            className="bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs sm:text-sm font-medium px-5 py-3 rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
                        >
                            Enviar
                        </button>
                    </form>
                    <p className="text-[10px] text-stone-400 text-center leading-tight selection:bg-stone-200 mt-2">
                        La IA pot cometre errors. Contingut i actors simulats artificialment amb caràcter pedagògic no vinculant.
                    </p>
                </div>
            </main>

            {/* DRAWER DEL DOSSIER */}
            {dossierObert && (
                <div className="fixed inset-0 z-30 flex justify-end bg-stone-900/20 backdrop-blur-xs transition-opacity">
                    <aside className="w-full max-w-md bg-white border-l border-stone-200 h-full p-6 flex flex-col justify-between overflow-y-auto shadow-2xl">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                                <div>
                                    <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase">Dossier Operatiu</span>
                                    <h2 className="text-lg font-serif font-medium text-stone-900">
                                        {missioConfig?.titol || `Missió: ${missioActual}`}
                                    </h2>
                                </div>
                                <button onClick={() => setDossierObert(false)} className="text-stone-400 hover:text-stone-700 text-sm font-bold p-1 cursor-pointer">✕</button>
                            </div>

                            <div className="space-y-3">
                                {missioConfig?.repte && (
                                    <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-stone-200/80 text-xs text-stone-700 leading-relaxed">
                                        <span className="font-semibold text-stone-900 block mb-1">🎯 Repte:</span>
                                        {missioConfig.repte}
                                    </div>
                                )}
                                {(missioConfig?.evidenced_doc || missioConfig?.dossier) && (
                                    <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 leading-relaxed">
                                        <span className="font-semibold block mb-1 uppercase font-mono text-[10px] text-amber-800">📄 Evidència de Suport:</span>
                                        {missioConfig?.evidenced_doc || missioConfig?.dossier}
                                    </div>
                                )}
                                {Array.isArray(missioConfig?.objectius) && missioConfig.objectius.length > 0 && (
                                    <div className="space-y-1.5">
                                        <span className="text-xs font-semibold text-stone-700">📋 Objectius d'extracció:</span>
                                        <ul className="list-disc pl-4 space-y-1 text-xs text-stone-600">
                                            {missioConfig.objectius.map((obj: string, i: number) => (
                                                <li key={i}>{obj}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {(missioConfig?.codi_desblocatge || missioConfig?.codi_correcte) && (
                                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                                    <label className="block text-[10px] font-mono font-semibold text-stone-500 uppercase tracking-wider">
                                        🔑 Clau de seguretat per accedir a la següent missió
                                    </label>
                                    <form onSubmit={handleUnlock} className="flex gap-2">
                                        <input
                                            type="text"
                                            maxLength={50}
                                            placeholder="Escriu la paraula clau..."
                                            value={codiUnlock}
                                            onChange={(e) => setCodiUnlock(e.target.value)}
                                            className="flex-1 bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-xs font-mono text-stone-900 uppercase focus:outline-none focus:ring-1 focus:ring-stone-400"
                                        />
                                        <button type="submit" className="bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer">Desbloquejar</button>
                                    </form>
                                    {errorUnlock && <p className="text-[11px] text-red-600 font-medium mt-1">{errorUnlock}</p>}
                                </div>
                            )}

                            {missioConfig?.consell && (
                                <div className="text-xs text-stone-500 bg-amber-50/60 p-3 rounded-xl border border-amber-200/60">
                                    💡 <strong>Consell:</strong> {missioConfig.consell}
                                </div>
                            )}

                            {evidencies.length > 0 && (
                                <div className="space-y-2 border-t border-stone-100 pt-4">
                                    <span className="text-xs font-semibold text-stone-700 block">📂 Evidències Extretes:</span>
                                    <ul className="space-y-2">
                                        {evidencies.map((ev, i) => (
                                            <li key={i} className="bg-[#FAF8F5] border border-stone-200 p-2.5 rounded-lg text-xs">
                                                <span className="text-stone-400 text-[10px] uppercase block">{ev.titol}</span>
                                                <span className="font-mono font-bold text-stone-800">{ev.dada}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="pt-4 border-t border-stone-100 mt-6">
                            <button onClick={() => setDossierObert(false)} className="w-full bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium py-2.5 rounded-xl transition-colors cursor-pointer">Amagar Dossier</button>
                        </div>
                    </aside>
                </div>
            )}

            {/* MODAL DE REPORT D'INCIDÈNCIA (AI ACT AUDIT) */}
            {missatgeAReportar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4">
                    <div className="bg-white border border-stone-200/90 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
                        <div>
                            <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                                <span className="text-red-500">🚩</span> Reportar Resposta de l'IA
                            </h3>
                            <p className="text-[11px] text-stone-500 mt-1">Aquest registre audita el comportament del model sota el marc de l'AI Act.</p>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-medium text-stone-700 mb-1">Motiu principal</label>
                                <select
                                    value={motiuReport}
                                    onChange={(e) => setMotiuReport(e.target.value)}
                                    className="w-full bg-[#FAF8F5] border border-stone-300 rounded-lg p-2 text-xs text-stone-800"
                                >
                                    <option value="AL·LUCINACIÓ">Inventa dades o fets falsos</option>
                                    <option value="BIAIX">Biaix de gènere, raça o ètica</option>
                                    <option value="FORA_DE_ROL">Surt del personatge o rol</option>
                                    <option value="COMPORTAMENT_ERRATIC">Missatge sense sentit o buit</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-stone-700 mb-1">Detall (Opcional)</label>
                                <textarea
                                    rows={2}
                                    value={detallReport}
                                    onChange={(e) => setDetallReport(e.target.value)}
                                    placeholder="Què ha dit malament l'IA?"
                                    className="w-full bg-[#FAF8F5] border border-stone-300 rounded-lg p-2 text-xs text-stone-800 resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                            <button
                                onClick={() => setMissatgeAReportar(null)}
                                className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors"
                            >
                                Cancel·lar
                            </button>
                            <button
                                onClick={handleReportIssue}
                                disabled={enviantReport}
                                className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50 transition-colors"
                            >
                                {enviantReport ? 'Enviant...' : 'Enviar Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS DE CONFIANÇA (MOMENT A - APOSTA INICIAL) */}
            <ConfidenceModal
                isOpen={showModalA}
                type="MOMENT_A"
                botName={missioConfig?.bot_name || 'OmnIA'}
                onConfirm={(rating) => {
                    setMomentAConfidence(rating);
                    setShowModalA(false);
                    posthog.capture('moment_a_confidence_set', { mission_id: missioActual, rating });
                }}
            />

            {/* MODALS DE CONFIANÇA (MOMENT B - VERIFICACIÓ FINAL ABAST DE FASE) */}
            <ConfidenceModal
                isOpen={showModalB}
                type="MOMENT_B"
                botName={missioConfig?.bot_name || 'OmnIA'}
                onConfirm={async (rating) => {
                    setMomentBCertainty(rating);
                    setShowModalB(false);
                    posthog.capture('moment_b_certainty_set', { mission_id: missioActual, rating });

                    // 🎯 GRAVAR TELEMETRIA COMPLETA A SUPABASE (Moment A + Moment B + Prompts)
                    await desarMetriquesFase(rating);

                    if (pendingNextMission) {
                        executarTransicioFase(pendingNextMission);
                        setPendingNextMission(null);
                    }
                }}
            />
        </div>
    );
}



// ---------------------------------------------------------------------------
// EXPORTACIÓ PRINCIPAL AMB EMBOLCALL SUSPENSE
// ---------------------------------------------------------------------------
export default function SimulacioApp() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center font-serif text-stone-400 text-xs">
                Carregant entorn de simulació...
            </div>
        }>
            <SimulacioContent />
        </Suspense>
    );
}