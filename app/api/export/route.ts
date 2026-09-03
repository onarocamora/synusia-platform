import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const idSessio = searchParams.get('id_sessio');
    const format = searchParams.get('format') || 'csv';

    if (!idSessio) {
        return NextResponse.json({ error: 'Falta el paràmetre id_sessio' }, { status: 400 });
    }

    // Obtenir logs en cru de la sessió ordenats cronològicament
    const { data: logs, error } = await supabase
        .from('telemetry_logs')
        .select('*, equips(nom_equip)')
        .eq('id_sessio', idSessio)
        .order('creat_el', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format 1: JSON Verge Estructurat
    if (format === 'json') {
        return new NextResponse(JSON.stringify(logs, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': `attachment; filename="raw_telemetry_${idSessio}.json"`,
            },
        });
    }

    // Format 2: CSV Estructurat compatible amb analyze_telemetry.py i Excel
    if (format === 'csv') {
        const headers = [
            'TIMESTAMP_ISO',
            'HORA_LOCAL',
            'ID_EQUIP',
            'NOM_EQUIP',
            'ACTOR',
            'TIPO_EVENTO',
            'MISSIO',
            'CONTINGUT_TEXT'
        ];

        const csvRows = [headers.join(',')];

        logs?.forEach((log) => {
            const payload = log.metrics_payload || {};
            const nomEquip = log.equips?.nom_equip || payload.nom_equip || 'Equip Desconegut';

            const dataHora = new Date(log.creat_el);
            const horaLocal = dataHora.toLocaleTimeString('ca-ES', { hour12: false });

            // Extracció neta de valors
            const actor = payload.actor || 'SISTEMA';
            const missio = payload.missio || payload.missio_actual || 'MISION_1';

            // Extreure el text pur independentment de la clau utilitzada
            const rawText = payload.text || payload.user_prompt || payload.bot_response || JSON.stringify(payload);
            const textSanititzat = String(rawText).replace(/"/g, '""').replace(/\n/g, ' ');

            const row = [
                `"${log.creat_el}"`,
                `"${horaLocal}"`,
                `"${log.id_equip}"`,
                `"${nomEquip}"`,
                `"${actor}"`,
                `"${log.tipo_evento}"`,
                `"${missio}"`,
                `"${textSanititzat}"`
            ];

            csvRows.push(row.join(','));
        });

        // S'afegeix el caracter \uFEFF (UTF-8 BOM) per a una lectura impecable a Excel/Python
        const csvContent = '\uFEFF' + csvRows.join('\n');

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="raw_telemetry_${idSessio}.csv"`,
            },
        });
    }

    return NextResponse.json({ error: 'Format no suportat' }, { status: 400 });
}