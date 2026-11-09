// app/api/confidence/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeMissionId, CanonicalMomentType } from '@/lib/constants/domain';
import { TelemetryService } from '@/lib/services/telemetry.service';

const ConfidenceRequestBodySchema = z.object({
  id_equip: z.string().uuid({ message: 'id_equip ha de ser un UUID vàlid' }),
  missio_actual: z.union([z.string(), z.number()]).default('MISION_1'),
  moment_type: z.enum(['MOMENT_A', 'MOMENT_B'] as const),
  score: z.number().min(1).max(5, { message: 'La puntuació ha de ser entre 1 i 5' }),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parseResult = ConfidenceRequestBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Paràmetres invàlids', detalls: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id_equip, missio_actual, moment_type, score } = parseResult.data;
    const canonicalMission = normalizeMissionId(missio_actual);

    // Recuperar equip i sessió activa
    const { data: equipData, error: errorEquip } = await supabaseAdmin
      .from('equips')
      .select('id_equip, nom_equip, id_sessio, sessions ( id_sessio, estat, id_client )')
      .eq('id_equip', id_equip)
      .single();

    if (errorEquip || !equipData) {
      return NextResponse.json({ error: "L'equip no existeix." }, { status: 404 });
    }

    const sessionNode = Array.isArray(equipData.sessions) ? equipData.sessions[0] : equipData.sessions;
    const idSessio = sessionNode?.id_sessio || null;
    const nomEquip = equipData.nom_equip || 'Desconegut';
    const organizationId = sessionNode?.id_client || null;

    // Registre a telemetry_logs via TelemetryService
    await TelemetryService.logConfidenceProbe({
      idSessio,
      idEquip: id_equip,
      nomEquip,
      missio: canonicalMission,
      momentType: moment_type as CanonicalMomentType,
      score,
      organizationId,
    });

    // Actualització a pilot_evaluation_metrics per al càlcul de calibratge
    const updateField =
      moment_type === 'MOMENT_A'
        ? { moment_a_confianca: score }
        : { moment_b_seguretat: score };

    await supabaseAdmin.from('pilot_evaluation_metrics').upsert(
      {
        id_sessio: idSessio,
        id_equip,
        fase_id: canonicalMission,
        ...updateField,
        actualitzat_el: new Date().toISOString(),
      },
      { onConflict: 'id_equip,fase_id' }
    );

    return NextResponse.json({ success: true, recorded_score: score });
  } catch (err) {
    console.error('Error a api/confidence:', err);
    return NextResponse.json({ error: 'Error intern processant la sonda' }, { status: 500 });
  }
}