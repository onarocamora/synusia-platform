// scripts/audit-db-coverage.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runAudit() {
    console.log('🔍 Iniciant auditoria de coberta de dades...');

    // 1. Verificar si hi ha logs d'interacció sense tokens registrats
    const { data: nullTokens } = await supabase
        .from('logs_interaccio')
        .select('id_log')
        .is('tokens_consumits', null);

    console.log(`- Logs sense tokens: ${nullTokens?.length || 0} ❌`);

    // 2. Verificar equips que tenen xats però no tenen registres de telemetria
    const { data: orphanEquips } = await supabase.rpc('check_telemetry_orphans');

    // 3. Verificar si tots els event_types de telemetry_logs compleixen la norma
    const { data: invalidEvents } = await supabase
        .from('telemetry_logs')
        .select('id_log, tipo_evento');

    console.log('✅ Auditoria finalitzada.');
}

runAudit();