import Link from 'next/link';
import { db } from '@/lib/db';
import { fissaCall, escludiContatto } from '@/app/azioni';
import { COLORE_INTERESSE, type LivelloInteresse, type Fascia } from '@/lib/tipi';
import { dataLeggibile, leggiJson, linkWhatsapp, orariProposti } from '@/lib/util';

export const dynamic = 'force-dynamic';

/** Valore per <input type="datetime-local">, in ora locale. */
function perInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function Risposte() {
  // Le risposte in entrata che l'AI ha gia' letto, piu' recenti prima.
  const messaggi = await db.messaggio.findMany({
    where: { direzione: 'ENTRATA' },
    orderBy: { dataIl: 'desc' },
    take: 80,
    include: { estrazione: true, lead: { include: { call: true } } },
  });

  const daGuardare = messaggi.filter((m) => m.estrazione?.richiedeAttenzione).length;

  return (
    <>
      <h1>Risposte</h1>
      <p className="sottotitolo">
        Cosa ha capito l&apos;AI da ogni risposta: interesse, disponibilità, numero di telefono.
        Da qui scegli l&apos;orario della call.
      </p>

      {daGuardare > 0 && (
        <div className="avviso attenzione">
          <strong>
            {daGuardare} risposta{daGuardare > 1 ? 'e' : ''} da guardare a mano.
          </strong>{' '}
          L&apos;AI non se l&apos;è sentita di decidere: sono segnate qui sotto.
        </div>
      )}

      {messaggi.length === 0 ? (
        <div className="riquadro">
          <div className="vuoto">
            Nessuna risposta ancora.
            <br />
            Qui arriveranno le risposte lette e sintetizzate dall&apos;AI.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {messaggi.map((m) => {
            const e = m.estrazione;
            const fasce = leggiJson<Fascia[]>(e?.disponibilita, []);
            const domande = leggiJson<string[]>(e?.domande, []);
            const proposte = orariProposti(fasce);
            const telefono = e?.telefono ?? m.lead.telefono;
            const wa = linkWhatsapp(
              telefono,
              `Buongiorno, sono di Astra Agency. Le scrivo per la call su ${m.lead.ragioneSociale}.`,
            );
            const callGiaFissata = m.lead.call.length > 0;

            return (
              <div
                className="riquadro"
                key={m.id}
                style={e?.richiedeAttenzione ? { borderColor: 'var(--amber)' } : undefined}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 14,
                    flexWrap: 'wrap',
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <Link href={`/lead/${m.leadId}`}>
                      <h2 style={{ marginBottom: 2 }}>{m.lead.ragioneSociale}</h2>
                    </Link>
                    <div className="secondario" style={{ fontSize: '.82rem' }}>
                      {m.lead.settore} · {m.lead.citta} · {dataLeggibile(m.dataIl)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {e && (
                      <span
                        className="targhetta"
                        style={{
                          borderColor: COLORE_INTERESSE[e.interesse as LivelloInteresse],
                          color: COLORE_INTERESSE[e.interesse as LivelloInteresse],
                        }}
                      >
                        interesse {e.interesse.toLowerCase().replace('_', ' ')}
                      </span>
                    )}
                    {callGiaFissata && <span className="targhetta ok">call fissata</span>}
                  </div>
                </div>

                {e?.richiedeAttenzione && (
                  <div className="avviso attenzione">
                    <strong>Serve il tuo occhio.</strong> {e.motivoAttenzione ?? 'Risposta ambigua.'}
                  </div>
                )}

                <div className="due-colonne">
                  <div>
                    <div className="email entrata">
                      <div className="oggetto">{m.oggetto}</div>
                      <div className="corpo">{m.corpo}</div>
                    </div>

                    {e && (
                      <div style={{ marginTop: 14 }}>
                        <h2 style={{ fontSize: '.9rem' }}>Riassunto dell&apos;AI</h2>
                        <p style={{ fontSize: '.86rem', lineHeight: 1.6, color: '#d9d4f5' }}>
                          {e.riassunto}
                        </p>
                        {domande.length > 0 && (
                          <>
                            <h2 style={{ fontSize: '.9rem', marginTop: 14 }}>Domande poste</h2>
                            <ul className="elenco-problemi">
                              {domande.map((d, i) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="dato">
                      <span className="chiave">Telefono</span>
                      <span className="valore">{telefono ?? '—'}</span>
                    </div>
                    <div className="dato">
                      <span className="chiave">Disponibilità</span>
                      <span className="valore">
                        {fasce.length === 0
                          ? 'non indicata'
                          : fasce.map((f) => `${f.giorno} ${f.dalle}–${f.alle}`).join(', ')}
                      </span>
                    </div>

                    <h2 style={{ fontSize: '.9rem', marginTop: 18 }}>Fissa la call</h2>
                    {proposte.length > 0 && (
                      <>
                        <p className="secondario" style={{ fontSize: '.78rem', marginBottom: 8 }}>
                          Orari ricavati da quanto ha scritto:
                        </p>
                        <div className="orari" style={{ marginBottom: 12 }}>
                          {proposte.map((d) => (
                            <form action={fissaCall} key={d.toISOString()}>
                              <input type="hidden" name="leadId" value={m.leadId} />
                              <input type="hidden" name="inizio" value={perInput(d)} />
                              <button className="btn piccolo" type="submit">
                                {dataLeggibile(d)}
                              </button>
                            </form>
                          ))}
                        </div>
                      </>
                    )}

                    <form action={fissaCall}>
                      <input type="hidden" name="leadId" value={m.leadId} />
                      <div className="campo">
                        <label htmlFor={`quando-${m.id}`}>Oppure scegli tu</label>
                        <input
                          id={`quando-${m.id}`}
                          type="datetime-local"
                          name="inizio"
                          required
                        />
                      </div>
                      <div className="campo">
                        <label htmlFor={`meet-${m.id}`}>Link Meet</label>
                        <input
                          id={`meet-${m.id}`}
                          name="meetUrl"
                          placeholder="https://meet.google.com/…"
                        />
                      </div>
                      <button className="btn principale" type="submit" style={{ width: '100%' }}>
                        Fissa la call
                      </button>
                    </form>

                    {wa ? (
                      <a
                        className="btn whatsapp"
                        href={wa}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{ width: '100%', marginTop: 10 }}
                      >
                        Apri chat WhatsApp
                      </a>
                    ) : (
                      <p className="secondario" style={{ fontSize: '.76rem', marginTop: 10, lineHeight: 1.5 }}>
                        WhatsApp non disponibile: manca un numero di cellulare valido.
                      </p>
                    )}

                    <form action={escludiContatto} style={{ marginTop: 10 }}>
                      <input type="hidden" name="email" value={m.lead.email ?? ''} />
                      <input type="hidden" name="motivo" value="RICHIESTA_CANCELLAZIONE" />
                      <button
                        className="btn rosso piccolo"
                        type="submit"
                        style={{ width: '100%' }}
                        disabled={!m.lead.email}
                      >
                        Non vuole essere contattato
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
