import Link from 'next/link';
import { db } from '@/lib/db';
import {
  PIPELINE,
  ETICHETTA_STATO,
  COLORE_STATO,
  ETICHETTA_FONTE,
  type StatoLead,
  type Fonte,
} from '@/lib/tipi';
import { dataBreve } from '@/lib/util';

export const dynamic = 'force-dynamic';

export default async function Pipeline({
  searchParams,
}: {
  searchParams: Promise<{ stato?: string; q?: string }>;
}) {
  const { stato, q } = await searchParams;

  const filtro: Record<string, unknown> = {};
  if (stato && stato !== 'tutti') filtro.stato = stato;
  if (q) {
    filtro.OR = [
      { ragioneSociale: { contains: q } },
      { citta: { contains: q } },
      { settore: { contains: q } },
    ];
  }

  const [lead, conteggi, totale] = await Promise.all([
    db.lead.findMany({
      where: filtro,
      orderBy: { aggiornatoIl: 'desc' },
      take: 200,
      include: { analisi: true },
    }),
    db.lead.groupBy({ by: ['stato'], _count: { _all: true } }),
    db.lead.count(),
  ]);

  const perStato = new Map(conteggi.map((c) => [c.stato, c._count._all]));

  return (
    <>
      <h1>Pipeline</h1>
      <p className="sottotitolo">
        {totale === 0
          ? 'Nessun lead ancora. Inizia inserendone uno a mano.'
          : `${totale} lead in totale. Clicca una tessera per filtrare.`}
      </p>

      <div className="griglia-stati">
        {PIPELINE.map((s) => (
          <Link
            key={s}
            href={stato === s ? '/' : `/?stato=${s}`}
            className="tessera"
            style={stato === s ? { borderColor: COLORE_STATO[s] } : undefined}
          >
            <div className="numero" style={{ color: COLORE_STATO[s] }}>
              {perStato.get(s) ?? 0}
            </div>
            <div className="etichetta">{ETICHETTA_STATO[s]}</div>
          </Link>
        ))}
      </div>

      <div className="riquadro">
        <form method="get" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Cerca per nome, città o settore…"
            style={{
              flex: 1,
              minWidth: 220,
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '9px 12px',
              color: 'var(--text)',
              fontFamily: 'var(--font-body)',
              fontSize: '.88rem',
            }}
          />
          {stato && <input type="hidden" name="stato" value={stato} />}
          <button className="btn" type="submit">
            Cerca
          </button>
          {(q || stato) && (
            <Link className="btn" href="/">
              Azzera
            </Link>
          )}
        </form>

        {lead.length === 0 ? (
          <div className="vuoto">
            Nessun lead con questi criteri.
            <br />
            <Link className="btn principale" href="/lead/nuovo" style={{ marginTop: 16 }}>
              + Inserisci il primo lead
            </Link>
          </div>
        ) : (
          <div className="scorri-x">
            <table className="tabella">
              <thead>
                <tr>
                  <th>Attività</th>
                  <th>Settore</th>
                  <th>Città</th>
                  <th>Sito</th>
                  <th>Stato</th>
                  <th>Fonte</th>
                  <th>Aggiornato</th>
                </tr>
              </thead>
              <tbody>
                {lead.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/lead/${l.id}`}>
                        <div className="nome">{l.ragioneSociale}</div>
                        <div className="secondario">{l.email ?? l.telefono ?? 'nessun contatto'}</div>
                      </Link>
                    </td>
                    <td className="secondario" data-etichetta="Settore">{l.settore}</td>
                    <td className="secondario" data-etichetta="Città">
                      {l.citta}
                      {l.provincia ? ` (${l.provincia})` : ''}
                    </td>
                    <td data-etichetta="Sito">
                      {!l.analisi ? (
                        <span className="secondario">da analizzare</span>
                      ) : !l.analisi.sitoEsiste ? (
                        <span className="targhetta allarme">nessun sito</span>
                      ) : (
                        <span
                          className="targhetta"
                          style={
                            (l.analisi.punteggio ?? 100) < 50
                              ? { borderColor: 'var(--amber)', color: 'var(--amber)' }
                              : undefined
                          }
                        >
                          punteggio {l.analisi.punteggio ?? '—'}
                        </span>
                      )}
                    </td>
                    <td data-etichetta="Stato">
                      <span className="stato">
                        <span
                          className="punto"
                          style={{ background: COLORE_STATO[l.stato as StatoLead] ?? '#888' }}
                        />
                        {ETICHETTA_STATO[l.stato as StatoLead] ?? l.stato}
                      </span>
                    </td>
                    <td className="secondario" data-etichetta="Fonte">
                      {ETICHETTA_FONTE[l.fonte as Fonte] ?? l.fonte}
                    </td>
                    <td className="secondario" data-etichetta="Aggiornato">{dataBreve(l.aggiornatoIl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
