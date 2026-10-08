/**
 * Tiene allineata la lista di chi non va contattato.
 *
 * Le disiscrizioni arrivano sul sito (Cloudflare Worker -> Firestore), non
 * qui: questo sistema gira sul portatile e puo' essere spento per giorni.
 * Quindi prima di ogni invio si ripesca l'elenco aggiornato.
 *
 * Se la sincronizzazione fallisce non si tira dritto allegramente: una
 * disiscrizione ignorata e' esattamente il genere di errore che non si
 * rimedia. Si procede solo se l'ultimo allineamento riuscito e' recente,
 * altrimenti l'invio si blocca.
 */

import { db } from '@/lib/db';

const ORE_DI_TOLLERANZA = 24;
const TIPO_EVENTO = 'SOPPRESSIONI_SINCRONIZZATE';

export type EsitoSync =
  | { ok: true; nuove: number; totale: number }
  | { ok: false; motivo: string; listaAffidabile: boolean };

async function ultimaSincronizzazione(): Promise<Date | null> {
  const e = await db.eventoLog.findFirst({
    where: { tipo: TIPO_EVENTO },
    orderBy: { creatoIl: 'desc' },
  });
  return e?.creatoIl ?? null;
}

export async function sincronizzaSoppressioni(): Promise<EsitoSync> {
  const base = process.env.URL_API_SITO;
  const chiave = process.env.ADMIN_API_KEY;

  if (!base || !chiave) {
    return {
      ok: false,
      motivo: 'URL_API_SITO o ADMIN_API_KEY non configurati: non posso leggere le disiscrizioni dal sito.',
      listaAffidabile: false,
    };
  }

  try {
    const controllo = new AbortController();
    const timer = setTimeout(() => controllo.abort(), 15000);
    const r = await fetch(`${base.replace(/\/$/, '')}/disiscrizioni`, {
      headers: { 'X-Astra-Key': chiave },
      signal: controllo.signal,
    });
    clearTimeout(timer);

    if (!r.ok) throw new Error(`il sito ha risposto ${r.status}`);

    const dati = (await r.json()) as { elenco?: Array<{ email?: string; motivo?: string }> };
    const elenco = (dati.elenco ?? []).filter((x) => x?.email);

    let nuove = 0;
    for (const voce of elenco) {
      const email = String(voce.email).toLowerCase().trim();
      const esisteva = await db.soppressione.findUnique({ where: { email } });
      if (!esisteva) nuove++;
      await db.soppressione.upsert({
        where: { email },
        create: { email, motivo: voce.motivo ?? 'DISISCRITTO' },
        update: { motivo: voce.motivo ?? 'DISISCRITTO' },
      });
      // Chi si e' disiscritto non e' piu' contattabile, anche se e' gia' un lead
      await db.lead.updateMany({
        where: { email, stato: { notIn: ['NON_CONTATTABILE', 'CLIENTE'] } },
        data: { stato: 'NON_CONTATTABILE' },
      });
    }

    await db.eventoLog.create({
      data: { tipo: TIPO_EVENTO, dettaglio: `${elenco.length} dal sito, ${nuove} nuove` },
    });

    return { ok: true, nuove, totale: elenco.length };
  } catch (e) {
    // Fallita: la lista locale e' ancora attendibile solo se e' fresca
    const ultima = await ultimaSincronizzazione();
    const oreFa = ultima ? (Date.now() - ultima.getTime()) / 3_600_000 : Infinity;
    return {
      ok: false,
      motivo: e instanceof Error ? e.message : 'errore sconosciuto',
      listaAffidabile: oreFa < ORE_DI_TOLLERANZA,
    };
  }
}
