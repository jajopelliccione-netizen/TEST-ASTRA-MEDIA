import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import {
  ETICHETTA_STATO,
  COLORE_STATO,
  ETICHETTA_FONTE,
  ETICHETTA_SOGGETTO,
  STATI_LEAD,
  type StatoLead,
  type Fonte,
  type TipoSoggetto,
} from '@/lib/tipi';
import { dataLeggibile, leggiJson, linkWhatsapp } from '@/lib/util';
import { cambiaStatoLead, eliminaLead } from '@/app/azioni';

export const dynamic = 'force-dynamic';

export default async function DettaglioLead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      analisi: true,
      bozze: { orderBy: { creataIl: 'desc' } },
      messaggi: { orderBy: { dataIl: 'asc' }, include: { estrazione: true } },
      call: { orderBy: { inizio: 'asc' } },
    },
  });
  if (!lead) notFound();

  const soppressione = lead.email
    ? await db.soppressione.findUnique({ where: { email: lead.email } })
    : null;

  const problemi = leggiJson<string[]>(lead.analisi?.problemi, []);
  const haRisposto = lead.messaggi.some((m) => m.direzione === 'ENTRATA');
  const wa = haRisposto
    ? linkWhatsapp(
        lead.telefono,
        `Buongiorno, sono di Astra Agency. Le scrivo in merito alla mail sul sito di ${lead.ragioneSociale}.`,
      )
    : null;

  return (
    <>
      <Link href="/" className="secondario" style={{ fontSize: '.84rem' }}>
        ← Pipeline
      </Link>

      <h1 style={{ marginTop: 10 }}>{lead.ragioneSociale}</h1>
      <p className="sottotitolo">
        {lead.settore} · {lead.citta}
        {lead.provincia ? ` (${lead.provincia})` : ''}
      </p>

      {soppressione && (
        <div className="avviso pericolo">
          <strong>Da non contattare.</strong> Questo indirizzo è nella lista di esclusione
          ({soppressione.motivo}). Nessuna email deve partire verso questo lead.
        </div>
      )}
      {lead.tipoSoggetto === 'DITTA_INDIVIDUALE' && (
        <div className="avviso attenzione">
          <strong>Ditta individuale.</strong> I contatti sono dati personali: verifica il Registro
          Pubblico delle Opposizioni e tieni la base giuridica documentata.
        </div>
      )}

      <div className="due-colonne">
        <div>
          {/* ── Analisi del sito ─────────────────────────────────── */}
          <div className="riquadro">
            <h2>Analisi del sito</h2>
            {!lead.analisi ? (
              <p className="secondario" style={{ fontSize: '.86rem' }}>
                Non ancora analizzato. Lo farà il worker di analisi (passo 2), oppure puoi
                aggiungere i dati a mano quando quella parte sarà pronta.
              </p>
            ) : (
              <>
                <div className="dato">
                  <span className="chiave">Sito esistente</span>
                  <span className="valore">
                    {lead.analisi.sitoEsiste ? (
                      lead.analisi.urlAnalizzato ? (
                        <a href={lead.analisi.urlAnalizzato} target="_blank" rel="noreferrer noopener">
                          {lead.analisi.urlAnalizzato}
                        </a>
                      ) : (
                        'sì'
                      )
                    ) : (
                      <span style={{ color: 'var(--pink)' }}>no</span>
                    )}
                  </span>
                </div>
                {lead.analisi.punteggio != null && (
                  <div className="dato">
                    <span className="chiave">Punteggio qualità</span>
                    <span
                      className="valore"
                      style={{
                        color: lead.analisi.punteggio < 50 ? 'var(--amber)' : 'var(--green)',
                      }}
                    >
                      {lead.analisi.punteggio}/100
                    </span>
                  </div>
                )}
                {lead.analisi.lcpMs != null && (
                  <div className="dato">
                    <span className="chiave">Tempo di caricamento</span>
                    <span className="valore">{(lead.analisi.lcpMs / 1000).toFixed(1)} s</span>
                  </div>
                )}
                <div className="dato">
                  <span className="chiave">Adatto al telefono</span>
                  <span className="valore">{lead.analisi.mobileOk === false ? 'no' : lead.analisi.mobileOk ? 'sì' : '—'}</span>
                </div>
                <div className="dato">
                  <span className="chiave">HTTPS</span>
                  <span className="valore">{lead.analisi.httpsOk === false ? 'no' : lead.analisi.httpsOk ? 'sì' : '—'}</span>
                </div>

                {problemi.length > 0 && (
                  <>
                    <h2 style={{ marginTop: 18, fontSize: '.9rem' }}>Problemi trovati</h2>
                    <ul className="elenco-problemi">
                      {problemi.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>

          {/* ── Conversazione ────────────────────────────────────── */}
          <div className="riquadro">
            <h2>Conversazione</h2>
            {lead.messaggi.length === 0 ? (
              <p className="secondario" style={{ fontSize: '.86rem' }}>
                Nessuna email ancora scambiata.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {lead.messaggi.map((m) => (
                  <div
                    key={m.id}
                    className={`email ${m.direzione === 'ENTRATA' ? 'entrata' : 'uscita'}`}
                  >
                    <div className="secondario" style={{ fontSize: '.75rem', marginBottom: 6 }}>
                      {m.direzione === 'ENTRATA' ? '← ricevuta' : '→ inviata'} ·{' '}
                      {dataLeggibile(m.dataIl)}
                    </div>
                    <div className="oggetto">{m.oggetto}</div>
                    <div className="corpo">{m.corpo}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Bozze ────────────────────────────────────────────── */}
          {lead.bozze.length > 0 && (
            <div className="riquadro">
              <h2>Bozze email</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                {lead.bozze.map((b) => (
                  <div key={b.id} className="email">
                    <div className="secondario" style={{ fontSize: '.75rem', marginBottom: 6 }}>
                      v{b.versione} · {b.stato.toLowerCase().replace('_', ' ')} ·{' '}
                      {dataLeggibile(b.creataIl)}
                      {b.motivoRifiuto ? ` · motivo: ${b.motivoRifiuto}` : ''}
                    </div>
                    <div className="oggetto">{b.oggetto}</div>
                    <div className="corpo">{b.corpo}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Colonna destra ─────────────────────────────────────── */}
        <div>
          <div className="riquadro">
            <h2>Dati</h2>
            <div className="dato">
              <span className="chiave">Stato</span>
              <span className="valore">
                <span className="stato">
                  <span
                    className="punto"
                    style={{ background: COLORE_STATO[lead.stato as StatoLead] ?? '#888' }}
                  />
                  {ETICHETTA_STATO[lead.stato as StatoLead] ?? lead.stato}
                </span>
              </span>
            </div>
            <div className="dato">
              <span className="chiave">Email</span>
              <span className="valore">{lead.email ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="chiave">Telefono</span>
              <span className="valore">{lead.telefono ?? '—'}</span>
            </div>
            <div className="dato">
              <span className="chiave">Fonte</span>
              <span className="valore">{ETICHETTA_FONTE[lead.fonte as Fonte] ?? lead.fonte}</span>
            </div>
            <div className="dato">
              <span className="chiave">Soggetto</span>
              <span className="valore">
                {ETICHETTA_SOGGETTO[lead.tipoSoggetto as TipoSoggetto] ?? lead.tipoSoggetto}
              </span>
            </div>
            <div className="dato">
              <span className="chiave">Base giuridica</span>
              <span className="valore">{lead.baseGiuridica.toLowerCase().replace('_', ' ')}</span>
            </div>
            <div className="dato">
              <span className="chiave">Inserito</span>
              <span className="valore">{dataLeggibile(lead.creatoIl)}</span>
            </div>
            {lead.note && (
              <div style={{ marginTop: 12, fontSize: '.84rem', lineHeight: 1.55, color: '#d9d4f5' }}>
                {lead.note}
              </div>
            )}
          </div>

          {lead.call.length > 0 && (
            <div className="riquadro">
              <h2>Call</h2>
              {lead.call.map((c) => (
                <div className="dato" key={c.id}>
                  <span className="chiave">{dataLeggibile(c.inizio)}</span>
                  <span className="valore">
                    {c.stato.toLowerCase().replace('_', ' ')}
                    {c.meetUrl && (
                      <>
                        {' · '}
                        <a href={c.meetUrl} target="_blank" rel="noreferrer noopener">
                          Meet
                        </a>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="riquadro">
            <h2>Azioni</h2>

            {wa ? (
              <a className="btn whatsapp" href={wa} target="_blank" rel="noreferrer noopener" style={{ width: '100%' }}>
                Apri chat WhatsApp
              </a>
            ) : (
              <p className="secondario" style={{ fontSize: '.79rem', lineHeight: 1.5 }}>
                {haRisposto
                  ? 'WhatsApp non disponibile: manca un numero di cellulare valido.'
                  : 'WhatsApp si attiva solo dopo che il cliente ha risposto via email (regole Meta).'}
              </p>
            )}

            <form action={cambiaStatoLead} style={{ marginTop: 14 }}>
              <input type="hidden" name="id" value={lead.id} />
              <div className="campo">
                <label htmlFor="stato">Sposta a</label>
                <select id="stato" name="stato" defaultValue={lead.stato}>
                  {STATI_LEAD.map((s) => (
                    <option key={s} value={s}>
                      {ETICHETTA_STATO[s]}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn" type="submit" style={{ width: '100%' }}>
                Aggiorna stato
              </button>
            </form>

            <form action={eliminaLead} style={{ marginTop: 10 }}>
              <input type="hidden" name="id" value={lead.id} />
              <button className="btn rosso piccolo" type="submit" style={{ width: '100%' }}>
                Elimina definitivamente
              </button>
            </form>
            <p className="secondario" style={{ fontSize: '.73rem', marginTop: 6, lineHeight: 1.45 }}>
              Cancella davvero il lead e tutto il suo storico: è la risposta a una richiesta di
              cancellazione dati.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
