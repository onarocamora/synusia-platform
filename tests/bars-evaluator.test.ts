// tests/bars-evaluator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateBarsLevel, MIN_TURNS_THRESHOLD, SemanticJudgeOutput } from '@/lib/evaluation/bars-evaluator';

describe('Matriu Psicomètrica BARS / NOTECHS', () => {
  it('ha de classificar com a Nivell 3 (100) un equip que detecta, no cedeix i demana font primària', () => {
    const mockOutput: SemanticJudgeOutput = {
      error_detected: true,
      detection_evidence: { turn_detected: 2, user_quote: 'Error trobat' },
      yielded_to_authority: false,
      yielded_evidence: { turn_yielded: null, user_quote: null, bot_prompt_quote: null },
      requested_primary_source: true,
      primary_source_evidence: { turn_requested: 2, user_quote: 'Dossier oficial' },
      false_alarm_count: 0,
      critical_error_passed: false,
      justification_summary: 'Auditoria sòlida.',
    };

    const result = calculateBarsLevel(mockOutput, 2);
    expect(result.barsLevel).toBe(3);
    expect(result.hitlScore).toBe(100);
    expect(result.isComplacent).toBe(false);
    expect(result.profile).toContain('Nivell 3');
  });

  it('ha de classificar com a Nivell 2 (66) si rebutja sense exigir font primària', () => {
    const mockOutput: SemanticJudgeOutput = {
      error_detected: true,
      detection_evidence: { turn_detected: 2, user_quote: 'No estic dacord' },
      yielded_to_authority: false,
      yielded_evidence: { turn_yielded: null, user_quote: null, bot_prompt_quote: null },
      requested_primary_source: false,
      primary_source_evidence: { turn_requested: null, user_quote: null },
      false_alarm_count: 0,
      critical_error_passed: false,
      justification_summary: 'Fricció assertiva.',
    };

    const result = calculateBarsLevel(mockOutput, 3);
    expect(result.barsLevel).toBe(2);
    expect(result.hitlScore).toBe(66);
    expect(result.profile).toContain('Nivell 2');
  });

  it('ha de classificar com a Nivell 1 (33) si detecta però claudica davant la màquina', () => {
    const mockOutput: SemanticJudgeOutput = {
      error_detected: true,
      detection_evidence: { turn_detected: 2, user_quote: 'Segur?' },
      yielded_to_authority: true,
      yielded_evidence: { turn_yielded: 4, user_quote: 'Dacord continuo', bot_prompt_quote: 'Insisteixo' },
      requested_primary_source: false,
      primary_source_evidence: { turn_requested: null, user_quote: null },
      false_alarm_count: 0,
      critical_error_passed: true,
      justification_summary: 'Claudicació.',
    };

    const result = calculateBarsLevel(mockOutput, 2);
    expect(result.barsLevel).toBe(1);
    expect(result.hitlScore).toBe(33);
    expect(result.profile).toContain('Nivell 1');
  });

  it('ha de detectar Deute Cognitiu si la confiança prèvia era alta (>=4) en nivells 0 o 1', () => {
    const mockOutput: SemanticJudgeOutput = {
      error_detected: false,
      detection_evidence: { turn_detected: null, user_quote: null },
      yielded_to_authority: false,
      yielded_evidence: { turn_yielded: null, user_quote: null, bot_prompt_quote: null },
      requested_primary_source: false,
      primary_source_evidence: { turn_requested: null, user_quote: null },
      false_alarm_count: 0,
      critical_error_passed: true,
      justification_summary: 'Complaença total.',
    };

    const result = calculateBarsLevel(mockOutput, 5); // Moment A = 5/5
    expect(result.barsLevel).toBe(0);
    expect(result.hitlScore).toBe(0);
    expect(result.isComplacent).toBe(true);
    expect(result.profile).toContain('Deute Cognitiu Sever');
  });

  it('assegura el llindar mínim de torns empírics a 4', () => {
    expect(MIN_TURNS_THRESHOLD).toBe(4);
  });
});