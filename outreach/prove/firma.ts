/**
 * La firma del token deve combaciare fra il sistema di outreach (Node) e il
 * Worker (WebCrypto). Sono due implementazioni diverse dello stesso calcolo:
 * se divergono, i link di disiscrizione smettono di funzionare in silenzio e
 * ce ne accorgeremmo solo da un aumento delle segnalazioni di spam.
 */
import { tokenDisiscrizione, emailDaToken } from '../src/worker/disiscrizione';

const SEGRETO = 'segreto-di-prova-non-usare-in-produzione';

// ── Copia esatta della logica del Worker (cloudflare-worker/worker.js) ──
function b64url(bytes: Uint8Array) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function firmaWorker(email: string, segreto: string) {
  const chiave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(segreto),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const firma = await crypto.subtle.sign('HMAC', chiave, new TextEncoder().encode(email));
  return b64url(new Uint8Array(firma));
}
function b64urlInTesto(s: string) {
  const base = s.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base + '='.repeat((4 - (base.length % 4)) % 4));
}
async function emailDaTokenWorker(token: string, segreto: string) {
  const pezzi = String(token || '').split('.');
  if (pezzi.length !== 2) return null;
  let email: string;
  try { email = b64urlInTesto(pezzi[0]).toLowerCase().trim(); } catch { return null; }
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return null;
  const atteso = await firmaWorker(email, segreto);
  return atteso === pezzi[1] ? email : null;
}

(async () => {
  const casi = ['mario@esempio.it', 'INFO@Barberia-Centrale.IT', 'nome.cognome+tag@sotto.dominio.co.uk'];
  let tuttoBene = true;

  for (const e of casi) {
    const token = tokenDisiscrizione(e, SEGRETO);
    const letto = await emailDaTokenWorker(token, SEGRETO);
    const ok = letto === e.toLowerCase();
    if (!ok) tuttoBene = false;
    console.log(`${ok ? 'OK  ' : 'ERRORE'}  ${e}  ->  il Worker legge: ${letto}`);
  }

  // Un token manomesso deve essere rifiutato
  const buono = tokenDisiscrizione('vittima@esempio.it', SEGRETO);
  const manomesso = Buffer.from('altro@esempio.it').toString('base64url') + '.' + buono.split('.')[1];
  const r1 = await emailDaTokenWorker(manomesso, SEGRETO);
  const r2 = emailDaToken(manomesso, SEGRETO);
  console.log(`${r1 === null && r2 === null ? 'OK  ' : 'ERRORE'}  token manomesso rifiutato da entrambi`);
  if (r1 !== null || r2 !== null) tuttoBene = false;

  // Un segreto sbagliato non deve validare
  const r3 = await emailDaTokenWorker(buono, 'segreto-sbagliato');
  console.log(`${r3 === null ? 'OK  ' : 'ERRORE'}  segreto sbagliato rifiutato`);
  if (r3 !== null) tuttoBene = false;

  console.log('\n' + (tuttoBene ? 'Le due implementazioni combaciano.' : 'DIVERGONO: i link non funzionerebbero.'));
  process.exit(tuttoBene ? 0 : 1);
})();
