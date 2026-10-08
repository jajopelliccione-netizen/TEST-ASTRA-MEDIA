/**
 * Passo 2: guarda il sito del lead e dice com'e' messo.
 *
 * Usa `fetch` e non un browser vero: e' cento volte piu' veloce e per decidere
 * "vale la pena scrivergli?" basta ampiamente. I numeri che ne escono sono
 * onesti su cosa misurano — il tempo e' quello di consegna dell'HTML, non il
 * Largest Contentful Paint vero, che richiederebbe Chromium.
 */

export type EsitoAnalisi = {
  sitoEsiste: boolean;
  urlAnalizzato: string | null;
  httpsOk: boolean | null;
  mobileOk: boolean | null;
  tempoMs: number | null;
  pesoKb: number | null;
  punteggio: number;
  problemi: string[];
  titoloSito: string | null;
  riassuntoAttivita: string;
  riassuntoSito: string;
};

export type DatiLead = {
  ragioneSociale: string;
  settore: string;
  citta: string;
  sitoUrl?: string | null;
};

const TIMEOUT_MS = 12000;

/** Prova https://, poi http://, poi con www. Restituisce la prima che risponde. */
async function trovaSito(url: string): Promise<{ risposta: Response; url: string } | null> {
  const pulito = url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const candidati = [
    `https://${pulito}`,
    `https://www.${pulito}`,
    `http://${pulito}`,
  ];
  // Il doppio www. capita quando l'utente incolla gia' www: lo tolgo
  const unici = [...new Set(candidati.map((u) => u.replace('www.www.', 'www.')))];

  for (const u of unici) {
    try {
      const controllo = new AbortController();
      const timer = setTimeout(() => controllo.abort(), TIMEOUT_MS);
      const risposta = await fetch(u, {
        redirect: 'follow',
        signal: controllo.signal,
        headers: { 'User-Agent': 'AstraAgency-SiteCheck/1.0 (+https://astragency.it)' },
      });
      clearTimeout(timer);
      if (risposta.ok) return { risposta, url: risposta.url || u };
    } catch {
      // host inesistente, certificato rotto, timeout: provo il prossimo
    }
  }
  return null;
}

function testoVisibile(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function primoGruppo(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1]?.trim() || null;
}

/**
 * Riassunto dell'attivita'. Se il sito c'e', lo ricava da titolo, descrizione e
 * primo testo della home. Se non c'e', dice onestamente cosa sappiamo invece di
 * inventare.
 */
function riassumiAttivita(lead: DatiLead, html: string | null, titolo: string | null): string {
  if (!html) {
    return `${lead.ragioneSociale} è ${articolo(lead.settore)} ${lead.settore} a ${lead.citta}. Online non c'è un sito: quello che si trova sono solo scheda Google e social, quindi tutto quello che si sa dell'attività lo decidono altri.`;
  }

  const descrizione =
    primoGruppo(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
    primoGruppo(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

  const testo = testoVisibile(html).slice(0, 400);

  const pezzi: string[] = [`${lead.ragioneSociale}, ${lead.settore} a ${lead.citta}.`];
  if (titolo) pezzi.push(`Si presenta come «${titolo.slice(0, 90)}».`);
  if (descrizione) pezzi.push(descrizione.slice(0, 180));
  else if (testo.length > 60) pezzi.push(`In home: «${testo.slice(0, 150)}…».`);

  return pezzi.join(' ');
}

function articolo(settore: string): string {
  return /^[aeiou]/i.test(settore) ? "un'" : 'un';
}

/** Frase unica che riassume lo stato del sito, da mostrare in dashboard. */
function riassumiSito(e: Omit<EsitoAnalisi, 'riassuntoSito' | 'riassuntoAttivita'>): string {
  if (!e.sitoEsiste) return 'Nessun sito raggiungibile.';
  if (e.problemi.length === 0)
    return `Il sito funziona e non ha problemi evidenti (punteggio ${e.punteggio}/100): probabilmente non è un buon lead.`;

  const gravi = e.problemi.slice(0, 2).join('; ');
  const altri = e.problemi.length > 2 ? ` e altri ${e.problemi.length - 2} problemi` : '';
  return `Punteggio ${e.punteggio}/100. ${gravi}${altri}.`;
}

export async function analizzaSito(lead: DatiLead): Promise<EsitoAnalisi> {
  const problemi: string[] = [];

  if (!lead.sitoUrl) {
    const base = {
      sitoEsiste: false,
      urlAnalizzato: null,
      httpsOk: null,
      mobileOk: null,
      tempoMs: null,
      pesoKb: null,
      punteggio: 0,
      problemi: [
        'Nessun sito: online esistono solo scheda Google e social',
        'Chi cerca il servizio su Google non trova l’attività',
        'Nessun modo di farsi contattare se non per telefono',
      ],
      titoloSito: null,
    };
    return { ...base, riassuntoAttivita: riassumiAttivita(lead, null, null), riassuntoSito: riassumiSito(base) };
  }

  const inizio = Date.now();
  const trovato = await trovaSito(lead.sitoUrl);
  const tempoMs = Date.now() - inizio;

  if (!trovato) {
    const base = {
      sitoEsiste: false,
      urlAnalizzato: null,
      httpsOk: null,
      mobileOk: null,
      tempoMs: null,
      pesoKb: null,
      punteggio: 0,
      problemi: [
        `L’indirizzo ${lead.sitoUrl} non risponde: il sito è offline o l’indirizzo è sbagliato`,
        'Chi lo cerca trova una pagina di errore',
      ],
      titoloSito: null,
    };
    return { ...base, riassuntoAttivita: riassumiAttivita(lead, null, null), riassuntoSito: riassumiSito(base) };
  }

  const { risposta, url } = trovato;
  const html = await risposta.text();
  const pesoKb = Math.round(new TextEncoder().encode(html).length / 1024);
  const httpsOk = url.startsWith('https://');
  const titolo = primoGruppo(html, /<title[^>]*>([\s\S]*?)<\/title>/i);

  // Senza <meta viewport> il telefono mostra la versione desktop rimpicciolita:
  // e' il singolo segnale piu' affidabile di sito vecchio.
  const mobileOk = /<meta[^>]+name=["']viewport["']/i.test(html);

  if (!httpsOk) problemi.push('Senza HTTPS: il browser lo segnala come «non sicuro» ai visitatori');
  if (!mobileOk) problemi.push('Non adatto al telefono: manca l’impostazione per gli schermi piccoli, si vede rimpicciolito');
  if (tempoMs > 3000) problemi.push(`Lento: ci mette ${(tempoMs / 1000).toFixed(1)} secondi solo a consegnare la pagina`);
  if (pesoKb > 2000) problemi.push(`Pagina pesante: ${pesoKb} KB di solo HTML, si apre male da rete mobile`);

  // Anno vecchio nel piè di pagina: fa pensare che l'attività sia chiusa
  const anni = [...html.matchAll(/(?:©|&copy;|copyright)\s*(\d{4})/gi)].map((m) => Number(m[1]));
  const annoCorrente = new Date().getFullYear();
  const annoMax = anni.length ? Math.max(...anni) : null;
  if (annoMax && annoCorrente - annoMax >= 2)
    problemi.push(`Il piè di pagina è fermo al ${annoMax}: sembra un’attività chiusa`);

  if (!/mailto:|<form/i.test(html))
    problemi.push('Nessun modulo di contatto né email cliccabile: chi vuole scrivere non sa dove');

  // Tecnologie che oggi non funzionano piu' da nessuna parte
  if (/\.swf|<applet|flash/i.test(html)) problemi.push('Usa Flash, che nessun browser esegue più dal 2021');
  if (/<table[^>]*>[\s\S]*<table/i.test(html) && !mobileOk)
    problemi.push('Impaginato con tabelle annidate: tecnica abbandonata da oltre quindici anni');

  // Punteggio: parte da 100 e scende per ogni problema, pesato
  let punteggio = 100;
  if (!httpsOk) punteggio -= 25;
  if (!mobileOk) punteggio -= 35;
  if (tempoMs > 3000) punteggio -= Math.min(25, Math.round((tempoMs - 3000) / 200));
  if (pesoKb > 2000) punteggio -= 10;
  if (annoMax && annoCorrente - annoMax >= 2) punteggio -= 10;
  punteggio = Math.max(0, Math.min(100, punteggio));

  const base = {
    sitoEsiste: true,
    urlAnalizzato: url,
    httpsOk,
    mobileOk,
    tempoMs,
    pesoKb,
    punteggio,
    problemi,
    titoloSito: titolo,
  };

  return {
    ...base,
    riassuntoAttivita: riassumiAttivita(lead, html, titolo),
    riassuntoSito: riassumiSito(base),
  };
}
