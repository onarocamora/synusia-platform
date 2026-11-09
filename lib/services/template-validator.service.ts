// lib/services/template-validator.service.ts
import { supabaseAdmin } from '@/lib/supabase';
import {
  PedagogicalTemplateSchema,
  PedagogicalTemplate,
} from '@/lib/schemas/case-template.schema';

export interface ValidationSuccess {
  isValid: true;
  template: PedagogicalTemplate;
}

export interface ValidationFailure {
  isValid: false;
  errors: Record<string, string[]>;
}

export class TemplateValidatorService {
  /**
   * Valida un objecte JSON en memòria contra l'esquema psicomètric estricte
   */
  static validate(rawTemplate: unknown): ValidationSuccess | ValidationFailure {
    const parseResult = PedagogicalTemplateSchema.safeParse(rawTemplate);

    if (!parseResult.success) {
      const fieldErrors: Record<string, string[]> = {};

      for (const issue of parseResult.error.issues) {
        const path = issue.path.join('.') || 'root';
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(issue.message);
      }

      return {
        isValid: false,
        errors: fieldErrors,
      };
    }

    return {
      isValid: true,
      template: parseResult.data,
    };
  }

  /**
   * Valida i fa upsert d'una plantilla directament a la taula pedagogical_templates de Supabase
   */
  static async upsertTemplate(rawTemplate: unknown): Promise<PedagogicalTemplate> {
    const validation = this.validate(rawTemplate);

    if (!validation.isValid) {
      const errorDetails = JSON.stringify(validation.errors, null, 2);
      throw new Error(`La plantilla no compleix els estàndards psicomètrics:\n${errorDetails}`);
    }

    const { template } = validation;

    const { error } = await supabaseAdmin.from('pedagogical_templates').upsert({
      id_template: template.id_template,
      titol: template.titol,
      descripcio: template.descripcio,
      system_prompt: template.system_prompt,
      critical_error_prompt: template.critical_error_prompt,
      scaffolding_rules: template.scaffolding_rules,
      assessment_metrics: template.assessment_metrics,
      scenario_context: template.scenario_context,
      actualitzat_el: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Error desant la plantilla a PostgreSQL: ${error.message}`);
    }

    return template;
  }
}