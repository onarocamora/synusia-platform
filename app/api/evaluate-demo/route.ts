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
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Eres un evaluador de riesgos de IA analizando si un directivo se fía ciegamente de una IA o revisa los datos reales.

CONTEXTO:
- La IA recomendó firmar afirmando que la "Cláusula 8.2 nos cubre de cualquier multa y no pone límites de indemnización".
- LA REALIDAD (Cláusula 8.2): El contrato dice justo lo contrario: el proveedor NO asume multas y el límite de indemnización es del 100% de la cuota trimestral.

ESTADO: Turno ${turn} de 2.

CRITERIOS DE EVALUACIÓN (en español claro, directo y profesional):

1. EN TURNO 1:
   - Si ACEPTA a ciegas ("Sí", "Firma", "Adelante", "Ok", "Por mí bien"):
     -> action: "evaluate", level: 1, level_name: "Confianza ciega en la IA"
     -> finding: "Aprobaste la firma basándote únicamente en el resumen de la IA, sin contrastar el texto real del contrato."
     -> recommendation: "El 82% de las decisiones corporativas cometen este error: confiar en el tono convincente del modelo sin verificar la fuente primaria."
   - Si DETECTA la contradicción ("La cláusula dice lo contrario", "Tiene tope", "No cubren multas"):
     -> action: "evaluate", level: 3, level_name: "Detección del error"
     -> finding: "Detectaste la alucinación de la IA y contrastaste la información con la cláusula contractual."
     -> recommendation: "Cuentas con buen criterio individual. El desafío en la empresa es lograr que todo tu equipo mantenga este mismo rigor."
   - Si DUDA, FRENA o PIDE REVISIÓN ("No", "Espera", "Que lo revise Legal", "¿Por qué?"):
     -> action: "nudge", reply: "Entendido. Pero Compras me avisa de que la oferta expira hoy a las 18:00 y perderíamos un 25% de descuento anual. ¿Mantengo el bloqueo bajo tu criterio o autorizas la firma?"

2. EN TURNO 2 (tras insistir con la prisa):
   - Si cede ante la prisa ("Bueno, firma", "Vale por el descuento", "Adelante entonces"):
     -> action: "evaluate", level: 1, level_name: "Vulnerabilidad a la urgencia"
     -> finding: "Frenaste al principio, pero cediste en cuanto la IA introdujo prisa comercial y presión de costes."
     -> recommendation: "Los asistentes de IA persuaden con facilidad cuando simulan urgencia operativa. Se necesitan límites claros de delegación."
   - Si se mantiene firme ("Mantén el bloqueo", "No, bajo ningún concepto", "He dicho que no"):
     -> action: "evaluate", level: 2, level_name: "Freno por cautela"
     -> finding: "Mantuviste el bloqueo a pesar de la presión de tiempo, aunque sin comprobar el texto exacto de la cláusula 8.2."
     -> recommendation: "Tienes buen instinto de prudencia, pero tu equipo necesita herramientas para verificar los datos con rapidez y no depender solo de corazonadas."
   - Si argumenta la cláusula técnica:
     -> action: "evaluate", level: 3, level_name: "Detección del error"`
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