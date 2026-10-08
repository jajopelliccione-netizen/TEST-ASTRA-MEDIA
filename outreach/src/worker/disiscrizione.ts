/**
 * Link di disiscrizione personalizzato, uno per destinatario.
 *
 * Il token porta con se' l'indirizzo e la sua firma, quindi chi clicca non
 * deve digitare niente e il Worker non deve consultare nessun archivio per
 * sapere chi e'. La firma impedisce che qualcuno disiscriva un indirizzo a
 * caso cambiando il link.
 *
 * ATTENZIONE: la firma deve combaciare con quella del Worker
 * (cloudflare-worker/worker.js, funzione firmaEmail). Stesso algoritmo,
 * stesso segreto, stessa codifica. C'e' una prova automatica che lo
 * verifica: `npx tsx prove/firma.ts`.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

function b64url(b: Buffer): string {
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function firmaEmail(email: string, segreto: string): string {
  return b64url(createHmac('sha256', segreto).update(email.toLowerCase().trim()).digest());
}

/** Il token: indirizzo e firma, separati da un punto. */
export function tokenDisiscrizione(email: string, segreto: string): string {
  const pulito = email.toLowerCase().trim();
  return `${b64url(Buffer.from(pulito, 'utf8'))}.${firmaEmail(pulito, segreto)}`;
}

/**
 * Link completo da mettere nell'email.
 * Senza segreto configurato torna il link generico: funziona lo stesso, ma
 * chi ci arriva deve scrivere il proprio indirizzo a mano.
 */
export function linkDisiscrizione(email?: string | null): string {
  const base = process.env.URL_DISISCRIZIONE || '';
  const segreto = process.env.UNSUBSCRIBE_SECRET || '';
  if (!base) return '';
  if (!email || !segreto) return base;
  return `${base}?t=${tokenDisiscrizione(email, segreto)}`;
}

/** Verifica un token (serve alle prove, non all'invio). */
export function emailDaToken(token: string, segreto: string): string | null {
  const pezzi = String(token || '').split('.');
  if (pezzi.length !== 2) return null;
  let email: string;
  try {
    email = Buffer.from(pezzi[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64')
      .toString('utf8')
      .toLowerCase();
  } catch {
    return null;
  }
  const atteso = Buffer.from(firmaEmail(email, segreto));
  const dato = Buffer.from(pezzi[1]);
  if (atteso.length !== dato.length || !timingSafeEqual(atteso, dato)) return null;
  return email;
}
