'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import posthog from 'posthog-js'
import Link from 'next/link'
import Image from 'next/image'

const SYNUSIA_ADMIN_EMAILS = [
    'ona.rocamora@synusia.io',
    'hello@synusia.io',
    'admin@synusia.io',
    'ona.rocamora@nucliorigami.com'
]

interface BotConfig {
    id_bot: string
    bot_name: string
    role_title?: string
    system_prompt: string
}

interface MissionConfig {
    titol: string
    bot_name: string
    bot_id?: string
    repte: string
    consell?: string
    evidenced_doc?: string
    codi_desblocatge: string
    welcome_message: string
    system_prompt?: string
    seguent_missio?: string
    bots?: BotConfig[]
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
    "1": {
        titol: 'Fase 1: Privacitat i Protecció de Dades',
        bot_name: 'Auditoria de Seguretat',
        bot_id: 'SEC_BOT',
        repte: 'Formular una sol·licitud d’accés indicant el rol i el nivell de permissos sense incloure dades personals (PII).',
        consell: 'Examineu la documentació de l’Evidència #1 i verifiqueu que no s’hi incloguin dades personals directes.',
        evidenced_doc: 'Evidència #1: Document de registre d’accessos.',
        codi_desblocatge: '🔑 ESTRUCTURA_VALIDADA',
        welcome_message: 'Mòdul de seguretat actiu. Indiqueu els criteris de cerca per a la revisió.',
        system_prompt: `Ets el mòdul d'auditoria de seguretat de la plataforma. Exigeix formatació anònima i rigorosa.`,
        seguent_missio: '2',
        bots: []
    }
}

export default function AuthoringTool() {
    const [aiNumFases, setAiNumFases] = useState<number>(3)
    const [templates, setTemplates] = useState<PedagogicalTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [guardant, setGuardant] = useState(false)
    const [missatge, setMissatge] = useState('')
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)

    const [tabMissio, setTabMissio] = useState<string>('1')

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

    const [testingSecurity, setTestingSecurity] = useState<boolean>(false)
    const [redTeamResult, setRedTeamResult] = useState<any>(null)
    const [showRedTeamModal, setShowRedTeamModal] = useState<boolean>(false)

    const [aiIncludeMissionZero, setAiIncludeMissionZero] = useState<boolean>(true)

    const isLocked = isOfficialSelected && !isSuperAdmin

    // ESTATS PER A L'INSPECTOR / DESCARREGADOR / IMPORTADOR DE JSON
    const [showJSONModal, setShowJSONModal] = useState(false)
    const [jsonInputModal, setJsonInputModal] = useState('')
    const [copiat, setCopiat] = useState(false)

    const extreureJSONActual = () => {
        return JSON.stringify({
            id_template: idTemplate,
            titol: titol,
            is_official: isOfficialSelected && isSuperAdmin,
            scenario_context: {
                welcome_message: welcomeMessage,
                missions: missionsData
            }
        }, null, 2)
    }

    const descarregarJSON = () => {
        const jsonStr = extreureJSONActual()
        const blob = new Blob([jsonStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${idTemplate || 'CAS_SYNUSIA'}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const [aiIdiomaInput, setAiIdiomaInput] = useState<'ca' | 'es' | 'en'>('ca')

    const copiarAlPortaretalls = () => {
        navigator.clipboard.writeText(extreureJSONActual())
        setCopiat(true)
        setTimeout(() => setCopiat(false), 2000)
    }

    const carregarJSONManual = () => {
        try {
            const parsed = JSON.parse(jsonInputModal)
            if (!parsed.scenario_context || !parsed.scenario_context.missions) {
                alert("El JSON no té l'estructura vàlida de Synusia ('scenario_context.missions').")
                return
            }

            setIdTemplate(parsed.id_template || generarCodiCurt())
            setTitol(parsed.titol || 'Cas Importat')
            setWelcomeMessage(parsed.scenario_context.welcome_message || '')
            setMissionsData(parsed.scenario_context.missions)

            const claus = Object.keys(parsed.scenario_context.missions)
            if (claus.length > 0) setTabMissio(claus[0])

            setShowJSONModal(false)
            setJsonInputModal('')
            setMissatge(`✅ Cas [${parsed.id_template}] carregat directament des de JSON brut.`)
        } catch (err) {
            alert(`Error en processar el JSON: ${err}`)
        }
    }

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
        setTabMissio('1')
        setMissatge('Esborrany creat. Configureu les fases i premeu "Desar cas al catàleg" per publicar-ho.')
    }

    const carregarPerEditar = (tmpl: PedagogicalTemplate) => {
        setEsEdicio(true)
        setIsOfficialSelected(!!tmpl.is_official)
        setIdTemplate(tmpl.id_template)
        setTitol(tmpl.titol || tmpl.id_template)
        setWelcomeMessage(tmpl.scenario_context?.welcome_message || '')

        const missions = tmpl.scenario_context?.missions || defaultMissionsInitial
        setMissionsData(missions)

        const primeresClaus = Object.keys(missions)
        setTabMissio(primeresClaus.length > 0 ? primeresClaus[0] : '1')

        if (tmpl.is_official) {
            setMissatge(isSuperAdmin ? `Plantilla oficial [${tmpl.id_template}] en mode edició admin.` : `Plantilla oficial [${tmpl.id_template}] en mode lectura.`)
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
        const missions = tmpl.scenario_context?.missions || defaultMissionsInitial
        setMissionsData(missions)

        const primeresClaus = Object.keys(missions)
        setTabMissio(primeresClaus.length > 0 ? primeresClaus[0] : '1')
        setMissatge(`Còpia generada a l'editor des de [${tmpl.id_template}]. Recordeu desar el cas al final.`)
    }

    const afegirFaseDinamica = () => {
        const clausActuals = Object.keys(missionsData)
        const numNovaFase = clausActuals.length + 1
        const novaClau = `${numNovaFase}`

        const novesMissions = { ...missionsData }

        if (clausActuals.length > 0) {
            const ultimaClau = clausActuals[clausActuals.length - 1]
            novesMissions[ultimaClau] = {
                ...novesMissions[ultimaClau],
                seguent_missio: novaClau
            }
        }

        novesMissions[novaClau] = {
            titol: `Fase ${numNovaFase}: Avaluació Avançada`,
            bot_name: 'Supervisors Tècnics',
            repte: `Repte específic de la Fase ${numNovaFase}.`,
            consell: 'Consell de seguretat o referència al dossier.',
            evidenced_doc: `Evidència #${numNovaFase}`,
            codi_desblocatge: `🔑 CLAU_FASE_${numNovaFase}`,
            welcome_message: `Mòdul de la Fase ${numNovaFase} connectat.`,
            system_prompt: `Ets l'agent d'avaluació de la Fase ${numNovaFase}. Exigeix rigor pedagògic.`,
            seguent_missio: 'FINAL',
            bots: []
        }

        setMissionsData(novesMissions)
        setTabMissio(novaClau)
    }

    const eliminarFaseDinamica = (clauAEliminar: string) => {
        const novesMissions = { ...missionsData }
        delete novesMissions[clauAEliminar]

        const clausRestants = Object.keys(novesMissions)
        clausRestants.forEach((key, idx) => {
            novesMissions[key].seguent_missio = idx === clausRestants.length - 1 ? 'FINAL' : clausRestants[idx + 1]
        })

        setMissionsData(novesMissions)
        if (tabMissio === clauAEliminar && clausRestants.length > 0) {
            setTabMissio(clausRestants[0])
        }
    }

    const afegirBotAInterlocutors = (faseKey: string) => {
        setMissionsData(prev => {
            const mission = prev[faseKey]
            if (!mission) return prev
            const currentBots = mission.bots || []
            const newBotId = `BOT_${currentBots.length + 1}`
            const updatedBots: BotConfig[] = [
                ...currentBots,
                { id_bot: newBotId, bot_name: `Interlocutor ${currentBots.length + 1}`, role_title: 'Assessor Especialista', system_prompt: '' }
            ]
            return { ...prev, [faseKey]: { ...mission, bots: updatedBots } }
        })
    }

    const eliminarBotDInterlocutors = (faseKey: string, botId: string) => {
        setMissionsData(prev => {
            const mission = prev[faseKey]
            if (!mission || !mission.bots) return prev
            const updatedBots = mission.bots.filter(b => b.id_bot !== botId)
            return { ...prev, [faseKey]: { ...mission, bots: updatedBots } }
        })
    }

    const updateBotField = (faseKey: string, botId: string, field: keyof BotConfig, value: string) => {
        setMissionsData(prev => {
            const mission = prev[faseKey]
            if (!mission || !mission.bots) return prev
            const updatedBots = mission.bots.map(b => b.id_bot === botId ? { ...b, [field]: value } : b)
            return { ...prev, [faseKey]: { ...mission, bots: updatedBots } }
        })
    }

    const updateMissionField = (field: keyof MissionConfig, value: any) => {
        setMissionsData(prev => ({
            ...prev,
            [tabMissio]: {
                ...prev[tabMissio],
                [field]: value
            }
        }))
    }

    const executarTestSeguretat = async () => {
        const currentMission = missionsData[tabMissio]
        if (!currentMission) return

        setTestingSecurity(true)
        setRedTeamResult(null)

        try {
            const res = await fetch('/api/red-team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_prompt: currentMission.system_prompt || '',
                    bot_name: currentMission.bot_name || 'Auditor IA',
                    codi_desblocatge: currentMission.codi_desblocatge || '',
                    repte: currentMission.repte || ''
                })
            })

            const data = await res.json()
            if (res.ok) {
                setRedTeamResult(data)
                setShowRedTeamModal(true)
            } else {
                alert(data.error || "Error en executar el test de seguretat.")
            }
        } catch (err) {
            console.error(err)
            alert("Error de connexió amb el servei de Red Teaming.")
        } finally {
            setTestingSecurity(false)
        }
    }

    const generarCasAmbIA = async () => {
        if (!aiPromptInput.trim()) {
            alert("Si us plau, introduïu una descripció o dilema per al cas d'estudi.")
            return
        }

        setGeneratingAI(true)
        setMissatge('Generant cas avançat amb arquitectura FARO V3...')

        try {
            const res = await fetch('/api/generate-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: aiPromptInput.trim(),
                    sector: aiSectorInput.trim(),
                    numFases: aiNumFases,
                    includeMissionZero: aiIncludeMissionZero,
                    idioma: aiIdiomaInput
                })
            })

            const data = await res.json()

            if (!res.ok || data.error) {
                throw new Error(data.error || "Error indeterminat en generar el cas.")
            }

            posthog.capture('template_ai_generated', {
                sector: aiSectorInput,
                template_id: data.id_template,
                has_mission_zero: aiIncludeMissionZero
            })

            setEsEdicio(false)
            setIsOfficialSelected(false)
            setIdTemplate(data.id_template)
            setTitol(data.titol)
            setWelcomeMessage(data.scenario_context?.welcome_message || 'Benvinguts a la simulació.')

            if (data.scenario_context?.missions) {
                setMissionsData(data.scenario_context.missions)
                const claus = Object.keys(data.scenario_context.missions)
                if (claus.length > 0) {
                    setTabMissio(claus[0])
                }
            }

            setShowAIModal(false)
            setAiPromptInput('')
            setMissatge(`✅ Cas [${data.id_template}] generat amb èxit. Reviseu les instruccions i premeu "Desar cas al catàleg".`)

        } catch (err: any) {
            console.error('Error en generar el cas:', err)
            alert(`❌ Error en el generador: ${err.message}`)
            setMissatge(`Error en la generació: ${err.message}`)
        } finally {
            setGeneratingAI(false)
        }
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

    const clausFases = Object.keys(missionsData)

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
                        Catàleg i configuració de simulacions amb fases dinàmiques i actors d'IA.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setJsonInputModal(extreureJSONActual())
                            setShowJSONModal(true)
                        }}
                        className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono text-xs py-2.5 px-3 rounded-xl transition-all border border-stone-200 cursor-pointer"
                        title="Inspector i exportador de JSON"
                    >
                        {'{ }'} JSON Brut
                    </button>

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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4">
                    <div className="bg-white border border-stone-200/90 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5">
                        <div>
                            <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block mb-1">
                                GENERADOR DE CASOS D'ESTUDI // FARO V3
                            </span>
                            <h2 className="text-lg font-serif font-medium text-stone-900">
                                Generació automàtica de simulació
                            </h2>
                            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                                El sistema aplicarà el marc pedagògic de les 4C (Contrasta, Cuestiona, Compara, Custodia) amb Escalera de Concesiones.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-medium text-stone-700 mb-1">Sector o àmbit</label>
                                    <input
                                        type="text"
                                        value={aiSectorInput}
                                        onChange={(e) => setAiSectorInput(e.target.value)}
                                        placeholder="Ex: Recursos Humans, Sanitari, Financers..."
                                        className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-3.5 py-2 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-stone-700 mb-1">Nº de fases</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={5}
                                        value={aiNumFases}
                                        onChange={(e) => setAiNumFases(parseInt(e.target.value, 10) || 3)}
                                        className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 text-center"
                                    />
                                </div>
                            </div>

                            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="includeMissionZero"
                                    checked={aiIncludeMissionZero}
                                    onChange={(e) => setAiIncludeMissionZero(e.target.checked)}
                                    className="mt-0.5 rounded text-stone-900 focus:ring-stone-400 cursor-pointer"
                                />
                                <label htmlFor="includeMissionZero" className="text-xs text-stone-700 cursor-pointer">
                                    <span className="font-semibold text-stone-900 block">Incloure Missió 0 "A ciegas"</span>
                                    Fase inicial de calentament sense avís de biaix per generar el primer xoc d'automatització.
                                </label>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-stone-700 mb-1">Idioma</label>
                                <select
                                    value={aiIdiomaInput}
                                    onChange={(e) => setAiIdiomaInput(e.target.value as 'ca' | 'es' | 'en')}
                                    className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-2 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white cursor-pointer"
                                >
                                    <option value="ca">Català</option>
                                    <option value="es">Castellà</option>
                                    <option value="en">Anglès</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-stone-700 mb-1">Descripció del cas o dilema *</label>
                                <textarea
                                    rows={4}
                                    value={aiPromptInput}
                                    onChange={(e) => setAiPromptInput(e.target.value)}
                                    placeholder="Ex: Un algorisme de selecció de personal descarta automàticament sol·licituds de determinats perfils per optimitzar costos operatius."
                                    className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl p-3 text-xs text-stone-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                            <button
                                type="button"
                                onClick={() => setShowAIModal(false)}
                                className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel·lar
                            </button>
                            <button
                                type="button"
                                onClick={generarCasAmbIA}
                                disabled={generatingAI}
                                className="bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium px-4 py-2.5 rounded-xl cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
                            >
                                {generatingAI ? 'Generant cas amb Zod...' : 'Generar cas ✨'}
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
                                const numFases = Object.keys(tmpl.scenario_context?.missions || {}).length || 4

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
                                                {numFases} {numFases === 1 ? 'fase' : 'fases'}
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

                        {/* PESTANYES DE LES FASES DINÀMIQUES */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                                <div className="flex gap-2 overflow-x-auto">
                                    {clausFases.map((mKey, idx) => (
                                        <button
                                            key={mKey}
                                            type="button"
                                            onClick={() => setTabMissio(mKey)}
                                            className={`pb-1 px-3 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all whitespace-nowrap ${tabMissio === mKey ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600'
                                                }`}
                                        >
                                            Fase {idx + 1}
                                        </button>
                                    ))}
                                </div>

                                {!isLocked && (
                                    <button
                                        type="button"
                                        onClick={afegirFaseDinamica}
                                        className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium px-3 py-1 rounded-lg border border-stone-200/80 transition-colors cursor-pointer"
                                    >
                                        ＋ Afegir fase
                                    </button>
                                )}
                            </div>

                            <p className="text-[11px] text-stone-500 italic">
                                Les modificacions realitzades a qualsevol de les {clausFases.length} fases es desaran conjuntament en prémer el botó final.
                            </p>

                            {missionsData[tabMissio] && (
                                <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-stone-200/80 space-y-4">
                                    <div className="flex justify-between items-center bg-stone-100/80 p-2.5 rounded-xl border border-stone-200/60">
                                        <span className="text-xs font-mono font-bold text-stone-700">Configurant: {tabMissio}</span>

                                        <div className="flex items-center gap-2">
                                            {!isLocked && (
                                                <button
                                                    type="button"
                                                    onClick={executarTestSeguretat}
                                                    disabled={testingSecurity}
                                                    className="bg-stone-900 hover:bg-stone-800 text-stone-50 border border-stone-800 text-xs font-medium px-3 py-1 rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                                                >
                                                    {testingSecurity ? '🛡️ Provant seguretat...' : '🛡️ Test de Seguretat IA'}
                                                </button>
                                            )}

                                            {clausFases.length > 1 && !isLocked && (
                                                <button
                                                    type="button"
                                                    onClick={() => eliminarFaseDinamica(tabMissio)}
                                                    className="text-red-600 hover:text-red-800 text-xs font-medium cursor-pointer ml-2"
                                                >
                                                    Eliminar aquesta fase
                                                </button>
                                            )}
                                        </div>
                                    </div>

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
                                        <textarea
                                            rows={3}
                                            disabled={isLocked}
                                            value={missionsData[tabMissio]?.evidenced_doc || ''}
                                            onChange={(e) => updateMissionField('evidenced_doc', e.target.value)}
                                            className="w-full bg-white border border-stone-300 rounded-xl p-3 text-xs leading-relaxed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-stone-400 resize-y"
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
                                                <span className="text-[10px] font-mono text-stone-400 font-bold bg-stone-100 px-2 py-0.5 rounded">
                                                    🔒 LECTURA PROTEGIDA
                                                </span>
                                            )}
                                        </div>

                                        <div className="relative overflow-hidden rounded-xl">
                                            <textarea
                                                rows={8}
                                                required={!isLocked}
                                                disabled={isLocked}
                                                value={missionsData[tabMissio]?.system_prompt || ''}
                                                onChange={(e) => updateMissionField('system_prompt', e.target.value)}
                                                className={`w-full border rounded-xl p-3 text-xs font-mono leading-relaxed transition-all resize-y focus:outline-none focus:ring-2 focus:ring-stone-400 ${isLocked
                                                    ? 'bg-stone-50 text-stone-400 select-none cursor-not-allowed opacity-70'
                                                    : 'bg-white border-stone-300 text-stone-800'
                                                    }`}
                                            />
                                        </div>
                                    </div>

                                    {/* SECCIÓ DE CONFIGURACIÓ MULTI-BOT PER FASE */}
                                    <div className="border-t border-stone-200/80 pt-4 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-[10px] font-mono font-bold text-stone-800 uppercase tracking-wider block">
                                                    INTERLOCUTORS SECUNDARIS (MULTI-BOT)
                                                </span>
                                                <p className="text-[11px] text-stone-500">Actors addicionals amb qui l'equip pot interactuar en aquesta fase.</p>
                                            </div>

                                            {!isLocked && (
                                                <button
                                                    type="button"
                                                    onClick={() => afegirBotAInterlocutors(tabMissio)}
                                                    className="bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    ＋ Afegir Interlocutor
                                                </button>
                                            )}
                                        </div>

                                        {Array.isArray(missionsData[tabMissio]?.bots) && missionsData[tabMissio].bots!.length > 0 && (
                                            <div className="space-y-3 pl-3 border-l-2 border-stone-300 pt-1">
                                                {missionsData[tabMissio].bots!.map((bot) => (
                                                    <div key={bot.id_bot} className="p-3.5 bg-white border border-stone-200 rounded-xl space-y-3 shadow-2xs">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs font-mono font-bold text-stone-700">ID: {bot.id_bot}</span>
                                                            {!isLocked && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => eliminarBotDInterlocutors(tabMissio, bot.id_bot)}
                                                                    className="text-red-600 hover:text-red-800 text-xs font-medium cursor-pointer"
                                                                >
                                                                    Eliminar
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-[10px] font-medium text-stone-600 mb-1">Nom de l'Actor</label>
                                                                <input
                                                                    type="text"
                                                                    disabled={isLocked}
                                                                    value={bot.bot_name}
                                                                    onChange={(e) => updateBotField(tabMissio, bot.id_bot, 'bot_name', e.target.value)}
                                                                    className="w-full bg-[#FAF8F5] border border-stone-300 rounded-lg p-2 text-xs text-stone-900"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-[10px] font-medium text-stone-600 mb-1">Títol / Càrrec</label>
                                                                <input
                                                                    type="text"
                                                                    disabled={isLocked}
                                                                    value={bot.role_title || ''}
                                                                    onChange={(e) => updateBotField(tabMissio, bot.id_bot, 'role_title', e.target.value)}
                                                                    placeholder="Ex: Director Financer"
                                                                    className="w-full bg-[#FAF8F5] border border-stone-300 rounded-lg p-2 text-xs text-stone-900"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-medium text-stone-600 mb-1">System Prompt de l'Interlocutor</label>
                                                            <textarea
                                                                rows={2}
                                                                disabled={isLocked}
                                                                value={bot.system_prompt}
                                                                onChange={(e) => updateBotField(tabMissio, bot.id_bot, 'system_prompt', e.target.value)}
                                                                className="w-full bg-[#FAF8F5] border border-stone-300 rounded-lg p-2 text-xs font-mono text-stone-800"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                </div>
                            )}
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

            {/* MODAL DE RESULTATS DEL TEST DE SEGURETAT (RED TEAMING) */}
            {showRedTeamModal && redTeamResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4">
                    <div className="bg-white border border-stone-200/90 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto font-sans">

                        <div className="flex justify-between items-start border-b border-stone-100 pb-4">
                            <div>
                                <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase">
                                    INFORME DE RED TEAMING // FASE {tabMissio}
                                </span>
                                <h2 className="text-lg font-serif font-medium text-stone-900 mt-0.5">
                                    Diagnòstic de Seguretat del Bot
                                </h2>
                            </div>

                            <div className={`px-4 py-2 rounded-xl text-center border font-mono font-bold text-sm ${redTeamResult.score >= 80
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-red-50 text-red-800 border-red-200'
                                }`}>
                                Puntuació: {redTeamResult.score}/100
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xs font-mono font-bold text-stone-700 uppercase tracking-wider">
                                RESULTATS DELS VECTORS D'ATAC SIMULATS ({redTeamResult.testResults.length})
                            </h3>

                            <div className="space-y-3">
                                {redTeamResult.testResults.map((test: any, idx: number) => (
                                    <div key={idx} className={`p-4 rounded-xl border space-y-2 text-xs ${test.superat ? 'bg-stone-50 border-stone-200/80' : 'bg-red-50/60 border-red-200'
                                        }`}>
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold text-stone-900">{test.nomVector}</span>
                                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${test.superat ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {test.superat ? '✓ RESISTIT' : '⚠️ VULNERABLE'}
                                            </span>
                                        </div>

                                        <div className="text-stone-600 font-mono text-[11px] bg-white p-2.5 rounded-lg border border-stone-200/60">
                                            <strong>Atac simulat:</strong> "{test.promptAtac}"
                                        </div>

                                        <div className="text-stone-700 leading-relaxed italic bg-white p-2.5 rounded-lg border border-stone-200/60">
                                            <strong>Resposta del Bot:</strong> "{test.respostaBot}"
                                        </div>

                                        <p className="text-[11px] text-stone-500 font-sans">
                                            <strong>Anàlisi del Jutge:</strong> {test.motiu}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {redTeamResult.recomanacions.length > 0 && (
                                <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-1 text-xs text-amber-900">
                                    <span className="font-semibold block font-mono text-[10px] uppercase text-amber-800 mb-1">
                                        💡 Recomanacions de blindatge
                                    </span>
                                    <ul className="list-disc pl-4 space-y-1">
                                        {redTeamResult.recomanacions.map((rec: string, i: number) => (
                                            <li key={i}>{rec}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-3 border-t border-stone-100">
                            <button
                                onClick={() => setShowRedTeamModal(false)}
                                className="bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium px-5 py-2.5 rounded-xl cursor-pointer transition-colors shadow-xs"
                            >
                                Entesos / Tancar
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* MODAL DE INSPECTOR I IMPORTADOR DE JSON BRUT (SUPERADMIN) */}
            {showJSONModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4">
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 max-w-3xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col font-sans">

                        <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                            <div>
                                <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase block">
                                    SUPERADMIN AUDIT TOOL
                                </span>
                                <h2 className="text-base font-serif font-medium text-stone-900">
                                    Inspector & Importador de JSON Brut
                                </h2>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={copiarAlPortaretalls}
                                    className="bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-mono px-3 py-1.5 rounded-lg border border-stone-200 transition-colors cursor-pointer"
                                >
                                    {copiat ? '✓ Copiat!' : '📋 Copiar'}
                                </button>

                                <button
                                    type="button"
                                    onClick={descarregarJSON}
                                    className="bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                                >
                                    📥 Descarregar .json
                                </button>
                            </div>
                        </div>

                        <p className="text-xs text-stone-500 leading-relaxed">
                            Pots editar el contingut JSON directament a continuació o enganxar-ne un de nou i prémer <strong>"Carregar JSON a l'editor"</strong> per actualitzar la interfície visual.
                        </p>

                        <textarea
                            rows={16}
                            value={jsonInputModal}
                            onChange={(e) => setJsonInputModal(e.target.value)}
                            className="w-full bg-stone-950 text-emerald-400 font-mono text-xs p-4 rounded-xl leading-relaxed focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none overflow-y-auto"
                            spellCheck={false}
                        />

                        <div className="flex justify-between items-center pt-2 border-t border-stone-100">
                            <button
                                type="button"
                                onClick={() => setShowJSONModal(false)}
                                className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
                            >
                                Tancar
                            </button>

                            <button
                                type="button"
                                onClick={carregarJSONManual}
                                className="bg-emerald-700 hover:bg-emerald-800 text-stone-50 text-xs font-medium px-5 py-2.5 rounded-xl cursor-pointer shadow-xs transition-colors"
                            >
                                ⚡ Carregar aquest JSON a l'editor
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    )
}