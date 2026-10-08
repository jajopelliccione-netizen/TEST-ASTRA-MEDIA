/**
 * Unica fonte di verita' per i campi "a scelta fissa".
 *
 * SQLite non ha gli enum, quindi nello schema Prisma sono stringhe. Tenendo
 * qui valori ed etichette, il resto del codice non scrive mai una stringa a
 * mano e un refuso diventa un errore di compilazione invece di un record
 * sbagliato che si scopre fra tre settimane.
 */

export const STATI_LEAD = [
  'NUOVO',
  'ANALIZZATO',
  'BOZZA_PRONTA',
  'APPROVATA',
  'INVIATA',
  'RISPOSTA',
  'CALL_FISSATA',
  'CLIENTE',
  'SCARTATO',
  'NON_CONTATTABILE',
] as const;
export type StatoLead = (typeof STATI_LEAD)[number];

/** L'ordine in cui il lead attraversa la pipeline, per le colonne e i conteggi. */
export const PIPELINE: StatoLead[] = [
  'NUOVO',
  'ANALIZZATO',
  'BOZZA_PRONTA',
  'APPROVATA',
  'INVIATA',
  'RISPOSTA',
  'CALL_FISSATA',
  'CLIENTE',
];

export const ETICHETTA_STATO: Record<StatoLead, string> = {
  NUOVO: 'Da analizzare',
  ANALIZZATO: 'Analizzato',
  BOZZA_PRONTA: 'Email da approvare',
  APPROVATA: 'Pronta da inviare',
  INVIATA: 'Email inviata',
  RISPOSTA: 'Ha risposto',
  CALL_FISSATA: 'Call fissata',
  CLIENTE: 'Diventato cliente',
  SCARTATO: 'Scartato',
  NON_CONTATTABILE: 'Non contattabile',
};

/** Colore usato per il pallino di stato. */
export const COLORE_STATO: Record<StatoLead, string> = {
  NUOVO: '#9B91C7',
  ANALIZZATO: '#00F5FF',
  BOZZA_PRONTA: '#FFB020',
  APPROVATA: '#7B5CF0',
  INVIATA: '#B44FD8',
  RISPOSTA: '#00E5A0',
  CALL_FISSATA: '#00E5A0',
  CLIENTE: '#00E5A0',
  SCARTATO: '#6B6485',
  NON_CONTATTABILE: '#FF2D78',
};

export const FONTI = ['MANUALE', 'GOOGLE_MAPS', 'PAGINE_GIALLE', 'FACEBOOK_ADS'] as const;
export type Fonte = (typeof FONTI)[number];
export const ETICHETTA_FONTE: Record<Fonte, string> = {
  MANUALE: 'Inserito a mano',
  GOOGLE_MAPS: 'Google Maps',
  PAGINE_GIALLE: 'Pagine Gialle',
  FACEBOOK_ADS: 'Facebook Ads Library',
};

export const TIPI_SOGGETTO = ['SCONOSCIUTO', 'DITTA_INDIVIDUALE', 'SOCIETA'] as const;
export type TipoSoggetto = (typeof TIPI_SOGGETTO)[number];
export const ETICHETTA_SOGGETTO: Record<TipoSoggetto, string> = {
  SCONOSCIUTO: 'Da verificare',
  DITTA_INDIVIDUALE: 'Ditta individuale',
  SOCIETA: 'Società',
};

export const BASI_GIURIDICHE = ['LEGITTIMO_INTERESSE', 'CONSENSO'] as const;
export type BaseGiuridica = (typeof BASI_GIURIDICHE)[number];

export const STATI_BOZZA = ['DA_APPROVARE', 'APPROVATA', 'RIFIUTATA', 'SOSTITUITA'] as const;
export type StatoBozza = (typeof STATI_BOZZA)[number];

export const LIVELLI_INTERESSE = ['ALTO', 'MEDIO', 'BASSO', 'NEGATIVO', 'NON_CHIARO'] as const;
export type LivelloInteresse = (typeof LIVELLI_INTERESSE)[number];
export const COLORE_INTERESSE: Record<LivelloInteresse, string> = {
  ALTO: '#00E5A0',
  MEDIO: '#00F5FF',
  BASSO: '#FFB020',
  NEGATIVO: '#FF2D78',
  NON_CHIARO: '#9B91C7',
};

export const STATI_CALL = ['DA_CONFERMARE', 'CONFERMATA', 'FATTA', 'ANNULLATA'] as const;
export type StatoCall = (typeof STATI_CALL)[number];

export const MOTIVI_SOPPRESSIONE = [
  'DISISCRITTO',
  'BOUNCE',
  'RECLAMO',
  'RICHIESTA_CANCELLAZIONE',
  'REGISTRO_OPPOSIZIONI',
] as const;
export type MotivoSoppressione = (typeof MOTIVI_SOPPRESSIONE)[number];

/** Una fascia di disponibilita' estratta dalla risposta del cliente. */
export type Fascia = { giorno: string; dalle: string; alle: string };
