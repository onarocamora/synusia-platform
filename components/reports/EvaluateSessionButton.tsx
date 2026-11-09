// components/reports/EvaluateSessionButton.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface EvaluateSessionButtonProps {
  sessionId: string;
}

export function EvaluateSessionButton({ sessionId }: EvaluateSessionButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleEvaluate = async () => {
    setLoading(true);
    setInfoMessage(null);
    setIsError(false);

    try {
      const res = await fetch('/api/evaluate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idSessio: sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error avaluant els equips');
      }

      // Comprovar si s'han avaluat equips o si tenen dades insuficients
    const evaluatedCount = data.results?.filter((r: any) => !r.insufficientData && !r.skipped && !r.error).length || 0;
    const insufficientCount = data.results?.filter((r: any) => r.insufficientData || r.skipped).length || 0;

    if (evaluatedCount === 0 && insufficientCount > 0) {
    setIsError(true);
    setInfoMessage(`S'han trobat ${insufficientCount} equip(s), però cap no té prou interacció per establir una avaluació psicomètrica.`);
    setLoading(false);
    return;
    }

    setInfoMessage(`Completat! S'han auditat ${evaluatedCount} equip(s)${insufficientCount > 0 ? ` (${insufficientCount} amb dades insuficients)` : ''}. Carregant informe...`);
      
      // Forçar recàrrega del report
      router.refresh();
      window.location.reload();
    } catch (err: any) {
      setIsError(true);
      setInfoMessage(err.message || 'No s’ha pogut completar l’avaluació');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleEvaluate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Auditant la cohort amb el Jutge Semàntic...
          </>
        ) : (
          <>
            <span>⚡</span> Avaluar equips d&apos;aquesta sessió ara
          </>
        )}
      </button>

      {infoMessage && (
        <p className={`max-w-sm text-center text-xs font-medium ${isError ? 'text-rose-600' : 'text-emerald-600'}`}>
          {infoMessage}
        </p>
      )}
    </div>
  );
}