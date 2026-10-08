import Link from 'next/link';
import { db } from '@/lib/db';
import { approvaBozza, rifiutaBozza } from '@/app/azioni';
import { dataLeggibile, leggiJson } from '@/lib/util';

export const dynamic = 'force-dynamic';

export default async function Approvazioni() {
  const bozze = await db.bozzaEmail.findMany({
    where: { stato: 'DA_APPROVARE' },
    orderBy: { creataIl: 'asc' },
    include: { lead: { include: { analisi: true } } },
  });

  return (
    <>
      <h1>Email da approvare</h1>
      <p className="sottotitolo">
        Nessuna email parte senza il tuo via libera. Puoi correggere il testo qui prima di
        approvare: viene salvata la versione che leggi adesso.
      </p>

      {bozze.length === 0 ? (
        <div className="riquadro">
          <div className="vuoto">
            Niente in attesa.
            <br />
            Quando il generatore produrrà nuove bozze le troverai qui.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {bozze.map((b) => {
            const problemi = leggiJson<string[]>(b.lead.analisi?.problemi, []);
            return (
              <div className="riquadro" key={b.id}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 14,
                    flexWrap: 'wrap',
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <Link href={`/lead/${b.leadId}`}>
                      <h2 style={{ marginBottom: 2 }}>{b.lead.ragioneSociale}</h2>
                    </Link>
                    <div className="secondario" style={{ fontSize: '.82rem' }}>
                      {b.lead.settore} · {b.lead.citta} · a {b.lead.email ?? 'nessuna email'}
                    </div>
                  </div>
                  <div className="secondario" style={{ fontSize: '.78rem' }}>
                    v{b.versione} · {dataLeggibile(b.creataIl)}
                    {b.modelloLlm ? ` · ${b.modelloLlm}` : ''}
                  </div>
                </div>

                {!b.lead.email && (
                  <div className="avviso pericolo">
                    <strong>Manca l&apos;indirizzo email.</strong> Puoi approvare il testo, ma
                    l&apos;invio non potrà partire finché non lo aggiungi.
                  </div>
                )}

                {problemi.length > 0 && (
                  <div className="avviso info">
                    <strong>Su cosa fa leva questa email:</strong> {problemi.join(' · ')}
                  </div>
                )}

                <form action={approvaBozza}>
                  <input type="hidden" name="id" value={b.id} />
                  <div className="campo">
                    <label htmlFor={`ogg-${b.id}`}>Oggetto</label>
                    <input id={`ogg-${b.id}`} name="oggetto" defaultValue={b.oggetto} />
                  </div>
                  <div className="campo">
                    <label htmlFor={`corpo-${b.id}`}>Testo</label>
                    <textarea
                      id={`corpo-${b.id}`}
                      name="corpo"
                      defaultValue={b.corpo}
                      style={{ minHeight: 230 }}
                    />
                    <p className="aiuto">
                      Controlla che ci siano identificazione del mittente e link di disiscrizione:
                      senza, l&apos;email non è a norma.
                    </p>
                  </div>
                  <div className="barra-azioni">
                    <button className="btn verde" type="submit">
                      Approva
                    </button>
                  </div>
                </form>

                <form action={rifiutaBozza} style={{ marginTop: 12 }}>
                  <input type="hidden" name="id" value={b.id} />
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      name="motivo"
                      placeholder="Perché la rifiuti (serve a migliorare le prossime)"
                      style={{
                        flex: 1,
                        minWidth: 240,
                        background: 'rgba(255,255,255,.04)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: '9px 12px',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-body)',
                        fontSize: '.85rem',
                      }}
                    />
                    <button className="btn rosso" type="submit">
                      Rifiuta e rigenera
                    </button>
                  </div>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
