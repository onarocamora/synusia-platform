import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Carregar variables d'entorn
dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Carpetes i fitxers a auditar
const FILES_TO_AUDIT = [
    'app/api/chat/route.ts',
    'app/api/generate-template/route.ts',
    'app/api/join-session/route.ts',
    'app/page.tsx',
    'app/admin/templates/page.tsx'
];

const BACKOFFICE_SYSTEM_PROMPT = `
Ets el Synusia Backoffice Agent (Lead System Architect & DevSecOps).
Analitza el fitxer de codi proporcionat i cerca ÚNICAMENT:
1. Vulnerabilitats de seguretat (Prompt Injection, fuites de claus, RLS de Supabase).
2. Deute tècnic de TypeScript (ús de 'any', tipats laxos, valors undefined no controlats).
3. Resiliència (parsejos JSON no protegits, gestió d'errors 500).

Sigues molt breu i directe. Si el fitxer està correcte, respon "✅ Fitxer segur i robust".
Si trobes problemes, indica la línia aproximada i dona el fragment de codi corregit.
`;

async function runAudit() {
    console.log('🔍 [SYNUSIA BACKOFFICE] Iniciant auditoria interna de codi...\n');

    for (const relativePath of FILES_TO_AUDIT) {
        const filePath = path.join(process.cwd(), relativePath);

        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ Fitxer no trobat: ${relativePath}`);
            continue;
        }

        const codeContent = fs.readFileSync(filePath, 'utf-8');
        console.log(`📄 Auditant: ${relativePath}...`);

        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: BACKOFFICE_SYSTEM_PROMPT },
                    { role: 'user', content: `Fitxer: ${relativePath}\n\nCodi:\n\`\`\`typescript\n${codeContent}\n\`\`\`` }
                ],
                temperature: 0.2,
            });

            console.log(`\n--- RESULTAT DE: ${relativePath} ---`);
            console.log(completion.choices[0]?.message?.content || 'Sense comentaris.');
            console.log('---------------------------------------------------\n');

        } catch (error: any) {
            console.error(`❌ Error analitzant ${relativePath}:`, error.message);
        }
    }
}

runAudit();