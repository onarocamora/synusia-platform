import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json(
                { error: 'Configuració de Supabase no disponible al servidor.' },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const body = await request.json().catch(() => ({}));
        const { id_sessio, id_equip, missatge_ia, motiu, detall } = body;

        if (!missatge_ia || !motiu) {
            return NextResponse.json(
                { error: 'Falten camps obligatoris per processar el report.' },
                { status: 400 }
            );
        }

        const { error } = await supabase.from('reports_incidencies').insert([
            {
                id_sessio: id_sessio || null,
                id_equip: id_equip || null,
                missatge_ia,
                motiu,
                detall: detall || null,
            },
        ]);

        if (error) {
            console.error('Error inserint report a Supabase:', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error('Crash a /api/report-issue:', err);
        return NextResponse.json(
            { error: 'Error intern processant la petició.' },
            { status: 500 }
        );
    }
}