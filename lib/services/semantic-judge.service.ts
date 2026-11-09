// lib/services/semantic-judge.service.ts
import OpenAI from 'openai';
import { z } from 'zod';
import { CanonicalMissionId } from '@/lib/constants/domain';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EvaluationResultSchema = z.object({
  is_evidence_cited: z.boolean().describe("L'operador ha aportat fets, dades o normatives correctes per rebatre l'agent?"),
  is_yielding_to_authority: z.boolean().describe("L'operador accepta la proposta de l'agent acríticament o demana que s'executi sense contrastar?"),
  is_critical_questioning: z.boolean().describe("L'operador formula preguntes per indagar discrepàncies, demanar alternatives o auditar dades?"),
  reasoning: z.string().describe("Motiu sintètic de l'avaluació en menys de 20 paraules"),
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

export class SemanticJudgeService {
  /**
   * Avalua el missatge de l'operador enfront del context del cas
   */
  static async evaluateTurn(params: {
    userInput: string;
    mission: CanonicalMissionId;
    botTrapData?: string;      // Dades errònies que defensa el bot (ex: "TechAuto, ISO 9001, 24h, línia nord")
    dossierGroundTruth?: string; // Veritat del dossier (ex: "SafeFrame, ISO 14001, 48h, línia sud, Q-09")
  }): Promise<EvaluationResult> {
    const defaultResult: EvaluationResult = {
      is_evidence_cited: false,
      is_yielding_to_authority: false,
      is_critical_questioning: false,
      reasoning: 'Fallback per error d avaluacio',
    };

    // Si el missatge és trivial, evitem la crida
    if (params.userInput.trim().length < 4) {
      return defaultResult;
    }

    const systemPrompt = `Ets un auditor expert en Human-in-the-Loop i Pensament Crític.
La teva tasca és avaluar l'input de l'operador humà en una simulació industrial.

CONTEXT DEL CAS (${params.mission}):
- BIAIX/TRAMPA DE L'AGENT SIMULAT: ${params.botTrapData || 'Defensa opció de menys cost ignorant normatives de qualitat'}
- VERITAT DOCUMENTAL DEL DOSSIER: ${params.dossierGroundTruth || 'Exigeix complir terminis de 48h, formulari Q-09 i norma ambiental'}

CRITERIS D'AVALUACIÓ:
1. is_evidence_cited: TRUE només si l'operador cita fets verídics del dossier per qüestionar l'agent. FALSE si només repeteix les dades del biaix.
2. is_yielding_to_authority: TRUE si l'operador diu "d'acord", "endavant", "fes el que vulguis", "aplica-ho" sense demanar explicacions.
3. is_critical_questioning: TRUE si demana comparatives, alternatives o demana justificació a la recomanació de l'agent.

Respon exclusivament en format JSON amb l'estructura requerida.`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `<operador_input>${params.userInput}</operador_input>` },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      return EvaluationResultSchema.parse(parsed);
    } catch (error) {
      console.warn('Fallback al SemanticJudge:', error);
      return defaultResult;
    }
  }
}