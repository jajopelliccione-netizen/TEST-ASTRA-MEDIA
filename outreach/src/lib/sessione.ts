/**
 * Accesso alla dashboard.
 *
 * Una volta online, questo indirizzo e' raggiungibile da chiunque: dentro ci
 * sono nomi, email e telefoni di persone. Quindi non basta che sia "difficile
 * da indovinare", serve una password.
 *
 * Tutto con WebCrypto e non con node:crypto, perche' il controllo gira anche
 * nel middleware di Next, dove i moduli di Node non esistono.
 */

const DURATA_GIORNI = 14;
const ITERAZIONI = 200_000;
export const NOME_COOKIE = 'astra_sessione';

const testo = new TextEncoder();

function esadecimale(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Confronto che non rivela quanti caratteri iniziali combaciano. */
function confrontoCostante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Password ──────────────────────────────────────────────────────────────

/**
 * PBKDF2 invece di un semplice SHA-256: rallenta di proposito chi provasse a
 * indovinare la password a tentativi. Il sale rende inutili le tabelle
 * precalcolate.
 */
export async function impronta(password: string, saleEsa: string): Promise<string> {
  const sale = Uint8Array.from(saleEsa.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const chiave = await crypto.subtle.importKey('raw', testo.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bit = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: sale, iterations: ITERAZIONI, hash: 'SHA-256' },
    chiave,
    256,
  );
  return esadecimale(bit);
}

/** Formato memorizzato in PASSWORD_HASH: "sale:impronta". */
export async function passwordCorretta(password: string): Promise<boolean> {
  const memorizzata = process.env.PASSWORD_HASH || '';
  const [sale, attesa] = memorizzata.split(':');
  if (!sale || !attesa) return false;
  return confrontoCostante(await impronta(password, sale), attesa);
}

// ── Cookie di sessione ────────────────────────────────────────────────────

async function chiaveFirma(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    testo.encode(process.env.SESSION_SECRET || ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/** Il cookie e' "scadenza.firma": nessun dato dentro, solo una data firmata. */
export async function creaSessione(): Promise<string> {
  const scadenza = Date.now() + DURATA_GIORNI * 86_400_000;
  const firma = await crypto.subtle.sign('HMAC', await chiaveFirma(), testo.encode(String(scadenza)));
  return `${scadenza}.${esadecimale(firma)}`;
}

export async function sessioneValida(cookie: string | undefined): Promise<boolean> {
  if (!cookie || !process.env.SESSION_SECRET) return false;
  const [scadenzaTxt, firma] = cookie.split('.');
  const scadenza = Number(scadenzaTxt);
  if (!Number.isFinite(scadenza) || Date.now() > scadenza) return false;
  const attesa = esadecimale(
    await crypto.subtle.sign('HMAC', await chiaveFirma(), testo.encode(scadenzaTxt)),
  );
  return confrontoCostante(attesa, firma ?? '');
}

/** Genera sale e impronta per una password nuova (usato da `npm run password`). */
export async function nuovaImpronta(password: string): Promise<string> {
  const sale = crypto.getRandomValues(new Uint8Array(16));
  const saleEsa = [...sale].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${saleEsa}:${await impronta(password, saleEsa)}`;
}
