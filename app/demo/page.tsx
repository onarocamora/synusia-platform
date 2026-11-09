import Image from 'next/image';
import { Lora } from 'next/font/google';
import DemoChatUI from '@/app/demo/DemoChatUI';

// Cargamos la tipografía exacta de la web (Lora)
const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string }>;
}) {
  const resolvedParams = await searchParams;
  const rawUid = resolvedParams?.uid?.trim();
  const uid = rawUid ? decodeURIComponent(rawUid) : 'Entorno Corporativo';
  const isCustomUid = Boolean(rawUid);

  return (
    <main className="min-h-screen bg-white text-gray-900 relative overflow-x-hidden flex flex-col justify-between selection:bg-stone-200">
      
      {/* Orbes fluidos de fondo (idénticos a la web de Synusia) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none opacity-20">
        <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] md:w-[480px] md:h-[480px] rounded-full bg-[#C85A32] blur-[90px] md:blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-[350px] h-[350px] md:w-[480px] md:h-[480px] rounded-full bg-[#334155] blur-[90px] md:blur-[120px]" />
      </div>

      {/* Cabecera institucional con Logo */}
      <header className="w-full border-b border-gray-200/60 bg-white/70 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Synusia"
              width={120}
              height={32}
              className="h-7 w-auto object-contain"
              priority
            />
            <span className="hidden sm:inline-block h-3.5 w-px bg-gray-300" />
            <span className="hidden sm:inline-block text-xs font-mono uppercase tracking-wider text-gray-500">
              Control de Riesgos de IA Generativa
            </span>
          </div>

          <span className="inline-flex items-center rounded-full border border-gray-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-gray-600 shadow-xs">
            Marco EU AI Act (Art. 14) • NIST
          </span>
        </div>
      </header>

      {/* Contenido principal */}
      <div className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:py-10">
        <div className="mb-6 text-center max-w-2xl mx-auto">
          <h1 className={`${lora.className} text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 leading-snug`}>
            ¿Cómo de fácil es engañar a tu equipo con una IA?
          </h1>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            {isCustomUid ? (
              <>
                Simulación activa para el equipo directivo de:{' '}
                <strong className="font-mono text-gray-900 font-semibold">{uid}</strong>
              </>
            ) : (
              'Pon a prueba tu criterio ante una recomendación generada por un modelo de lenguaje.'
            )}
          </p>
        </div>

        {/* Marco del simulador translúcido sobre el fondo */}
        <div className="h-[520px] overflow-hidden rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-md shadow-xl shadow-gray-200/30">
          <DemoChatUI uid={uid} />
        </div>

        <p className="mt-3 text-center text-xs text-gray-500 font-mono">
        </p>
      </div>

      <footer className="relative z-10 w-full border-t border-gray-200/60 py-3 text-center text-xs text-gray-500 bg-white/40 backdrop-blur-xs">
        © 2026 Nucli Innovation SL. Todos los derechos reservados.
      </footer>
    </main>
  );
}