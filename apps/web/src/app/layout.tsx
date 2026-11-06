import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'DevCycle', template: '%s · DevCycle' },
  description:
    'Plataforma de gestión del ciclo de vida del software: multiproducto, trazabilidad funcional y agentes IA.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
