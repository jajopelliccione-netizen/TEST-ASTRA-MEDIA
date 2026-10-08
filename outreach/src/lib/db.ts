import { PrismaClient } from '@prisma/client';

/**
 * Collegamento al database (Postgres).
 *
 * Nessun adattatore e nessuna magia: il sistema gira su un runtime Node, che
 * e' quello per cui Prisma e' fatto. Ci avevo provato sui Worker di
 * Cloudflare, ma li' Prisma pretende il suo motore nativo, che su quel
 * runtime non puo' esistere — anche il generatore dedicato se lo porta
 * dietro. Meglio un host che esegue Node che mezza libreria riscritta.
 */
const globalePerPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalePerPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

// In sviluppo Next ricarica i moduli a ogni salvataggio: senza questa cache
// si aprirebbe una connessione nuova a ogni modifica.
if (process.env.NODE_ENV !== 'production') globalePerPrisma.prisma = db;
