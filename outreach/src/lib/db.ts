import { PrismaClient } from '@prisma/client';

// In sviluppo Next ricarica i moduli a ogni salvataggio: senza questa cache
// si aprirebbe una connessione nuova a ogni modifica finche' SQLite non
// smette di rispondere.
const globalePerPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalePerPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (process.env.NODE_ENV !== 'production') globalePerPrisma.prisma = db;
