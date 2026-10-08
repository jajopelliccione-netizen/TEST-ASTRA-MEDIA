import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { NOME_COOKIE, passwordCorretta, creaSessione, sessioneValida } from '@/lib/sessione';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Accedi — Astra Outreach', robots: { index: false } };

async function entra(form: FormData) {
  'use server';
  const password = String(form.get('password') ?? '');
  const vai = String(form.get('vai') ?? '/');

  if (!(await passwordCorretta(password))) {
    redirect(`/accedi?errore=1${vai !== '/' ? `&vai=${encodeURIComponent(vai)}` : ''}`);
  }

  (await cookies()).set(NOME_COOKIE, await creaSessione(), {
    httpOnly: true,                                   // non leggibile da JavaScript
    secure: process.env.NODE_ENV === 'production',    // solo su HTTPS una volta online
    sameSite: 'lax',                                  // non parte da siti altrui
    path: '/',
    maxAge: 14 * 86_400,
  });

  redirect(vai.startsWith('/') ? vai : '/');
}

export default async function Accedi({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string; vai?: string }>;
}) {
  const { errore, vai } = await searchParams;

  // Gia' dentro: non ha senso mostrare il modulo
  if (await sessioneValida((await cookies()).get(NOME_COOKIE)?.value)) redirect('/');

  const configurata = Boolean(process.env.PASSWORD_HASH && process.env.SESSION_SECRET);

  return (
    <div className="schermata-accesso">
      <form action={entra} className="riquadro modulo-accesso">
        <div className="marchio-accesso">
          ASTRA <span>Outreach</span>
        </div>

        {!configurata ? (
          <div className="avviso pericolo" style={{ marginBottom: 0 }}>
            <strong>Accesso non configurato.</strong> Mancano <code>PASSWORD_HASH</code> o{' '}
            <code>SESSION_SECRET</code>. Genera la password con <code>npm run password</code> e
            mettili nelle variabili d&apos;ambiente: finché non ci sono, non si entra.
          </div>
        ) : (
          <>
            {errore && (
              <div className="avviso pericolo">Password sbagliata.</div>
            )}
            <div className="campo">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" required autoFocus
                     autoComplete="current-password" />
            </div>
            <input type="hidden" name="vai" value={vai ?? '/'} />
            <button className="btn principale grande" type="submit">Entra</button>
          </>
        )}
      </form>
    </div>
  );
}
