/**
 * Dati finti per vedere la dashboard popolata senza aspettare i worker.
 * Sono tutti inventati: nessun contatto reale finisce qui dentro.
 * Si lancia con `npm run db:seed` ed e' ripetibile (prima svuota).
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

/** Una data a N giorni da oggi, all'ora indicata. */
function giorno(scarto: number, ora = 10, minuti = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + scarto);
  d.setHours(ora, minuti, 0, 0);
  return d;
}
/** Il prossimo giorno della settimana indicato (1 = lunedì … 5 = venerdì), in AAAA-MM-GG. */
function prossimo(giornoSettimana: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== giornoSettimana);
  // Niente toISOString: sposterebbe la data di un giorno per via del fuso
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function main() {
  // Ordine inverso rispetto alle dipendenze
  await db.eventoLog.deleteMany();
  await db.estrazione.deleteMany();
  await db.messaggio.deleteMany();
  await db.bozzaEmail.deleteMany();
  await db.call.deleteMany();
  await db.analisiSito.deleteMany();
  await db.lead.deleteMany();
  await db.soppressione.deleteMany();

  // ── 1. Senza sito, mai contattato ────────────────────────────────────
  await db.lead.create({
    data: {
      ragioneSociale: 'Barberia Centrale',
      settore: 'barbiere',
      citta: 'Roma',
      provincia: 'RM',
      email: 'info@barberiacentrale.example',
      telefono: '06 1234567',
      fonte: 'GOOGLE_MAPS',
      tipoSoggetto: 'DITTA_INDIVIDUALE',
      stato: 'ANALIZZATO',
      analisi: {
        create: {
          sitoEsiste: false,
          punteggio: 0,
          problemi: JSON.stringify([
            'Nessun sito: online esiste solo la scheda Google',
            'Nessun modo di prenotare se non per telefono',
            'I concorrenti in zona hanno tutti un sito',
          ]),
        },
      },
    },
  });

  // ── 2. Sito scadente, bozza in attesa di approvazione ────────────────
  const palestra = await db.lead.create({
    data: {
      ragioneSociale: 'Palestra Olympus',
      settore: 'palestra',
      citta: 'Milano',
      provincia: 'MI',
      email: 'info@olympus.example',
      telefono: '02 9876543',
      sitoUrl: 'http://olympus.example',
      fonte: 'PAGINE_GIALLE',
      tipoSoggetto: 'SOCIETA',
      stato: 'BOZZA_PRONTA',
      analisi: {
        create: {
          sitoEsiste: true,
          urlAnalizzato: 'http://olympus.example',
          httpsOk: false,
          mobileOk: false,
          lcpMs: 7400,
          pesoKb: 5200,
          punteggio: 24,
          problemi: JSON.stringify([
            'Non si legge dal telefono: il testo esce dallo schermo',
            'Ci mette 7,4 secondi ad aprirsi',
            'Senza HTTPS: il browser lo segnala come non sicuro',
            'Gli orari in home sono fermi al 2019',
          ]),
        },
      },
    },
  });

  await db.bozzaEmail.create({
    data: {
      leadId: palestra.id,
      oggetto: 'Il sito di Palestra Olympus non si apre dal telefono',
      corpo: `Buongiorno,

ho dato un'occhiata al sito di Palestra Olympus e ho notato due cose che probabilmente vi stanno costando iscrizioni.

La prima: da telefono il testo esce dallo schermo e il menù non si riesce a toccare. Considerando che la gran parte di chi cerca una palestra lo fa dal cellulare, è lì che si perdono i contatti.

La seconda: la pagina ci mette 7,4 secondi ad aprirsi. Oltre i 3 secondi la metà delle persone chiude e passa al risultato successivo.

Ci sono anche gli orari fermi al 2019 in home, che è il tipo di dettaglio che fa dubitare che la palestra sia ancora attiva.

Se le va, in una call di 20 minuti le mostro cosa cambierei e quanto costerebbe. Senza impegno: se poi decide di lasciare tutto com'è, nessun problema.

Mi dica un paio di momenti in cui è comodo e mi organizzo io.

Jacopo Pelliccione
Astra Agency — astragency.it

---
Se non desidera ricevere altre email da noi, può disiscriversi qui: https://astragency.it/disiscrizione`,
      modelloLlm: 'esempio-seed',
      stato: 'DA_APPROVARE',
    },
  });

  // ── 3. Ha risposto, interessato, con disponibilità ───────────────────
  const ristorante = await db.lead.create({
    data: {
      ragioneSociale: 'Trattoria da Nino',
      settore: 'ristorante',
      citta: 'Napoli',
      provincia: 'NA',
      email: 'nino@trattoriadanino.example',
      telefono: '3391234567',
      fonte: 'FACEBOOK_ADS',
      tipoSoggetto: 'DITTA_INDIVIDUALE',
      stato: 'RISPOSTA',
      analisi: {
        create: {
          sitoEsiste: false,
          punteggio: 0,
          problemi: JSON.stringify([
            'Nessun sito, solo la pagina Facebook',
            'Il menù è pubblicato come foto: Google non lo legge',
          ]),
        },
      },
    },
  });

  await db.messaggio.create({
    data: {
      leadId: ristorante.id,
      direzione: 'USCITA',
      mittente: 'info@astra-proposte.it',
      destinatario: 'nino@trattoriadanino.example',
      oggetto: 'Il menù della Trattoria da Nino non si trova su Google',
      corpo:
        'Buongiorno,\n\nho notato che il menù della trattoria è pubblicato solo come foto su Facebook...\n\nJacopo — Astra Agency',
      dataIl: giorno(-3, 9, 15),
    },
  });

  const rispostaNino = await db.messaggio.create({
    data: {
      leadId: ristorante.id,
      direzione: 'ENTRATA',
      mittente: 'nino@trattoriadanino.example',
      destinatario: 'info@astra-proposte.it',
      oggetto: 'Re: Il menù della Trattoria da Nino non si trova su Google',
      corpo: `Buongiorno,

in effetti ci avevo pensato ma non ho mai avuto tempo di occuparmene. Mi interessa capire i costi.

Sono libero giovedì pomeriggio dalle 15 alle 18, oppure venerdì mattina presto prima di aprire, dalle 9 alle 11.

Il mio numero è 339 1234567, se preferisce mi chiami pure.

Una cosa: il sito poi lo devo aggiornare io quando cambio il menù? Perché non sono pratico di computer.

Grazie,
Nino`,
      dataIl: giorno(-1, 18, 40),
    },
  });

  await db.estrazione.create({
    data: {
      messaggioId: rispostaNino.id,
      interesse: 'ALTO',
      riassunto:
        'Interessato, chiede i costi. Preoccupato di non essere capace di aggiornare il menù da solo: va rassicurato su quel punto nella call.',
      telefono: '3391234567',
      disponibilita: JSON.stringify([
        { giorno: prossimo(4), dalle: '15:00', alle: '18:00' }, // giovedì
        { giorno: prossimo(5), dalle: '09:00', alle: '11:00' }, // venerdì
      ]),
      domande: JSON.stringify([
        'Quanto costa?',
        'Devo aggiornare io il menù quando cambia? Non sono pratico di computer.',
      ]),
      modelloLlm: 'esempio-seed',
    },
  });

  // ── 4. Ha risposto ma la risposta è ambigua: segnalata ───────────────
  const estetista = await db.lead.create({
    data: {
      ragioneSociale: 'Centro Estetico Aurora',
      settore: 'centro estetico',
      citta: 'Torino',
      provincia: 'TO',
      email: 'aurora@estetica.example',
      fonte: 'GOOGLE_MAPS',
      tipoSoggetto: 'SOCIETA',
      stato: 'RISPOSTA',
    },
  });

  const rispostaAurora = await db.messaggio.create({
    data: {
      leadId: estetista.id,
      direzione: 'ENTRATA',
      mittente: 'aurora@estetica.example',
      destinatario: 'info@astra-proposte.it',
      oggetto: 'Re: Il sito di Centro Estetico Aurora',
      corpo: `Salve, ne parlo con mia sorella che si occupa di queste cose e le faccio sapere. Però guardi che il preventivo dell'altra agenzia era molto più basso, non so se ha senso.`,
      dataIl: giorno(0, 11, 20),
    },
  });

  await db.estrazione.create({
    data: {
      messaggioId: rispostaAurora.id,
      interesse: 'NON_CHIARO',
      riassunto:
        'Rimanda la decisione a una terza persona e tira in ballo un preventivo più basso di un concorrente. Non dà disponibilità.',
      disponibilita: JSON.stringify([]),
      domande: JSON.stringify([]),
      richiedeAttenzione: true,
      motivoAttenzione:
        'Obiezione sul prezzo con un concorrente già in gioco: non so quanto margine hai e non voglio scrivere una cifra al posto tuo.',
      modelloLlm: 'esempio-seed',
    },
  });

  // ── 5. Call già fissata ──────────────────────────────────────────────
  const officina = await db.lead.create({
    data: {
      ragioneSociale: 'Autofficina Bellini',
      settore: 'officina',
      citta: 'Bologna',
      provincia: 'BO',
      email: 'bellini@officina.example',
      telefono: '3357778899',
      fonte: 'PAGINE_GIALLE',
      tipoSoggetto: 'SOCIETA',
      stato: 'CALL_FISSATA',
    },
  });
  await db.call.create({
    data: {
      leadId: officina.id,
      inizio: giorno(2, 16, 0),
      meetUrl: 'https://meet.google.com/abc-defg-hij',
      stato: 'CONFERMATA',
    },
  });

  // ── 6. Chi ha chiesto di non essere contattato ───────────────────────
  await db.soppressione.create({
    data: {
      email: 'basta@esempio.example',
      motivo: 'DISISCRITTO',
      note: 'Click sul link di disiscrizione',
    },
  });

  const conteggi = {
    lead: await db.lead.count(),
    bozzeDaApprovare: await db.bozzaEmail.count({ where: { stato: 'DA_APPROVARE' } }),
    risposte: await db.messaggio.count({ where: { direzione: 'ENTRATA' } }),
    esclusioni: await db.soppressione.count(),
  };
  console.log('Dati di esempio inseriti:', conteggi);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
