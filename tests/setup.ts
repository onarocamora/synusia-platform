// tests/setup.ts
import * as dotenv from 'dotenv';

// 1. Carregar variables reals des de .env.local
dotenv.config({ path: '.env.local' });

// 2. Valors de reserva perquè els tests unitaris purs no fallin si no connecten a la BD
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';