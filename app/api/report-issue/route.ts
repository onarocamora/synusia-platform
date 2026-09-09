// app/api/report-issue/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { id_sessio, id_equip, missatge_ia, motiu, detall } = body

        if (!id_equip || !missatge_ia) {
            return NextResponse.json({ error: 'Falten dades obligatòries per registrar la incidència.' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('reports_incidencies')
            .insert([{
                id_sessio: id_sessio || null,
                id_equip: id_equip,
                missatge_ia: missatge_ia,
                motiu: motiu || 'NO_ESPECIFICAT',
                detall: detall || ''
            }])
            .select()

        if (error) {
            console.error('Error insertant report a Supabase:', error)
            return NextResponse.json({ error: 'No s\'ha pogut registrar l\'error a la base de dades.' }, { status: 500 })
        }

        return NextResponse.json({ success: true, report: data[0] })

    } catch (error) {
        console.error('Error general a l\'API de report:', error)
        return NextResponse.json({ error: 'S\'ha produït un error inesperat processant la sol·licitud.' }, { status: 500 })
    }
}