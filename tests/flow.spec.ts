import { test, expect } from '@playwright/test';

test('FLUX COMPLET UI NOVA: Creació de sessió, unió, xat i sincronització', async ({ browser }) => {
    test.setTimeout(60000);

    // -------------------------------------------------------------
    // 1. NAVEGADOR 1: PANELL DEL TENDER / ADMIN
    // -------------------------------------------------------------
    const contextAdmin = await browser.newContext();
    const pageAdmin = await contextAdmin.newPage();

    console.log('📡 [1] Admin entra a /admin...');
    await pageAdmin.goto('/admin');
    await pageAdmin.waitForLoadState('networkidle');

    // Premer botó de nova sessió
    const botoLlançar = pageAdmin.locator('button:has-text("Llançar Nova Sessió"), button:has-text("Nova Sessió")').first();
    await expect(botoLlançar).toBeVisible({ timeout: 10000 });
    await botoLlançar.click();

    console.log('⏳ Esperant que es generi la sessió a la pantalla...');
    await pageAdmin.waitForTimeout(3000);

    // Capturar el PIN directament des de l'input de l'Admin
    let pinSessio = await pageAdmin.locator('input[placeholder="PIN D\'ACCÉS"]').inputValue();

    if (!pinSessio || pinSessio.length < 4) {
        // Fallback: Buscar al text de la pàgina
        const bodyText = await pageAdmin.innerText('body');
        const pinMatch = bodyText.match(/([A-Z0-9]{4})/);
        pinSessio = pinMatch ? pinMatch[1] : '';
    }

    if (!pinSessio) {
        await pageAdmin.screenshot({ path: 'debug-admin.png' });
        throw new Error('No s\'ha pogut trobar el PIN a la pantalla de l\'Admin.');
    }

    console.log(`🔑 [2] PIN detectat automàticament: "${pinSessio}"`);

    // -------------------------------------------------------------
    // 2. NAVEGADOR 2: PANTALLA DE L'ALUMNE (NOVA UI)
    // -------------------------------------------------------------
    const contextAlumne = await browser.newContext();
    const pageAlumne = await contextAlumne.newPage();

    console.log('🎒 [3] Alumne entra a la portada (Nova UI Light)...');
    await pageAlumne.goto('/');
    await pageAlumne.waitForLoadState('networkidle');

    // Emplenar el PIN, Nom i Reflexió inicial (Missió 0)
    await pageAlumne.locator('input[placeholder*="Ex: 1234"]').fill(pinSessio);
    await pageAlumne.locator('input[placeholder*="Alpha"]').fill('Equip Robot Playwright');
    await pageAlumne.locator('textarea[placeholder*="Reflexió"]').fill('Cap decisió ètica s\'hauria de deixar 100% a una màquina.');

    // Premer el botó per entrar
    const botoEntrar = pageAlumne.locator('button:has-text("Inicialitzar Connexió")').first();
    await botoEntrar.click();

    console.log('💬 [4] Alumne enviat a la sessió. Comprovant components del xat...');

    // Verificar que el xat s'ha carregat bé (buscant el camp d'entrada)
    const inputXat = pageAlumne.locator('input[placeholder*="Introduïu la teva consulta"]');
    await expect(inputXat).toBeVisible({ timeout: 10000 });

    // Enviar un missatge al xat
    await inputXat.fill('Hola ARIA, quines són les primeres pistes?');
    await pageAlumne.locator('button:has-text("Enviar")').click();

    // Testejar el Drawer (Dossier Lateral)
    console.log('📖 [5] Provant obertura i tancament del Dossier Lateral...');
    await pageAlumne.locator('button:has-text("Dossier")').click();
    // Verificar que el Drawer es mostra (buscant el títol 'Dossier Operatiu')
    await expect(pageAlumne.locator('text=Dossier Operatiu').first()).toBeVisible();
    // Tancar el Drawer
    await pageAlumne.locator('button:has-text("Tancar i Tornar al Xat")').click();

    // -------------------------------------------------------------
    // 3. VERIFICACIÓ EN TEMPS REAL AL PANELL DEL TENDER
    // -------------------------------------------------------------
    console.log('👁️ [6] Comprovant recepció en temps real al Tender...');
    await pageAdmin.bringToFront();

    // Esperem 3 segons per veure si es reflecteix la connexió
    const textEquipConnectat = pageAdmin.locator('text=Equip Robot Playwright');
    await expect(textEquipConnectat).toBeVisible({ timeout: 5000 });

    console.log('🎉 PROVA COMPLETADA AMB ÉXIT A LA NOVA INTERFÍCIE!');
});
