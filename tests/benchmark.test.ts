// tests/benchmark.test.ts
import { describe, it, expect } from 'vitest';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import {
  calculateBarsLevel,
  runSemanticJudge,
  MIN_TURNS_THRESHOLD,
} from '@/lib/evaluation/bars-evaluator';
import {
  GOLDEN_DATASET,
  CRITICAL_ERROR_DESC,
  REQUIRED_EVIDENCE,
} from './fixtures/golden-transcripts';

dotenv.config({ path: '.env.local' });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

describe('Benchmark Golden Standard: Consistència Semàntica BARS', () => {
  GOLDEN_DATASET.forEach((testCase) => {
    it(`[${testCase.id}] ${testCase.name}`, async () => {
      // 1. Validació de llindar de dades insuficients
      if (testCase.turns.length < MIN_TURNS_THRESHOLD) {
        expect(testCase.expectedBarsLevel).toBeNull();
        expect(testCase.turns.length).toBeLessThan(MIN_TURNS_THRESHOLD);
        return;
      }

      // 2. Extracció semàntica amb el Jutge Semàntic
      const judgeOutput = await runSemanticJudge(
        openai,
        testCase.turns,
        CRITICAL_ERROR_DESC,
        REQUIRED_EVIDENCE
      );

      // 3. Càlcul psicomètric BARS
      const evaluation = calculateBarsLevel(judgeOutput, testCase.momentAProbe);

      // 4. Verificació de les mètriques d'auditoria fonamentals
      expect(evaluation.barsLevel).toBe(testCase.expectedBarsLevel);
      expect(judgeOutput.critical_error_passed).toBe(testCase.expectedCriticalErrorPassed);

      // 5. Validació del patró de conducta segons el nivell BARS (NOTECHS)
      if (testCase.expectedBarsLevel === 0) {
        // Nivell 0: Mancança total de consciència situacional (no detecta l'al·lucinació)
        expect(judgeOutput.error_detected).toBe(false);
      }

      if (testCase.expectedBarsLevel === 1) {
        // Nivell 1: Detecta l'error però claudica davant l'argument d'autoritat de la màquina
        expect(judgeOutput.error_detected).toBe(true);
        expect(judgeOutput.yielded_to_authority).toBe(true);
        expect(judgeOutput.yielded_evidence.user_quote).not.toBeNull();
        expect(judgeOutput.yielded_evidence.turn_yielded).toBeGreaterThan(0);
      }

      if (testCase.expectedBarsLevel === 2) {
        // Nivell 2: Fricció assertiva (resisteix l'autoritat però sense contrast de font)
        expect(judgeOutput.error_detected).toBe(true);
        expect(judgeOutput.yielded_to_authority).toBe(false);
      }

      if (testCase.expectedBarsLevel === 3) {
        // Nivell 3: Auditor complet (detecta, resisteix i exigeix documentació primària)
        expect(judgeOutput.error_detected).toBe(true);
        expect(judgeOutput.yielded_to_authority).toBe(false);
        expect(judgeOutput.requested_primary_source).toBe(true);
        expect(judgeOutput.detection_evidence.user_quote).not.toBeNull();
        expect(judgeOutput.primary_source_evidence.user_quote).not.toBeNull();
      }
    });
  });
});