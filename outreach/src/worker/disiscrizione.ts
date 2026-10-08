/**
 * Link di disiscrizione personalizzato, uno per destinatario.
 *
 * Il token porta con se' l'indirizzo e la sua firma, quindi chi clicca non
 * deve digitare niente e il Worker non deve consultare nessun archivio per
 * sapere chi e'. La firma impedisce che qualcuno disiscriva un indirizzo a
 * caso cambiando il link.
 *
 * Usa WebCrypto e non node:crypto perche' questo codice deve girare anche sui
 * Worker di Cloudflare, dove i moduli di Node non ci sono. Per questo le
 * funzioni sono asincrone: WebCrypto non ha una variante sincrona.
 *
 * ATTENZIONE: la firma deve combaciare con quella del Worker
 * (cloudflare-worker/worker.js, funzione firmaEmail). Lo verifica
 * `npm run verifica`, che importa il Worker vero e confronta.
 */

const testo = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlTesto(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function daB64url(s: string): string {
  const base = s.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base + '='.repeat((4 - (base.length % 4)) % 4));
}

/** Confronto che non rivela quanti caratteri iniziali combaciano. */
function confrontoCostante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function firmaEmail(email: string, segreto: string): Promise<string> {
  const chiave = await crypto.subtle.importKey(
    'raw',
    testo.encode(segreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return b64url(await crypto.subtle.sign('HMAC', chiave, testo.encode(email.toLowerCase().trim())));
}

/** Il token: indirizzo e firma, separati da un punto. */
export async function tokenDisiscrizione(email: string, segreto: string): Promise<string> {
  const pulito = email.toLowerCase().trim();
  return `${b64urlTesto(pulito)}.${await firmaEmail(pulito, segreto)}`;
}

/**
 * Link completo da mettere nell'email.
 * Senza segreto configurato torna il link generico: funziona lo stesso, ma
 * chi ci arriva deve scrivere il proprio indirizzo a mano.
 */
export async function linkDisiscrizione(email?: string | null): Promise<string> {
  const base = process.env.URL_DISISCRIZIONE || '';
  const segreto = process.env.UNSUBSCRIBE_SECRET || '';
  if (!base) return '';
  if (!email || !segreto) return base;
  return `${base}?t=${await tokenDisiscrizione(email, segreto)}`;
}

/** Verifica un token (serve alle prove, non all'invio). */
export async function emailDaToken(token: string, segreto: string): Promise<string | null> {
  const pezzi = String(token || '').split('.');
  if (pezzi.length !== 2) return null;
  let email: string;
  try {
    email = daB64url(pezzi[0]).toLowerCase().trim();
  } catch {
    return null;
  }
  return confrontoCostante(await firmaEmail(email, segreto), pezzi[1]) ? email : null;
}
