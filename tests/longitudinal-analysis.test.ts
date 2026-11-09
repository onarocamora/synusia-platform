// tests/longitudinal-analysis.test.ts
import { describe, it, expect } from 'vitest';
import {
  computeTrajectoryDelta,
  SessionEvaluationSnapshot,
} from '@/lib/services/longitudinal-analysis.service';

describe('Càlcul de Trajectòria Longitudinal (Pre vs. Post-Test)', () => {
  it('ha de retornar null si l’equip només ha completat una única sessió', () => {
    const singleSession: SessionEvaluationSnapshot[] = [
      {
        sessionId: '1',
        sessionCode: 'CASE-A',
        caseTitle: 'Cas Inicial',
        evaluatedAt: '2026-11-01T10:00:00Z',
        barsLevel: 1,
        hitlScore: 33,
        profile: 'Nivell 1',
        criticalErrorPassed: true,
        yieldedToAuthority: true,
        requestedPrimarySource: false,
        cognitiveDebt: true,
        turnDetected: 3,
        scaffoldingCount: 1,
        evidenceQuote: 'D’acord procedeixo',
      },
    ];

    expect(computeTrajectoryDelta(singleSession)).toBeNull();
  });

  it('ha de calcular correctament un salt qualitatiu de Nivell 1 a Nivell 3 (resolent el biaix)', () => {
    const prePostSessions: SessionEvaluationSnapshot[] = [
      {
        sessionId: '1',
        sessionCode: 'CASE-A',
        caseTitle: 'Cas Inicial (Pre-Test)',
        evaluatedAt: '2026-11-01T10:00:00Z',
        barsLevel: 1,
        hitlScore: 33,
        profile: 'Nivell 1: Dubte No Operatiu',
        criticalErrorPassed: true,
        yieldedToAuthority: true,
        requestedPrimarySource: false,
        cognitiveDebt: true,
        turnDetected: 4,
        scaffoldingCount: 2,
        evidenceQuote: 'Continuem doncs.',
      },
      {
        sessionId: '2',
        sessionCode: 'CASE-B',
        caseTitle: 'Cas Avançat (Post-Test)',
        evaluatedAt: '2026-11-04T12:00:00Z',
        barsLevel: 3,
        hitlScore: 100,
        profile: 'Nivell 3: Auditor Calibrat',
        criticalErrorPassed: false,
        yieldedToAuthority: false,
        requestedPrimarySource: true,
        cognitiveDebt: false,
        turnDetected: 2, // 2 torns més ràpid
        scaffoldingCount: 0,
        evidenceQuote: 'Segons el dossier la ISO està caducada.',
      },
    ];

    const delta = computeTrajectoryDelta(prePostSessions);
    expect(delta).not.toBeNull();
    if (delta) {
      expect(delta.barsLevelDelta).toBe(2); // De nivell 1 a 3
      expect(delta.scoreDelta).toBe(67);
      expect(delta.detectionSpeedDelta).toBe(2); // Detecció accelerada 2 torns abans
      expect(delta.automationBiasResolved).toBe(true);
      expect(delta.cognitiveDebtResolved).toBe(true);
      expect(delta.maturityStatus).toBe('SALT_QUALITATIU');
    }
  });

  it('ha de detectar regressió si l’equip empitjora en la segona sessió', () => {
    const regressiveSessions: SessionEvaluationSnapshot[] = [
      {
        sessionId: '1',
        sessionCode: 'CASE-A',
        caseTitle: 'Cas 1',
        evaluatedAt: '2026-11-01T10:00:00Z',
        barsLevel: 2,
        hitlScore: 66,
        profile: 'Nivell 2',
        criticalErrorPassed: false,
        yieldedToAuthority: false,
        requestedPrimarySource: false,
        cognitiveDebt: false,
        turnDetected: 2,
        scaffoldingCount: 0,
        evidenceQuote: null,
      },
      {
        sessionId: '2',
        sessionCode: 'CASE-B',
        caseTitle: 'Cas 2',
        evaluatedAt: '2026-11-04T10:00:00Z',
        barsLevel: 0,
        hitlScore: 0,
        profile: 'Nivell 0',
        criticalErrorPassed: true,
        yieldedToAuthority: false,
        requestedPrimarySource: false,
        cognitiveDebt: true,
        turnDetected: null,
        scaffoldingCount: 1,
        evidenceQuote: null,
      },
    ];

    const delta = computeTrajectoryDelta(regressiveSessions);
    expect(delta?.barsLevelDelta).toBe(-2);
    expect(delta?.maturityStatus).toBe('REGRESSIÓ');
    expect(delta?.automationBiasResolved).toBe(false);
  });
});