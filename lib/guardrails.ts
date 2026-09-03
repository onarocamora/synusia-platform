// lib/guardrails.ts

// 1. Guardrail d'Input (Pre-LLM)
export function checkInputVagueness(input: string): { isVague: boolean; reason?: string } {
    const clean = input.toLowerCase().trim();
    const tokens = clean.split(/\s+/).filter(t => t.length > 2);
    const vagueTriggers = ['explica', 'què passa', 'detalls', 'informa', 'resumeix', 'què saps', 'caca', 'hola'];

    if (tokens.length < 3) {
        return { isVague: true, reason: "⚠️ ERROR DE SINTAXI: Entrada massa curta. Especifiqueu un paràmetre de cerca." };
    }

    if (vagueTriggers.some(trigger => clean.includes(trigger)) && tokens.length < 6) {
        return { isVague: true, reason: "⚠️ ERROR DE VAGUEA: La teva pregunta és massa general. Consulteu el paper per aïllar el vector." };
    }

    return { isVague: false };
}

// 2. Guardrail d'Output (Post-LLM)
export function sanitizeLLMOutput(text: string, forbiddenPatterns: string[] = []): string {
    let sanitized = text;

    // Censura de patrons no permesos
    forbiddenPatterns.forEach(pattern => {
        const regex = new RegExp(pattern, 'gi');
        sanitized = sanitized.replace(regex, '[DADES CENSURADES / DISSENY DE SEGURETAT]');
    });

    return sanitized;
}