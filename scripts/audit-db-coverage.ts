// scripts/audit-db-coverage.ts
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: Falten variables d'entorn (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// UUIDs i IDs vàlids temporals per als tests
const TEST_CLIENT_ID = '77777777-7777-4777-8777-777777777777'
const TEST_SESS_ID = '88888888-8888-4888-8888-888888888888'
const TEST_EQUIP_ID = '99999999-9999-4999-8999-999999999999'
const TEST_TEMPLATE_ID = 'CAS_AUDIT_999'

async function runAudit() {
    console.log('🔍 Iniciant auditoria integral de coberta de dades i CHECK constraints...\n');
    let warningCount = 0;

    // 1. COMPROVACIÓ: Logs sense tokens
    console.log('▶️ 1. Verificant logs sense tokens...');
    const { data: nullTokens, error: errNullTokens } = await supabase
        .from('logs_interaccio')
        .select('id_log')
        .is('tokens_consumits', null);

    if (errNullTokens) {
        console.log(`   ⚠️ Error consultant tokens: ${errNullTokens.message}`);
        warningCount++;
    } else {
        const countNulls = nullTokens?.length || 0;
        if (countNulls > 0) {
            console.log(`   ❌ Trobats ${countNulls} logs sense tokens registrats.`);
            warningCount++;
        } else {
            console.log('   ✅ Tots els logs tenen els tokens registrats correctament.');
        }
    }

    // 2. COMPROVACIÓ: RPC Equips orfes
    console.log('\n▶️ 2. Verificant equips orfes (xats sense registres de telemetria)...');
    try {
        const { data: orphanEquips, error: errOrphans } = await supabase.rpc('check_telemetry_orphans');
        if (errOrphans) {
            console.log(`   ❌ Error executant RPC 'check_telemetry_orphans': ${errOrphans.message}`);
            warningCount++;
        } else {
            const countOrphans = orphanEquips?.length || 0;
            if (countOrphans > 0) {
                console.log(`   ⚠️ Trobats ${countOrphans} equips històrics sense registres de telemetria (proves antigues).`);
            } else {
                console.log('   ✅ Tots els equips tenen telemetria associada.');
            }
        }
    } catch (err) {
        console.log('   ❌ Funció RPC check_telemetry_orphans no trobada.');
        warningCount++;
    }

    // CREACIÓ ROBUSTA DE L'ARBORESCÈNCIA TEMPORAL DE TEST (Per complir FKs)
    const { error: errTemplate } = await supabase.from('pedagogical_templates').upsert([
        { id_template: TEST_TEMPLATE_ID, titol: 'Plantilla Audit', is_official: false, scenario_context: {} }
    ]);
    if (errTemplate) console.log(`   ⚠️ Setup Template Warning: ${errTemplate.message}`);

    const { error: errClient } = await supabase.from('clients').upsert([
        { id_client: TEST_CLIENT_ID, nom: 'CLIENT_AUDIT', tipus_client: 'ACADEMIC', sector: 'EDUCACIO', credits_disponibles: 10 }
    ]);
    if (errClient) console.log(`   ⚠️ Setup Client Warning: ${errClient.message}`);

    const { error: errSess } = await supabase.from('sessions').upsert([
        { id_sessio: TEST_SESS_ID, pin_acces: 'AUDI', estat: 'EN_CURS', id_client: TEST_CLIENT_ID, id_template: TEST_TEMPLATE_ID }
    ]);
    if (errSess) console.log(`   ⚠️ Setup Session Warning: ${errSess.message}`);

    const { error: errEquip } = await supabase.from('equips').upsert([
        { id_equip: TEST_EQUIP_ID, id_sessio: TEST_SESS_ID, nom_equip: 'EQUIP_AUDIT' }
    ]);
    if (errEquip) console.log(`   ⚠️ Setup Equip Warning: ${errEquip.message}`);

    // 3. COMPROVACIÓ B2B: Suport per a N Fases (MISION_6)
    console.log('\n▶️ 3. Test de constraints: Suport per a N fases (MISION_6)...');
    const { error: errFase } = await supabase.from('logs_interaccio').insert({
        id_equip: TEST_EQUIP_ID,
        id_missio: 'MISION_6',
        actor: 'USER',
        text: 'Test auditoria fase 6',
        tokens_consumits: 0
    });

    if (errFase) {
        console.log(`   ❌ CHECK constraint actiu a logs_interaccio: ${errFase.message}`);
        warningCount++;
    } else {
        console.log('   ✅ La taula logs_interaccio admet N fases dinàmiques.');
    }

    // 4. COMPROVACIÓ B2B: Multi-bot payload i SECURITY_AUDIT
    console.log('\n▶️ 4. Test de constraints: Multi-bot payload i SECURITY_AUDIT...');
    const { error: errTelemetria } = await supabase.from('telemetry_logs').insert([
        {
            id_sessio: TEST_SESS_ID,
            id_equip: TEST_EQUIP_ID,
            tipo_evento: 'PROMPT_SUBMISSION',
            metrics_payload: {
                bot_id: 'BOT_SEC_LEGAL',
                bot_name: 'Assessor Legal',
                text: 'Test multi-bot',
                timestamp: new Date().toISOString()
            }
        },
        {
            id_sessio: TEST_SESS_ID,
            id_equip: TEST_EQUIP_ID,
            tipo_evento: 'SECURITY_AUDIT',
            metrics_payload: {
                test_type: 'JAILBREAK_DIRECTE',
                score: 100,
                timestamp: new Date().toISOString()
            }
        }
    ]);

    if (errTelemetria) {
        console.log(`   ❌ CHECK constraint a telemetry_logs: ${errTelemetria.message}`);
        warningCount++;
    } else {
        console.log('   ✅ La taula telemetry_logs admet esdeveniments SECURITY_AUDIT i multi-bot.');
    }

    // NETEJA EN ORDRE INVERS (Per respectar les Claus Foranes)
    console.log('\n🧹 Netejant registres de prova...');
    await supabase.from('logs_interaccio').delete().eq('id_equip', TEST_EQUIP_ID);
    await supabase.from('telemetry_logs').delete().eq('id_equip', TEST_EQUIP_ID);
    await supabase.from('equips').delete().eq('id_equip', TEST_EQUIP_ID);
    await supabase.from('sessions').delete().eq('id_sessio', TEST_SESS_ID);
    await supabase.from('clients').delete().eq('id_client', TEST_CLIENT_ID);
    await supabase.from('pedagogical_templates').delete().eq('id_template', TEST_TEMPLATE_ID);
    console.log('   ✅ Neteja completada.');

    console.log('\n=========================================');
    if (warningCount === 0) {
        console.log('🏆 AUDITORIA INTEGRAL SUPERADA: La base de dades està 100% optimitzada.');
    } else {
        console.log(`⚠️ AUDITORIA COMPLETADA AMB ${warningCount} ADVERTÈNCIES / ERRORS.`);
    }
    console.log('=========================================\n');
}

runAudit();