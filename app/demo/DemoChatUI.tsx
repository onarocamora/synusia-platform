'use client';

import { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
  simulated?: boolean;
}

interface EvaluationData {
  level: 1 | 2 | 3;
  level_name: string;
  finding: string;
  recommendation: string;
}

export default function DemoChatUI({ uid }: { uid: string }) {
  const [status, setStatus] = useState<'analyzing' | 'idle' | 'loading' | 'evaluated'>('analyzing');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'user',
      content: '¿Puedes revisar el borrador del Proveedor B y confirmar si los términos de responsabilidad y multas son aceptables para firma?',
      simulated: true
    }
  ]);
  const [turn, setTurn] = useState<number>(1);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showHistoryReview, setShowHistoryReview] = useState(false);
  const [hasViewedSource, setHasViewedSource] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState('');
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadCapturing, setLeadCapturing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const startTimeRef = useRef<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStatus('idle');
      startTimeRef.current = Date.now();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'He revisado el contrato del Proveedor B. La Cláusula 8.2 nos cubre totalmente: asumen ellos cualquier sanción regulatoria y no ponen límite a indemnizaciones en caso de fuga de datos. ¿Doy luz verde a Compras para firmar?'
        }
      ]);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  const handleOpenDoc = () => {
    setShowDocModal(true);
    setHasViewedSource(true);
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/demo?uid=${encodeURIComponent(uid)}&ref=share`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCaptureLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !leadId) return;

    setLeadCapturing(true);
    try {
      await fetch('/api/capture-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, email: emailInput.trim() })
      });
      setLeadCaptured(true);
    } catch {
      setLeadCaptured(true);
    } finally {
      setLeadCapturing(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim()) return;

    const currentText = userInput;
    setUserInput('');

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: currentText }];
    setMessages(newMessages);
    setStatus('loading');

    const totalSeconds = Number(((Date.now() - startTimeRef.current) / 1000).toFixed(1));
    setElapsedSeconds(totalSeconds);

    try {
      const res = await fetch('/api/evaluate-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          message: currentText,
          turn,
          history: newMessages.slice(0, -1),
          timeSpent: totalSeconds,
          sourceChecked: hasViewedSource
        })
      });

      const data = await res.json();

      if (data.action === 'nudge' && data.reply) {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
        setTurn(2);
        setStatus('idle');
      } else if (data.evaluation) {
        setEvaluation(data.evaluation);
        setLeadId(data.leadId);
        setStatus('evaluated');
      }
    } catch {
      setEvaluation({
        level: 1,
        level_name: 'Fallo de Supervisión',
        finding: 'No se pudo conectar con el motor de evaluación.',
        recommendation: 'Revisa la consola del sistema.'
      });
      setStatus('evaluated');
    }
  };

  return (
    <div className="relative flex h-full flex-col bg-[#FCFBF9] text-stone-800 font-sans">
      {/* Barra superior del contrato */}
      <div className="flex items-center justify-between border-b border-stone-200 bg-stone-100/70 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded border border-stone-200 bg-white text-stone-600 shadow-xs">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-stone-800">Contrato_Proveedor_B.pdf</div>
            <div className="text-[10px] text-stone-500">Documento analizado por el asistente</div>
          </div>
        </div>

        <button
          onClick={handleOpenDoc}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
            hasViewedSource
              ? 'border-emerald-600/40 bg-emerald-50 text-emerald-800'
              : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50 shadow-xs'
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {hasViewedSource ? 'Cláusula 8.2 consultada' : 'Leer Cláusula 8.2 original'}
        </button>
      </div>

      {/* Visor del texto original */}
      {showDocModal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-stone-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-stone-500">
                Texto real del contrato
              </span>
              <button onClick={() => setShowDocModal(false)} className="text-stone-400 hover:text-stone-700 text-sm">
                ✕
              </button>
            </div>
            <div className="my-4 rounded-lg border border-stone-200 bg-[#FAF8F5] p-4 text-xs text-stone-800 leading-relaxed">
              <p className="font-bold text-stone-900 mb-1.5">Cláusula 8.2 (Responsabilidad e Indemnización):</p>
              &quot;En ningún caso el Proveedor asumirá responsabilidad por sanciones de organismos reguladores impuestas al Cliente. La indemnización máxima exigible queda limitada al 100% de la cuota abonada en los últimos 3 meses.&quot;
            </div>
            <button
              onClick={() => setShowDocModal(false)}
              className="w-full rounded-md border border-stone-300 bg-stone-100 py-2 text-xs font-medium text-stone-700 hover:bg-stone-200 transition-colors"
            >
              Volver a la conversación
            </button>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {status === 'analyzing' ? (
          <div className="flex h-full flex-col items-center justify-center space-y-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-800 border-t-transparent" />
            <p className="text-xs text-stone-500">Analizando cláusulas...</p>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-white text-[11px] font-mono font-bold text-stone-700 shadow-xs">
                  IA
                </div>
              )}
              <div
                className={`max-w-xl rounded-xl p-3.5 text-sm leading-relaxed shadow-xs ${
                  m.role === 'user'
                    ? 'rounded-tr-none border border-stone-300 bg-stone-900 text-stone-50'
                    : 'rounded-tl-none border border-stone-200 bg-white text-stone-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}

        {status === 'loading' && (
          <div className="flex items-center gap-2 text-xs text-stone-500 pl-10">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-stone-600 border-t-transparent" />
            Analizando tu decisión...
          </div>
        )}
      </div>

      {/* Input */}
      {status === 'idle' && (
        <div className="border-t border-stone-200 bg-white p-3.5">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={
                turn === 1
                  ? "Indica cómo proceder con la propuesta..."
                  : "Responde a la advertencia de Compras..."
              }
              className="w-full rounded-lg border border-stone-300 bg-[#FAF8F5] py-2.5 pl-4 pr-12 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
            <button
              type="submit"
              disabled={!userInput.trim()}
              className="absolute right-1.5 rounded-md bg-stone-900 p-2 text-white hover:bg-stone-800 disabled:opacity-30 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* Modal de Resultados */}
      {status === 'evaluated' && evaluation && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg my-auto overflow-hidden rounded-xl border border-stone-300 bg-white shadow-2xl">
            {/* Header del resultado */}
            <div
              className={`px-6 py-4 border-b ${
                evaluation.level === 3
                  ? 'border-emerald-200 bg-emerald-50/70'
                  : evaluation.level === 2
                  ? 'border-amber-200 bg-amber-50/70'
                  : 'border-red-200 bg-red-50/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono tracking-wider uppercase text-stone-500">
                    Resultado de la simulación
                  </span>
                  <h3
                    className={`text-base font-bold ${
                      evaluation.level === 3
                        ? 'text-emerald-900'
                        : evaluation.level === 2
                        ? 'text-amber-900'
                        : 'text-red-900'
                    }`}
                  >
                    {evaluation.level_name}
                  </h3>
                </div>
                <span className="text-xl">
                  {evaluation.level === 3 ? '🟢' : evaluation.level === 2 ? '🟡' : '🔴'}
                </span>
              </div>
            </div>

            {/* Ficha técnica */}
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div>
                  <span className="text-stone-500 block">Tiempo de respuesta:</span>
                  <span className="text-stone-900 font-bold">{elapsedSeconds} segundos</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Contrato consultado:</span>
                  <span className={hasViewedSource ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                    {hasViewedSource ? 'SÍ (Cláusula 8.2 leída)' : 'NO (Sin verificar)'}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-stone-900 block mb-1">Lo que ha ocurrido:</span>
                <p className="text-stone-700 leading-relaxed">{evaluation.finding}</p>
              </div>

              <div className="rounded-md border border-stone-200 bg-[#FAF8F5] p-3">
                <span className="font-semibold text-stone-900 block mb-1">¿Qué riesgo implica para la empresa?</span>
                <p className="text-stone-600 leading-relaxed">{evaluation.recommendation}</p>
              </div>

              {/* Plegable con lo que se habló */}
              <div className="rounded-md border border-stone-200 bg-white">
                <button
                  type="button"
                  onClick={() => setShowHistoryReview(!showHistoryReview)}
                  className="w-full flex items-center justify-between p-2.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
                >
                  <span>Revisar la conversación completa</span>
                  <span>{showHistoryReview ? '▲ Ocultar' : '▼ Ver'}</span>
                </button>
                {showHistoryReview && (
                  <div className="border-t border-stone-200 p-3 space-y-2 max-h-36 overflow-y-auto bg-stone-50">
                    {messages.map((m, i) => (
                      <div key={i} className="text-[11px]">
                        <strong className="text-stone-900">
                          {m.role === 'assistant' ? 'Asistente IA:' : 'Tu respuesta:'}
                        </strong>{' '}
                        <span className="text-stone-700">{m.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Captura de Lead */}
              <div className="border-t border-stone-200 pt-3">
                {!leadCaptured ? (
                  <form onSubmit={handleCaptureLead} className="space-y-2">
                    <label className="block text-[11px] font-semibold text-stone-800">
                      Recibir el informe completo y comparativa del sector (PDF):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="tu.correo@empresa.com"
                        className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={leadCapturing}
                        className="rounded-md bg-stone-900 px-3 py-2 font-medium text-white hover:bg-stone-800 disabled:opacity-50 transition-colors"
                      >
                        {leadCapturing ? 'Enviando...' : 'Solicitar'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2.5 text-center text-emerald-800 font-medium">
                    ✓ Te hemos enviado el informe a tu correo.
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <a
                  href="https://calendar.app.google/akDdbLe2UvNNqFnV9"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-stone-900 py-2.5 px-3 text-center font-medium text-white hover:bg-stone-800 transition-colors"
                >
                  Agendar diagnóstico para mi equipo (30 min)
                </a>

                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-stone-300 bg-white py-2.5 px-3 font-medium text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  {copiedLink ? '¡Enlace copiado!' : 'Compartir con mi equipo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}