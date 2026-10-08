import { db } from '@/lib/db';
import { leggiJson } from '@/lib/util';
import { SchedaInvio, type DatiScheda } from '@/componenti/SchedaInvio';
import { motiviPerNonInviare, inviateOggi } from '@/worker/invio';
import { sincronizzaSoppressioni } from '@/worker/soppressioni';

export const dynamic = 'force-dynamic';

export default async function DaInviare() {
  const bozze = await db.bozzaEmail.findMany({
    where: { stato: 'DA_APPROVARE' },
    orderBy: { creataIl: 'asc' },
    include: { lead: { include: { analisi: true } } },
  });

  // Una sola sincronizzazione per tutta la pagina, non una per scheda.
  await sincronizzaSoppressioni();

  // I motivi di blocco si calcolano qui, una volta: cosi' il tasto arriva gia'
  // spento e con la spiegazione, invece di fallire dopo il click.
  const schede: DatiScheda[] = await Promise.all(
    bozze.map(async (b) => ({
      bozzaId: b.id,
      leadId: b.leadId,
      ragioneSociale: b.lead.ragioneSociale,
      settore: b.lead.settore,
      citta: b.lead.citta,
      email: b.lead.email,
      riassuntoAttivita: b.lead.analisi?.riassuntoAttivita ?? null,
      riassuntoSito: b.lead.analisi?.riassuntoSito ?? null,
      punteggio: b.lead.analisi?.punteggio ?? null,
      sitoEsiste: b.lead.analisi?.sitoEsiste ?? null,
      urlSito: b.lead.analisi?.urlAnalizzato ?? null,
      problemi: leggiJson<string[]>(b.lead.analisi?.problemi, []),
      oggetto: b.oggetto,
      corpo: b.corpo,
      modello: b.modelloLlm,
      bloccanti: await motiviPerNonInviare(b.lead.email, b.corpo, { allinea: false }),
    })),
  );

  const partiteOggi = await inviateOggi();
  const tetto = Number(process.env.INVII_MAX_GIORNO) || 25;
  const invioVero = String(process.env.INVIO_ATTIVO).toLowerCase() === 'true';

  return (
    <>
      <h1>Da inviare</h1>
      <p className="sottotitolo">
        Per ogni attività: cosa fa, com&apos;è messo il sito e l&apos;email già scritta. Un tasto e
        parte.
      </p>

      {!invioVero && (
        <div className="avviso info">
          <strong>Modalità prova.</strong> `INVIO_ATTIVO` non è `true`, quindi le email vengono
          registrate come se fossero partite ma <strong>non raggiungono nessuno</strong>. Serve a
          provare tutto il giro in sicurezza. Mettilo a `true` nel `.env` solo dopo aver
          configurato SPF, DKIM, DMARC e la pagina di disiscrizione.
        </div>
      )}

      <div className="contatore-invii">
        <span>
          Oggi: <strong>{partiteOggi}</strong> / {tetto}
        </span>
        <div className="barretta">
          <div
            className="riempimento"
            style={{
              width: `${Math.min(100, (partiteOggi / tetto) * 100)}%`,
              background: partiteOggi >= tetto ? 'var(--pink)' : 'var(--green)',
            }}
          />
        </div>
      </div>

      {schede.length === 0 ? (
        <div className="riquadro">
          <div className="vuoto">
            Niente pronto da inviare.
            <br />
            Apri un lead e premi «Analizza e scrivi l&apos;email» per riempire questa coda.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {schede.map((d) => (
            <SchedaInvio key={d.bozzaId} d={d} />
          ))}
        </div>
      )}
    </>
  );
}
