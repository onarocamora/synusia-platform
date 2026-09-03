import { createClient } from '@supabase/supabase-js'

console.log("La URL que llegeix Next.js és:", process.env.NEXT_PUBLIC_SUPABASE_URL)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Falten les variables d’entorn de Supabase al fitxer .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)