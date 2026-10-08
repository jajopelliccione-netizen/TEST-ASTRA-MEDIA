/**
 * La firma del token deve combaciare fra il sistema di outreach (Node) e il
 * Worker (WebCrypto). Sono due implementazioni diverse dello stesso calcolo:
 * se divergono, i link di disiscrizione smettono di funzionare in silenzio e
 * ce ne accorgeremmo solo da un aumento delle segnalazioni di spam.
 */
import { tokenDisiscrizione, emailDaToken } from '../src/worker/disiscrizione';

const SEGRETO = 'segreto-di-prova-non-usare-in-produzione';

// Il Worker vero, non una copia: se qualcuno cambia la firma di la' e non
// di qua, questa prova fallisce subito invece di lasciare link rotti in giro.
// @ts-expect-error — JavaScript senza tipi
import { firmaEmail as firmaWorker, emailDaToken as emailDaTokenWorker } from '../../cloudflare-worker/worker.js';

(async () => {
  const casi = ['mario@esempio.it', 'INFO@Barberia-Centrale.IT', 'nome.cognome+tag@sotto.dominio.co.uk'];
  let tuttoBene = true;

  for (const e of casi) {
    const token = await tokenDisiscrizione(e, SEGRETO);
    const letto = await emailDaTokenWorker(token, SEGRETO);
    const ok = letto === e.toLowerCase();
    if (!ok) tuttoBene = false;
    console.log(`${ok ? 'OK  ' : 'ERRORE'}  ${e}  ->  il Worker legge: ${letto}`);
  }

  // Un token manomesso deve essere rifiutato
  const buono = await tokenDisiscrizione('vittima@esempio.it', SEGRETO);
  const manomesso = Buffer.from('altro@esempio.it').toString('base64url') + '.' + buono.split('.')[1];
  const r1 = await emailDaTokenWorker(manomesso, SEGRETO);
  const r2 = await emailDaToken(manomesso, SEGRETO);
  console.log(`${r1 === null && r2 === null ? 'OK  ' : 'ERRORE'}  token manomesso rifiutato da entrambi`);
  if (r1 !== null || r2 !== null) tuttoBene = false;

  // Un segreto sbagliato non deve validare
  const r3 = await emailDaTokenWorker(buono, 'segreto-sbagliato');
  console.log(`${r3 === null ? 'OK  ' : 'ERRORE'}  segreto sbagliato rifiutato`);
  if (r3 !== null) tuttoBene = false;

  console.log('\n' + (tuttoBene ? 'Le due implementazioni combaciano.' : 'DIVERGONO: i link non funzionerebbero.'));
  process.exit(tuttoBene ? 0 : 1);
})();
