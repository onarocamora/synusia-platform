import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from '@vercel/analytics/react';
import Footer from '@/components/Footer'; // Assegura't que la ruta d'importació coincideixi amb la teva estructura

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
    template: '%s | Synusia',
  },
  description: 'Entorn d\'entrenament i simulació amb IA.',
  keywords: ['Synusia', 'Simulació', 'IA', 'Pedagògic', 'EdTech'],
  authors: [{ name: 'Synusia Team' }],
  icons: {
    icon: '/icon.svg',
    shortcut: '/logo.png',
    apple: '/apple-touch-icon.png'
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

        <div className="flex-1">
          {children}
          <Analytics />
        </div>

        {/* El footer només es renderitzarà si NO estem a la ruta "/" */}
        <Footer />

      </body>
    </html>
  );
}