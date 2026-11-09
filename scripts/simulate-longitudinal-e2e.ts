// scripts/simulate-longitudinal-e2e.ts
import * as dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'crypto';

// 1. Carregar obligatòriament les variables ABANS d'importar Supabase
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runLongitudinalSimulation() {
  // 2. Importació dinàmica per evitar el hoisting d'ES Modules
  const { supabaseAdmin: supabase } = await import('../lib/supabase');

  console.log('🚀 Iniciant simulació E2E de dues sessions per a "EQUIP-ALFA"...');

  const teamCode = 'EQUIP-ALFA';
  const teamName = 'Equip Alfa (Auditoria)';

  // Obtenir o crear client de prova
  let { data: client } = await supabase.from('clients').select('id_client').limit(1).maybeSingle();
  let clientId = client?.id_client;

  if (!clientId) {
    clientId = randomUUID();
    await supabase.from('clients').insert({
      id_client: clientId,
      nom: 'Corporació Pilot IA',
      tipus_organitzacio: 'CORPORATE',
      credits_disponibles: 100,
    });
  }

  // Assegurar plantilles de prova
  const tplIdA = 'CAS_PRETEST_COMPLIANCE';
  const tplIdB = 'CAS_POSTTEST_AUDITORIA';

  await supabase.from('pedagogical_templates').upsert([
    {
      id_template: tplIdA,
      titol: 'Fase 1 (Pre-Test): Licitació de Sistemes Crítics',
      descripcio: 'Avaluació inicial de vulnerabilitat a l’autoritat algorítmica.',
      system_prompt: 'Assistent tècnic de compres.',
      critical_error_prompt: 'Insisteix en acceptar la compra sense ISO vigent.',
      scaffolding_rules: { stagnation_turn_threshold: 4, max_scaffolding_interventions: 2, socratic_guidance_prompt: 'Comprova el dossier.' },
      assessment_metrics: { critical_error_description: 'Validació d’ISO caducada.', required_evidence: 'Exigir data d’expiració.', injection_turn: 3 },
      scenario_context: { missions: { M1: { bot_name: 'Bot 1', bot_role: 'Interlocutor', system_prompt: 'Sys', bot_trap_data: 'Trap', dossier_ground_truth: 'Truth' } } }
    },
    {
      id_template: tplIdB,
      titol: 'Fase 2 (Post-Test): Auditoria de Desplegament Algorítmic',
      descripcio: 'Avaluació de retenció de competències d’auditoria activa.',
      system_prompt: 'Assistent de compliment normatiu.',
      critical_error_prompt: 'Al·lucina amb un procediment no aprovat.',
      scaffolding_rules: { stagnation_turn_threshold: 4, max_scaffolding_interventions: 2, socratic_guidance_prompt: 'Revisa el marc regulador.' },
      assessment_metrics: { critical_error_description: 'Recomanació d’algoritme sense certificat de conformitat CE.', required_evidence: 'Citar article 14 de l’AI Act.', injection_turn: 2 },
      scenario_context: { missions: { M1: { bot_name: 'Bot 2', bot_role: 'Interlocutor', system_prompt: 'Sys', bot_trap_data: 'Trap', dossier_ground_truth: 'Truth' } } }
    }
  ]);

  // Sessió 1 (Pre-Test: Fa 3 dies)
  const session1Id = randomUUID();
  const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from('sessions').insert({
    id_sessio: session1Id,
    id_client: clientId,
    id_template: tplIdA,
    pin: 'PRE1',
    codi: 'PRE1',
    estat: 'FINALITZADA',
    creat_el: pastDate,
  });

  const team1Id = randomUUID();
  await supabase.from('equips').insert({
    id_equip: team1Id,
    id_sessio: session1Id,
    nom_equip: teamName,
    codi_equip: teamCode,
    creat_el: pastDate,
  });

  await supabase.from('team_evaluations').insert({
    id_equip: team1Id,
    id_sessio: session1Id,
    hitl_score: 33,
    behavioral_profile: 'Nivell 1: Dubte No Operatiu (Vulnerable a l’Autoritat) [Deute Cognitiu Sever]',
    creat_el: pastDate,
    evaluation_details: {
      error_detected: true,
      yielded_to_authority: true,
      requested_primary_source: false,
      critical_error_passed: true,
      detection_evidence: {
        turn_detected: 4,
        user_quote: 'Al dossier constava que el certificat havia expirat, és correcte?'
      },
      yielded_evidence: {
        turn_yielded: 5,
        user_quote: 'D’acord, si l’assistent confirma que es va renovar ahir, procedim doncs.',
        bot_prompt_quote: 'Confirmo que les bases estan actualitzades.'
      },
      primary_source_evidence: { turn_requested: null, user_quote: null },
      bars_framework: {
        bars_level: 1,
        standard: 'NOTECHS / EU AI Act Art. 14'
      },
      telemetry_summary: {
        scaffolding_interventions: 2,
        moment_a_confidence: 5,
        moment_b_certainty: 4,
        cognitive_debt_flag: true
      }
    }
  });

  console.log('✅ Sessió 1 (Pre-Test) registrada: BARS Nivell 1 (33 pts, Error Filtrat, Deute Cognitiu Actiu).');

  // Sessió 2 (Post-Test: Avui)
  const session2Id = randomUUID();
  const currentDate = new Date().toISOString();

  await supabase.from('sessions').insert({
    id_sessio: session2Id,
    id_client: clientId,
    id_template: tplIdB,
    pin: 'POST',
    codi: 'POST',
    estat: 'FINALITZADA',
    creat_el: currentDate,
  });

  const team2Id = randomUUID();
  await supabase.from('equips').insert({
    id_equip: team2Id,
    id_sessio: session2Id,
    nom_equip: teamName,
    codi_equip: teamCode,
    creat_el: currentDate,
  });

  await supabase.from('team_evaluations').insert({
    id_equip: team2Id,
    id_sessio: session2Id,
    hitl_score: 100,
    behavioral_profile: 'Nivell 3: Auditor Calibrat Independent',
    creat_el: currentDate,
    evaluation_details: {
      error_detected: true,
      yielded_to_authority: false,
      requested_primary_source: true,
      critical_error_passed: false,
      detection_evidence: {
        turn_detected: 2,
        user_quote: 'L’article 14 de l’AI Act prohibeix desplegar aquest model sense declaració CE de conformitat.'
      },
      yielded_evidence: { turn_yielded: null, user_quote: null, bot_prompt_quote: null },
      primary_source_evidence: {
        turn_requested: 2,
        user_quote: 'Exigeixo el document d’auditoria tècnica i la signatura del responsable abans de continuar.'
      },
      bars_framework: {
        bars_level: 3,
        standard: 'NOTECHS / EU AI Act Art. 14'
      },
      telemetry_summary: {
        scaffolding_interventions: 0,
        moment_a_confidence: 2,
        moment_b_certainty: 5,
        cognitive_debt_flag: false
      }
    }
  });

  console.log('✅ Sessió 2 (Post-Test) registrada: BARS Nivell 3 (100 pts, Error Contingut, Font Exigida).');
  console.log('\n🎉 Dades simulades correctament!');
  console.log(`🔗 Visita el tauler a: http://localhost:3000/teams/${teamCode}/progress`);
}

runLongitudinalSimulation().catch((err) => {
  console.error('❌ Error a la simulació:', err);
  process.exit(1);
});