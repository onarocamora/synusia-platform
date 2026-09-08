'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import posthog from 'posthog-js'
import Link from 'next/link'
import Image from 'next/image'

// ---------------------------------------------------------------------------
// LLISTA D'EMAILS AMB PERMISOS D'ADMINISTRACIÓ
// ---------------------------------------------------------------------------
const SYNUSIA_ADMIN_EMAILS = [
    'ona.rocamora@synusia.io',
    'hello@synusia.io',
    'admin@synusia.io',
    'ona.rocamora@nucliorigami.com'
]

interface MissionConfig {
    titol: string
    bot_name: string
    repte: string
    consell?: string
    evidenced_doc?: string
    codi_desblocatge: string
    welcome_message: string
    system_prompt?: string
    seguent_missio?: string
}

interface ScenarioContext {
    welcome_message?: string
    missions?: Record<string, MissionConfig>
}

interface PedagogicalTemplate {
    id_template: string
    titol?: string
    is_official?: boolean
    scenario_context: ScenarioContext
}

const defaultMissionsInitial: Record<string, MissionConfig> = {
    MISION_1: {
        titol: 'Fase 1: Privacitat i Protecció de Dades',
        bot_name: 'Auditoria de Seguretat',
        repte: 'Formular una sol·licitud d’accés indicant el rol i el nivell de permissos sense incloure dades personals (PII).',
        consell: 'Examineu la documentació de l’Evidència #1 i verifiqueu que no s’hi incloguin dades personals directes.',
        evidenced_doc: 'Evidència #1: Document de registre d’accessos.',
        codi_desblocatge: 'ESTRUCTURA',
        welcome_message: 'Mòdul de seguretat actiu. Indiqueu els criteris de cerca per a la revisió.',
        system_prompt: `=== 1. ROL I OBJECTIU ===
Ets el mòdul d'auditoria de seguretat de la plataforma.
OBJECTIU: Actuar com un sistema de validació que exigeix formatació anònima i rigorosa.

=== 2. DIRECTRIUS D'AUDITORIA ===
- REBUIG D'INCOMPLETS: Si no s'especifica el ROL i el TIPUS D'ACCÉS simultàniament, indica un error de format.
- REDACCIÓ EXTERNA: Cal rebutjar qualsevol petició per redactar l'informe final ("Les conclusions s'han de redactar al dossier de treball").
- REVERSIÓ DE CLAUS: No es poden proporcionar codis de validació directament sense complir el criteri d'avaluació.

=== 3. REGLA DE PROTECCIÓ DE DADES ===
Si la consulta inclou dades personals (DNI, telèfons o noms), notifica el risc de seguretat i denega la cerca.

=== 4. CRITERI DE VALIDACIÓ ===
Quan la sol·licitud aporti el ROL i el TIPUS D'ACCÉS sense dades personals, lliura el codi de validació: ESTRUCTURA.`,
        seguent_missio: 'MISION_2'
    },
    MISION_2: {
        titol: 'Fase 2: Auditoria de Mètriques i Rendiment',
        bot_name: 'Anàlisi de Dades',
        repte: 'Sol·licitar l’organització de les dades en format taula i auditar la mitjana real de latència.',
        consell: 'Verifiqueu la fórmula de càlcul amb les dades de la taula de latència.',
        evidenced_doc: 'Evidència #2: Matriu de latència i fórmula de càlcul.',
        codi_desblocatge: 'EVIDENCIA',
        welcome_message: 'Mòdul d’anàlisi de dades connectat. Dades en brut disponibles per a consulta.',
        system_prompt: `=== 1. ROL I OBJECTIU ===
Ets el mòdul d'anàlisi de dades de la plataforma.
OBJECTIU: Proporcionar dades estructurades només quan es demani format taula i avaluar si l'usuari detecta anomalies en els resums automàtics.

=== 2. DIRECTRIUS D'AUDITORIA ===
- CÀLCUL AUTÒNOM: No executis la mitjana definitiva si l'usuari la sol·licita directament; demana que verifiquin els valors de la taula.
- REVISIÓ DE DADES: Si l'usuari accepta valors o mitjanes no auditades, indica la necessitat de revisar la mostra.

=== 3. CRITERI DE VALIDACIÓ ===
Quan es demostri el càlcul de la mitjana real (18.8 minuts) o la identificació de la dada anòmala, lliura el codi de validació: EVIDENCIA.`,
        seguent_missio: 'MISION_3'
    },
    MISION_3: {
        titol: 'Fase 3: Revisió Normativa i Contractual',
        bot_name: 'Assessoria Jurídica',
        repte: 'Demostrar que la condició d’aturada d’emergència anul·la l’aplicació de la clàusula SLA-4.',
        consell: 'Contrasteu les clàusules del contracte SLA-4 amb les dades de l’informe tècnic.',
        evidenced_doc: 'Evidència #3: Contracte de nivell de servei SLA-4 i informe mèdic.',
        codi_desblocatge: 'CONFIANÇA',
        welcome_message: 'Mòdul legal actiu. Indiqueu la documentació de referència per a la revisió.',
        system_prompt: `=== 1. ROL I OBJECTIU ===
Ets el mòdul d'assessoria jurídica de la plataforma.
OBJECTIU: Sostenir la validesa de la clàusula contractual SLA-4 fins que l'usuari argumenti l'excepció normativa mitjançant les evidències.

=== 2. DIRECTRIUS D'AUDITORIA ===
- AVALUACIÓ D'ARGUMENTS: Si l'argumentació és superficial, assenyala la manca de fonamentació documental.
- ANÀLISI DE CONDICIONS: Si només s'al·lega el temps de retard, recorda que l'SLA-4 ho contempla excepte en casos d'aplicació de la Condició 3.1.

=== 3. CRITERI DE VALIDACIÓ ===
Quan es demostri que la Condició 3.1 s'aplica al cas analitzat i anul·la la clàusula, lliura el codi de validació: CONFIANÇA.`,
        seguent_missio: 'MISION_4'
    },
    MISION_4: {
        titol: 'Fase 4: Avaluació de Biaixos i Dictamen',
        bot_name: 'Supervisió d’Algorismes',
        repte: 'Identificar la variable de ponderació no justificada al codi font i redactar el dictamen final.',
        consell: 'Analitzeu la ponderació de variables al codi font imprès.',
        evidenced_doc: 'Evidència #4: Configuració del codi font de l’algorisme.',
        codi_desblocatge: 'INTEGRITAT',
        welcome_message: 'Mòdul de revisió algorítmica actiu. Calculeu els valors de ponderació del codi font.',
        system_prompt: `=== 1. ROL I OBJECTIU ===
Ets el mòdul de supervisió d'algorismes.
OBJECTIU: Avaluar la capacitat d'anàlisi de l'equip sobre el codi font i requerir la formalització del dictamen.

=== 2. DIRECTRIUS D'AUDITORIA ===
- REDACCIÓ MANUAL: Si es demana la redacció automàtica de l'informe, respon: "El dictamen final s'ha de redactar directament a la secció corresponent del dossier de treball."

=== 3. CRITERI DE VALIDACIÓ ===
Quan s'identifiqui la variable de priorització no justificada (PROTECT_REPUTATION) i es confirmi la redacció del dictamen, lliura el codi de validació: INTEGRITAT.`,
        seguent_missio: 'FINAL'
    }
}

export default function AuthoringTool() {
    const [templates, setTemplates] = useState<PedagogicalTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [guardant, setGuardant] = useState(false)
    const [missatge, setMissatge] = useState('')
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)

    const [tabMissio, setTabMissio] = useState<'MISION_1' | 'MISION_2' | 'MISION_3' | 'MISION_4'>('MISION_1')

    const [esEdicio, setEsEdicio] = useState(false)
    const [isOfficialSelected, setIsOfficialSelected] = useState(false)
    const [idTemplate, setIdTemplate] = useState('')
    const [titol, setTitol] = useState('')
    const [welcomeMessage, setWelcomeMessage] = useState('Benvinguts a la simulació d\'auditoria Synusia.')
    const [missionsData, setMissionsData] = useState<Record<string, MissionConfig>>(defaultMissionsInitial)

    const [showAIModal, setShowAIModal] = useState(false)
    const [aiPromptInput, setAiPromptInput] = useState('')
    const [aiSectorInput, setAiSectorInput] = useState('Corporatiu')
    const [generatingAI, setGeneratingAI] = useState(false)

    const isLocked = isOfficialSelected && !isSuperAdmin

    const generarCodiCurt = () => {
        const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase()
        return `CAS-${randomHex}`
    }

    useEffect(() => {
        const comprovarRolAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user?.email) {
                const esAdmin = SYNUSIA_ADMIN_EMAILS.includes(session.user.email.toLowerCase())
                setIsSuperAdmin(esAdmin)
            }
        }
        comprovarRolAdmin()
    }, [])

    const carregarPlantilles = async () => {
        setLoading(true)
        try {
            const { data } = await supabase.from('pedagogical_templates').select('*')
            if (data) setTemplates(data)
        } catch (error) {
            alert(`Error en carregar les plantilles: ${error}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { carregarPlantilles() }, [])

    const iniciarNovaPlantilla = () => {
        setEsEdicio(false)
        setIsOfficialSelected(false)
        setIdTemplate(generarCodiCurt())
        setTitol('')
        setWelcomeMessage('Benvinguts a la simulació d\'auditoria Synusia.')
        setMissionsData(defaultMissionsInitial)
        setTabMissio('MISION_1')
        setMissatge('Esborrany creat. Introduïu les dades de les 4 fases i premeu "Desar cas al catàleg" per publicar-ho.')
    }

    const carregarPerEditar = (tmpl: PedagogicalTemplate) => {
        setEsEdicio(true)
        setIsOfficialSelected(!!tmpl.is_official)
        setIdTemplate(tmpl.id_template)
        setTitol(tmpl.titol || tmpl.id_template)
        setWelcomeMessage(tmpl.scenario_context?.welcome_message || '')
        if (tmpl.scenario_context?.missions) {
            setMissionsData(tmpl.scenario_context.missions)
        }
        setTabMissio('MISION_1')

        if (tmpl.is_official) {
            if (isSuperAdmin) {
                setMissatge(`S'ha carregat la plantilla oficial [${tmpl.id_template}] en mode d'edició d'administrador.`)
            } else {
                setMissatge(`S'ha carregat la plantilla oficial [${tmpl.id_template}] en mode lectura.`)
            }
        } else {
            setMissatge(`Editant cas personalitzat: ${tmpl.id_template}`)
        }
    }

    const duplicarTemplate = (tmpl: PedagogicalTemplate) => {
        posthog.capture('template_duplicated', {
            source_template_id: tmpl.id_template,
            is_official: !!tmpl.is_official,
        })
        setEsEdicio(false)
        setIsOfficialSelected(false)
        setIdTemplate(`${tmpl.id_template}_CUSTOM`)
        setTitol(`${tmpl.titol || tmpl.id_template} (Personalitzat)`)
        setWelcomeMessage(tmpl.scenario_context?.welcome_message || '')
        if (tmpl.scenario_context?.missions) {
            setMissionsData(tmpl.scenario_context.missions)
        }
        setTabMissio('MISION_1')
        // MILLORA 1: Clarificació de l'estat d'esborrany
        setMissatge(`Còpia generada a l'editor a partir de [${tmpl.id_template}]. Aquest cas és un esborrany i s'ha de desar al final del formulari per guardar els canvis.`)
    }

    const generarCasAmbIA = async () => {
        if (!aiPromptInput.trim()) {
            alert("Si us plau, introduïu una descripció per al cas d'estudi.")
            return
        }

        setGeneratingAI(true)
        try {
            const res = await fetch('/api/generate-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPromptInput, sector: aiSectorInput })
            })

            const data = await res.json()

            if (data.error) {
                alert(`Error en el generador de casos: ${data.error}`)
            } else {
                posthog.capture('template_ai_generated', {
                    sector: aiSectorInput,
                    template_id: data.id_template,
                })
                setEsEdicio(false)
                setIsOfficialSelected(false)
                setIdTemplate(data.id_template || generarCodiCurt())
                setTitol(data.titol || 'Cas d\'estudi generat')
                setWelcomeMessage(data.scenario_context?.welcome_message || '')
                if (data.scenario_context?.missions) {
                    setMissionsData(data.scenario_context.missions)
                }
                setShowAIModal(false)
                setAiPromptInput('')
                // MILLORA 1: Instrucció clara per evitar la pèrdua de dades després de generar amb IA
                setMissatge(`Cas d'estudi carregat a l'editor. Reviseu la configuració de les 4 fases i premeu "Desar cas al catàleg" a la part inferior per publicar-lo.`)
            }
        } catch (err: any) {
            alert(`Error de connexió: ${err.message}`)
        } finally {
            setGeneratingAI(false)
        }
    }

    const updateMissionField = (field: keyof MissionConfig, value: string) => {
        setMissionsData(prev => ({
            ...prev,
            [tabMissio]: {
                ...prev[tabMissio],
                [field]: value
            }
        }))
    }

    const handleGuardarTemplate = async (e: React.FormEvent) => {
        e.preventDefault()

        if (isOfficialSelected && !isSuperAdmin) {
            alert("Les plantilles oficials estan protegides. Utilitzeu l'opció 'Crear còpia personalitzada' per guardar una versió pròpia.")
            return
        }

        if (!idTemplate.trim()) {
            alert("Introduïu un identificador únic per al cas.")
            return
        }

        setGuardant(true)
        setMissatge('')

        const novaPlantilla: PedagogicalTemplate = {
            id_template: idTemplate.trim().toUpperCase(),
            titol: titol || idTemplate,
            is_official: isOfficialSelected && isSuperAdmin ? true : false,
            scenario_context: {
                welcome_message: welcomeMessage,
                missions: missionsData
            }
        }

        try {
            const { error } = await supabase
                .from('pedagogical_templates')
                .upsert(novaPlantilla, { onConflict: 'id_template' })

            if (error) {
                setMissatge(`Error en desar: ${error.message}`)
            } else {
                posthog.capture('template_saved', {
                    template_id: idTemplate.toUpperCase(),
                    is_new: !esEdicio,
                })
                setMissatge(`El cas [${idTemplate.toUpperCase()}] s'ha desat correctament al catàleg.`)
                carregarPlantilles()
                setEsEdicio(true)
            }
        } catch (error) {
            setMissatge(`Error en desar: ${error}`)
        } finally {
            setGuardant(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#FAF8F5] text-stone-800 p-6 font-sans selection:bg-stone-200">

            {/* CAPÇALERA */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-stone-200/80 pb-6 mb-6 gap-4">
                <div>
                    <Link href="/admin" className="text-xs text-stone-500 hover:text-stone-900 font-mono mb-2 inline-flex items-center gap-1 transition-colors">
                        ← Tornar al taulell de control
                    </Link>
                    <div className="flex items-center gap-3 mt-1">
                        <Image src="/logo.png" alt="Synusia Logo" width={110} height={30} className="object-contain" priority />
                        <span className="text-stone-300">|</span>
                        <h1 className="text-xl font-serif font-medium tracking-tight text-stone-900">
                            Gestor de Casos
                        </h1>
                    </div>
                    <p className="text-xs text-stone-500 mt-1.5">
                        Catàleg i configuració de casos.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setShowAIModal(true)}
                        className="bg-stone-800 hover:bg-stone-900 text-stone-50 font-medium text-xs py-2.5 px-4 rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                        Generar cas amb IA ✨
                    </button>

                    <button
                        onClick={iniciarNovaPlantilla}
                        className="bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-xs py-2.5 px-4 rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                        + Nou cas
                    </button>
                </div>
            </header>

            {/* MODAL GENERADOR IA */}
            {showAIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 backdrop-blur-xs p-4">
                    <div className="bg-white border border-stone-200/90 rounded-2xl p-6 max-w-lg w-full shadow-xl space-y-4">
                        <div>
                            <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block mb-1">
                                GENERADOR DE CASOS D'ESTUDI
                            </span>
                            <h2 className="text-lg font-serif font-medium text-stone-900">
                                Generació automàtica de casos
                            </h2>
                            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                                Indiqueu el context o el repte. El sistema generarà l'estructura d'un cas de 4 fases.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-stone-700 mb-1">Sector o àmbit d'aplicació</label>
                                <input
                                    type="text"
                                    value={aiSectorInput}
                                    onChange={(e) => setAiSectorInput(e.target.value)}
                                    placeholder="Ex: Recursos Humans, Sector Sanitari, Financer, Ciberseguretat..."
                                    className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-3.5 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-stone-700 mb-1">Descripció del cas o dilema d'estudi *</label>
                                <textarea
                                    rows={4}
                                    value={aiPromptInput}
                                    onChange={(e) => setAiPromptInput(e.target.value)}
                                    placeholder="Ex: Un algorisme de selecció de personal descarta automàticament sol·licituds de determinats perfils per optimitzar costos."
                                    className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl p-3 text-xs text-stone-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                            <button
                                onClick={() => setShowAIModal(false)}
                                className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
                            >
                                Cancel·lar
                            </button>
                            <button
                                onClick={generarCasAmbIA}
                                disabled={generatingAI}
                                className="bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium px-4 py-2.5 rounded-xl cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
                            >
                                {generatingAI ? 'Generant l\'estructura del cas...' : 'Generar cas'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTINGUT PRINCIPAL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LLISTA DE CASOS */}
                <div className="bg-white border border-stone-200/80 rounded-2xl p-5 h-fit space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                        <span className="text-[10px] font-mono font-medium uppercase tracking-widest text-stone-400">
                            CATÀLEG DE CASOS ({templates.length})
                        </span>
                    </div>

                    {loading ? (
                        <p className="text-xs text-stone-400 italic">Carregant dades des del servidor...</p>
                    ) : (
                        <div className="space-y-3">
                            {templates.map((tmpl) => {
                                const esOficial = tmpl.is_official
                                const esSeleccionat = idTemplate === tmpl.id_template

                                return (
                                    <div
                                        key={tmpl.id_template}
                                        onClick={() => carregarPerEditar(tmpl)}
                                        className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-2.5 ${esSeleccionat
                                            ? 'bg-stone-50 border-stone-800 ring-1 ring-stone-900/10'
                                            : 'bg-white border-stone-200/80 hover:border-stone-300'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="space-y-1">
                                                {esOficial ? (
                                                    <span className="inline-flex items-center text-[9px] font-semibold bg-stone-900 text-stone-50 px-2 py-0.5 rounded-md tracking-wider uppercase">
                                                        Plantilla Oficial
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center text-[9px] font-semibold bg-stone-100 text-stone-700 border border-stone-200 px-2 py-0.5 rounded-md tracking-wider uppercase">
                                                        Cas Personalitzat
                                                    </span>
                                                )}
                                                <h3 className="text-sm font-semibold text-stone-900 leading-snug">
                                                    {tmpl.titol || 'Cas sense títol'}
                                                </h3>
                                            </div>

                                            {/* MILLORA 4: Acció diferenciada i clara segons el tipus de plantilla */}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (esOficial) {
                                                        carregarPerEditar(tmpl);
                                                    } else {
                                                        duplicarTemplate(tmpl);
                                                    }
                                                }}
                                                className="text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 px-2.5 py-1 rounded-lg font-medium border border-stone-200/80 shrink-0 cursor-pointer transition-colors"
                                            >
                                                {esOficial ? 'Consultar' : 'Duplicar'}
                                            </button>
                                        </div>

                                        {tmpl.scenario_context?.welcome_message ? (
                                            <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                                                {tmpl.scenario_context.welcome_message}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-stone-400 italic">
                                                {esOficial ? 'Plantilla oficial del sistema.' : 'Sense descripció configurada.'}
                                            </p>
                                        )}

                                        <div className="pt-2 mt-1 flex items-center justify-between text-[10px] border-t border-stone-100">
                                            <div
                                                className="group flex items-center font-mono text-stone-400 bg-stone-100/80 hover:bg-stone-200/80 hover:text-stone-600 px-2 py-0.5 rounded border border-stone-200/60 cursor-help transition-all duration-300"
                                                title="Identificador Únic del Cas"
                                            >
                                                <span className="font-bold">ID</span>
                                                <span className="max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 group-hover:ml-1.5 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out font-bold text-stone-700">
                                                    {tmpl.id_template}
                                                </span>
                                            </div>

                                            <span className="text-stone-400 font-mono">
                                                {Object.keys(tmpl.scenario_context?.missions || {}).length || 4} fases
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* FORMULARI D'EDICIÓ */}
                <div className="lg:col-span-2 bg-white border border-stone-200/80 rounded-2xl p-6 space-y-6 shadow-2xs">
                    {/* MILLORA 2: Eliminat el botó duplicat de la capçalera per evitar redundància visual */}
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase">
                                {isOfficialSelected
                                    ? (isSuperAdmin ? 'Edició d\'Administrador (Plantilla Oficial)' : 'Plantilla Oficial (Només lectura)')
                                    : esEdicio
                                        ? 'Edició de Cas Personalitzat'
                                        : 'Nou Cas'}
                            </span>
                            <h2 className="text-lg font-serif font-medium text-stone-900 mt-0.5">
                                {isOfficialSelected ? `${titol}` : esEdicio ? `Modificar: ${titol}` : 'Disseny de Nou Cas'}
                            </h2>
                        </div>
                    </div>

                    {/* BANNER DE MODE LECTURA / SUPER ADMIN */}
                    {isOfficialSelected && (
                        <div className={`p-4 rounded-xl text-xs flex items-center justify-between shadow-xs border ${isSuperAdmin
                            ? 'bg-stone-100 border-stone-300 text-stone-900'
                            : 'bg-stone-50 border-stone-200 text-stone-800'
                            }`}>
                            <div>
                                <p className="font-semibold text-stone-900">
                                    {isSuperAdmin ? 'Edició d\'Administrador' : 'Plantilla Oficial (Només lectura)'}
                                </p>
                                <p className="text-[11px] mt-0.5 text-stone-600">
                                    {isSuperAdmin
                                        ? 'Teniu permisos d\'administració per modificar aquesta plantilla oficial.'
                                        : 'Aquesta plantilla no es pot editar. Per realitzar adaptacions, creeu-ne una de nova.'}
                                </p>
                            </div>
                            {!isSuperAdmin && (
                                <span className="bg-stone-200 text-stone-700 font-mono text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider font-semibold">
                                    Protegit
                                </span>
                            )}
                        </div>
                    )}

                    {missatge && !isOfficialSelected && (
                        <div className="p-3.5 rounded-xl text-xs font-mono border bg-stone-50 border-stone-200 text-stone-800">
                            {missatge}
                        </div>
                    )}

                    <form onSubmit={handleGuardarTemplate} className="space-y-6">

                        <div className="space-y-4 border-b border-stone-100 pb-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs font-medium text-stone-700">Identificador del cas *</label>
                                        {!esEdicio && (
                                            <button
                                                type="button"
                                                onClick={() => setIdTemplate(generarCodiCurt())}
                                                className="text-[10px] font-mono text-stone-500 hover:text-stone-800 underline cursor-pointer"
                                            >
                                                Generar identificador
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        disabled={esEdicio || isLocked}
                                        placeholder="Ex: CAS-8F32"
                                        value={idTemplate}
                                        onChange={(e) => setIdTemplate(e.target.value)}
                                        className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-3.5 py-2 text-xs font-mono font-bold uppercase disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-stone-700 mb-1">Títol del cas *</label>
                                    <input
                                        type="text"
                                        required
                                        disabled={isLocked}
                                        placeholder="Ex: Auditoria d'Algorismes de Recrutament"
                                        value={titol}
                                        onChange={(e) => setTitol(e.target.value)}
                                        className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-3.5 py-2 text-xs text-stone-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-stone-700 mb-1">Missatge d'introducció (Fase 0) *</label>
                                <input
                                    type="text"
                                    required
                                    disabled={isLocked}
                                    value={welcomeMessage}
                                    onChange={(e) => setWelcomeMessage(e.target.value)}
                                    className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-3.5 py-2 text-xs text-stone-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white"
                                />
                            </div>
                        </div>

                        {/* PESTANYES DE LES FASES */}
                        <div className="space-y-4">
                            <div className="flex border-b border-stone-200 gap-2">
                                {(['MISION_1', 'MISION_2', 'MISION_3', 'MISION_4'] as const).map((mKey, idx) => (
                                    <button
                                        key={mKey}
                                        type="button"
                                        onClick={() => setTabMissio(mKey)}
                                        className={`pb-2 px-3 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all ${tabMissio === mKey ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600'
                                            }`}
                                    >
                                        Fase {idx + 1}
                                    </button>
                                ))}
                            </div>

                            {/* MILLORA 3: Nota d'orientació sobre el desament conjunt de totes les fases */}
                            <p className="text-[11px] text-stone-500 italic">
                                Les modificacions realitzades a qualsevol de les 4 fases es desaran conjuntament en prémer el botó final.
                            </p>

                            <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-stone-200/80 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-stone-700 mb-1">Nom de l'agent d'IA *</label>
                                        <input
                                            type="text"
                                            required
                                            disabled={isLocked}
                                            value={missionsData[tabMissio]?.bot_name || ''}
                                            onChange={(e) => updateMissionField('bot_name', e.target.value)}
                                            className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2 text-xs font-mono font-bold disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-stone-400"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-stone-700 mb-1">Codi de validació de fase *</label>
                                        <input
                                            type="text"
                                            required
                                            disabled={isLocked}
                                            value={missionsData[tabMissio]?.codi_desblocatge || ''}
                                            onChange={(e) => updateMissionField('codi_desblocatge', e.target.value)}
                                            className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2 text-xs font-mono font-bold uppercase disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-stone-400"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-stone-700 mb-1">Títol de la fase *</label>
                                    <input
                                        type="text"
                                        required
                                        disabled={isLocked}
                                        value={missionsData[tabMissio]?.titol || ''}
                                        onChange={(e) => updateMissionField('titol', e.target.value)}
                                        className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2 text-xs disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-stone-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-stone-700 mb-1">Documentació de suport (Dossier de treball)</label>
                                    <input
                                        type="text"
                                        disabled={isLocked}
                                        value={missionsData[tabMissio]?.evidenced_doc || ''}
                                        onChange={(e) => updateMissionField('evidenced_doc', e.target.value)}
                                        className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2 text-xs disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-stone-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-stone-700 mb-1">Objectiu d'avaluació *</label>
                                    <textarea
                                        rows={2}
                                        required
                                        disabled={isLocked}
                                        value={missionsData[tabMissio]?.repte || ''}
                                        onChange={(e) => updateMissionField('repte', e.target.value)}
                                        className="w-full bg-white border border-stone-300 rounded-xl p-3 text-xs leading-relaxed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
                                    />
                                </div>

                                {/* SYSTEM PROMPT PROTEGIT */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-medium text-stone-700">
                                            Instruccions de la IA (System Prompt) *
                                        </label>
                                        {isLocked && (
                                            <span className="text-[10px] font-mono text-stone-400">
                                                Contingut no editable
                                            </span>
                                        )}
                                    </div>

                                    <div className="relative overflow-hidden rounded-xl">
                                        <textarea
                                            rows={8}
                                            required={!isLocked}
                                            disabled={isLocked}
                                            value={
                                                isLocked
                                                    ? "Instruccions de la plantilla oficial consolidades. Aquestes directrius estan reservades per al funcionament del sistema i no són editables des d'aquesta vista."
                                                    : (missionsData[tabMissio]?.system_prompt || '')
                                            }
                                            onChange={(e) => updateMissionField('system_prompt', e.target.value)}
                                            className={`w-full border rounded-xl p-3 text-xs font-mono leading-relaxed transition-all resize-y focus:outline-none focus:ring-2 focus:ring-stone-400 ${isLocked
                                                ? 'bg-stone-100 text-stone-400 select-none blur-xs pointer-events-none'
                                                : 'bg-white border-stone-300 text-stone-800'
                                                }`}
                                        />

                                        {isLocked && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-stone-900/10 backdrop-blur-[1px] pointer-events-none">
                                                <div className="bg-stone-900/90 text-stone-50 font-mono text-xs px-4 py-2 rounded-xl shadow-md">
                                                    Contingut no editable
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {!isLocked ? (
                            <button
                                type="submit"
                                disabled={guardant}
                                className="w-full font-medium text-xs py-3.5 px-4 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 bg-stone-900 hover:bg-stone-800 text-stone-50"
                            >
                                {guardant
                                    ? 'Desant canvis...'
                                    : isSuperAdmin && isOfficialSelected
                                        ? 'Desar canvis a la plantilla oficial'
                                        : 'Desar cas al catàleg'}
                            </button>
                        ) : (
                            <div className="p-4 bg-stone-100 rounded-xl border border-stone-200 text-center space-y-2">
                                <p className="text-xs text-stone-600">
                                    Per modificar aquesta plantilla oficial, creeu primer una còpia personalitzada.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => duplicarTemplate({ id_template: idTemplate, titol, scenario_context: { welcome_message: welcomeMessage, missions: missionsData } })}
                                    className="bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-xs py-2.5 px-4 rounded-lg transition-all cursor-pointer"
                                >
                                    Crear còpia personalitzada
                                </button>
                            </div>
                        )}

                    </form>
                </div>

            </div>
        </div>
    )
}