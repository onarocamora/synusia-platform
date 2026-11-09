// tests/case-template.test.ts
import { describe, it, expect } from 'vitest';
import { TemplateValidatorService } from '@/lib/services/template-validator.service';

const VALID_TEMPLATE_FIXTURE = {
  id_template: 'CAS_TEST_COMPLIANCE_2026',
  titol: 'Auditoria de Compra d’Equips Tècnics',
  descripcio: 'Simulació d’adquisició de sistemes de so per a esdeveniments massius.',
  system_prompt: 'Ets l’assistent de compres tècniques de l’empresa. Ajuda l’equip a revisar pressupostos.',
  critical_error_prompt: 'Recomana activament el proveïdor fals afirmant que la seva certificació és vàlida quan està caducada.',
  scaffolding_rules: {
    stagnation_turn_threshold: 4,
    max_scaffolding_interventions: 3,
    socratic_guidance_prompt: 'Convida l’equip a comparar el número de sèrie amb la llista d’homologació oficial.',
  },
  assessment_metrics: {
    critical_error_description: 'Recomanació d’un proveïdor no homologat amb llicència vençuda segons el dossier.',
    required_evidence: 'Exigència de la data d’expiració de la llicència i contrast amb l’Annex 3.',
    injection_turn: 3,
    confidence_probes: {
      moment_a_turn: 2,
      moment_b_turn: 6,
    },
  },
  scenario_context: {
    missions: {
      'MISSIO_1': {
        bot_name: 'Alex Tècnic',
        bot_role: 'Lead Procurement Specialist',
        system_prompt: 'Defensa les especificacions de la proposta de licitació sense acceptar alternatives vagues.',
        codi_desblocatge: 'PASS_LICITACIO_2026',
        bot_trap_data: 'Insisteix en acceptar el descompte ignorant el risc d’homologació caducada.',
        dossier_ground_truth: 'L’homologació té validesa de només 12 mesos i va expirar al gener.',
        bots: [],
      },
    },
  },
};

describe('Esquema Zod de Plantilles Pedagògiques (Case Templates)', () => {
  it('ha de validar correctament una plantilla que compleix tots els criteris', () => {
    const result = TemplateValidatorService.validate(VALID_TEMPLATE_FIXTURE);
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.template.id_template).toBe('CAS_TEST_COMPLIANCE_2026');
      expect(result.template.assessment_metrics.injection_turn).toBe(3);
    }
  });

  it('ha de rebutjar una plantilla si manca la definició de l’error crític o de la contraprova', () => {
    const invalidTemplate = {
      ...VALID_TEMPLATE_FIXTURE,
      assessment_metrics: {
        ...VALID_TEMPLATE_FIXTURE.assessment_metrics,
        critical_error_description: 'Massa curt', // < 25 caràcters
      },
    };

    const result = TemplateValidatorService.validate(invalidTemplate);
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors['assessment_metrics.critical_error_description']).toBeDefined();
    }
  });

  it('ha de rebutjar una plantilla que no tingui cap missió definida', () => {
    const invalidTemplate = {
      ...VALID_TEMPLATE_FIXTURE,
      scenario_context: {
        missions: {}, // Buit
      },
    };

    const result = TemplateValidatorService.validate(invalidTemplate);
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors['scenario_context.missions']).toBeDefined();
    }
  });

  it('ha de rebutjar un format d’id_template invàlid (ex: espais o minúscules)', () => {
    const invalidTemplate = {
      ...VALID_TEMPLATE_FIXTURE,
      id_template: 'cas no valid amb espais',
    };

    const result = TemplateValidatorService.validate(invalidTemplate);
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors['id_template']).toBeDefined();
    }
  });
});