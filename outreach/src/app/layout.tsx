import './globals.css';
import type { Metadata } from 'next';
import { Nav } from '@/componenti/Nav';

export const metadata: Metadata = {
  title: 'Astra Outreach',
  description: 'Strumento interno: ricerca lead, email su misura, gestione risposte e call.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Nav />
        <main className="contenuto">{children}</main>
      </body>
    </html>
  );
}
