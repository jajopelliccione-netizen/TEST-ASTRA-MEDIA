import Link from 'next/link';
import { db } from '@/lib/db';

/**
 * Barra di navigazione. Mostra due contatori perche' sono le uniche due code
 * che richiedono una mia azione: le email ferme in attesa di approvazione e le
 * risposte non ancora lavorate.
 */
export async function Nav() {
  const [daApprovare, risposteAperte] = await Promise.all([
    db.bozzaEmail.count({ where: { stato: 'DA_APPROVARE' } }),
    db.lead.count({ where: { stato: 'RISPOSTA' } }),
  ]);

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
