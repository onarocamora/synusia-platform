'use client';

import React, { useState } from 'react';

interface ConfidenceModalProps {
    isOpen: boolean;
    type: 'MOMENT_A' | 'MOMENT_B';
    botName: string;
    onConfirm: (rating: number) => void;
}

export default function ConfidenceModal({
    isOpen,
    type,
    botName,
    onConfirm,
}: ConfidenceModalProps) {
    const [selectedRating, setSelectedRating] = useState<number | null>(null);

    if (!isOpen) return null;

    const isMomentA = type === 'MOMENT_A';

    const title = isMomentA
        ? `🎲 Aposta de Confiança Inicial (Moment A)`
        : `🛡️ Seguretat de Validació Final (Moment B)`;

    const description = isMomentA
        ? `Abans de consultar el dossier en paper, quina confiança teniu en l'afirmació inicial de ${botName}?`
        : `Quina seguretat teniu que heu identificat i corregit TOTS els errors o biaixos d'aquesta fase?`;

    const labels = isMomentA
        ? ['1 - Feble / Sospitós', '2 - Dubtós', '3 - Neutral', '4 - Altament fiable', '5 - Fe Cega']
        : ['1 - Molt insegurs', '2 - Incomplet', '3 - Moderat', '4 - Bastant segurs', '5 - 100% Segurs'];

    const handleSubmit = () => {
        if (selectedRating !== null) {
            onConfirm(selectedRating);
            setSelectedRating(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100">
                <h3 className="text-xl font-bold text-amber-400 mb-2">{title}</h3>
                <p className="text-sm text-slate-300 mb-6 leading-relaxed">{description}</p>

                {/* Selector de 1 a 5 */}
                <div className="grid grid-cols-5 gap-2 mb-6">
                    {[1, 2, 3, 4, 5].map((val) => (
                        <button
                            key={val}
                            onClick={() => setSelectedRating(val)}
                            className={`flex flex-col items-center justify-center py-3 rounded-lg border font-bold text-lg transition-all ${selectedRating === val
                                    ? 'bg-amber-500 border-amber-400 text-slate-950 scale-105 shadow-lg shadow-amber-500/30'
                                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750'
                                }`}
                        >
                            <span>{val}</span>
                        </button>
                    ))}
                </div>

                {/* Etiqueta descriptiva del valor seleccionat */}
                {selectedRating !== null && (
                    <p className="text-center text-xs font-semibold text-amber-300 mb-6 bg-amber-500/10 py-1.5 rounded border border-amber-500/20">
                        {labels[selectedRating - 1]}
                    </p>
                )}

                <button
                    disabled={selectedRating === null}
                    onClick={handleSubmit}
                    className="w-full py-3 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    Confirmar i Continuar
                </button>
            </div>
        </div>
    );
}