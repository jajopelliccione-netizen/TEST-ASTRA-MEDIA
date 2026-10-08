import type { Fascia } from './tipi';

/**
 * Normalizza un numero italiano in formato wa.me (prefisso internazionale,
 * solo cifre). Restituisce null se non sembra un numero valido, cosi' il
 * bottone WhatsApp non compare invece di aprire una chat verso il nulla.
 */
export function numeroPerWhatsapp(grezzo: string | null | undefined): string | null {
  if (!grezzo) return null;
  let n = grezzo.replace(/[^\d+]/g, '');
  if (n.startsWith('00')) n = '+' + n.slice(2);
  if (n.startsWith('+')) {
    n = n.slice(1);
  } else {
    // Numero nazionale: i cellulari italiani iniziano con 3 e hanno 9-10 cifre
    if (/^3\d{8,9}$/.test(n)) n = '39' + n;
    else return null;
  }
  return /^\d{11,15}$/.test(n) ? n : null;
}

/**
 * Link alla chat WhatsApp con messaggio gia' scritto.
 * Da usare SOLO dopo che il cliente ha risposto via email: il primo contatto
 * su WhatsApp viola le regole di Meta.
 */
export function linkWhatsapp(numero: string | null | undefined, messaggio: string): string | null {
  const n = numeroPerWhatsapp(numero);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(messaggio)}`;
}

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export function dataLeggibile(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return '—';
  return `${GIORNI[x.getDay()]} ${x.getDate()} ${MESI[x.getMonth()]}, ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
}

export function dataBreve(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return '—';
  return `${x.getDate()} ${MESI[x.getMonth()]}`;
}

/** Legge un campo JSON del database senza far esplodere la pagina se e' malformato. */
export function leggiJson<T>(testo: string | null | undefined, fallback: T): T {
  if (!testo) return fallback;
  try {
    const v = JSON.parse(testo);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Trasforma le fasce di disponibilita' in orari concreti proposti, a scatti di
 * 30 minuti, cosi' nella dashboard si sceglie con un click invece di scrivere
 * una data a mano.
 */
export function orariProposti(fasce: Fascia[], passoMin = 30, massimo = 12): Date[] {
  const out: Date[] = [];
  for (const f of fasce) {
    const inizio = new Date(`${f.giorno}T${f.dalle}:00`);
    const fine = new Date(`${f.giorno}T${f.alle}:00`);
    if (Number.isNaN(inizio.getTime()) || Number.isNaN(fine.getTime())) continue;
    for (let t = inizio.getTime(); t + passoMin * 60000 <= fine.getTime(); t += passoMin * 60000) {
      out.push(new Date(t));
      if (out.length >= massimo) return out;
    }
  }
  return out;
}
