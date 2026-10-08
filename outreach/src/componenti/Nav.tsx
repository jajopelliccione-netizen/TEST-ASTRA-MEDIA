import Link from 'next/link';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { NOME_COOKIE, sessioneValida } from '@/lib/sessione';

/**
 * Barra di navigazione. Mostra due contatori perche' sono le uniche due code
 * che richiedono una mia azione: le email ferme in attesa di approvazione e le
 * risposte non ancora lavorate.
 *
 * Non compare, e soprattutto non interroga il database, senza una sessione
 * valida: sulla pagina di accesso non c'e' niente da navigare, e chi non e'
 * entrato non deve far partire query.
 */
export async function Nav() {
  if (!(await sessioneValida((await cookies()).get(NOME_COOKIE)?.value))) return null;

  // I contatori sono un di piu': se il database non risponde, la pagina deve
  // aprirsi lo stesso invece di andare in errore per un numerino.
  let daApprovare = 0;
  let risposteAperte = 0;
  try {
    [daApprovare, risposteAperte] = await Promise.all([
      db.bozzaEmail.count({ where: { stato: 'DA_APPROVARE' } }),
      db.lead.count({ where: { stato: 'RISPOSTA' } }),
    ]);
  } catch {
    /* nessun contatore, pazienza */
  }

  return (
    <nav className="nav">
      <Link href="/" className="nav-marchio">
        ASTRA <span>Outreach</span>
      </Link>
      <Link href="/" className="voce">
        Pipeline
      </Link>
      <Link href="/approvazioni" className="voce">
        Da inviare
        {daApprovare > 0 && <span className="pastiglia">{daApprovare}</span>}
      </Link>
      <Link href="/risposte" className="voce">
        Risposte
        {risposteAperte > 0 && <span className="pastiglia">{risposteAperte}</span>}
      </Link>
      <span className="nav-spazio" />
      <Link href="/lead/nuovo" className="btn piccolo principale">
        + Nuovo lead
      </Link>
    </nav>
  );
}
