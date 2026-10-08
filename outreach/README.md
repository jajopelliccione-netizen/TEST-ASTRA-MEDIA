# Astra Outreach

Strumento interno di Astra Agency: trova attività italiane senza sito (o con
un sito messo male), scrive loro un'email su misura, raccoglie le risposte e
porta a una call.

---

## ⚠️ Prima di tutto: questo repository è pubblico

`TEST-ASTRA-MEDIA` è un repository **pubblico** e il workflow di deploy
pubblica l'intera cartella su GitHub Pages. Per questo:

- `outreach/` è **escluso dal deploy** (`.github/workflows/deploy.yml`), quindi
  non viene mai servito su astragency.it;
- il deploy ha un **controllo di sicurezza** che lo fa fallire se un `.env`, un
  database o una chiave finiscono per sbaglio nei file da pubblicare;
- `.env`, `*.db` e `outreach/data/` sono in `.gitignore`: **i dati dei lead non
  entrano mai in git**.

Il codice però resta pubblico. **Appena puoi, sposta questo progetto in un
repository privato**: i dati personali dei lead e la strategia commerciale non
hanno motivo di stare in vetrina. Quando lo crei:

```bash
git subtree split --prefix=outreach -b outreach-solo
# poi dal nuovo repo privato: git pull <percorso-locale> outreach-solo
```

---

## Struttura

```
outreach/
├── prisma/
│   ├── schema.prisma     modello dati di tutto il flusso
│   └── seed.ts           dati finti per lavorare sull'interfaccia
├── src/
│   ├── app/              dashboard Next.js (App Router)
│   │   ├── page.tsx              pipeline + ricerca
│   │   ├── azioni.ts             server action (unico punto che scrive sul db)
│   │   ├── lead/nuovo/           inserimento a mano
│   │   ├── lead/[id]/            scheda completa del lead
│   │   ├── approvazioni/         coda email da approvare
│   │   └── risposte/             risposte lette dall'AI + scelta orario call
│   ├── componenti/
│   └── lib/
│       ├── db.ts         client Prisma
│       ├── tipi.ts       valori ammessi ed etichette (fonte di verità)
│       └── util.ts       link WhatsApp, date, fasce orarie
└── worker/               ← da fare: ricerca, analisi, invio, lettura risposte
```

**Perché tutto in TypeScript invece di Python per i worker**: dashboard e
worker condividono lo stesso schema Prisma e gli stessi tipi. Un campo
rinominato diventa un errore di compilazione ovunque, invece di un `KeyError`
scoperto in produzione. Se poi per lo scraping servisse una libreria Python, si
aggiunge un worker a parte: il database resta il punto d'incontro.

---

## Dove gira

La dashboard sta **online**, raggiungibile da telefono, tablet e computer.
Non su `localhost`: altrimenti funzionerebbe solo sul Mac, e solo acceso.

Questo pero' significa che l'indirizzo e' pubblico e dentro ci sono **dati
personali di persone reali**. Perche' sia una cosa seria e non un foglio
lasciato sul tavolo:

- **nessuna pagina si apre senza password.** Il controllo sta nel
  `middleware`, non nelle singole pagine: una pagina nuova nasce protetta,
  invece di esserlo se qualcuno si ricorda di proteggerla;
- la password non e' salvata da nessuna parte, solo la sua impronta
  **PBKDF2 con 200.000 giri**, che rende lentissimo provarla a tentativi;
- il cookie di sessione e' **httpOnly** (JavaScript non lo legge), firmato,
  e vale 14 giorni;
- senza `PASSWORD_HASH` e `SESSION_SECRET` il modulo di accesso si rifiuta
  di funzionare, invece di lasciare aperto.

### Messa online (Netlify + Neon, entrambi gratuiti)

```bash
cd outreach
npm run password -- "una password lunga e che non usi altrove"
```

Stampa `PASSWORD_HASH` e `SESSION_SECRET`.

1. **neon.tech** — crea un progetto, copia la stringa di connessione
   (`postgresql://...`). Piano gratuito, nessuna scadenza.
2. **netlify.com** — collega il repository. `netlify.toml` dice gia' tutto:
   cartella `outreach`, Node 22, build con Prisma.
3. In **Site configuration -> Environment variables** incolla le righe di
   `.env.example` compilate, compresa `DATABASE_URL` di Neon.
4. Una volta sola, per creare le tabelle:
   `DATABASE_URL="...neon..." npx prisma db push`
5. Per avere `outreach.astragency.it` invece dell'indirizzo `.netlify.app`:
   su Cloudflare aggiungi un record **CNAME** `outreach` che punta al nome
   del sito Netlify.

#### Perche' non Vercel, e perche' non Cloudflare

**Vercel** era la scelta ovvia (Next.js e' loro), ma il piano gratuito
Hobby **vieta l'uso commerciale**, e questo strumento serve a cercare
clienti: sarebbero stati 20$/mese.

**Cloudflare** sarebbe stato il posto naturale — dominio, DNS e Worker sono
gia' li'. Ci ho provato davvero: adattatore OpenNext, database D1,
configurazione completa. L'applicazione partiva e il login funzionava nel
runtime di Cloudflare, ma **Prisma sui Worker pretende il suo motore
nativo**, che li' non puo' esistere; anche il generatore dedicato a
`workerd` se lo porta dietro. Le alternative erano riscrivere tutte le
query in SQL a mano o rinunciare a Prisma: due settimane di lavoro per
cambiare hosting. Netlify esegue Node, dove tutto questo semplicemente
funziona, e il suo piano gratuito l'uso commerciale lo consente.

### Prove in locale

```bash
npm install
npm run db:locale      # schema su SQLite, niente database esterno
npm run setup
npm run dev            # http://localhost:3100
npm run db:online      # rimettilo su Postgres prima di pubblicare
```

## A che punto siamo

| # | Passo del flusso | Stato |
|---|------------------|-------|
| 1 | Ricerca lead (Maps / Pagine Gialle / Facebook Ads) | da fare — intanto si inseriscono a mano |
| 2 | Analisi del sito (esiste? quanto è messo male?) | ✅ fatto |
| 3 | Generazione email su misura | ✅ fatto (LLM, con modello interno di riserva) |
| 3b | Approvazione manuale prima dell'invio | ✅ fatto |
| 4 | Invio con dominio dedicato, SPF/DKIM/DMARC | ✅ fatto — spento da `INVIO_ATTIVO` |
| 5 | Lettura risposte e estrazione dati | da fare — la dashboard li mostra già |
| 6 | Dashboard (anche da telefono) | ✅ fatto |
| 7 | Conferma call via email + Meet | parziale: la call si fissa, l'email di conferma no |
| 8 | Bottone WhatsApp dopo la risposta | ✅ fatto |
| — | Disiscrizione con link personalizzato | ✅ fatto e verificato in rete |

### Configurazione in rete, già fatta

- **SPF** su `astragency.it` (prima non c'era: chiunque poteva spedire a nome tuo)
- **`proposte.astragency.it`** autenticato su Brevo, con DKIM — il mittente è isolato
  dal dominio con cui si lavora
- **`/api/disiscrizione`** sul Worker: link firmato, conferma, scrittura su Firestore
- **`/api/debug`** chiuso: era una GET aperta che mostrava l'email del service account

La dashboard è costruita sullo schema definitivo: quando i worker arriveranno,
riempiranno tabelle che le pagine già leggono. Non ci sarà da rifare nulla.

---

## Le regole scritte nel codice, non nelle buone intenzioni

Tre vincoli sono applicati dal programma, così non dipendono dal ricordarsene:

**Niente WhatsApp a freddo.** Il bottone "Apri chat" compare solo se il lead ha
già risposto via email (`haRisposto` in `lead/[id]/page.tsx`). Scrivere per
primi su WhatsApp viola le regole di Meta e fa chiudere il numero.

**Lista di esclusione controllata all'ingresso.** Inserendo un lead la cui
email è nella tabella `Soppressione`, il salvataggio viene rifiutato. Il
controllo va ripetuto anche al momento dell'invio, quando il worker esisterà.

**Numeri di telefono validati.** `numeroPerWhatsapp()` restituisce `null` se il
numero non è un cellulare italiano plausibile, così il bottone non compare
invece di aprire una chat verso un numero inesistente.

### GDPR: cosa è già previsto e cosa manca

Previsto nello schema:

- `tipoSoggetto` distingue la **ditta individuale** (i cui contatti sono dati
  personali a tutti gli effetti) dalla società, e la scheda lead mostra un
  avviso;
- `baseGiuridica` registra *perché* possiamo contattare quel soggetto, prima di
  farlo;
- `Soppressione` tiene disiscrizioni, bounce, reclami e Registro Opposizioni;
- `EventoLog` è il diario di cosa è stato fatto e quando: serve a dimostrare la
  conformità se qualcuno la chiede;
- "Elimina definitivamente" cancella davvero lead e storico (diritto all'oblio).

Ancora da fare, e **nessuna email deve partire prima**:

1. link di disiscrizione **funzionante** (una pagina vera, non un indirizzo
   finto) e in ogni email;
2. identificazione completa del mittente nel piè di pagina: ragione sociale,
   indirizzo, P.IVA;
3. informativa privacy raggiungibile dall'email;
4. verifica sul Registro Pubblico delle Opposizioni per le ditte individuali;
5. SPF, DKIM e DMARC sul dominio secondario, **prima** del primo invio.

Sul volume: si parte da 20-30 email al giorno e si sale piano
(`INVII_MAX_GIORNO`). Un dominio nuovo che manda 500 email il primo giorno
finisce nello spam e non ne esce più.
