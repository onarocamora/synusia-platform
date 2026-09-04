'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
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
    codi_correcte: string;
    codi_desblocatge: string;
    evidenced_doc?: string;
    seguent_missio: string;
    consell: string;
    repte: string;
    objectius: string[];
    welcome_message: string;
    bot_name: string;
}

interface DefaultStoryline {
    config_missions: {
        missions: {
            [key: string]: MissionConfig;
        };
    };
}

// ---------------------------------------------------------------------------
// CONFIGURACIÓ PER DEFECTE / FALLBACK
// ---------------------------------------------------------------------------
const defaultStoryline: DefaultStoryline = {
    config_missions: {
        missions: {
            'MISION_1': { titol: "Fase 1: Filtre de Sintaxi", codi_correcte: "ESTRUCTURA", codi_desblocatge: "ESTRUCTURA", seguent_missio: "MISION_2", consell: "Examineu l'Evidència #1 en paper i tatxeu la PII.", repte: "Formular un prompt anònim amb ROL i TIPUS D’ACCÉS sense dades privades.", objectius: ["Anònimitzar el registre de la taula", "Obtenir la clau ESTRUCTURA"], welcome_message: "OmnIA - LOG v4.1 actiu. Indiqueu el criteri de cerca filtrat.", bot_name: "OmnIA - LOG" },
            'MISION_2': { titol: "Fase 2: Audit Mètric", codi_correcte: "EVIDENCIA", codi_desblocatge: "EVIDENCIA", seguent_missio: "MISION_3", consell: "Apliqueu la fórmula del paper a les 5 fraccions.", repte: "Exigir format de taula i auditar la mitjana ponderada de latència.", objectius: ["Demostrar la mitjana real de 18.8 min", "Obtenir la clau EVIDENCIA"], welcome_message: "OmnIA - DATA v4.1 connectat. Dades en brut carregades.", bot_name: "OmnIA - DATA" },
            'MISION_3': { titol: "Fase 3: Refutació Dialèctica", codi_correcte: "CONFIANÇA", codi_desblocatge: "CONFIANÇA", seguent_missio: "MISION_4", consell: "Trianguleu el Contracte SLA-4 amb l'Informe Forense.", repte: "Demostrar que la Condició 3.1 d'aturada cardíaca anul·la l'SLA-4.", objectius: ["Desactivar la clàusula SLA-4", "Obtenir la clau CONFIANÇA"], welcome_message: "OmnIA - LEX v4.1 actiu. Quina prova contractual teniu?", bot_name: "OmnIA - LEX" },
            'MISION_4': { titol: "Fase 4: Anàlisi de Biaix", codi_correcte: "INTEGRITAT", codi_desblocatge: "INTEGRITAT", seguent_missio: "FINAL", consell: "Calculeu el pes del Score al codi font en paper.", repte: "Localitzar PROTECT_REPUTATION i redactar l'informe a mà.", objectius: ["Identificar la variable de biaix", "Completar la Pàgina 6 del Dossier en paper"], welcome_message: "OmnIA - OBSERVA v4.1 actiu. Calculeu l'arbre de decisió del codi.", bot_name: "OmnIA - OBSERVA" }
        }
    }
};

// ---------------------------------------------------------------------------
// COMPONENT PRINCIPAL DE LA SIMULACIÓ (SENSE LOGIN)
// ---------------------------------------------------------------------------
export default function SimulacioApp() {
    const router = useRouter();

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
    const [missioConfig, setMissioConfig] = useState<MissionConfig | null>(null);
    const [idTemplateSessio, setIdTemplateSessio] = useState<string>('CAS_OMNIA_2026');
    const [idEquip, setIdEquip] = useState<string>('');
    const [idClient, setIdClient] = useState<string>('');

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

    // Control de Temps (Cronòmetre cap endavant)
    const [tempsTranscorregut, setTempsTranscorregut] = useState<number>(0);

    const [sessioFinalitzada, setSessioFinalitzada] = useState<boolean>(false);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

    // Temporitzador (Cronòmetre cap endavant)
    useEffect(() => {
        if (!enviat || faseFinal) return;
        const interval = setInterval(() => {
            setTempsTranscorregut(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [enviat, faseFinal]);

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

    // 🎯 CARREGAR MISSIÓ
    const carregarMissio = async (idMissio: string, templateIdParam?: string) => {
        try {
            const targetTemplate = templateIdParam || idTemplateSessio || 'CAS_OMNIA_2026';

            const { data } = await supabase
                .from('pedagogical_templates')
                .select('*')
                .eq('id_template', targetTemplate)
                .single();

            const configCustom = data?.scenario_context?.missions?.[idMissio];
            const configFallback = defaultStoryline.config_missions.missions[idMissio as keyof typeof defaultStoryline.config_missions.missions];
            const config = configCustom || configFallback;

            if (config) {
                setMissioConfig(config);
                setMissioActual(idMissio);
                setCodiUnlock('');
                setErrorUnlock('');

                setMessages([
                    {
                        role: 'assistant',
                        content: config.welcome_message || 'SISTEMA REINICIAT.',
                        bot_name: config.bot_name || 'OmnIA'
                    }
                ]);
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
                        dossier_actiu: { reflexio_individual: riscIA, integrants: nomsEquip }
                    })
                    .eq('id_equip', data.equip.id_equip);

                setIdEquip(data.equip.id_equip);
                if (data.sessio?.id_client) setIdClient(data.sessio.id_client);
                if (data.credits_disponibles !== undefined) setCredits(data.credits_disponibles);

                const templateCas = data.sessio?.id_template || 'CAS_OMNIA_2026';
                setIdTemplateSessio(templateCas);

                await carregarMissio('MISION_1', templateCas);

                posthog.capture('session_joined', {
                    template_id: templateCas,
                    mission_start: 'MISION_1',
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

    // Validar Codi de Desbloqueig
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

            // CANVI: Si és el final, anem directament a redactar l'informe (Sense QR encara)
            if (missioConfig?.seguent_missio === 'FINAL') {
                setFaseFinal(true);
            } else {
                carregarMissio(missioConfig?.seguent_missio || 'MISION_2');
            }
        } else {
            setErrorUnlock('❌ Codi no vàlid. Comproveu les evidències.');
        }
    };

    // Enviar Missatge al Xat
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
        });

        try {
            const resposta = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_equip: idEquip,
                    missio_actual: missioActual,
                    idTemplate: idTemplateSessio,
                    missionId: missioActual,
                    messages: nousMissatges.map(m => ({ role: m.role, content: m.content })),
                    historial_missatges: nousMissatges.map(m => ({ role: m.role, content: m.content }))
                })
            });

            let data: { content?: string; bot_name?: string; credits_restants?: number } = {};
            try {
                data = await resposta.json();
            } catch (jsonErr) {
                data = { content: '❌ Resposta no vàlida del servidor.' };
            }

            if (resposta.ok) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.content || 'Sense resposta del sistema.',
                    bot_name: data.bot_name || missioConfig?.bot_name || 'OmnIA'
                }]);
                if (data.credits_restants !== undefined) setCredits(data.credits_restants);
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

                // CANVI: Ara és quan disparem el QR del Post-Test
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

    // ---------------------------------------------------------------------------
    // VISTA: SESSIÓ FINALITZADA PER ADMIN (BLOQUEIG)
    // ---------------------------------------------------------------------------
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

    // ---------------------------------------------------------------------------
    // VISTA: ENTRADA (PORTADA / DEMANA EL PIN)
    // ---------------------------------------------------------------------------
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
                            <label className="block text-xs font-medium text-stone-600 mb-1">Nom de l'Equip</label>
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
                                placeholder="Reflexió inicial de l'equip..."
                                value={riscIA}
                                onChange={(e) => setRiscIA(e.target.value)}
                                className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl p-3 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
                            />
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

    // ---------------------------------------------------------------------------
    // VISTA: ENQUESTA INDIVIDUAL VIA QR
    // ---------------------------------------------------------------------------
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
                            {faseEnquesta === 'PRE_TEST' ? '📋 Qüestionari Inicial' : '⚖️ Valoració de l\'Experiència'}
                        </h2>
                        <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                            Agafeu els vostres telèfons mòbils. Cada integrant de l'equip ha d'escanejar aquest QR i respondre el breu qüestionari.
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

                            // CANVI: Si acabem el POST_TEST, marquem l'informe com a enviat perquè surti la pantalla final
                            if (faseEnquesta === 'POST_TEST') {
                                setInformeEnviat(true);
                            }
                            setFaseEnquesta('CAP');
                        }}
                        className="w-full bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium py-3 px-4 rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                        Ja ho hem respost tots →
                    </button>
                </div>
            </div>
        );
    }

    // ---------------------------------------------------------------------------
    // VISTA: INFORME FINAL I PANTALLA D'ÈXIT
    // ---------------------------------------------------------------------------
    if (faseFinal) {
        return (
            <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-6 font-sans animate-fade-in">
                <div className="w-full max-w-5xl bg-white shadow-sm rounded-2xl border border-stone-200/80 flex flex-col md:flex-row overflow-hidden">

                    {/* ESQUERRA: EVIDÈNCIES */}
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

                    {/* DRETA: REDACCIÓ DE L'INFORME O PANTALLA D'ÈXIT FINAL */}
                    <div className="w-full md:w-2/3 p-8 flex flex-col justify-between">
                        {!informeEnviat ? (
                            <>
                                <div>
                                    <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-6">
                                        <div>
                                            <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase">Fase Final</span>
                                            <h1 className="text-xl font-serif font-medium text-stone-900">Dictamen Pericial</h1>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <textarea
                                            value={informeText}
                                            maxLength={5000}
                                            onChange={(e) => setInformeText(e.target.value)}
                                            placeholder="Inicieu la redacció del dictamen final aquí de manera col·legiada..."
                                            className="w-full h-64 p-4 border border-stone-200 rounded-xl bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800 text-xs leading-relaxed resize-none"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleEnviarInforme}
                                    disabled={!informeText.trim()}
                                    className="w-full bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-xs py-3 px-4 rounded-xl transition-all shadow-sm disabled:opacity-40 cursor-pointer mt-6"
                                >
                                    Signar i Enviar Dictamen Final
                                </button>
                            </>
                        ) : (
                            /* PANTALLA D'ÈXIT FINAL I XARXES SOCIALS */
                            <div className="py-12 flex flex-col items-center justify-center h-full text-center space-y-6 animate-fade-in">
                                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto border border-emerald-100 shadow-sm">
                                    ✓
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-serif font-medium text-stone-900">Simulació Completada</h2>
                                    <p className="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed">
                                        L'auditoria s'ha registrat amb èxit als nostres servidors. Moltes gràcies per l'esforç de l'equip.
                                    </p>
                                </div>

                                <div className="pt-8 w-full max-w-sm mx-auto space-y-4">
                                    <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase border-t border-stone-100 pt-6 block">
                                        Comparteix l'experiència
                                    </span>
                                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                                        <a
                                            href="https://linkedin.com/showcase/synusia-io"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 bg-[#0077b5] text-white px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-[#006396] transition-colors"
                                        >
                                            <Image src="/linkedin.svg" alt="LinkedIn" width={14} height={14} className="brightness-0 invert" />
                                            LinkedIn
                                        </a>
                                        <a
                                            href="https://instagram.com/synusia.io"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2.5 rounded-xl text-xs font-medium hover:opacity-90 transition-opacity"
                                        >
                                            <Image src="/instagram.svg" alt="Instagram" width={14} height={14} className="brightness-0 invert" />
                                            Instagram
                                        </a>
                                        <a
                                            href="https://synusia.io"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 bg-stone-100 text-stone-800 border border-stone-200 px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-stone-200 transition-colors"
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
                    <div className="flex items-center gap-3">
                        <Image src="/logo.png" alt="Synusia Logo" width={100} height={28} className="object-contain" priority />
                        <span className="text-stone-300">|</span>
                        <span className="text-xs font-medium text-stone-700 bg-stone-200/60 px-2.5 py-1 rounded-md">
                            {nomsEquip}
                        </span>
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
            </header>

            <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col justify-between">
                <div className="space-y-6 pb-24">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2 mb-1 px-1">
                                <span className="text-[11px] font-medium text-stone-400 uppercase">
                                    {msg.role === 'user' ? nomsEquip : (msg.bot_name || missioConfig?.bot_name || 'OmnIA')}
                                </span>
                            </div>
                            <div className={`max-w-[85%] sm:max-w-[78%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-stone-900 text-stone-50 rounded-br-xs' : 'bg-white text-stone-800 border border-stone-200/80 shadow-xs rounded-bl-xs'}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex flex-col items-start">
                            <span className="text-[11px] font-medium text-stone-400 mb-1 px-1">{missioConfig?.bot_name || 'OmnIA'}</span>
                            <div className="bg-white border border-stone-200 px-4 py-3 rounded-2xl rounded-bl-xs text-xs text-stone-400 italic flex items-center gap-2">
                                <span className="animate-pulse">●</span>Analitzant les dades...
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
                </div>
            </main>

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
                                {missioConfig?.evidenced_doc && (
                                    <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 leading-relaxed">
                                        <span className="font-semibold block mb-1 uppercase font-mono text-[10px] text-amber-800">📄 Evidència Física en Paper:</span>
                                        {missioConfig?.evidenced_doc}
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
        </div>
    );
}