'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { STATI_LEAD, type StatoLead } from '@/lib/tipi';

/** Scrive una riga nel diario. Non deve mai far fallire l'azione principale. */
async function registra(tipo: string, leadId?: string, dettaglio?: string) {
  try {
    await db.eventoLog.create({ data: { tipo, leadId, dettaglio } });
  } catch {
    /* il diario e' utile, non indispensabile */
  }
}

function testo(form: FormData, chiave: string): string {
  return String(form.get(chiave) ?? '').trim();
}
function testoOpzionale(form: FormData, chiave: string): string | null {
  const v = testo(form, chiave);
  return v === '' ? null : v;
}

// ── Lead ────────────────────────────────────────────────────────────────

export async function creaLead(_precedente: unknown, form: FormData) {
  const ragioneSociale = testo(form, 'ragioneSociale');
  const settore = testo(form, 'settore');
  const citta = testo(form, 'citta');

  if (!ragioneSociale || !settore || !citta) {
    return { errore: 'Nome attività, settore e città sono obbligatori.' };
  }

  const email = testoOpzionale(form, 'email');

  // Prima di accettare il lead controllo che non sia gia' tra chi ha chiesto
  // di non essere contattato: meglio scoprirlo ora che al momento dell'invio.
  if (email) {
    const soppresso = await db.soppressione.findUnique({ where: { email: email.toLowerCase() } });
    if (soppresso) {
      return {
        errore: `Questo indirizzo è nella lista di esclusione (${soppresso.motivo}). Non va contattato.`,
      };
    }
  }

  const lead = await db.lead.create({
    data: {
      ragioneSociale,
      settore,
      citta,
      provincia: testoOpzionale(form, 'provincia'),
      telefono: testoOpzionale(form, 'telefono'),
      email: email?.toLowerCase() ?? null,
      sitoUrl: testoOpzionale(form, 'sitoUrl'),
      fonte: testo(form, 'fonte') || 'MANUALE',
      tipoSoggetto: testo(form, 'tipoSoggetto') || 'SCONOSCIUTO',
      note: testoOpzionale(form, 'note'),
    },
  });

  await registra('LEAD_CREATO', lead.id, `inserito a mano: ${ragioneSociale}`);
  revalidatePath('/');
  redirect(`/lead/${lead.id}`);
}

export async function cambiaStatoLead(form: FormData) {
  const id = testo(form, 'id');
  const nuovo = testo(form, 'stato') as StatoLead;
  if (!id || !STATI_LEAD.includes(nuovo)) return;

  await db.lead.update({ where: { id }, data: { stato: nuovo } });
  await registra('STATO_CAMBIATO', id, `-> ${nuovo}`);

  revalidatePath('/');
  revalidatePath(`/lead/${id}`);
}

export async function eliminaLead(form: FormData) {
  const id = testo(form, 'id');
  if (!id) return;
  // Cancellazione vera, non logica: e' quello che il GDPR chiama diritto
  // all'oblio, e le relazioni sono tutte in cascata.
  await db.lead.delete({ where: { id } });
  revalidatePath('/');
  redirect('/');
}

// ── Approvazione email ──────────────────────────────────────────────────

export async function approvaBozza(form: FormData) {
  const id = testo(form, 'id');
  if (!id) return;

  const bozza = await db.bozzaEmail.findUnique({ where: { id }, include: { lead: true } });
  if (!bozza) return;

  // Il testo puo' essere stato corretto a mano prima di approvare
  const oggetto = testo(form, 'oggetto') || bozza.oggetto;
  const corpo = testo(form, 'corpo') || bozza.corpo;

  await db.bozzaEmail.update({
    where: { id },
    data: { oggetto, corpo, stato: 'APPROVATA', decisaIl: new Date() },
  });
  await db.lead.update({ where: { id: bozza.leadId }, data: { stato: 'APPROVATA' } });
  await registra('BOZZA_APPROVATA', bozza.leadId);

  revalidatePath('/approvazioni');
  revalidatePath('/');
  revalidatePath(`/lead/${bozza.leadId}`);
}

export async function rifiutaBozza(form: FormData) {
  const id = testo(form, 'id');
  if (!id) return;

  const bozza = await db.bozzaEmail.findUnique({ where: { id } });
  if (!bozza) return;

  await db.bozzaEmail.update({
    where: { id },
    data: {
      stato: 'RIFIUTATA',
      motivoRifiuto: testoOpzionale(form, 'motivo'),
      decisaIl: new Date(),
    },
  });
  // Torna indietro di un passo: il lead resta analizzato, serve una bozza nuova
  await db.lead.update({ where: { id: bozza.leadId }, data: { stato: 'ANALIZZATO' } });
  await registra('BOZZA_RIFIUTATA', bozza.leadId, testo(form, 'motivo'));

  revalidatePath('/approvazioni');
  revalidatePath('/');
}

// ── Call ────────────────────────────────────────────────────────────────

export async function fissaCall(form: FormData) {
  const leadId = testo(form, 'leadId');
  const quando = testo(form, 'inizio');
  if (!leadId || !quando) return;

  const inizio = new Date(quando);
  if (Number.isNaN(inizio.getTime())) return;

  await db.call.create({
    data: {
      leadId,
      inizio,
      durataMin: Number(testo(form, 'durataMin')) || 30,
      meetUrl: testoOpzionale(form, 'meetUrl'),
      stato: 'DA_CONFERMARE',
    },
  });
  await db.lead.update({ where: { id: leadId }, data: { stato: 'CALL_FISSATA' } });
  await registra('CALL_FISSATA', leadId, inizio.toISOString());

  revalidatePath('/risposte');
  revalidatePath('/');
  revalidatePath(`/lead/${leadId}`);
}

// ── Esclusioni ──────────────────────────────────────────────────────────

export async function escludiContatto(form: FormData) {
  const email = testo(form, 'email').toLowerCase();
  const motivo = testo(form, 'motivo') || 'RICHIESTA_CANCELLAZIONE';
  if (!email) return;

  await db.soppressione.upsert({
    where: { email },
    create: { email, motivo, note: testoOpzionale(form, 'note') },
    update: { motivo, note: testoOpzionale(form, 'note') },
  });

  // Qualunque lead con quell'indirizzo smette di essere contattabile
  await db.lead.updateMany({ where: { email }, data: { stato: 'NON_CONTATTABILE' } });
  await registra('CONTATTO_ESCLUSO', undefined, `${email} (${motivo})`);

  revalidatePath('/');
  revalidatePath('/risposte');
}
