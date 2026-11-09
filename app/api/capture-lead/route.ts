import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { leadId, email } = await req.json();

    if (!email || !leadId) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    const { error } = await supabase
      .from('demo_leads')
      .update({ email })
      .eq('id', leadId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al capturar lead', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}