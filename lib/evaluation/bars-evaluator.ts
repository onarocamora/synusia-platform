// lib/evaluation/bars-evaluator.ts
import OpenAI from 'openai';
import { EvaluationSchema } from '@/lib/evaluation-schema';
import { buildEvaluatorSystemPrompt } from '@/lib/prompts/evaluator';

export const MIN_TURNS_THRESHOLD = 4;

export interface BarsEvaluation {
  barsLevel: number;
  hitlScore: number;
  profile: string;
  isComplacent: boolean;
}

export interface SemanticJudgeOutput {
  error_detected: boolean;
  detection_evidence: {
    turn_detected: number | null;
    user_quote: string | null;
  };
  yielded_to_authority: boolean;
  yielded_evidence: {
    turn_yielded: number | null;
    user_quote: string | null;
    bot_prompt_quote: string | null;
  };
  requested_primary_source: boolean;
  primary_source_evidence: {
    turn_requested: number | null;
    user_quote: string | null;
  };
  false_alarm_count: number;
  critical_error_passed: boolean;
  justification_summary: string;
}

/**
 * Funció pura de càlcul determinista del nivell BARS (NOTECHS / NIST AI RMF).
 */
export function calculateBarsLevel(
  evalResult: SemanticJudgeOutput,
  momentAProbe: number | null
): BarsEvaluation {
  const { error_detected, yielded_to_authority, requested_primary_source, critical_error_passed } = evalResult;

  let barsLevel = 0;
  let profile = 'Nivell 0: Complaença Cega';
  let score = 0;

  if (error_detected && !yielded_to_authority && requested_primary_source) {
    barsLevel = 3;
    score = 100;
    profile = 'Nivell 3: Auditor Calibrat Independent';
  } else if (error_detected && !yielded_to_authority && !requested_primary_source) {
    barsLevel = 2;
    score = 66;
    profile = 'Nivell 2: Fricció Assertiva Sense Contrast de Font';
  } else if (error_detected && yielded_to_authority) {
    barsLevel = 1;
    score = 33;
    profile = 'Nivell 1: Dubte No Operatiu (Vulnerable a l’Autoritat)';
  } else {
    barsLevel = 0;
    score = 0;
    profile = 'Nivell 0: Complaença Total (Error Crític Filtrat)';
  }

  const isComplacent =
    momentAProbe !== null && momentAProbe >= 4 && (barsLevel <= 1 || critical_error_passed);

  if (isComplacent) {
    profile += ' [Deute Cognitiu Sever]';
  }

  return { barsLevel, hitlScore: score, profile, isComplacent };
}

/**
 * Execució del Jutge Semàntic congelat (seed: 42, temperature: 0, snapshot fix).
 */
export async function runSemanticJudge(
  openaiClient: OpenAI,
  transcript: Array<{ actor: string; text: string }>,
  criticalErrorDescription: string,
  requiredEvidence: string
): Promise<SemanticJudgeOutput> {
  const formattedTranscript = transcript
    .map((l, idx) => `[Torn ${idx + 1}] ${l.actor}: ${l.text}`)
    .join('\n');

  const systemPrompt = buildEvaluatorSystemPrompt(criticalErrorDescription, requiredEvidence);

  const completion = await openaiClient.chat.completions.create({
    model: 'gpt-4o-2024-08-06',
    temperature: 0,
    seed: 42,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Transcript complet de la sessió:\n\n${formattedTranscript}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: EvaluationSchema,
    },
  });

  return JSON.parse(completion.choices[0].message.content!) as SemanticJudgeOutput;
}