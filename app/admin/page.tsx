"use client"

import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import posthog from 'posthog-js'
import Link from 'next/link'
import Image from 'next/image'

// ---------------------------------------------------------------------------
// TYPES & INTERFACES
// ---------------------------------------------------------------------------
interface TeamData {
  id_equip: string
  id_client: string
  noms_equip: string
  missio_actual: string
  credits: number
  informe_final: string | null
  hora_inici: string
  reflexio_individual?: string
}

interface TemplateOption {
  id_template: string
  titol?: string
  is_official?: boolean
}

interface SessionData {
  id_sessio: string
  pin_acces: string
  id_template: string
  estat: 'EN_CURS' | 'ACTIVA' | 'FINALITZADA'
  creat_el?: string
  created_at?: string
  nom_grup?: string
}

const mapMissions: Record<string, number> = {
  'MISION_1': 25,
  'MISION_2': 50,
  'MISION_3': 75,
  'MISION_4': 100,
  'FINAL': 100
}

export default function AdminDashboard() {
  // ---------------------------------------------------------------------------
  // ESTATS D'AUTENTICACIÓ (PROTECCIÓ FACILITADOR)
  // ---------------------------------------------------------------------------
  const [authChecking, setAuthChecking] = useState<boolean>(true)
  const [session, setSession] = useState<any>(null)
  const identifiedUserId = useRef<string | null>(null)
  const [loginEmail, setLoginEmail] = useState<string>('')
  const [loginPassword, setLoginPassword] = useState<string>('')
  const [loginLoading, setLoginLoading] = useState<boolean>(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // ESTATS DEL TAULELL I SESSIONS
  // ---------------------------------------------------------------------------
  const [totesLesSessions, setTotesLesSessions] = useState<SessionData[]>([])
  const [pinSessio, setPinSessio] = useState<string>('')
  const [idSessio, setIdSessio] = useState<string | null>(null)
  const [templateSessioActiva, setTemplateSessioActiva] = useState<string>('')
  const [equips, setEquips] = useState<TeamData[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [equipSeleccionat, setEquipSeleccionat] = useState<TeamData | null>(null)

  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templateSeleccionada, setTemplateSeleccionada] = useState<string>('')
  const [mostrarModalLlançament, setMostrarModalLlançament] = useState<boolean>(false)
  const [nomGrupInput, setNomGrupInput] = useState<string>('')

  const [idClientActual, setIdClientActual] = useState<string>('')
  const [projectingPin, setProjectingPin] = useState<string | null>(null)

  // Sync PostHog amb la sessió
  useEffect(() => {
    const syncUserSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        posthog.identify(session.user.id, {
          email: session.user.email,
          role: 'facilitator'
        })
      }
    }
    syncUserSession()
  }, [])

  // Verificació inicial de sessió a Supabase
  useEffect(() => {
    const identifySession = (activeSession: Session) => {
      const userId = activeSession.user.id
      if (!userId || identifiedUserId.current === userId) return

      if (identifiedUserId.current) {
        posthog.reset()
      }

      if (activeSession.user.email) {
        posthog.identify(userId, { email: activeSession.user.email })
      } else {
        posthog.identify(userId)
      }

      identifiedUserId.current = userId
    }

    const checkSession = async () => {
      try {
        const { data: { session: activeSession } } = await supabase.auth.getSession()
        setSession(activeSession)
        if (activeSession) {
          identifySession(activeSession)
        }
      } catch (err) {
        console.error('Error comprovant la sessió:', err)
      } finally {
        setAuthChecking(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession)
      setAuthChecking(false)

      if (event === 'SIGNED_OUT') {
        posthog.reset()
        identifiedUserId.current = null
      } else if (event === 'SIGNED_IN' && currentSession) {
        identifySession(currentSession)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Carregar dades quan el facilitador està autenticat
  useEffect(() => {
    if (session?.user?.id) {
      carregarPlantillesIClient()
      carregarTotesLesSessions(session.user.id)
    }
  }, [session])

  // Login / Logout
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })

      if (error) {
        setLoginError('Accés denegat. Credencials de facilitador incorrectes.')
      } else {
        posthog.capture('facilitator_logged_in')
        setSession(data.session)
      }
    } catch (err) {
      setLoginError('Error de connexió amb el servidor d’autenticació.')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setEquips([])
    setIdSessio(null)
    setTotesLesSessions([])
  }

  const generarPinUnic = () => {
    const caracters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let resultat = ''
    for (let i = 0; i < 4; i++) {
      resultat += caracters.charAt(Math.floor(Math.random() * caracters.length))
    }
    return resultat
  }

  const carregarPlantillesIClient = async () => {
    try {
      const { data: clients } = await supabase
        .from('clients')
        .select('id_client')
        .limit(1)

      if (clients && clients.length > 0) {
        setIdClientActual(clients[0].id_client)
      }

      const { data: dataTemplates } = await supabase
        .from('pedagogical_templates')
        .select('id_template, titol, is_official')

      if (dataTemplates && dataTemplates.length > 0) {
        setTemplates(dataTemplates)
        setTemplateSeleccionada(dataTemplates[0].id_template)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const carregarTotesLesSessions = async (userIdParam?: string) => {
    const activeUserId = userIdParam || session?.user?.id
    if (!activeUserId) return

    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', activeUserId)
        .order('id_sessio', { ascending: false })

      if (!error && data) {
        setTotesLesSessions(data)
      }
    } catch (err) {
      console.error('Error carregant llista de sessions:', err)
    }
  }

  const obrirModalLlançament = () => {
    carregarPlantillesIClient()
    setMostrarModalLlançament(true)
  }

  const arrancarNouTallerMonetitzat = async () => {
    if (!templateSeleccionada) {
      alert("⚠️ Seleccioneu una plantilla o cas abans de continuar!")
      return
    }

    if (!session?.user?.id) {
      alert("🚨 Error d'autenticació. Inicieu sessió de nou.")
      return
    }

    let clientId = idClientActual.trim()

    if (!clientId) {
      try {
        const { data: nouClient, error: errClient } = await supabase
          .from('clients')
          .insert([{ nom: 'UNIVERSITAT DEMO', tipus_client: 'ACADEMIC', sector: 'EDUCACIO', credits_disponibles: 10 }])
          .select('id_client')
          .single()

        if (errClient || !nouClient) {
          alert("🚨 Error en inicialitzar el client per defecte.")
          return
        }
        clientId = nouClient.id_client
        setIdClientActual(clientId)
      } catch (err) {
        console.error(err)
        return
      }
    }

    setLoading(true)

    try {
      const { data: clients, error: errorClient } = await supabase
        .from('clients')
        .select('credits_disponibles')
        .eq('id_client', clientId)

      if (errorClient || !clients || clients.length === 0) {
        alert(`🚨 CLIENT NO TROBAT: La ID de client [${clientId}] no existeix.`)
        setLoading(false)
        return
      }

      const saldoActual = clients[0].credits_disponibles ?? 0

      if (saldoActual <= 0) {
        alert("🚨 SALDO INSUFICIENT: Teniu 0 crèdits disponibles.")
        setLoading(false)
        return
      }

      const { error: errorResta } = await supabase
        .from('clients')
        .update({ credits_disponibles: saldoActual - 1 })
        .eq('id_client', clientId)

      if (errorResta) {
        alert(`No s'ha pogut processar el cobrament: ${errorResta.message}`)
        setLoading(false)
        return
      }

      const nouPin = generarPinUnic()

      const { data: novaSessio, error: errorSessio } = await supabase
        .from('sessions')
        .insert([{
          pin_acces: nouPin,
          estat: 'EN_CURS',
          id_client: clientId,
          id_template: templateSeleccionada,
          user_id: session.user.id
        }])
        .select()
        .single()

      if (errorSessio || !novaSessio) {
        alert(`Error al registrar la sessió: ${errorSessio?.message}`)
        setLoading(false)
        return
      }

      posthog.capture('session_created', {
        template_id: templateSeleccionada,
        credits_remaining: saldoActual - 1,
      })

      setPinSessio(nouPin)
      setMostrarModalLlançament(false)
      setNomGrupInput('')
      await carregarTotesLesSessions(session.user.id)
      await carregarDadesSessio(nouPin)

      alert(`🎉 Taller llançat amb èxit!\n📂 Cas actiu: [${templateSeleccionada}]\n💸 Crèdit consumit (Saldo restant: ${saldoActual - 1}).\n🎯 PIN de sala per a l'aula: ${nouPin}`)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const carregarDadesSessio = async (pinTarget: string, isSilent = false) => {
    if (!pinTarget.trim()) return
    if (!isSilent) setLoading(true)
    try {
      const { data: sessio, error: errorSessio } = await supabase
        .from('sessions')
        .select('id_sessio, id_client, id_template')
        .eq('pin_acces', pinTarget.trim().toUpperCase())
        .single()

      if (errorSessio || !sessio) {
        if (!isSilent) alert("⚠️ No s'ha trobat cap sessió amb aquest PIN.")
        return
      }

      setIdSessio(sessio.id_sessio)
      setTemplateSessioActiva(sessio.id_template || '')
      setPinSessio(pinTarget.trim().toUpperCase())

      if (!isSilent) {
        posthog.capture('session_loaded', { team_count: 0 })
      }

      const { data: equipsData, error: errorEquips } = await supabase
        .from('equips')
        .select(`
          id_equip,
          id_sessio,
          nom_equip,
          missio_actual,
          dossier_actiu,
          creat_el,
          sessions (
            id_client,
            clients (
              credits_disponibles
            )
          )
        `)
        .eq('id_sessio', sessio.id_sessio)

      if (!errorEquips && equipsData) {
        const formattedTeams: TeamData[] = equipsData.map((e: any) => {
          const sessionNode = Array.isArray(e.sessions) ? e.sessions[0] : e.sessions
          const clientNode = sessionNode?.clients ? (Array.isArray(sessionNode.clients) ? sessionNode.clients[0] : sessionNode.clients) : null

          return {
            id_equip: e.id_equip,
            id_client: sessionNode?.id_client || '',
            noms_equip: e.nom_equip || 'Equip Detectat',
            missio_actual: e.missio_actual || 'MISION_1',
            credits: clientNode?.credits_disponibles ?? 0,
            informe_final: e.dossier_actiu?.informe_final || null,
            reflexio_individual: e.dossier_actiu?.reflexio_individual || '',
            hora_inici: e.creat_el || new Date().toISOString()
          }
        })
        setEquips(formattedTeams)
      }
    } catch (err) {
      console.error(err)
    } finally {
      if (!isSilent) setLoading(false)
    }
  }

  const arxivarSessióMestre = async (targetIdSessio?: string) => {
    const idAArxivar = targetIdSessio || idSessio
    if (!idAArxivar) return
    const confirmar = confirm("🚨 Vols donar per acabat aquest taller i FINALITZAR la sessió? Els equips quedaran arxivats i la terminal de l'alumne es bloquejarà.")
    if (!confirmar) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ estat: 'FINALITZADA' })
        .eq('id_sessio', idAArxivar)

      if (!error) {
        posthog.capture('session_archived', { team_count: equips.length })
        if (idSessio === idAArxivar) {
          setEquips([])
          setEquipSeleccionat(null)
          setIdSessio(null)
          setPinSessio('')
        }
        await carregarTotesLesSessions(session?.user?.id)
        alert("🔒 Partida finalitzada i arxivada correctament.")
      } else {
        alert(`Error al tancar la sessió: ${error.message}`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Escolta Realtime quan hi ha una sessió oberta al monitor
  useEffect(() => {
    if (!pinSessio || !idSessio) return

    const canalEquips = supabase
      .channel(`equips-sessio-${idSessio}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'equips',
          filter: `id_sessio=eq.${idSessio}`
        },
        () => {
          carregarDadesSessio(pinSessio, true)
        }
      )
      .subscribe()

    const interval = setInterval(() => {
      carregarDadesSessio(pinSessio, true)
    }, 5000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(canalEquips)
    }
  }, [idSessio, pinSessio])

  const modificarCreditsMestre = async (idEquip: string, idClient: string, canvi: number) => {
    const equip = equips.find(e => e.id_equip === idEquip)
    const targetClientId = idClient || idClientActual
    if (!equip || !targetClientId) return

    const nouSaldo = Math.max(0, equip.credits + canvi)

    try {
      const { error } = await supabase
        .from('clients')
        .update({ credits_disponibles: nouSaldo })
        .eq('id_client', targetClientId)

      if (!error) {
        setEquips(prev => prev.map(e => e.id_equip === idEquip ? { ...e, credits: nouSaldo } : e))
      }
    } catch (err) {
      console.error("Error modificarCreditsMestre:", err)
    }
  }

  const forcarSaltMissio = async (idEquip: string, seguentMissio: string) => {
    try {
      const { error } = await supabase
        .from('equips')
        .update({ missio_actual: seguentMissio })
        .eq('id_equip', idEquip)

      if (!error) {
        posthog.capture('team_mission_forced', { target_mission: seguentMissio })
        setEquips(prev => prev.map(e => e.id_equip === idEquip ? { ...e, missio_actual: seguentMissio } : e))
        alert(`🚀 S'ha forçat el salt a ${seguentMissio}`)
      }
    } catch (err) {
      console.error("Error forcarSaltMissio:", err)
    }
  }

  const descarregarTelemetria = (idSessioParam: string, format: 'csv' | 'json') => {
    if (!idSessioParam) return
    posthog.capture('telemetry_downloaded', { format })
    const url = `/api/export?id_sessio=${idSessioParam}&format=${format}`
    const link = document.createElement('a')
    link.href = url
    link.download = `telemetria_${idSessioParam}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const sessionsActives = totesLesSessions.filter(s => s.estat === 'EN_CURS' || s.estat === 'ACTIVA')
  const sessionsArxivades = totesLesSessions.filter(s => s.estat === 'FINALITZADA')

  // ---------------------------------------------------------------------------
  // VISTA 1: ESTAT DE CÀRREGA INICIAL
  // ---------------------------------------------------------------------------
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center text-stone-400 font-mono text-xs">
        Verificant permisos de facilitador...
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // VISTA 2: ACCÉS PER A FACILITADORS (LOGIN)
  // ---------------------------------------------------------------------------
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-[#FAF8F5] text-stone-800 font-sans p-6 selection:bg-amber-100">
        <header className="max-w-5xl w-full mx-auto flex justify-between items-center py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Synusia Logo" width={110} height={30} className="object-contain" priority />
          </div>
          <span className="text-[10px] font-mono px-3 py-1.5 bg-white border border-stone-200 text-stone-500 rounded-md shadow-xs">
            CENTRE D'OPERACIONS
          </span>
        </header>

        <main className="max-w-md w-full mx-auto my-auto bg-white border border-stone-200/80 rounded-2xl p-8 shadow-sm">
          <div className="mb-8 text-center space-y-2">
            <h1 className="text-2xl font-serif font-medium text-stone-900 tracking-tight">
              Accés per a Facilitadors
            </h1>
            <p className="text-xs text-stone-500 leading-relaxed">
              Inicieu sessió per crear sales, gestionar els equips i fer el seguiment de les simulacions.
            </p>
          </div>

          {loginError && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <span>⚠️</span> {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[11px] font-medium text-stone-600 mb-1.5">
                Correu Electrònic
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="pedrojuanes@synusia.io"
                className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-stone-600 mb-1.5">
                Contrasenya
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium py-3 rounded-xl text-sm transition duration-200 disabled:opacity-50 mt-4 shadow-sm cursor-pointer"
            >
              {loginLoading ? 'Autenticant...' : 'Accedir al Tauler →'}
            </button>
          </form>
        </main>

        <footer className="max-w-5xl w-full mx-auto text-center py-4 text-[11px] text-stone-400 font-mono">
          Nucli Innovation SL &copy; {new Date().getFullYear()} &mdash; Synusia Platform
        </footer>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // VISTA 3: MODE PROJECTOR (PANTALLA COMPLETA EN CLASSE)
  // ---------------------------------------------------------------------------
  if (projectingPin) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 relative font-sans">
        <button
          onClick={() => setProjectingPin(null)}
          className="absolute top-8 right-8 text-stone-500 hover:text-stone-900 font-mono text-xs px-4 py-2 border border-stone-200 rounded-xl bg-white shadow-xs transition-all cursor-pointer"
        >
          ✕ Tancar projecció
        </button>

        <div className="text-center space-y-8">
          <Image src="/logo.png" alt="Synusia Logo" width={180} height={50} className="mx-auto mb-6 opacity-90 object-contain" priority />
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-900">Entreu a la Simulació</h1>
          <p className="text-lg text-stone-500 font-mono bg-stone-100/80 px-4 py-1.5 rounded-full inline-block border border-stone-200/60">
            app.synusia.io
          </p>

          <div className="bg-white border-2 border-stone-200/90 p-10 sm:p-14 rounded-3xl shadow-xl mt-6 inline-block">
            <span className="block text-xs font-bold uppercase tracking-[0.3em] text-stone-400 mb-3 font-mono">
              PIN d'Accés
            </span>
            <span className="text-7xl sm:text-9xl font-mono font-bold text-stone-900 tracking-widest">
              {projectingPin}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // VISTA 4: TAULELL DE CONTROL (FACILITADOR AUTENTICAT)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-800 p-6 font-sans selection:bg-amber-100">

      {/* CAPÇALERA DE LA PLATAFORMA */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-stone-200/80 pb-6 mb-6 gap-4 no-print">
        <div>
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Synusia Logo" width={110} height={30} className="object-contain" priority />
            <span className="text-stone-300">|</span>
            <h1 className="text-xl font-serif font-medium tracking-tight text-stone-900">
              Centre d'Operacions
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">Gestió d'aules, creació de sales i seguiment de simulacions en temps real</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/templates"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 font-medium text-xs py-2.5 px-4 rounded-xl transition-all shadow-xs"
          >
            📚 Gestor de Casos
          </Link>

          <button
            onClick={obrirModalLlançament}
            disabled={loading}
            className="bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-xs py-2.5 px-4 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            ＋ Obrir Nova Sala (-1 CR)
          </button>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-stone-200 shadow-xs ml-1">
            <input
              type="text"
              placeholder="PIN sala"
              value={pinSessio}
              onChange={(e) => setPinSessio(e.target.value)}
              className="bg-[#FAF8F5] border border-stone-300 rounded-lg px-2.5 py-1 text-center text-xs font-mono font-bold tracking-widest text-stone-900 focus:outline-none uppercase w-24"
            />
            <button
              onClick={() => carregarDadesSessio(pinSessio)}
              className="bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Carregar
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="text-stone-400 hover:text-red-600 text-xs px-2 py-1 transition-colors cursor-pointer ml-1"
            title="Tancar sessió"
          >
            🚪
          </button>
        </div>
      </header>

      {/* MODAL PER LLANÇAR NOVA SALA */}
      {mostrarModalLlançament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-stone-200/90 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase">CONFIGURACIÓ DE SALA</span>
              <h2 className="text-lg font-serif font-medium text-stone-900 mt-0.5">Llançar Nova Simulació</h2>
              <p className="text-xs text-stone-500 mt-1">Es generarà un PIN únic de 4 lletres perquè els alumnes accedeixin.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Selecciona el Cas*</label>
                <select
                  value={templateSeleccionada}
                  onChange={(e) => setTemplateSeleccionada(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl p-3 text-xs font-mono font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 cursor-pointer"
                >
                  {templates.length === 0 ? (
                    <option value="CAS_OMNIA_2026">CAS_OMNIA_2026 (Per defecte)</option>
                  ) : (
                    templates.map((t) => (
                      <option key={t.id_template} value={t.id_template}>
                        {t.is_official ? '🏛️ ' : ''}{t.titol ? `${t.titol} [${t.id_template}]` : t.id_template}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-900 leading-relaxed">
              ⚡ En confirmar, es descomptarà 1 crèdit del teu compte i la sala quedarà en estat <strong>ACTIVA</strong> per als alumnes.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                onClick={() => setMostrarModalLlançament(false)}
                className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
              >
                Cancel·lar
              </button>
              <button
                onClick={arrancarNouTallerMonetitzat}
                disabled={loading}
                className="bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium px-4 py-2.5 rounded-xl cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
              >
                {loading ? 'Llançant...' : '🚀 Confirmar i Llançar (-1 CR)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SI TENIM UNA SESSIÓ SELECCIONADA/CARREGADA AL MONITOR */}
      {idSessio ? (
        <div className="space-y-4 animate-fade-in">

          {/* BARRA DE MONITORITZACIÓ DE SALA */}
          <div className="flex flex-wrap justify-between items-center bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-xs gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setIdSessio(null); setPinSessio(''); setEquips([]); setEquipSeleccionat(null); }}
                className="text-xs text-stone-500 hover:text-stone-900 font-mono flex items-center gap-1 underline transition-colors cursor-pointer"
              >
                ← Tornar a la Llista de Sales
              </button>
              <span className="text-stone-300">|</span>
              <span className="text-xs font-mono text-stone-600 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200/80">
                PIN: <strong className="text-stone-900">{pinSessio}</strong>
              </span>
              <span className="text-xs font-mono text-stone-400 hidden md:inline">
                Cas: <strong className="text-stone-600">{templateSessioActiva}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setProjectingPin(pinSessio)}
                className="bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 text-xs font-medium px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                title="Projectar a la pissarra"
              >
                📺 Projectar PIN
              </button>

              <button
                onClick={() => descarregarTelemetria(idSessio, 'csv')}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs font-mono font-medium px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-xs cursor-pointer"
              >
                📥 CSV
              </button>

              <button
                onClick={() => descarregarTelemetria(idSessio, 'json')}
                className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 text-xs font-mono font-medium px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-xs cursor-pointer"
              >
                📄 JSON
              </button>

              <button
                onClick={() => arxivarSessióMestre(idSessio)}
                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-medium px-3 py-1.5 rounded-xl transition-all no-print cursor-pointer"
              >
                🔒 Arxivar Sala
              </button>
            </div>
          </div>

          {/* TAULELL PRINCIPAL EN TEMPS REAL */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* GRUP DE TARGETES D'EQUIPS */}
            <div className="xl:col-span-2 space-y-4">
              <h2 className="text-[10px] font-mono font-medium tracking-widest uppercase text-stone-400">
                EQUIPS EN SALA ({equips.length})
              </h2>

              {equips.length === 0 && (
                <div className="text-xs text-stone-400 italic p-8 bg-white border border-dashed border-stone-200 rounded-2xl text-center space-y-2">
                  <p>Sessió activa correctament. Esperant que els equips s'inscriguin des de la terminal de l'alumne...</p>
                  <p className="font-mono text-[11px] text-stone-500">Projecteu el PIN [{pinSessio}] a la pantalla de la classe.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {equips.map((team) => {
                  const progres = mapMissions[team.missio_actual] || 25
                  const esLimit = team.credits <= 0
                  const isSelected = equipSeleccionat?.id_equip === team.id_equip

                  return (
                    <div
                      key={team.id_equip}
                      onClick={() => setEquipSeleccionat(team)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer bg-white shadow-xs ${isSelected
                        ? 'border-stone-800 ring-2 ring-stone-900/10 bg-stone-50/60'
                        : 'border-stone-200/90 hover:border-stone-300'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-stone-900 text-sm tracking-wide">{team.noms_equip}</h3>
                          <span className="text-[10px] font-mono text-stone-600 uppercase bg-stone-100 px-2 py-0.5 rounded border border-stone-200 mt-1.5 inline-block">
                            🎯 {(team.missio_actual || 'MISION_1').replace('_', ' ')}
                          </span>
                        </div>
                        <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${esLimit
                          ? 'bg-red-50 text-red-700 border border-red-200 animate-pulse'
                          : 'bg-stone-100 text-stone-800 border border-stone-200'
                          }`}>
                          ⚡ {team.credits} CR
                        </span>
                      </div>

                      <div className="space-y-1 mb-4">
                        <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden border border-stone-200/80">
                          <div className="bg-stone-800 h-full transition-all duration-1000" style={{ width: `${progres}%` }} />
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-stone-100 gap-2 no-print" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button onClick={() => modificarCreditsMestre(team.id_equip, team.id_client, -1)} className="bg-stone-100 hover:bg-stone-200 text-stone-700 w-6 h-6 border border-stone-200 rounded text-xs cursor-pointer">-1</button>
                          <button onClick={() => modificarCreditsMestre(team.id_equip, team.id_client, 2)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 h-6 border border-emerald-200 rounded text-[10px] font-medium cursor-pointer">+2 CR</button>
                        </div>
                        <div className="flex gap-1 text-[10px] font-mono">
                          {['MISION_1', 'MISION_2', 'MISION_3', 'MISION_4'].map((m, idx) => (
                            <button key={m} onClick={() => forcarSaltMissio(team.id_equip, m)} disabled={team.missio_actual === m} className="bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-600 px-1.5 rounded disabled:opacity-30 cursor-pointer">M{idx + 1}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* AUDITORIA EN CRU / DETAIL PANEL */}
            <div className="bg-white border border-stone-200/90 rounded-2xl p-5 h-[76vh] flex flex-col justify-between overflow-y-auto shadow-xs">
              {equipSeleccionat ? (
                <div className="space-y-6 h-full flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="border-b border-stone-100 pb-3">
                      <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">// COGNITIVE AUDIT LOGS</span>
                      <h2 className="text-lg font-serif font-medium text-stone-900 mt-0.5">{equipSeleccionat.noms_equip}</h2>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono font-medium text-stone-500 uppercase tracking-wider block">
                        🧠 Reflexió de Calibratge (Misió 0):
                      </span>
                      <div className="bg-[#FAF8F5] p-3 rounded-xl border border-stone-200/80 text-xs text-stone-700 italic leading-relaxed">
                        "{equipSeleccionat.reflexio_individual || 'Cap reflexió inicial registrada.'}"
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono font-medium text-stone-500 uppercase tracking-wider block">
                        ⚖️ Dictamen / Resolució Final:
                      </span>
                      {equipSeleccionat.informe_final ? (
                        <div className="bg-[#FAF8F5] p-3 rounded-xl border-l-3 border-l-stone-900 border-stone-200 text-xs text-stone-800 leading-relaxed">
                          {equipSeleccionat.informe_final}
                        </div>
                      ) : (
                        <div className="bg-[#FAF8F5] p-3 rounded-xl border border-dashed border-stone-200 text-xs text-stone-400 italic text-center">
                          L'equip encara no ha enviat el dictamen final.
                        </div>
                      )}
                    </div>

                    <div className="p-3 bg-stone-50 border border-stone-200/80 rounded-xl space-y-1 font-mono text-[11px] text-stone-600">
                      <div className="flex justify-between">
                        <span>Hora Inici:</span>
                        <span className="font-semibold text-stone-800">
                          {new Date(equipSeleccionat.hora_inici).toLocaleTimeString('ca-ES')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Missió Activa:</span>
                        <span className="font-semibold text-stone-800">{equipSeleccionat.missio_actual}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Crèdits Disponibles:</span>
                        <span className="font-semibold text-stone-800">{equipSeleccionat.credits} CR</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100">
                    <button
                      onClick={() => descarregarTelemetria(idSessio!, 'csv')}
                      className="w-full bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium py-2.5 rounded-xl transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
                    >
                      <span>📥</span> Descarregar Telemetria en CSV
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 space-y-2">
                  <span className="text-2xl">📊</span>
                  <p className="text-xs font-sans">Seleccioneu un equip de la llista per veure la seva auditoria en temps real.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      ) : (
        /* VISTA PRINCIPAL DE SALES (QUAN NO N'HI HA CAP CARREGADA AL MONITOR) */
        <div className="space-y-10 animate-fade-in">

          {/* SECCIÓ 1: SALES ACTIVES (EN CURS) */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <h2 className="text-xs font-mono font-semibold text-stone-900 uppercase tracking-widest">
                Aules en Curs ({sessionsActives.length})
              </h2>
            </div>

            {sessionsActives.length === 0 ? (
              <div className="bg-white border border-stone-200 border-dashed rounded-2xl p-8 text-center text-stone-400 text-xs space-y-3">
                <p>No hi ha cap simulació activa en aquest moment.</p>
                <button
                  onClick={obrirModalLlançament}
                  className="bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  ＋ Obrir la primera sala
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sessionsActives.map((s) => (
                  <div
                    key={s.id_sessio}
                    className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-2xs hover:border-stone-300 transition-all flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block">
                          CAS
                        </span>
                        <h3 className="text-sm font-semibold text-stone-900 mt-0.5">
                          {s.id_template}
                        </h3>
                      </div>

                      <div className="bg-stone-100 border border-stone-200 px-3 py-1 rounded-xl text-center">
                        <span className="block text-[8px] uppercase tracking-widest text-stone-400 font-mono font-bold">PIN</span>
                        <span className="font-mono font-bold text-sm text-stone-900">{s.pin_acces}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-stone-100">
                      <button
                        onClick={() => carregarDadesSessio(s.pin_acces)}
                        className="flex-1 bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium py-2 rounded-xl transition-colors cursor-pointer text-center"
                      >
                        📊 Monitoritzar
                      </button>
                      <button
                        onClick={() => setProjectingPin(s.pin_acces)}
                        className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer"
                        title="Projectar a la pissarra"
                      >
                        📺
                      </button>
                      <button
                        onClick={() => arxivarSessióMestre(s.id_sessio)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer"
                        title="Finalitzar Sessió"
                      >
                        Arxivar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECCIÓ 2: HISTÒRIC DE SESSIONS (ARXIVADES) */}
          <section>
            <h2 className="text-xs font-mono font-semibold text-stone-400 uppercase tracking-widest mb-4">
              Històric de Sessions (Arxivades)
            </h2>

            <div className="bg-white border border-stone-200/90 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-stone-200 text-[10px] uppercase font-mono tracking-wider text-stone-500">
                    <th className="p-4 font-medium">Cas</th>
                    <th className="p-4 font-medium">PIN</th>
                    <th className="p-4 font-medium">Estat</th>
                    <th className="p-4 font-medium text-right">Accions</th>
                  </tr>
                </thead>
                <tbody className="text-xs text-stone-700 divide-y divide-stone-100">
                  {sessionsArxivades.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-stone-400 italic">No teniu sessions arxivades.</td>
                    </tr>
                  ) : (
                    sessionsArxivades.map((s) => (
                      <tr key={s.id_sessio} className="hover:bg-stone-50 transition-colors">
                        <td className="p-4 font-medium text-stone-900">{s.id_template}</td>
                        <td className="p-4 font-mono font-bold text-stone-500">{s.pin_acces}</td>
                        <td className="p-4">
                          <span className="text-[10px] font-mono bg-stone-100 text-stone-500 px-2 py-0.5 rounded border border-stone-200 uppercase">
                            FINALITZADA
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => carregarDadesSessio(s.pin_acces)}
                            className="text-stone-700 hover:text-stone-900 font-medium underline underline-offset-2 cursor-pointer"
                          >
                            Revisar Avaluacions
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      )}

    </div>
  )
}