// lib/metadata-config.ts

export interface SegmentMetadata {
    title: string;
    description: string;
    keywords: string[];
    ogImage: string;
}

export const SEGMENTS_METADATA: Record<string, SegmentMetadata> = {
    // Segment Predeterminat / General
    default: {
        title: 'Synusia | Plataforma de Simulació Pedagògica i Fricció Cognitiva',
        description: 'Entorn d\'entrenament i simulació avançada amb IA per al desenvolupament de pensament crític i presa de decisions.',
        keywords: ['Simulació IA', 'EdTech', 'Aprenentatge Experiencial', 'Fricció Pedagògica'],
        ogImage: '/og/og-default.png',
    },

    // Segment Acadèmic (Universitats, Escoles de Negoci, Investigació)
    academic: {
        title: 'Synusia Academic | Simulacions d\'Alt Impacte per a Educació Superior',
        description: 'Avaluació de competències, observabilitat de l\'aprenentatge i recerca en comunicació IA-humà amb telemetria avançada.',
        keywords: ['Learning Analytics', 'Universitats', 'Investigació Educativa', 'White Paper IA', 'Avaluació Competencial'],
        ogImage: '/og/og-academic.png',
    },

    // Segment Corporatiu (L&D, HR, Executius, Compliance)
    corporate: {
        title: 'Synusia Corporate | Entrenament d\'Executius en Gestió de Crisi i Governança',
        description: 'Plataforma d\'immersió en dilemes ètics, presa de decisions sota pressió i auditories algorítmiques per a equips directius.',
        keywords: ['Executive Training', 'Gestió de Crisi', 'L&D', 'Compliance AI', 'Governança Algorítmica'],
        ogImage: '/og/og-corporate.png',
    },

    // Segment Legal / Regulatory
    legal: {
        title: 'Synusia Legal & Compliance | Simulador de Responsabilitat i Contractes',
        description: 'Entrenament pràctic en auditoria de clàusules contractuals, biaix algorítmic i regulació d\'intel·ligència artificial.',
        keywords: ['LegalTech', 'Auditoria Algorítmica', 'SLA', 'Compliance Legal', 'AI Act'],
        ogImage: '/og/og-legal.png',
    }
};