"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image';

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
  const [loginEmail, setLoginEmail] = useState<string>('')
  const [loginPassword, setLoginPassword] = useState<string>('')
  const [loginLoading, setLoginLoading] = useState<boolean>(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // ESTATS DEL TAULELL DE CONTROL
  // ---------------------------------------------------------------------------
  const [pinSessio, setPinSessio] = useState<string>('')
  const [idSessio, setIdSessio] = useState<string | null>(null)
  const [equips, setEquips] = useState<TeamData[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [equipSeleccionat, setEquipSeleccionat] = useState<TeamData | null>(null)

  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templateSeleccionada, setTemplateSeleccionada] = useState<string>('')
  const [mostrarModalLlançament, setMostrarModalLlançament] = useState<boolean>(false)

  const [idClientActual, setIdClientActual] = useState<string>('')

  // Verificació inicial de sessió a Supabase
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session: activeSession } } = await supabase.auth.getSession()
        setSession(activeSession)
      } catch (err) {
        console.error('Error comprovant la sessió:', err)
      } finally {
        setAuthChecking(false)
      }
    }

    checkSession()

    // Escolta canvis d'estat a Supabase Auth (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setAuthChecking(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Carregar dades quan el facilitador està autenticat
  useEffect(() => {
    if (session) {
      carregarPlantillesIClient()
    }
  }, [session])

  // Login de Facilitador
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
        setSession(data.session)
      }
    } catch (err) {
      setLoginError('Error de connexió amb el servidor d’autenticació.')
    } finally {
      setLoginLoading(false)
    }
  }

  // Logout de Facilitador
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setEquips([])
    setIdSessio(null)
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
        .select('id_template, titol')

      if (dataTemplates && dataTemplates.length > 0) {
        setTemplates(dataTemplates)
        setTemplateSeleccionada(dataTemplates[0].id_template)
      }
    } catch (err) {
      console.error(err)
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
        alert(`🚨 CLIENT NO TROBAT: La ID de client [${clientId}] no existeix.`);
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
          id_template: templateSeleccionada
        }])
        .select()
        .single()

      if (errorSessio || !novaSessio) {
        alert(`Error al registrar la sessió: ${errorSessio?.message}`)
        setLoading(false)
        return
      }

      setPinSessio(nouPin)
      setIdSessio(novaSessio.id_sessio)
      setEquips([])
      setEquipSeleccionat(null)
      setMostrarModalLlançament(false)

      alert(`🎉 Taller llançat amb èxit!\n📂 Cas actiu: [${templateSeleccionada}]\n💸 Crèdit consumit (Saldo restant: ${saldoActual - 1}).\n🎯 PIN d'accés per a l'aula: ${nouPin}`)

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
        .select('id_sessio, id_client')
        .eq('pin_acces', pinTarget.trim().toUpperCase())
        .eq('estat', 'EN_CURS')
        .single()

      if (errorSessio || !sessio) {
        if (!isSilent) alert("⚠️ No hi ha cap sessió 'EN_CURS' amb aquest PIN.")
        return
      }

      setIdSessio(sessio.id_sessio)

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

  const arxivarSessióMestre = async () => {
    if (!idSessio) return
    const confirmar = confirm("🚨 Vols donar per acabat aquest taller i FINALITZAR la sessió? Els equips quedaran arxivats i la terminal de l'alumne es bloquejarà.")
    if (!confirmar) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ estat: 'FINALITZADA' })
        .eq('id_sessio', idSessio)

      if (!error) {
        setEquips([])
        setEquipSeleccionat(null)
        setIdSessio(null)
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
        setEquips(prev => prev.map(e => e.id_equip === idEquip ? { ...e, missio_actual: seguentMissio } : e))
        alert(`🚀 S'ha forçat el salt a ${seguentMissio}`)
      }
    } catch (err) {
      console.error("Error forcarSaltMissio:", err)
    }
  }

  const descarregarTelemetria = (idSessioParam: string, format: 'csv' | 'json') => {
    if (!idSessioParam) return
    const url = `/api/export?id_sessio=${idSessioParam}&format=${format}`
    const link = document.createElement('a')
    link.href = url
    link.download = `telemetria_${idSessioParam}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
  // VISTA 2: CARÀTULA D'ACCÉS PER A FACILITADORS (ESTIL CLAUDE / MINIMAL)
  // ---------------------------------------------------------------------------
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-[#FAF8F5] text-stone-800 font-sans p-6 selection:bg-amber-100">

        {/* Capçalera */}
        <header className="max-w-5xl w-full mx-auto flex justify-between items-center py-4">
          <div className="flex items-center gap-3">
            {/* Si ja has posat el logo, assegura't que l'import d'Image hi és a dalt */}
            <Image src="/logo.png" alt="Synusia Logo" width={110} height={30} className="object-contain" priority />
          </div>
          <span className="text-[10px] font-mono px-3 py-1.5 bg-white border border-stone-200 text-stone-500 rounded-md shadow-xs">
            PANELL D'OPERACIONS
          </span>
        </header>

        {/* Formulari Central */}
        <main className="max-w-md w-full mx-auto my-auto bg-white border border-stone-200/80 rounded-2xl p-8 shadow-sm">
          <div className="mb-8 text-center space-y-2">
            <h1 className="text-2xl font-serif font-medium text-stone-900 tracking-tight">
              Accés Facilitador
            </h1>
            <p className="text-xs text-stone-500 leading-relaxed">
              Autenticació requerida per accedir al panell de gestió de sessions i telemetria.
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
                className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white transition-all"
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
                className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium py-3 rounded-xl text-sm transition duration-200 disabled:opacity-50 mt-4 shadow-sm cursor-pointer"
            >
              {loginLoading ? 'Autenticant...' : 'Entrar al Panell →'}
            </button>
          </form>
        </main>

        {/* Peu de pàgina */}
        <footer className="max-w-5xl w-full mx-auto text-center py-4 text-[11px] text-stone-400 font-mono">
          Nucli Innovation SL &copy; {new Date().getFullYear()} &mdash; Synusia Platform
        </footer>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // VISTA 3: TAULELL DE CONTROL (FACILITADOR AUTENTICAT)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-800 p-6 font-sans selection:bg-amber-100">

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-stone-200/80 pb-6 mb-6 gap-4 no-print">
        <div>
          <h1 className="text-2xl font-serif font-medium tracking-tight text-stone-900 flex items-center gap-3">
            <Image src="/logo.png" alt="Synusia Logo" width={32} height={32} className="object-contain" />
            Synusia Operations Panel
          </h1>
          <p className="text-xs text-stone-500 mt-1">Gestió aïllada multi-tenant per a tallers executius, universitats i entitats públiques.</p>

          <div className="flex items-center gap-2 mt-3">
            <Link
              href="/admin/templates"
              className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-xs"
            >
              🎨 Gestor de Plantilles / Authoring Tool →
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              🚪 Tancar Sessió ({session.user?.email})
            </button>
          </div>
        </div>

        <div className="flex gap-2 bg-white p-2 rounded-xl border border-stone-200 shadow-xs">
          <button
            onClick={obrirModalLlançament}
            disabled={loading}
            className="bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-xs py-2.5 px-4 rounded-lg transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Processant...' : '🚀 Llançar Nova Sessió (-1 Crèdit)'}
          </button>

          <input
            type="text"
            placeholder="PIN D'ACCÉS"
            value={pinSessio}
            onChange={(e) => setPinSessio(e.target.value)}
            className="bg-[#FAF8F5] border border-stone-300 rounded-lg px-3 py-1.5 text-center text-sm font-mono font-bold tracking-widest text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400 uppercase w-32"
          />
          <button
            onClick={() => carregarDadesSessio(pinSessio)}
            className="bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-800 font-medium px-4 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
          >
            Sincronitzar
          </button>
        </div>
      </header>

      {mostrarModalLlançament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase">CONFIGURACIÓ DE TALLER</span>
              <h2 className="text-lg font-serif font-medium text-stone-900 mt-1">Selecciona el Cas</h2>
              <p className="text-xs text-stone-500 mt-1">Quin cas o narrativa vols activar per a aquesta nova sessió?</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-stone-700">Plantilla / Storyline Activa *</label>
              <select
                value={templateSeleccionada}
                onChange={(e) => setTemplateSeleccionada(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl p-3 text-xs font-mono font-bold text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400 cursor-pointer"
              >
                {templates.length === 0 ? (
                  <option value="MISION_1">MISION_1 (Per defecte)</option>
                ) : (
                  templates.map((t) => (
                    <option key={t.id_template} value={t.id_template}>
                      {t.titol ? `${t.titol} [${t.id_template}]` : t.id_template}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-800 leading-relaxed">
              💸 En confirmar, es descomptarà 1 crèdit del compte del client i es generarà un PIN d'accés únic per a l'aula.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setMostrarModalLlançament(false)}
                className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium px-4 py-2.5 rounded-xl cursor-pointer"
              >
                Cancel·lar
              </button>
              <button
                onClick={arrancarNouTallerMonetitzat}
                disabled={loading}
                className="bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium px-4 py-2.5 rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
              >
                {loading ? 'Llançant...' : 'Confirmar i Llançar (-1 CR)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {idSessio && (
        <div className="space-y-4">

          <div className="flex flex-wrap justify-between items-center bg-white p-3 rounded-xl border border-stone-200 shadow-xs gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-medium text-stone-500 uppercase tracking-wider mr-1">
                📊 Exportar Dades:
              </span>
              <button
                onClick={() => descarregarTelemetria(idSessio, 'csv')}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs font-mono font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                📥 Telemetria (CSV)
              </button>
              <button
                onClick={() => descarregarTelemetria(idSessio, 'json')}
                className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 text-xs font-mono font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                📄 Raw (JSON)
              </button>
              <button
                onClick={() => window.print()}
                className="bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 text-xs font-mono font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs no-print cursor-pointer"
              >
                🖨️ Guardar PDF
              </button>
            </div>

            <button
              onClick={arxivarSessióMestre}
              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-mono font-medium px-3 py-1.5 rounded-lg transition-all no-print cursor-pointer"
            >
              🔒 Arxivar Sessió
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            <div className="xl:col-span-2 space-y-4">
              <h2 className="text-xs font-mono font-medium tracking-wider uppercase text-stone-500">
                // MONITOR DE LA SALA EN ACTIU ({equips.length} Equips)
              </h2>

              {equips.length === 0 && (
                <p className="text-xs text-stone-500 italic p-6 bg-white border border-dashed border-stone-300 rounded-xl">
                  Sessió connectada. Esperant que els equips s'inscriguin des de la terminal de l'alumne...
                </p>
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
                            🎯 FASE: {(team.missio_actual || 'MISION_1').replace('_', ' ')}
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

            <div className="bg-white border border-stone-200 rounded-xl p-5 h-[76vh] flex flex-col justify-between overflow-y-auto shadow-xs">
              {equipSeleccionat ? (
                <div className="space-y-6 h-full flex flex-col justify-between">
                  <div className="space-y-6">

                    <div className="border-b border-stone-100 pb-3">
                      <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">// RAW COGNITIVE AUDIT LOGS</span>
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
                      <span>📥</span> Descarregar Telemetria Completa en CSV
                    </button>
                  </div>

                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 space-y-2">
                  <span className="text-2xl">📊</span>
                  <p className="text-xs font-sans">Seleccioneu un equip de la llista per veure el seu registre en cru.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}