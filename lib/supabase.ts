import { createClient } from '@supabase/supabase-js'

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

console.log("La URL que llegeix Next.js és:", process.env.NEXT_PUBLIC_SUPABASE_URL)

const supabaseConfig: SupabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}

if (!supabaseConfig.url || !supabaseConfig.anonKey) {
  throw new Error('Falten les variables d’entorn de Supabase al fitxer .env.local')
}

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey)