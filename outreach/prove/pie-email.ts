process.env.AZIENDA_RAGIONE_SOCIALE = 'Astra Agency';
process.env.REPLY_TO = 'info@astragency.it';
process.env.URL_PRIVACY = 'https://astragency.it/privacy';
process.env.URL_DISISCRIZIONE = 'https://astragency.it/api/disiscrizione';
process.env.UNSUBSCRIBE_SECRET = 'segreto-di-prova';
process.env.MITTENTE_NOME = 'Astra Agency';

import { piePagina, cosaMancaPerLegge } from '../src/worker/email';
import { emailDaToken } from '../src/worker/disiscrizione';

(async () => {
  const destinatario = 'info@barberiacentrale.example';
  const pie = await piePagina(destinatario);
  console.log('── Piè di pagina per ' + destinatario + ':');
  console.log(pie.split('\n').map(r => '   ' + r).join('\n'));
  
  const link = pie.match(/https:\/\/\S*disiscrizione\S*/)?.[0] ?? '';
  const token = new URL(link).searchParams.get('t') ?? '';
  const letto = await emailDaToken(token, 'segreto-di-prova');
  console.log('\n── Il link contiene il destinatario giusto? ' +
    (letto === destinatario ? 'SÌ (' + letto + ')' : 'NO -> ' + letto));
  
  console.log('── Ogni destinatario ha un link diverso? ' +
    ((await piePagina('altro@esempio.it')).includes(token) ? 'NO' : 'SÌ'));
  
  const manca = cosaMancaPerLegge(pie);
  console.log('── Controllo di legge: ' + (manca.length ? 'BLOCCA — ' + manca.join('; ') : 'passa'));
  
})();
