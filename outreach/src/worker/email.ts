/**
 * Passo 3: scrive l'email su misura per il lead.
 *
 * Due strade:
 *  - con GROQ_API_KEY scrive l'LLM, a cui passo i problemi concreti trovati
 *    sul sito cosi' non puo' inventarseli;
 *  - senza chiave usa un modello di testo costruito sugli stessi dati.
 *
 * La seconda non e' un ripiego triste: produce email sensate e permette di
 * lavorare (e di fare prove) senza dipendere da un servizio esterno. Se l'LLM
 * non risponde o scrive qualcosa di inutilizzabile, si ricade li' invece di
 * bloccare tutto.
 */

import type { EsitoAnalisi } from './analisi';

export type DatiEmail = {
  ragioneSociale: string;
  settore: string;
  citta: string;
  email?: string | null;
};

export type EmailGenerata = {
  oggetto: string;
  corpo: string;
  modello: string;
};

const MODELLI_GROQ = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-20b',
];

/** Piè di pagina obbligatorio: identificazione del mittente e disiscrizione. */
export function piePagina(): string {
  const nome = process.env.AZIENDA_RAGIONE_SOCIALE || 'Astra Agency';
  const piva = process.env.AZIENDA_PIVA || '';
  const contatto = process.env.REPLY_TO || process.env.MITTENTE_EMAIL || '';
  const privacy = process.env.URL_PRIVACY || '';
  const disiscrizione = process.env.URL_DISISCRIZIONE || '';

  const righe = [
    '',
    '—',
    nome,
    piva ? `P.IVA ${piva}` : '',
    contatto,
    'astragency.it',
    // Chi siamo e come trattiamo i dati sta nell'informativa, non nel
    // piede dell'email: un link invece di cinque righe di burocrazia.
    privacy ? `Informativa privacy: ${privacy}` : '',
    '',
    disiscrizione
      ? `Se non desidera ricevere altre email da noi, può disiscriversi qui: ${disiscrizione}`
      : '',
  ].filter(Boolean);

  return righe.join('\n');
}

/**
 * Verifica che l'email sia spedibile per legge. Torna l'elenco di cosa manca:
 * se non e' vuoto, l'invio non deve partire.
 *
 * Il minimo perche' chi riceve sappia chi gli scrive e possa levarselo di
 * torno: un nome, un indirizzo a cui rispondere, l'informativa privacy (dove
 * stanno i dati del titolare per esteso) e una disiscrizione che funziona.
 * La P.IVA non e' richiesta: chi lavora in prestazione occasionale non ne ha
 * una, e la legge impone di identificarsi, non di avere una partita IVA.
 */
export function cosaMancaPerLegge(corpo: string): string[] {
  const manca: string[] = [];

  if (!process.env.URL_DISISCRIZIONE) manca.push('URL_DISISCRIZIONE non configurato nel .env');
  else if (!corpo.includes(process.env.URL_DISISCRIZIONE))
    manca.push('il link di disiscrizione non compare nel testo');

  if (!process.env.AZIENDA_RAGIONE_SOCIALE) manca.push('AZIENDA_RAGIONE_SOCIALE non configurata');

  if (!process.env.REPLY_TO && !process.env.MITTENTE_EMAIL)
    manca.push('manca un indirizzo a cui il destinatario possa rispondere');

  if (!process.env.URL_PRIVACY) manca.push('URL_PRIVACY non configurato (l’informativa privacy)');

  return manca;
}

// ── Modello di testo (sempre disponibile) ──────────────────────────────────

function oggettoDaProblemi(lead: DatiEmail, a: EsitoAnalisi): string {
  if (!a.sitoEsiste) return `${lead.ragioneSociale} non si trova su Google`;
  if (a.mobileOk === false) return `Il sito di ${lead.ragioneSociale} non si apre bene dal telefono`;
  if (a.tempoMs && a.tempoMs > 3000)
    return `Il sito di ${lead.ragioneSociale} ci mette ${(a.tempoMs / 1000).toFixed(1)} secondi ad aprirsi`;
  if (a.httpsOk === false) return `Il sito di ${lead.ragioneSociale} risulta «non sicuro»`;
  return `Due cose sul sito di ${lead.ragioneSociale}`;
}

function generaDaModello(lead: DatiEmail, a: EsitoAnalisi): EmailGenerata {
  const apertura = a.sitoEsiste
    ? `ho dato un'occhiata al sito di ${lead.ragioneSociale} e ho notato alcune cose che probabilmente vi stanno costando clienti.`
    : `cercavo ${lead.settore} a ${lead.citta} e sono arrivato a ${lead.ragioneSociale}, ma non ho trovato un sito: solo la scheda Google.`;

  const elenco = a.problemi
    .slice(0, 3)
    .map((p) => `· ${p}`)
    .join('\n');

  const chiusura = a.sitoEsiste
    ? `Se le va, in una call di venti minuti le mostro cosa cambierei e quanto costerebbe. Senza impegno: se poi decide di lasciare tutto com'è, nessun problema.`
    : `Se le va, in una call di venti minuti le faccio vedere cosa servirebbe davvero per un'attività come la sua e quanto costerebbe. Senza impegno.`;

  const corpo = `Buongiorno,

${apertura}

${elenco}

${chiusura}

Mi dica un paio di momenti in cui le è comodo e mi organizzo io.

${process.env.MITTENTE_NOME || 'Astra Agency'}
${piePagina()}`;

  return { oggetto: oggettoDaProblemi(lead, a), corpo, modello: 'modello-interno' };
}

// ── Generazione con LLM ────────────────────────────────────────────────────

async function generaConGroq(lead: DatiEmail, a: EsitoAnalisi): Promise<EmailGenerata | null> {
  const chiave = process.env.GROQ_API_KEY;
  if (!chiave) return null;

  const istruzioni = `Sei chi scrive le email commerciali di Astra Agency, un'agenzia italiana che fa siti web per piccole attività.

Scrivi UNA email a freddo, in italiano, dando del lei.

Regole non negoziabili:
- Parti da un problema CONCRETO fra quelli elencati. Non inventarne altri e non usarne di generici.
- Niente frasi da brochure ("soluzioni innovative", "siamo leader", "nell'era digitale").
- Niente complimenti falsi e niente urgenza inventata ("solo per oggi").
- Massimo 160 parole, corpo incluso. Frasi corte.
- Chiudi proponendo una call di venti minuti, senza impegno, e chiedendo quando gli è comodo.
- Non promettere risultati numerici che non possiamo garantire.
- Non scrivere la firma né il piè di pagina: li aggiungo io.

Rispondi SOLO con JSON valido: {"oggetto": "...", "corpo": "..."}
L'oggetto deve essere specifico e non sembrare pubblicità: massimo 60 caratteri.`;

  const contesto = `Attività: ${lead.ragioneSociale}
Settore: ${lead.settore}
Città: ${lead.citta}
Cosa fa: ${a.riassuntoAttivita}
Ha un sito: ${a.sitoEsiste ? `sì (${a.urlAnalizzato})` : 'no'}
Problemi trovati (usa SOLO questi):
${a.problemi.map((p) => `- ${p}`).join('\n')}`;

  for (const modello of MODELLI_GROQ) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chiave}` },
        body: JSON.stringify({
          model: modello,
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: istruzioni },
            { role: 'user', content: contesto },
          ],
        }),
      });

      // 400 e 404 vogliono dire "modello non piu' disponibile": provo il prossimo
      if (r.status === 400 || r.status === 404) continue;
      if (!r.ok) continue;

      const dati = await r.json();
      const grezzo = dati?.choices?.[0]?.message?.content;
      if (!grezzo) continue;

      const { oggetto, corpo } = JSON.parse(grezzo);
      if (typeof oggetto !== 'string' || typeof corpo !== 'string') continue;
      if (oggetto.trim().length < 5 || corpo.trim().length < 80) continue;

      return {
        oggetto: oggetto.trim(),
        corpo: `${corpo.trim()}\n\n${process.env.MITTENTE_NOME || 'Astra Agency'}\n${piePagina()}`,
        modello,
      };
    } catch {
      // rete, JSON malformato, modello che non collabora: passo al prossimo
    }
  }
  return null;
}

/** Scrive l'email. Con l'LLM se possibile, altrimenti col modello interno. */
export async function generaEmail(lead: DatiEmail, a: EsitoAnalisi): Promise<EmailGenerata> {
  return (await generaConGroq(lead, a)) ?? generaDaModello(lead, a);
}
