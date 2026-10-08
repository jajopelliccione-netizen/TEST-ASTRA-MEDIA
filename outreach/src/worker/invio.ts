/**
 * Passo 4: manda davvero l'email.
 *
 * Questo e' il punto in cui un errore costa caro: un invio sbagliato non si
 * annulla, e bruciare il dominio significa finire nello spam per mesi. Per
 * questo prima di consegnare qualunque messaggio ci sono cinque controlli, e
 * nessuno di essi dipende dal fatto che io me ne ricordi.
 *
 * L'interruttore principale e' INVIO_ATTIVO: finche' non vale "true" il
 * sistema si comporta normalmente ma NON consegna nulla. Serve a provare tutto
 * il giro — bozza, approvazione, tasto, stati — senza che parta una riga verso
 * una persona vera.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { db } from '@/lib/db';
import { cosaMancaPerLegge } from './email';

export type EsitoInvio =
  | { ok: true; simulato: boolean; messageId: string | null }
  | { ok: false; motivo: string; bloccante: true };

const EMAIL_VALIDA = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

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
  return db.messaggio.count({
    where: { direzione: 'USCITA', dataIl: { gte: inizioGiorno } },
  });
}

/**
 * Tutti i motivi per cui questa email NON deve partire.
 * Vuoto = via libera. Lo uso anche nella dashboard per spiegare, prima di
 * cliccare, perche' il tasto Invia e' spento.
 */
export async function motiviPerNonInviare(
  destinatario: string | null | undefined,
  corpo: string,
): Promise<string[]> {
  const motivi: string[] = [];

  if (!destinatario || !EMAIL_VALIDA.test(destinatario)) {
    motivi.push('Manca un indirizzo email valido per questo lead.');
    return motivi; // senza destinatario il resto non ha senso
  }

  const soppresso = await db.soppressione.findUnique({
    where: { email: destinatario.toLowerCase() },
  });
  if (soppresso)
    motivi.push(`Questo indirizzo è nella lista di esclusione (${soppresso.motivo}): non va contattato.`);

  const manca = cosaMancaPerLegge(corpo);
  for (const m of manca) motivi.push(`Requisito di legge non soddisfatto: ${m}.`);

  const giaOggi = await inviateOggi();
  const tetto = tettoGiornaliero();
  if (giaOggi >= tetto)
    motivi.push(`Raggiunto il tetto di ${tetto} invii al giorno (${giaOggi} già partite). Riprova domani.`);

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD)
    motivi.push('SMTP non configurato nel .env: non c’è da dove spedire.');

  if (!process.env.MITTENTE_EMAIL) motivi.push('MITTENTE_EMAIL non configurata.');

  return motivi;
}

let trasportoCache: Transporter | null = null;
function trasporto(): Transporter {
  if (trasportoCache) return trasportoCache;
  trasportoCache = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
  });
  return trasportoCache;
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

  const mittente = `${process.env.MITTENTE_NOME || 'Astra Agency'} <${process.env.MITTENTE_EMAIL}>`;
  const simulato = !invioAttivo();
  let messageId: string | null = null;

  if (!simulato) {
    const esito = await trasporto().sendMail({
      from: mittente,
      to: destinatario,
      subject: oggetto,
      text: corpo,
      headers: {
        // Permette al destinatario di disiscriversi dal suo client di posta:
        // riduce molto la probabilita' che segni come spam invece di uscire.
        'List-Unsubscribe': `<${process.env.URL_DISISCRIZIONE}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    messageId = esito.messageId ?? null;
  }

  await db.messaggio.create({
    data: {
      leadId,
      bozzaId,
      direzione: 'USCITA',
      messageId,
      mittente,
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
