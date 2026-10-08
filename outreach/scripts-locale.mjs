// Passa lo schema fra Postgres (online) e SQLite (prove in locale).
// Prisma non accetta una variabile per il provider, quindi si cambia la riga.
import { readFileSync, writeFileSync } from 'node:fs';
const versoSqlite = process.argv[2] === 'sqlite';
const p = 'prisma/schema.prisma';
const s = readFileSync(p, 'utf8');
writeFileSync(p, versoSqlite
  ? s.replace('provider = "postgresql"', 'provider = "sqlite"')
  : s.replace('provider = "sqlite"', 'provider = "postgresql"'));
console.log(versoSqlite
  ? 'Schema su SQLite (prove in locale). Ricordati di rimetterlo con: npm run db:online'
  : 'Schema su Postgres (online).');
