/** Genera PASSWORD_HASH e SESSION_SECRET da mettere nelle variabili d'ambiente. */
import { nuovaImpronta } from '../src/lib/sessione';
import { randomBytes } from 'node:crypto';

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Uso: npm run password -- "una password lunga almeno 12 caratteri"');
  process.exit(1);
}
(async () => {
  console.log('\nIncolla queste due righe nelle variabili d\'ambiente:\n');
  console.log('PASSWORD_HASH="' + (await nuovaImpronta(password)) + '"');
  console.log('SESSION_SECRET="' + randomBytes(32).toString('base64url') + '"');
  console.log('\nLa password in chiaro non viene salvata da nessuna parte: tienila tu.\n');
})();
