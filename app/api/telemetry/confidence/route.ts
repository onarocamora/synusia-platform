// app/api/telemetry/confidence/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ConfidencePayloadSchema } from '@/lib/schemas/telemetry.schema';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));

    // 1. Validació estricta i normalització automàtica de la missió a MISION_X
    const parseResult = ConfidencePayloadSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Dades de confiança invàlides', detalls: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      id_sessio,
      id_equip,
      missio_actual, // Ja normalitzat canònicament ('MISION_1', 'MISION_2', etc.)
      moment_a_confianca,
      moment_b_seguretat,
      prompts_enviats,
      timestamp,
    } = parseResult.data;

    // 2. Recuperació del nom de l'equip
    const { data: equip } = await supabaseAdmin
      .from('equips')
      .select('nom_equip')
      .eq('id_equip', id_equip)
      .maybeSingle();

    const nomEquip = equip?.nom_equip || 'Desconegut';
    const nowIso = timestamp || new Date().toISOString();

    // 3. Escriptura concurrent en paral·lel per reduir la latència
    await Promise.all([
      // A. telemetria mare (registre d'auditoria que nodreix la recerca)
      supabaseAdmin.from('telemetry_logs').insert([
        {
          id_sessio: id_sessio || null,
          id_equip: id_equip,
          tipo_evento: 'CONFIDENCE_PROBE',
          metrics_payload: {
            actor: 'OPERATOR',
            nom_equip: nomEquip,
            missio: missio_actual,
            moment_a_confidence: moment_a_confianca,
            moment_b_certainty: moment_b_seguretat,
            prompts_count: prompts_enviats,
            timestamp: nowIso,
          },
        },
      ]),

      // B. Taula agregada per al pilot
      supabaseAdmin.from('pilot_evaluation_metrics').upsert(
        {
          id_sessio: id_sessio || null,
          id_equip: id_equip,
          fase_id: missio_actual,
          moment_a_confianca: moment_a_confianca,
          moment_b_seguretat: moment_b_seguretat,
          prompts_enviats: prompts_enviats,
          completat_el: nowIso,
        },
        { onConflict: 'id_equip,fase_id' }
      ),

      // C. Estat de fase a phase_analytics
      supabaseAdmin
        .from('phase_analytics')
        .update({
          moment_a_confidence: moment_a_confianca,
          moment_b_certainty: moment_b_seguretat,
          actualitzat_el: nowIso,
        })
        .eq('id_equip', id_equip)
        .eq('id_missio', missio_actual),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error a telemetry/confidence:', err);
    return NextResponse.json({ error: err.message || 'Error intern' }, { status: 500 });
  }
}