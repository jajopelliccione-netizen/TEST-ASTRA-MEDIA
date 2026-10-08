import { NextResponse, type NextRequest } from 'next/server';
import { NOME_COOKIE, sessioneValida } from '@/lib/sessione';

/**
 * Nessuna pagina e' raggiungibile senza accesso. Il controllo sta qui e non
 * nelle singole pagine: cosi' una pagina nuova e' protetta per difetto, e non
 * perche' qualcuno si e' ricordato di proteggerla.
 */
export async function middleware(request: NextRequest) {
  const percorso = request.nextUrl.pathname;

  if (percorso.startsWith('/accedi')) return NextResponse.next();

  if (await sessioneValida(request.cookies.get(NOME_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const destinazione = request.nextUrl.clone();
  destinazione.pathname = '/accedi';
  // Dopo l'accesso si torna dove si stava andando
  destinazione.search = percorso === '/' ? '' : `?vai=${encodeURIComponent(percorso)}`;
  return NextResponse.redirect(destinazione);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
