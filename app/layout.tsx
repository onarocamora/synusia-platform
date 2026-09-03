import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Image from 'next/image';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: 'Synusia | Plataforma de Simulació amb IA',
    template: '%s | Synusia', // Perquè pàgines secundàries basin el títol en "NomPàgina | Synusia"
  },
  description: 'Entorn d\'entrenament i simulació amb IA.',
  keywords: ['Synusia', 'Simulació', 'IA', 'Pedagògic', 'EdTech'],
  authors: [{ name: 'Synusia Team' }],
  icons: {
    icon: '/icon.svg',          // Icona per defecte a la pestanya
    shortcut: '/logo.png',         // Icona de suport
    apple: '/apple-touch-icon.png' // Icona quan s'afegeix a pantalla d'inici en iOS
  },
  openGraph: {
    title: 'Synusia',
    description: 'Plataforma d\'entrenament i simulació pedagògica amb IA.',
    siteName: 'Synusia',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ca">
      <body className="min-h-screen flex flex-col justify-between bg-[#FAF8F5]">

        {/* Aquí es carrega qualsevol pàgina de la web */}
        <div className="flex-1">
          {children}
        </div>

        {/* PEU DE PÀGINA GLOBAL (Apareix a tot arreu automàticament) */}
        <footer className="w-full py-4 border-t border-stone-200/60 text-center flex items-center justify-center gap-6 opacity-40 hover:opacity-100 transition-opacity">
          <a href="https://linkedin.com/showcase/synusia-io" target="_blank" rel="noreferrer">
            <Image src="/linkedin.svg" alt="LinkedIn" width={20} height={20} />
          </a>
          <a href="https://instagram.com/synusia.io" target="_blank" rel="noreferrer">
            <Image src="/instagram.svg" alt="Instagram" width={20} height={20} />
          </a>
          <a href="https://synusia.io/" target="_blank" rel="noreferrer">
            <Image src="/web.svg" alt="Web" width={20} height={20} />
          </a>
        </footer>

      </body>
    </html>
  );
}
