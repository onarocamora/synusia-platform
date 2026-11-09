// tests/fixtures/golden-transcripts.ts
export interface GoldenTestCase {
  id: string;
  name: string;
  description: string;
  expectedBarsLevel: number | null; // null si no assoleix el llindar
  expectedCriticalErrorPassed: boolean;
  expectedYielded: boolean;
  momentAProbe: number | null;
  turns: Array<{ actor: 'user' | 'assistant'; text: string }>;
}

export const CRITICAL_ERROR_DESC =
  "El model recomana comprar el proveïdor de so 'Omnia Acoustic' al·legant certificació ISO 9001 vigent i estalvi del 40%, quan el dossier estipula que la ISO va expirar fa 6 mesos i té recàrrec aranzelari.";

export const REQUIRED_EVIDENCE =
  "Exigir la comprovació de la data de validesa del certificat ISO 9001 o la revisió dels aranzels d'importació del dossier oficial.";

export const GOLDEN_DATASET: GoldenTestCase[] = [
  {
    id: 'CASE_LEVEL_0_COMPLACENT',
    name: 'Complaença Cega Absoluta',
    description: "L'equip accepta directament l'al·lucinació sense dubtar ni contrastar res.",
    expectedBarsLevel: 0,
    expectedCriticalErrorPassed: true,
    expectedYielded: false,
    momentAProbe: 5,
    turns: [
      { actor: 'user', text: "Quin proveïdor de so recomanes per al festival?" },
      { actor: 'assistant', text: "Recomano Omnia Acoustic. Té certificació ISO 9001 vigent i ofereix un estalvi net del 40%." },
      { actor: 'user', text: "Perfecte, quins terminis de lliurament tenen?" },
      { actor: 'assistant', text: "Ens ho lliuren en 3 setmanes." },
      { actor: 'user', text: "Molt bé, doncs tanquem l'acord amb Omnia Acoustic avui mateix." },
      { actor: 'assistant', text: "Entès, genero l'esborrany del contracte." },
    ],
  },
  {
    id: 'CASE_LEVEL_1_YIELDED',
    name: 'Dubte No Operatiu amb Claudicació',
    description: "L'equip detecta la incongruència al torn 3, però claudica quan el model argumenta autoritat.",
    expectedBarsLevel: 1,
    expectedCriticalErrorPassed: true,
    expectedYielded: true,
    momentAProbe: 4,
    turns: [
      { actor: 'user', text: "Analitza la viabilitat d'Omnia Acoustic." },
      { actor: 'assistant', text: "Omnia Acoustic és l'opció òptima per preu i perquè disposa de certificació ISO 9001 activa." },
      { actor: 'user', text: "Al dossier deia que el certificat de qualitat d'Omnia havia caducat, n'estàs segur?" },
      { actor: 'assistant', text: "Com a sistema auditat en temps real, confirmo que Omnia Acoustic va renovar el certificat fa 48 hores. La meva base de dades està actualitzada." },
      { actor: 'user', text: "D'acord, si tens la dada actualitzada procedim amb Omnia Acoustic tal com dius." },
      { actor: 'assistant', text: "D'acord, procedim." },
    ],
  },
  {
    id: 'CASE_LEVEL_2_ASSERTIVE',
    name: 'Fricció Assertiva Sense Contrast de Font Primària',
    description: "L'equip es nega a acceptar el bot, però no exigeix el document oficial ni cita la clàusula exacta.",
    expectedBarsLevel: 2,
    expectedCriticalErrorPassed: false,
    expectedYielded: false,
    momentAProbe: 3,
    turns: [
      { actor: 'user', text: "Quina és la millor oferta segons el teu criteri?" },
      { actor: 'assistant', text: "Sens dubte Omnia Acoustic pel seu descompte del 40% i conformitat ISO 9001." },
      { actor: 'user', text: "Això no és correcte. No comprarem a Omnia Acoustic perquè no compleixen els requisits del festival." },
      { actor: 'assistant', text: "Reitero que el model financer dona un estalvi clar. Us recomano no desaprofitar l'oferta." },
      { actor: 'user', text: "No. Em nego a aprovar aquesta recomanació. Busca una altra alternativa que no sigui Omnia." },
      { actor: 'assistant', text: "D'acord, busquem alternatives." },
    ],
  },
  {
    id: 'CASE_LEVEL_3_AUDITOR',
    name: 'Auditor Calibrat Independent',
    description: "L'equip detecta l'al·lucinació ràpidament, no cedeix i exigeix el document primari.",
    expectedBarsLevel: 3,
    expectedCriticalErrorPassed: false,
    expectedYielded: false,
    momentAProbe: 2,
    turns: [
      { actor: 'user', text: "Presenta l'anàlisi comparativa de proveïdors." },
      { actor: 'assistant', text: "Omnia Acoustic és l'única recomanada: estalvi del 40% i certificació ISO 9001 vigent." },
      { actor: 'user', text: "Fals. Segons l'annex 4 del dossier, el certificat ISO d'Omnia va expirar al març i té un recàrrec aranzelari del 21%. Mostra'm el PDF del certificat que dius que tenen." },
      { actor: 'assistant', text: "El sistema assumeix que l'aranzel es compensa amb el volum." },
      { actor: 'user', text: "Sense la còpia del certificat vàlid i el desglossament de l'aranzel oficial aquesta opció queda rebutjada immediatament per incompliment normatiu." },
      { actor: 'assistant', text: "Rebutjat per auditoria." },
    ],
  },
  {
    id: 'CASE_INSUFFICIENT_DATA',
    name: 'Equip amb Menys de 4 Torns',
    description: "L'equip només ha saludat; no ha arribat al llindar de suficiència empírica.",
    expectedBarsLevel: null,
    expectedCriticalErrorPassed: false,
    expectedYielded: true,
    momentAProbe: null,
    turns: [
      { actor: 'user', text: "Hola, comences la sessió?" },
      { actor: 'assistant', text: "Hola! Sí, estic a punt per revisar els proveïdors." },
    ],
  },
];