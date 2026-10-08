'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { approvaEInvia, rifiutaBozza } from '@/app/azioni';

type Risultato = { ok?: boolean; simulato?: boolean; errore?: string } | null;

export type DatiScheda = {
  bozzaId: string;
  leadId: string;
  ragioneSociale: string;
  settore: string;
  citta: string;
  email: string | null;
  riassuntoAttivita: string | null;
  riassuntoSito: string | null;
  punteggio: number | null;
  sitoEsiste: boolean | null;
  urlSito: string | null;
  problemi: string[];
  oggetto: string;
  corpo: string;
  modello: string | null;
  /** Se non e' vuoto il tasto Invia resta spento, con il motivo scritto sopra. */
  bloccanti: string[];
};

/** Da `(precedente, form)` a quello che si aspetta useActionState. */
async function azioneInvia(_precedente: Risultato, form: FormData): Promise<Risultato> {
  return (await approvaEInvia(form)) as Risultato;
}

export function SchedaInvio({ d }: { d: DatiScheda }) {
  const [esito, invia, inCorso] = useActionState<Risultato, FormData>(azioneInvia, null);

  if (esito?.ok) {
    return (
      <div className="riquadro">
        <div className="avviso ok-invio" style={{ marginBottom: 0 }}>
          <strong>
            {esito.simulato ? 'Simulata (non è partita davvero).' : 'Inviata.'}
          </strong>{' '}
          {d.ragioneSociale} è passata a «Email inviata».{' '}
          <Link href={`/lead/${d.leadId}`} style={{ textDecoration: 'underline' }}>
            Apri la scheda
          </Link>
        </div>
      </div>
    );
  }

  const bloccato = d.bloccanti.length > 0;

  return (
    <div className="riquadro scheda-invio">
      <div className="scheda-testa">
        <div>
          <Link href={`/lead/${d.leadId}`}>
            <h2>{d.ragioneSociale}</h2>
          </Link>
          <div className="secondario sottoriga">
            {d.settore} · {d.citta} · {d.email ?? 'nessuna email'}
          </div>
        </div>
        {d.sitoEsiste === false ? (
          <span className="targhetta allarme">nessun sito</span>
        ) : d.punteggio != null ? (
          <span
            className="targhetta"
            style={
              d.punteggio < 50 ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined
            }
          >
            sito {d.punteggio}/100
          </span>
        ) : null}
      </div>

      {d.riassuntoAttivita && (
        <section className="blocco">
          <h3>Cosa fa</h3>
          <p>{d.riassuntoAttivita}</p>
        </section>
      )}

      <section className="blocco">
        <h3>Com&apos;è il sito</h3>
        {d.riassuntoSito && <p>{d.riassuntoSito}</p>}
        {d.urlSito && (
          <p>
            <a href={d.urlSito} target="_blank" rel="noreferrer noopener" className="collegamento">
              {d.urlSito}
            </a>
          </p>
        )}
        {d.problemi.length > 0 && (
          <ul className="elenco-problemi" style={{ marginTop: 8 }}>
            {d.problemi.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        )}
      </section>

      {esito?.errore && (
        <div className="avviso pericolo">
          <strong>Non inviata.</strong> {esito.errore}
        </div>
      )}

      {bloccato && (
        <div className="avviso attenzione">
          <strong>Invio bloccato:</strong>
          <ul style={{ marginTop: 6, paddingLeft: 18 }}>
            {d.bloccanti.map((b, i) => (
              <li key={i} style={{ marginBottom: 2 }}>
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={invia}>
        <input type="hidden" name="id" value={d.bozzaId} />

        <details className="email-pieghevole">
          <summary>
            <span className="riga-oggetto">{d.oggetto}</span>
            <span className="apri">leggi e correggi</span>
          </summary>
          <div className="campo" style={{ marginTop: 14 }}>
            <label htmlFor={`ogg-${d.bozzaId}`}>Oggetto</label>
            <input id={`ogg-${d.bozzaId}`} name="oggetto" defaultValue={d.oggetto} />
          </div>
          <div className="campo">
            <label htmlFor={`corpo-${d.bozzaId}`}>Testo</label>
            <textarea
              id={`corpo-${d.bozzaId}`}
              name="corpo"
              defaultValue={d.corpo}
              style={{ minHeight: 280 }}
            />
            {d.modello && <p className="aiuto">Scritta da: {d.modello}</p>}
          </div>
        </details>

        <div className="barra-azioni">
          <button className="btn principale grande" type="submit" disabled={inCorso || bloccato}>
            {inCorso ? 'Invio in corso…' : bloccato ? 'Invio bloccato' : 'Invia email'}
          </button>
        </div>
      </form>

      <form action={rifiutaBozza} className="riga-rifiuto">
        <input type="hidden" name="id" value={d.bozzaId} />
        <input name="motivo" placeholder="Perché non va bene" aria-label="Motivo del rifiuto" />
        <button className="btn rosso piccolo" type="submit">
          Scarta e riscrivi
        </button>
      </form>
    </div>
  );
}
