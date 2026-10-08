/**
 * Passo 4: manda davvero l'email.
 *
 * Usa l'API HTTP di Brevo e non SMTP. Due motivi: sui Worker di Cloudflare
 * non si possono aprire connessioni SMTP, e comunque una chiamata HTTP dice
 * molto piu' chiaramente cosa e' andato storto di un errore di protocollo.
 *
 * Questo e' il punto in cui un errore costa caro: un invio sbagliato non si
 * annulla, e bruciare il dominio significa finire nello spam per mesi. Per
 * questo prima di consegnare qualunque messaggio ci sono dei controlli, e
 * nessuno di essi dipende dal fatto che io me ne ricordi.
 *
 * L'interruttore principale e' INVIO_ATTIVO: finche' non vale "true" il
 * sistema si comporta normalmente ma NON consegna nulla. Serve a provare
 * tutto il giro senza che parta una riga verso una persona vera.
 */

import { db } from '@/lib/db';
import { cosaMancaPerLegge } from './email';
import { linkDisiscrizione } from './disiscrizione';
import { sincronizzaSoppressioni } from './soppressioni';

export type EsitoInvio =
  | { ok: true; simulato: boolean; messageId: string | null }
  | { ok: false; motivo: string; bloccante: true };

const EMAIL_VALIDA = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const API_BREVO = 'https://api.brevo.com/v3/smtp/email';

function invioAttivo(): boolean {
  return String(process.env.INVIO_ATTIVO).toLowerCase() === 'true';
}

function tettoGiornaliero(): number {
  const n = Number(process.env.INVII_MAX_GIORNO);
  return Number.isFinite(n) && n > 0 ? n : 25;
}

/** Quante email sono gia' partite oggi. */
export async function inviateOggi(): Promise<number> {
  const inizioGiorno = new Date();
  inizioGiorno.setHours(0, 0, 0, 0);
  return db.messaggio.count({ where: { direzione: 'USCITA', dataIl: { gte: inizioGiorno } } });
}

/**
 * Tutti i motivi per cui questa email NON deve partire.
 * Vuoto = via libera. Lo uso anche nella dashboard per spiegare, prima di
 * cliccare, perche' il tasto Invia e' spento.
 */
export async function motiviPerNonInviare(
  destinatario: string | null | undefined,
  corpo: string,
  { allinea = true }: { allinea?: boolean } = {},
): Promise<string[]> {
  const motivi: string[] = [];

  // Le disiscrizioni arrivano sul sito: prima di tutto ripesco l'elenco.
  if (allinea) {
    const sync = await sincronizzaSoppressioni();
    if (!sync.ok && !sync.listaAffidabile) {
      motivi.push(
        `Non riesco a leggere le disiscrizioni dal sito (${sync.motivo}) e la copia locale è vecchia: non posso garantire di non scrivere a chi ha chiesto di non essere contattato.`,
      );
    }
  }

  if (!destinatario || !EMAIL_VALIDA.test(destinatario)) {
    motivi.push('Manca un indirizzo email valido per questo lead.');
    return motivi; // senza destinatario il resto non ha senso
  }

  const soppresso = await db.soppressione.findUnique({
    where: { email: destinatario.toLowerCase() },
  });
  if (soppresso)
    motivi.push(`Questo indirizzo è nella lista di esclusione (${soppresso.motivo}): non va contattato.`);

  for (const m of cosaMancaPerLegge(corpo)) motivi.push(`Requisito di legge non soddisfatto: ${m}.`);

  const giaOggi = await inviateOggi();
  const tetto = tettoGiornaliero();
  if (giaOggi >= tetto)
    motivi.push(`Raggiunto il tetto di ${tetto} invii al giorno (${giaOggi} già partite). Riprova domani.`);

  if (!process.env.BREVO_API_KEY)
    motivi.push('BREVO_API_KEY non configurata: non c’è da dove spedire.');

  if (!process.env.MITTENTE_EMAIL) motivi.push('MITTENTE_EMAIL non configurata.');

  return motivi;
}

/**
 * Consegna l'email e registra il messaggio.
 * Registra anche quando e' simulata, cosi' la conversazione in dashboard e'
 * sempre il racconto fedele di cosa e' successo.
 */
export async function inviaEmail(opzioni: {
  leadId: string;
  bozzaId: string;
  destinatario: string;
  oggetto: string;
  corpo: string;
}): Promise<EsitoInvio> {
  const { leadId, bozzaId, destinatario, oggetto, corpo } = opzioni;

  const motivi = await motiviPerNonInviare(destinatario, corpo);
  if (motivi.length > 0) return { ok: false, motivo: motivi.join(' '), bloccante: true };

  const mittenteEmail = process.env.MITTENTE_EMAIL!;
  const mittenteNome = process.env.MITTENTE_NOME || 'Astra Agency';
  const rispondiA = process.env.REPLY_TO;
  const simulato = !invioAttivo();
  let messageId: string | null = null;

  if (!simulato) {
    const disiscrizione = await linkDisiscrizione(destinatario);
    const risposta = await fetch(API_BREVO, {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: mittenteNome, email: mittenteEmail },
        to: [{ email: destinatario }],
        ...(rispondiA ? { replyTo: { email: rispondiA, name: mittenteNome } } : {}),
        subject: oggetto,
        textContent: corpo,
        headers: {
          // Fa comparire il pulsante "Annulla iscrizione" dentro Gmail,
          // accanto al mittente: chi lo usa non preme "Spam". Il link e'
          // personalizzato, altrimenti Gmail manderebbe la richiesta e non
          // succederebbe niente.
          'List-Unsubscribe': `<${disiscrizione}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });

    if (!risposta.ok) {
      const dettaglio = await risposta.text().catch(() => '');
      await db.eventoLog.create({
        data: { leadId, tipo: 'INVIO_FALLITO', dettaglio: `${risposta.status}: ${dettaglio.slice(0, 300)}` },
      });
      return {
        ok: false,
        motivo: `Brevo ha rifiutato l'invio (${risposta.status}). ${dettaglio.slice(0, 200)}`,
        bloccante: true,
      };
    }

    messageId = ((await risposta.json().catch(() => ({}))) as { messageId?: string }).messageId ?? null;
  }

  await db.messaggio.create({
    data: {
      leadId,
      bozzaId,
      direzione: 'USCITA',
      messageId,
      mittente: `${mittenteNome} <${mittenteEmail}>`,
      destinatario,
      oggetto,
      corpo: simulato ? `[SIMULATO — INVIO_ATTIVO non è true]\n\n${corpo}` : corpo,
    },
  });

  await db.lead.update({ where: { id: leadId }, data: { stato: 'INVIATA' } });
  await db.eventoLog.create({
    data: {
      leadId,
      tipo: simulato ? 'EMAIL_SIMULATA' : 'EMAIL_INVIATA',
      dettaglio: `a ${destinatario}: ${oggetto}`,
    },
  });

  return { ok: true, simulato, messageId };
}
