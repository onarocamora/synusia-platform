import fs from 'fs';
import path from 'path';
import readline from 'readline';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const askQuestion = (query: string): Promise<string> => {
    return new Promise((resolve) => rl.question(query, resolve));
};

const BACKOFFICE_FIX_PROMPT = `
Ets el Synusia Backoffice Agent (DevSecOps & System Architect).
La teva tasca és refactoritzar el fitxer TypeScript/Next.js proporcionat per:
1. Eliminar el deute de TypeScript (substituir 'any' per interfícies / tipus estrictes).
2. Assegurar que els parsejos JSON tinguin try/catch i que els inputs d'usuari a LLMs utilitzin <user_input>.
3. Millorar la resiliència en les crides a Supabase/OpenAI.

REGLA CRÍTICA: Retorna ÚNICAMENT el codi font completament corregit. NO incloguis explicacions, ni salutacions, ni marques markdown (\`\`\`typescript ... \`\`\`). Retorna només text pla executable.
`;

async function refactorFile() {
    const targetRelativePath = process.argv[2] || 'app/api/chat/route.ts';
    const filePath = path.join(process.cwd(), targetRelativePath);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ Fitxer no trobat: ${targetRelativePath}`);
        rl.close();
        return;
    }

    const originalCode = fs.readFileSync(filePath, 'utf-8');
    console.log(`\n🤖 [SYNUSIA BACKOFFICE] Refactoritzant: ${targetRelativePath}...`);

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: BACKOFFICE_FIX_PROMPT },
                { role: 'user', content: originalCode }
            ],
            temperature: 0.1,
        });

        let newCode = completion.choices[0]?.message?.content?.trim() || '';

        // Sanitització preventiva si el model inclou blocs markdown
        newCode = newCode.replace(/^```(typescript|tsx|javascript|js)?/i, '').replace(/```$/i, '').trim();

        if (!newCode || newCode === originalCode) {
            console.log('✅ El codi ja està optimitzat o no requereix canvis.');
            rl.close();
            return;
        }

        console.log(`\n⚠️ L'AGENT HA GENERAT UNA NOVA VERSIÓ DE: ${targetRelativePath}`);
        console.log('--- MOSTRA DELS PRIMERS 300 CARÀCTERS ---');
        console.log(newCode.substring(0, 300) + '...\n');

        const answer = await askQuestion('👉 Vols aplicar aquests canvis al fitxer? (s/n): ');

        if (answer.toLowerCase() === 's' || answer.toLowerCase() === 'si' || answer.toLowerCase() === 'y') {
            // 1. Crear backup de seguretat (.bak)
            fs.writeFileSync(`${filePath}.bak`, originalCode, 'utf-8');

            // 2. Sobreescriure el fitxer amb el nou codi
            fs.writeFileSync(filePath, newCode, 'utf-8');

            console.log(`\n✅ Fitxer actualitzat amb èxit! (S'ha desat una còpia de seguretat a ${targetRelativePath}.bak)`);
        } else {
            console.log('\n❌ Canvis descartats. El fitxer no ha estat modificat.');
        }

    } catch (error: any) {
        console.error('❌ Error durant el procés de refactorització:', error.message);
    } finally {
        rl.close();
    }
}

refactorFile();