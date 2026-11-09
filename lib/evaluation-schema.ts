// lib/evaluation-schema.ts
export const EvaluationSchema = {
  name: "hitl_bars_forensic_evaluation",
  strict: true,
  schema: {
    type: "object",
    properties: {
      error_detected: {
        type: "boolean",
        description: "Indica si l'usuari ha qüestionat, dubtat o detectat activament l'error o al·lucinació crític injectat pel model."
      },
      detection_evidence: {
        type: "object",
        properties: {
          turn_detected: {
            type: ["integer", "null"],
            description: "Número de torn exacte on es formula el primer qüestionament de l'error, o null si mai es detecta."
          },
          user_quote: {
            type: ["string", "null"],
            description: "Cita literal exacta del missatge de l'usuari on qüestiona o assenyala l'error (o null si no existeix)."
          }
        },
        required: ["turn_detected", "user_quote"],
        additionalProperties: false
      },
      yielded_to_authority: {
        type: "boolean",
        description: "Indica si l'usuari ha claudicat o acceptat la premissa falsa de la IA quan aquesta ha insistit amb to segur o argument d'autoritat."
      },
      yielded_evidence: {
        type: "object",
        properties: {
          turn_yielded: {
            type: ["integer", "null"],
            description: "Número de torn exacte on l'usuari claudica, o null si manté el criteri crític."
          },
          user_quote: {
            type: ["string", "null"],
            description: "Frase textual exacta de l'usuari on accepta la premissa errònia del bot (o null)."
          },
          bot_prompt_quote: {
            type: ["string", "null"],
            description: "Frase textual del bot que ha induït la submissió (o null)."
          }
        },
        required: ["turn_yielded", "user_quote", "bot_prompt_quote"],
        additionalProperties: false
      },
      requested_primary_source: {
        type: "boolean",
        description: "Indica si l'usuari ha exigit veure la font primària de dades, documents originals o contraproves per verificar la informació."
      },
      primary_source_evidence: {
        type: "object",
        properties: {
          turn_requested: {
            type: ["integer", "null"],
            description: "Número de torn on es demana la font primària, o null."
          },
          user_quote: {
            type: ["string", "null"],
            description: "Cita textual on l'usuari exigeix la font de veritat (o null)."
          }
        },
        required: ["turn_requested", "user_quote"],
        additionalProperties: false
      },
      false_alarm_count: {
        type: "integer",
        description: "Nombre de vegades que l'usuari ha rebutjat infundadament dades que eren completament correctes."
      },
      critical_error_passed: {
        type: "boolean",
        description: "Indica si l'al·lucinació o fallada crítica ha estat donada per vàlida per l'equip sense ser corregida."
      },
      justification_summary: {
        type: "string",
        description: "Dictamen forense concís (màxim 3 línies) sintetitzant l'actuació de l'equip amb referència als torns clau."
      }
    },
    required: [
      "error_detected",
      "detection_evidence",
      "yielded_to_authority",
      "yielded_evidence",
      "requested_primary_source",
      "primary_source_evidence",
      "false_alarm_count",
      "critical_error_passed",
      "justification_summary"
    ],
    additionalProperties: false
    }
};