// lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Singleton a globalThis per evitar que el Fast Refresh de Next.js
// creï instàncies duplicades de GoTrue a la memòria durant el desenvolupament
const globalForSupabase = globalThis as unknown as {
  supabase?: SupabaseClient;
  supabaseAdmin?: SupabaseClient;
};

// 1. Client Públic / Navegador
export const supabase =
  globalForSupabase.supabase ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: typeof window !== 'undefined',
    },
  });

// 2. Client Administratiu (Server-side / API Routes)
// - Al servidor (Node.js): utilitza serviceRoleKey per bypassar RLS i sense persistència de sessió.
// - Al navegador: referencia la mateixa instància única de `supabase` per no duplicar GoTrueClient
//   ni provocar errors d'inspecció a React o PostHog.
export const supabaseAdmin: SupabaseClient =
  typeof window === 'undefined'
    ? (globalForSupabase.supabaseAdmin ??
      createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }))
    : supabase;

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabase = supabase;
  if (typeof window === 'undefined') {
    globalForSupabase.supabaseAdmin = supabaseAdmin;
  }
}