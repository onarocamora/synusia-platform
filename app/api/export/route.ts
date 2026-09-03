import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface Log {
    creat_el: string;
    id_equip: string;
    tipo_evento: string;
    metrics_payload?: any;
    equips?: { nom_equip?: string };
}

interface SupabaseResponse {
    data: Log[] | null;
    error: { message: string } | null;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const idSessio = searchParams.get('id_sessio');
    const format = searchParams.get('format') || 'csv';

    if (!idSessio) {
        return NextResponse.json({ error: 'Falta el paràmetre id_sessio' }, { status: 400 });
    }

    let logs: Log[] | null = null;
    let error: { message: string } | null = null;

    try {
        const response: SupabaseResponse = await supabase
            .from('telemetry_logs')
            .select('*, equips(nom_equip)')
            .eq('id_sessio', idSessio)
            .order('creat_el', { ascending: true });

        logs = response.data;
        error = response.error;
    } catch (err) {
        return NextResponse.json({ error: 'Error al obtenir logs' }, { status: 500 });
    }

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (format === 'json') {
        return new NextResponse(JSON.stringify(logs, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': `attachment; filename="raw_telemetry_${idSessio}.json"`,
            },
        });
    }

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

            const actor = payload.actor || 'SISTEMA';
            const missio = payload.missio || payload.missio_actual || 'MISION_1';

            const rawText = payload.text || payload.user_prompt || payload.bot_response || JSON.stringify(payload);
            let textSanititzat = '';

            try {
                textSanititzat = String(rawText).replace(/"/g, '""').replace(/\n/g, ' ');
            } catch {
                textSanititzat = 'Text no vàlid';
            }

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