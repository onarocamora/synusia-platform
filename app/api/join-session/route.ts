import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface RequestBody {
  pin: string;
  nomsEquip: string;
}

interface Session {
  id_sessio: string;
  estat: string;
  id_client: string;
  id_template: string | null;
  data_expiracio_pilot?: string | null; // Afegit per al compliment AI4edu
}

interface ExistingTeam {
  id_equip: string;
}

interface NewTeam {
  id_equip: string;
  id_sessio: string;
  nom_equip: string;
  missio_actual: string;
}

interface ClientData {
  id_client: string;
  credits_disponibles: number;
}

interface TemplateData {
  id_template: string;
  [key: string]: unknown;
}

export async function POST(request: Request) {
  try {
    const { pin, nomsEquip }: RequestBody = await request.json()

    if (!pin || !nomsEquip) {
      return NextResponse.json({ error: 'Falten dades d’accés (PIN i Nom d’equip).' }, { status: 400 })
    }

    // 1. Cerca de la sessió incloent data_expiracio_pilot
    const { data: sessio, error: errorSessio }: { data: Session | null; error: unknown } = await supabase
      .from('sessions')
      .select('id_sessio, estat, id_client, id_template, data_expiracio_pilot')
      .eq('pin_acces', pin)
      .single()

    if (errorSessio || !sessio) {
      return NextResponse.json({ error: 'El PIN no és vàlid o la sessió no existeix.' }, { status: 401 })
    }

    // 2. Control d'estat de la sessió
    if (sessio.estat !== 'EN_CURS' && sessio.estat !== 'ACTIVA') {
      return NextResponse.json({ error: 'Aquesta sessió ja no està activa.' }, { status: 403 })
    }

    // 3. Validació temporal de caducitat (AI4edu / AESIA)
    if (sessio.data_expiracio_pilot) {
      const dataLimit = new Date(sessio.data_expiracio_pilot)
      const ara = new Date()

      if (ara > dataLimit) {
        // Tancament automàtic a la BD per expiració del pilot
        await supabase
          .from('sessions')
          .update({ estat: 'FINALITZADA' })
          .eq('id_sessio', sessio.id_sessio)

        return NextResponse.json(
          { error: 'El termini autoritzat per a aquesta prova pilot ha expirat per normativa.' },
          { status: 403 }
        )
      }
    }

    const nomNet = nomsEquip.trim()

    // 4. Comprovació d'equip existent
    const { data: equipExistent, error: errorEquipExistent }: { data: ExistingTeam | null; error: unknown } = await supabase
      .from('equips')
      .select('id_equip')
      .eq('id_sessio', sessio.id_sessio)
      .ilike('nom_equip', nomNet)
      .maybeSingle()

    if (errorEquipExistent) {
      return NextResponse.json({ error: 'Error al comprovar l\'equip existent.' }, { status: 500 })
    }

    if (equipExistent) {
      return NextResponse.json(
        { error: `El nom d'equip "${nomNet}" ja està registrat en aquesta sessió. Trieu un nom diferent.` },
        { status: 400 }
      )
    }

    // 5. Creació del nou equip
    const { data: nouEquip, error: errorEquip }: { data: NewTeam | null; error: unknown } = await supabase
      .from('equips')
      .insert([
        {
          id_sessio: sessio.id_sessio,
          nom_equip: nomNet,
          missio_actual: 'MISION_1'
        }
      ])
      .select('id_equip, id_sessio, nom_equip, missio_actual')
      .single()

    if (errorEquip) throw errorEquip

    // 6. Recuperació de dades del client
    const { data: clientData, error: errorClientData }: { data: ClientData | null; error: unknown } = await supabase
      .from('clients')
      .select('id_client, credits_disponibles')
      .eq('id_client', sessio.id_client)
      .single()

    if (errorClientData) {
      return NextResponse.json({ error: 'Error al recuperar la informació del client.' }, { status: 500 })
    }

    // 7. Recuperació de la plantilla pedagògica
    const templateId = sessio.id_template || 'MISION_1'
    const { data: templateData, error: errorTemplateData }: { data: TemplateData | null; error: unknown } = await supabase
      .from('pedagogical_templates')
      .select('*')
      .eq('id_template', templateId)
      .single()

    if (errorTemplateData) {
      return NextResponse.json({ error: 'Error al recuperar la plantilla pedagògica.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      equip: nouEquip,
      sessio,
      credits_disponibles: clientData?.credits_disponibles ?? 0,
      template: templateData || null
    })

  } catch (error) {
    console.error('Error al porter d’API join-session:', error)
    return NextResponse.json({ error: (error as Error)?.message || 'Error intern del servidor de seguretat.' }, { status: 500 })
  }
}