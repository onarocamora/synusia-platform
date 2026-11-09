// app/layout.tsx (El nuevo layout limpio en la raíz)
import './globals.css'; // Asegúrate de importar tus estilos globales

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}