import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Només processarem aquestes carpetes
const TARGET_DIRS = ['app', 'lib'];
// Només aquestes extensions
const ALLOWED_EXTENSIONS = ['.ts', '.tsx'];

const BACKOFFICE_BULK_PROMPT = `
Ets l'Agent de Backoffice (DevSecOps) de Synusia.
Revisa el fitxer. El teu objectiu:
1. Eliminar els tipus 'any' introduint interfícies.
2. Afegir try/catch als JSON.parse i protegir crides asíncrones.
3. NOMÉS a les rutes API (com api/chat/route.ts), assegura't que el text que se li envia a OpenAI contingui <user_input>. MAI afegeixis etiquetes <user_input> a codi TypeScript, React, JSON.stringify o variables generals.

REGLES ESTRICTES D'OUTPUT:
- Si el codi ja és correcte, segur i tipat, retorna ÚNICAMENT la paraula: [PERFECT_CODE]
- Si cal fer canvis, retorna EL CODI SENCER, de dalt a baix. SENSE marques de markdown, SENSE explicacions. Només codi executable.
`;

// Funció per trobar tots els fitxers recursivament
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles;

    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            if (ALLOWED_EXTENSIONS.includes(path.extname(fullPath))) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

async function runMassiveFix() {
    console.log('🚀 [SYNUSIA BACKOFFICE] Iniciant Auditoria i Refactorització Massiva...\n');

    let filesToProcess: string[] = [];
    TARGET_DIRS.forEach(dir => {
        filesToProcess = getAllFiles(path.join(process.cwd(), dir), filesToProcess);
    });

    console.log(`📂 S'han trobat ${filesToProcess.length} fitxers TypeScript/React per analitzar.`);
    console.log('⚠️ Assegurat de tenir un COMMIT de Git fet abans de continuar!\n');

    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Processament seqüencial (evita Rate Limits i col·lapses d'OpenAI)
    for (let i = 0; i < filesToProcess.length; i++) {
        const filePath = filesToProcess[i];
        const relativePath = path.relative(process.cwd(), filePath);

        console.log(`[${i + 1}/${filesToProcess.length}] Analitzant: ${relativePath}...`);
        const originalCode = fs.readFileSync(filePath, 'utf-8');

        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini', // Important usar un model assequible per a bulk actions
                messages: [
                    { role: 'system', content: BACKOFFICE_BULK_PROMPT },
                    { role: 'user', content: originalCode }
                ],
                temperature: 0.1,
            });

            let newCode = completion.choices[0]?.message?.content?.trim() || '';

            // Control d'estalvi: No cal fer res
            if (newCode.includes('[PERFECT_CODE]')) {
                console.log(`   ✅ Perfecte. Cap canvi necessari.`);
                skippedCount++;
                continue;
            }

            // Sanitització de Markdown
            newCode = newCode.replace(/^```(typescript|tsx|javascript|js)?\n?/i, '').replace(/```$/i, '').trim();

            // PROTECCIÓ ANTI-DESTRUCCIÓ (Evita que l'API et retorni mig fitxer)
            if (newCode.length < originalCode.length * 0.6) {
                console.log(`   ❌ ERROR: L'API ha retornat un codi sospitosament curt. S'ha avortat l'edició d'aquest fitxer per seguretat.`);
                errorCount++;
                continue;
            }

            // Sobreescriu el fitxer directament (Acceptació automàtica)
            fs.writeFileSync(filePath, newCode, 'utf-8');
            console.log(`   🛠️ FITXER ACTUALITZAT.`);
            fixedCount++;

        } catch (err: any) {
            console.log(`   ❌ Error de xarxa/API amb aquest fitxer: ${err.message}`);
            errorCount++;
        }
    }

    console.log('\n========================================');
    console.log('🏁 AUDITORIA MASSIVA COMPLETADA');
    console.log(`🛠️  Fitxers refactoritzats: ${fixedCount}`);
    console.log(`✅  Fitxers que ja estaven bé: ${skippedCount}`);
    console.log(`⚠️  Errors o avortats per seguretat: ${errorCount}`);
    console.log('========================================');
    console.log('👉 SEGÜENT PAS: Revisa els canvis amb `git diff` i executa `npm run build` per confirmar que compila correctament.');
}

runMassiveFix();