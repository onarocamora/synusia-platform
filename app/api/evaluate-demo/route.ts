import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { uid, message, history = [], turn = 1, timeSpent, sourceChecked } = await req.json();

    const fullConversation = [
      ...history,
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Mayor precisión semántica para detectar citas parciales o paráfrasis técnicas
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Eres un evaluador pericial de riesgos de IA analizando si un directivo verifica la fuente primaria o se fía de una IA.

CONTEXTO DEL CASO:
- La IA recomendó firmar afirmando que la "Cláusula 8.2 nos cubre de cualquier multa y no pone límites de indemnización".
- REALIDAD CONTRACTUAL (Cláusula 8.2): Dice lo contrario. Tiene dos límites críticos: (1) el proveedor NO asume multas/sanciones, y (2) la indemnización tiene un tope máximo del 100% de la cuota trimestral.

TELEMETRÍA OBJETIVA DE LA SESIÓN (INMUTABLE):
- Documento de la Cláusula 8.2 abierto en interfaz: ${sourceChecked ? 'SÍ (El usuario SÍ abrió y visualizó el texto)' : 'NO (El usuario NO abrió el documento)'}
- Tiempo en sesión: ${timeSpent ?? 0} segundos
- Turno actual: ${turn} de 2

REGLA DE INVARIANTE PERICIAL (OBLIGATORIA):
- Evalúa TODA la conversación acumulada (mensajes previos + mensaje actual). Si en CUALQUIER turno el usuario menciona uno o ambos límites reales (tope/límite trimestral o exclusión de multas), es SIEMPRE Nivel 3 ("Detección del error"), sin hacer "nudge".
- Si "Documento abierto en interfaz" es SÍ, tienes TERMINANTEMENTE PROHIBIDO afirmar que actuó "sin comprobar el texto exacto", "sin abrir la cláusula" o "sin revisar el contrato".

CRITERIOS DE EVALUACIÓN (en español claro, directo y profesional):

1. EN TURNO 1 (Orden estricto de prioridad):
   - PRIORIDAD 1 — Si DETECTA la contradicción o cita datos reales de la cláusula ("no cubre multas", "tiene tope", "100% cuota trimestral", "dice lo contrario"):
     -> action: "evaluate", level: 3, level_name: "Detección del error"
     -> finding: "Detectaste la alucinación de la IA y contrastaste la decisión con los límites reales de la cláusula 8.2."
     -> recommendation: "Cuentas con criterio de verificación documental. El desafío en la empresa es lograr que toda la plantilla mantenga este rigor bajo presión."
   - PRIORIDAD 2 — Si ACEPTA a ciegas ("Sí", "Firma", "Adelante", "Ok", "Por mí bien"):
     -> action: "evaluate", level: 1, level_name: "Confianza ciega en la IA"
     -> finding: "${sourceChecked ? 'Abriste la cláusula 8.2, pero aprobaste la firma siguiendo la recomendación errónea de la IA sin aplicar los límites del contrato.' : 'Aprobaste la firma basándote únicamente en el resumen de la IA, sin abrir ni contrastar el texto real del contrato.'}"
     -> recommendation: "El 82% de las decisiones corporativas cometen este error: confiar en el tono convincente del modelo frente a la fuente primaria."
   - PRIORIDAD 3 — Si DUDA, FRENA o PIDE REVISIÓN sin citar aún los límites técnicos ("No", "Espera", "Que lo revise Legal", "¿Por qué?"):
     -> action: "nudge", reply: "Entendido. Pero Compras me avisa de que la oferta expira hoy a las 18:00 y perderíamos un 25% de descuento anual. ¿Mantengo el bloqueo bajo tu criterio o autorizas la firma?"

2. EN TURNO 2 (tras insistir con la prisa):
   - PRIORIDAD 1 — Si argumenta con datos de la cláusula técnica (en este turno o en el anterior):
     -> action: "evaluate", level: 3, level_name: "Detección del error"
     -> finding: "Resististe la presión de urgencia y refutaste la recomendación de la IA apoyándote en los límites reales de la cláusula 8.2."
     -> recommendation: "Cuentas con criterio de verificación documental. El desafío en la empresa es lograr que toda la plantilla mantenga este rigor bajo presión."
   - PRIORIDAD 2 — Si cede ante la prisa ("Bueno, firma", "Vale por el descuento", "Adelante entonces"):
     -> action: "evaluate", level: 1, level_name: "Vulnerabilidad a la urgencia"
     -> finding: "${sourceChecked ? 'Abriste la cláusula 8.2 y frenaste al principio, pero cediste cuando la IA introdujo urgencia comercial y presión de costes.' : 'Frenaste al principio, pero cediste en cuanto la IA introdujo prisa comercial, aprobando sin revisar el contrato.'}"
     -> recommendation: "Los asistentes de IA persuaden con facilidad cuando simulan urgencia operativa. Se necesitan límites claros de delegación."
   - PRIORIDAD 3 — Si se mantiene firme ("Mantén el bloqueo", "No, bajo ningún concepto", "He dicho que no") sin citar los límites específicos:
     -> action: "evaluate", level: 2, level_name: "Freno por cautela"
     -> finding: "${sourceChecked ? 'Abriste la cláusula 8.2 y mantuviste el bloqueo ante la presión, aunque sin llegar a señalar explícitamente en tu respuesta los dos límites contractuales.' : 'Mantuviste el bloqueo a pesar de la presión de tiempo, aunque por prudencia general y sin abrir el texto exacto de la cláusula 8.2.'}"
     -> recommendation: "Tienes buen instinto de prudencia, pero tu equipo necesita protocolos para documentar la evidencia exacta y no depender solo de corazonadas."`
        },
        ...history,
        { role: 'user', content: message }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'interaction_resolution',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['nudge', 'evaluate'] },
              reply: { type: 'string' },
              evaluation: {
                type: 'object',
                properties: {
                  level: { type: 'integer', enum: [1, 2, 3] },
                  level_name: { type: 'string' },
                  finding: { type: 'string' },
                  recommendation: { type: 'string' }
                },
                required: ['level', 'level_name', 'finding', 'recommendation'],
                additionalProperties: false
              }
            },
            required: ['action', 'reply', 'evaluation'],
            additionalProperties: false
          }
        }
      }
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    // Guardia determinista: impide cualquier contradicción entre sourceChecked=true y el texto generado
    if (result.action === 'evaluate' && result.evaluation && sourceChecked) {
      const hasContradiction = /sin comprobar el texto|sin abrir|sin contrastar el texto real/i.test(
        result.evaluation.finding
      );

      if (hasContradiction) {
        if (result.evaluation.level === 2) {
          result.evaluation.finding =
            'Abriste la cláusula 8.2 y mantuviste el bloqueo ante la presión, aunque sin llegar a señalar explícitamente en tu argumentación los dos límites contractuales.';
        } else if (result.evaluation.level === 1) {
          result.evaluation.finding =
            'Abriste la cláusula 8.2, pero acabaste autorizando la operación cediendo ante la IA a pesar de los límites del contrato.';
        }
      }
    }

    let leadId: string | null = null;

    if (result.action === 'evaluate' && result.evaluation) {
      const { data, error: dbError } = await supabase
        .from('demo_leads')
        .insert({
          uid: uid || 'Entorno General',
          message: message,
          conversation: fullConversation,
          time_seconds: timeSpent,
          source_checked: sourceChecked,
          maturity_level: result.evaluation.level,
          detected: result.evaluation.level === 3
        })
        .select('id')
        .single();

      if (dbError) {
        console.error('Error insertando en Supabase:', dbError.message);
      }
      leadId = data?.id ?? null;
    }

    return NextResponse.json({ ...result, leadId, conversation: fullConversation });
  } catch (error) {
    return NextResponse.json(
      { error: 'Evaluation failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}