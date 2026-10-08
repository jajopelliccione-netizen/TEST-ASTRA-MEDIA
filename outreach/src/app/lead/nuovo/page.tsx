'use client';

import { useActionState } from 'react';
import { creaLead } from '@/app/azioni';
import { FONTI, ETICHETTA_FONTE, TIPI_SOGGETTO, ETICHETTA_SOGGETTO } from '@/lib/tipi';

export default function NuovoLead() {
  const [stato, azione, inCorso] = useActionState(creaLead, null as { errore?: string } | null);

  return (
    <>
      <h1>Nuovo lead</h1>
      <p className="sottotitolo">
        Inserimento a mano. La ricerca automatica su Maps e Pagine Gialle arriverà dopo: lo
        schema dati è già quello definitivo, quindi non ci sarà da rifare nulla.
      </p>

      <form action={azione}>
        <div className="riquadro" style={{ maxWidth: 760 }}>
          {stato?.errore && (
            <div className="avviso pericolo">
              <strong>Non salvato.</strong> {stato.errore}
            </div>
          )}

          <h2>Attività</h2>
          <div className="campo">
            <label htmlFor="ragioneSociale">Nome attività *</label>
            <input id="ragioneSociale" name="ragioneSociale" required />
          </div>
          <div className="riga-campi">
            <div className="campo">
              <label htmlFor="settore">Settore *</label>
              <input id="settore" name="settore" placeholder="barbiere, ristorante, palestra…" required />
            </div>
            <div className="campo">
              <label htmlFor="citta">Città *</label>
              <input id="citta" name="citta" required />
            </div>
            <div className="campo">
              <label htmlFor="provincia">Provincia</label>
              <input id="provincia" name="provincia" placeholder="RM" maxLength={4} />
            </div>
          </div>

          <h2 style={{ marginTop: 22 }}>Contatti</h2>
          <div className="riga-campi">
            <div className="campo">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" />
            </div>
            <div className="campo">
              <label htmlFor="telefono">Telefono</label>
              <input id="telefono" name="telefono" placeholder="333 1234567" />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="sitoUrl">Sito attuale</label>
            <input id="sitoUrl" name="sitoUrl" placeholder="https://… (lascia vuoto se non ce l'ha)" />
            <p className="aiuto">
              Se lo lasci vuoto l&apos;analisi lo cercherà comunque, per evitare di scrivere a chi un
              sito ce l&apos;ha già e lo ha fatto bene.
            </p>
          </div>

          <h2 style={{ marginTop: 22 }}>Inquadramento</h2>
          <div className="riga-campi">
            <div className="campo">
              <label htmlFor="fonte">Fonte</label>
              <select id="fonte" name="fonte" defaultValue="MANUALE">
                {FONTI.map((f) => (
                  <option key={f} value={f}>
                    {ETICHETTA_FONTE[f]}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="tipoSoggetto">Tipo di soggetto</label>
              <select id="tipoSoggetto" name="tipoSoggetto" defaultValue="SCONOSCIUTO">
                {TIPI_SOGGETTO.map((t) => (
                  <option key={t} value={t}>
                    {ETICHETTA_SOGGETTO[t]}
                  </option>
                ))}
              </select>
              <p className="aiuto">
                Per una <strong>ditta individuale</strong> i contatti sono dati personali: serve più
                cautela e va controllato il Registro Pubblico delle Opposizioni.
              </p>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="note">Note</label>
            <textarea id="note" name="note" style={{ minHeight: 80 }} />
          </div>

          <div className="barra-azioni">
            <button className="btn principale" type="submit" disabled={inCorso}>
              {inCorso ? 'Salvataggio…' : 'Salva lead'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
