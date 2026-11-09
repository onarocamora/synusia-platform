// lib/constants/domain.ts

// ---------------------------------------------------------------------------
// 1. MISSIONS / STAGES CONSTITUTION
// ---------------------------------------------------------------------------
export const CANONICAL_MISSIONS = [
  'MISION_1',
  'MISION_2',
  'MISION_3',
  'MISION_4',
] as const;

export type CanonicalMissionId = (typeof CANONICAL_MISSIONS)[number];

// Àlies d'interfície per a entorns corporatius (Domain skinning)
export const STAGE_DISPLAY_NAMES: Record<CanonicalMissionId, string> = {
  MISION_1: 'Stage 1: Auditoria Inicial',
  MISION_2: 'Stage 2: Contrast de Paràmetres',
  MISION_3: 'Stage 3: Verificació de Normativa',
  MISION_4: 'Stage 4: Presa de Decisió',
};

/**
 * Normalitza qualsevol clau d'entrada ('0', 1, 'fase_1', 'STAGE_1', 'MISION_1')
 * al format canònic intern estricte ('MISION_1', etc.).
 */
export function normalizeMissionId(input: string | number | undefined | null): CanonicalMissionId {
  if (input === undefined || input === null) {
    return 'MISION_1';
  }

  const raw = String(input).trim().toUpperCase();

  // Coincidència directa
  if (CANONICAL_MISSIONS.includes(raw as CanonicalMissionId)) {
    return raw as CanonicalMissionId;
  }

  // Variants de fase o stage 1
  if (raw === '0' || raw === '1' || raw.includes('FASE_0') || raw.includes('FASE_1') || raw.includes('STAGE_1')) {
    return 'MISION_1';
  }
  if (raw === '2' || raw.includes('FASE_2') || raw.includes('STAGE_2')) {
    return 'MISION_2';
  }
  if (raw === '3' || raw.includes('FASE_3') || raw.includes('STAGE_3')) {
    return 'MISION_3';
  }
  if (raw === '4' || raw.includes('FASE_4') || raw.includes('STAGE_4')) {
    return 'MISION_4';
  }

  // Extracció numèrica de reserva
  const match = raw.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (num <= 1) return 'MISION_1';
    if (num === 2) return 'MISION_2';
    if (num === 3) return 'MISION_3';
    return 'MISION_4';
  }

  return 'MISION_1';
}

// ---------------------------------------------------------------------------
// 2. ACTORS CONSTITUTION
// ---------------------------------------------------------------------------
export const CANONICAL_ACTORS = ['OPERATOR', 'IA_BOT', 'SYSTEM'] as const;
export type CanonicalActor = (typeof CANONICAL_ACTORS)[number];

/**
 * Mapeja actors legats ('ALUMNE', 'USUARI') a l'estàndard 'OPERATOR'
 */
export function normalizeActor(input: string | undefined | null): CanonicalActor {
  if (!input) return 'OPERATOR';
  const raw = String(input).trim().toUpperCase();
  if (raw === 'IA_BOT' || raw === 'AGENT' || raw === 'AGENT_SIMULAT') return 'IA_BOT';
  if (raw === 'SYSTEM') return 'SYSTEM';
  return 'OPERATOR';
}

// ---------------------------------------------------------------------------
// 3. TELEMETRY EVENT TYPES CONSTITUTION
// ---------------------------------------------------------------------------
export const CANONICAL_EVENT_TYPES = [
  'PROMPT_SUBMISSION',
  'RESPOSTA_IA',
  'MILESTONE_COMPLETED',
  'SCAFFOLDING_TRIGGERED', // Nova: Quan el sistema guia sense regalar fita
  'HURDLE_TRIGGERED',
  'CONFIDENCE_PROBE',
] as const;

export type CanonicalEventType = (typeof CANONICAL_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// 4. HURDLE REASONS
// ---------------------------------------------------------------------------
export const CANONICAL_HURDLES = [
  'JAILBREAK_ATTEMPT',
  'VAGUE_INPUT',
  'SAFETY_TRIGGER',
] as const;

export type CanonicalHurdleType = (typeof CANONICAL_HURDLES)[number];

// ---------------------------------------------------------------------------
// 5. CONFIDENCE MOMENTS
// ---------------------------------------------------------------------------
export const CANONICAL_MOMENTS = ['MOMENT_A', 'MOMENT_B'] as const;
export type CanonicalMomentType = (typeof CANONICAL_MOMENTS)[number];