// Cloudflare Worker — gestisce /api/notify, /api/track e /api/debug
// Credenziali lette da env vars (impostate come secrets nel dashboard Cloudflare)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url  = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method === 'POST' && path.endsWith('/notify')) {
      return handleNotify(request, env);
    }

    if (request.method === 'POST' && path.endsWith('/track')) {
      return handleTrack(request, env);
    }

    if (request.method === 'POST' && path.endsWith('/reset-collab-password')) {
      return handleResetCollabPassword(request, env);
    }

    if (request.method === 'POST' && path.endsWith('/recover-collab')) {
      return handleRecoverCollab(request, env);
    }

    if (request.method === 'GET' && path.endsWith('/social')) {
      return handleSocialData(request, env);
    }

    if (request.method === 'POST' && path.endsWith('/delete-collab-auth')) {
      return handleDeleteCollabAuth(request, env);
    }

    if (request.method === 'GET' && path.endsWith('/debug')) {
      return handleDebug(env);
    }

    return new Response('Not found', { status: 404 });
  },
};

// ── POST /api/track ────────────────────────────────────────────────────────
async function handleTrack(request, env) {
  try {
    const { clientId, page } = await request.json();
    if (!clientId || typeof clientId !== 'string' || clientId.length > 128) {
      return json({ ok: false });
    }

    const today      = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const safePage   = (page || '/').replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+/, '') .slice(0, 80) || 'root';
    const projectId  = env.FCM_PROJECT_ID;
    const accessToken = await getAccessToken(env.FCM_CLIENT_EMAIL, env.FCM_PRIVATE_KEY);

    const docName = `projects/${projectId}/databases/(default)/documents/analytics/${clientId}/daily/${today}`;
    const fsResp = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writes: [{
          transform: {
            document: docName,
            fieldTransforms: [
              { fieldPath: 'views',               increment: { integerValue: '1' } },
              { fieldPath: `pages.${safePage}`,   increment: { integerValue: '1' } },
            ],
          },
        }],
      }),
    });

    return json({ ok: fsResp.ok });
  } catch (err) {
    return json({ ok: false });
  }
}

// ── POST /api/reset-collab-password ───────────────────────────────────────
async function handleResetCollabPassword(request, env) {
  try {
    const { uid, newPassword } = await request.json();
    if (!uid || !newPassword || newPassword.length < 8) {
      return json({ ok: false, error: 'uid e newPassword (min 8 caratteri) richiesti' });
    }
    const projectId  = env.FCM_PROJECT_ID;
    const accessToken = await getAccessToken(env.FCM_CLIENT_EMAIL, env.FCM_PRIVATE_KEY);
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: uid, password: newPassword }),
      }
    );
    const data = await resp.json();
    if (!resp.ok) return json({ ok: false, error: data.error?.message || 'Errore Firebase' });
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

// ── POST /api/recover-collab ───────────────────────────────────────────────
async function handleRecoverCollab(request, env) {
  try {
    const { username, name, newPassword, ownerUid } = await request.json();
    if (!username || !newPassword || newPassword.length < 8) {
      return json({ ok: false, error: 'username e newPassword richiesti' });
    }
    const projectId   = env.FCM_PROJECT_ID;
    const accessToken = await getAccessToken(env.FCM_CLIENT_EMAIL, env.FCM_PRIVATE_KEY);
    const internalEmail = `${username}@astra-admin.internal`;

    // Cerca l'utente in Firebase Auth per email
    const lookupResp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: [internalEmail] }),
      }
    );
    const lookupData = await lookupResp.json();
    let uid;

    if (lookupData.users && lookupData.users.length > 0) {
      uid = lookupData.users[0].localId;
      // Reimposta la password
      await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: uid, password: newPassword }),
      });
    } else {
      // Crea l'utente
      const createResp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: internalEmail, password: newPassword, displayName: name || username }),
        }
      );
      const createData = await createResp.json();
      if (!createData.localId) return json({ ok: false, error: createData.error?.message || 'Creazione fallita' });
      uid = createData.localId;
    }

    // Assicura che auth_aliases e admins esistano su Firestore
    const fsBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    await fetch(`${fsBase}/auth_aliases/${username}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { email: { stringValue: internalEmail } } }),
    });
    const adminFields = {
      name:      { stringValue: name || username },
      username:  { stringValue: username },
      role:      { stringValue: 'collaborator' },
    };
    if (ownerUid) adminFields.createdBy = { stringValue: ownerUid };
    await fetch(`${fsBase}/admins/${uid}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: adminFields }),
    });

    return json({ ok: true, uid });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

// ── GET /api/social ────────────────────────────────────────────────────────
async function handleSocialData(request, env) {
  try {
    const url      = new URL(request.url);
    const clientId = url.searchParams.get('clientId');
    const platform = url.searchParams.get('platform'); // 'instagram' | 'tiktok'
    const allPosts = url.searchParams.get('allPosts') === '1';

    if (!clientId || !platform) return json({ ok: false, error: 'clientId e platform richiesti' });
    if (!env.RAPID_API_KEY) return json({ ok: false, error: 'RAPID_API_KEY non configurata nel Worker' });

    const projectId = env.FCM_PROJECT_ID;
    const svcToken  = await getAccessToken(env.FCM_CLIENT_EMAIL, env.FCM_PRIVATE_KEY);
    const fsBase    = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    const clientResp = await fetch(`${fsBase}/clients/${clientId}`, { headers: { Authorization: `Bearer ${svcToken}` } });
    if (!clientResp.ok) return json({ ok: false, error: 'Client non trovato' });
    const f  = (await clientResp.json()).fields || {};
    const pf = f.social?.mapValue?.fields?.[platform]?.mapValue?.fields || {};

    if (!pf.enabled?.booleanValue) return json({ ok: false, error: `${platform} non attivato` });

    const username    = pf.username?.stringValue;
    const mode        = pf.mode?.stringValue || 'auto';
    const managedFrom = pf.managedFrom?.stringValue || '';
    const selectedIds = (pf.selectedPosts?.arrayValue?.values || []).map(v => v.stringValue).filter(Boolean);

    if (!username) return json({ ok: false, error: 'Username non configurato' });

    const RK = env.RAPID_API_KEY;

    if (platform === 'instagram') {
      const [profileR, postsR] = await Promise.all([
        fetch(`https://instagram-scraper-api2.p.rapidapi.com/v1/info?username=${encodeURIComponent(username)}`,
          { headers: { 'x-rapidapi-host': 'instagram-scraper-api2.p.rapidapi.com', 'x-rapidapi-key': RK } }),
        fetch(`https://instagram-scraper-api2.p.rapidapi.com/v1/posts?username_or_id_or_url=${encodeURIComponent(username)}`,
          { headers: { 'x-rapidapi-host': 'instagram-scraper-api2.p.rapidapi.com', 'x-rapidapi-key': RK } }),
      ]);
      const profileData = await profileR.json();
      const postsData   = await postsR.json();
      if (profileData.status === 'fail' || profileData.error) return json({ ok: false, error: 'Profilo Instagram non trovato o API key non valida' });

      let posts = postsData.data?.items || [];
      if (!allPosts) {
        if (mode === 'auto' && managedFrom) {
          const fromTs = Math.floor(new Date(managedFrom).getTime() / 1000);
          posts = posts.filter(p => (p.taken_at || 0) >= fromTs);
        } else if (mode === 'manual' && selectedIds.length > 0) {
          posts = posts.filter(p => selectedIds.includes(String(p.id || p.pk)));
        }
      }
      return json({ ok: true, platform: 'instagram', profile: profileData.data, posts });
    }

    if (platform === 'tiktok') {
      const [profileR, videosR] = await Promise.all([
        fetch(`https://tiktok-scraper7.p.rapidapi.com/user/info?uniqueId=${encodeURIComponent(username)}`,
          { headers: { 'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com', 'x-rapidapi-key': RK } }),
        fetch(`https://tiktok-scraper7.p.rapidapi.com/user/posts?uniqueId=${encodeURIComponent(username)}&count=35&cursor=0`,
          { headers: { 'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com', 'x-rapidapi-key': RK } }),
      ]);
      const profileData = await profileR.json();
      const videosData  = await videosR.json();
      if (profileData.code !== 0) return json({ ok: false, error: 'Profilo TikTok non trovato o API key non valida' });

      let videos = videosData.data?.videos || [];
      if (!allPosts) {
        if (mode === 'auto' && managedFrom) {
          const fromTs = Math.floor(new Date(managedFrom).getTime() / 1000);
          videos = videos.filter(v => (v.createTime || 0) >= fromTs);
        } else if (mode === 'manual' && selectedIds.length > 0) {
          videos = videos.filter(v => selectedIds.includes(String(v.video_id || v.id)));
        }
      }
      return json({ ok: true, platform: 'tiktok', profile: profileData.data?.user, stats: profileData.data?.stats, videos });
    }

    return json({ ok: false, error: 'Platform non supportata' });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

// ── POST /api/delete-collab-auth ──────────────────────────────────────────
async function handleDeleteCollabAuth(request, env) {
  try {
    const { uid } = await request.json();
    if (!uid) return json({ ok: false, error: 'uid richiesto' });
    const projectId   = env.FCM_PROJECT_ID;
    const accessToken = await getAccessToken(env.FCM_CLIENT_EMAIL, env.FCM_PRIVATE_KEY);
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: uid }),
      }
    );
    if (!resp.ok) {
      const data = await resp.json();
      return json({ ok: false, error: data.error?.message || 'Errore Firebase' });
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

// ── POST /api/notify ───────────────────────────────────────────────────────
async function handleNotify(request, env) {
  try {
    const body = await request.json();
    const { type, name, companyName, title: customTitle, body: customBody } = body;

    let title, notifBody;
    if (type === 'manual') {
      title     = customTitle  || 'Astra Agency';
      notifBody = customBody   || 'Nuova notifica';
    } else if (type === 'partner') {
      title     = 'Nuova richiesta partner!';
      notifBody = `${companyName || "Un'azienda"} vuole collaborare`;
    } else {
      title     = 'Nuovo messaggio!';
      notifBody = `${name || 'Qualcuno'} ha inviato un messaggio`;
    }

    const projectId   = env.FCM_PROJECT_ID;
    const clientEmail = env.FCM_CLIENT_EMAIL;
    const privateKey  = env.FCM_PRIVATE_KEY;

    const accessToken = await getAccessToken(clientEmail, privateKey);
    const tokens      = await getAdminTokens(projectId, accessToken);

    if (tokens.length > 0) {
      await sendAll(tokens, title, notifBody, projectId, accessToken);
    }

    return json({ ok: true, count: tokens.length });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ── GET /api/debug ─────────────────────────────────────────────────────────
async function handleDebug(env) {
  const result = { steps: {} };
  const projectId   = env.FCM_PROJECT_ID;
  const clientEmail = env.FCM_CLIENT_EMAIL;
  const privateKey  = env.FCM_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    result.steps.credentials = '✗ Env vars mancanti (FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY)';
    return jsonDebug(result);
  }
  result.steps.credentials = { projectId, clientEmail, keyLength: privateKey.length };

  let accessToken;
  try {
    accessToken = await getAccessToken(clientEmail, privateKey);
    result.steps.oauth = '✓ access token ottenuto';
  } catch (e) {
    result.steps.oauth = '✗ ' + e.message;
    return jsonDebug(result);
  }

  try {
    const tokens = await getAdminTokens(projectId, accessToken);
    result.steps.firestoreTokens = tokens.length > 0
      ? `✓ ${tokens.length} token trovati`
      : '✗ Nessun token in admin_tokens — attiva le notifiche sul telefono';
    result.steps.tokenCount = tokens.length;

    if (tokens.length > 0) {
      const fcmUrl  = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
      const fcmResp = await fetch(fcmUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: tokens[0],
            notification: { title: 'Debug Astra', body: 'Test diagnostico!' },
            webpush: {
              notification: {
                title: 'Debug Astra',
                body: 'Test diagnostico!',
                icon: 'https://astragency.it/admin/icon.png',
                badge: 'https://astragency.it/admin/icon.png',
                requireInteraction: false,
              },
              fcmOptions: { link: 'https://astragency.it/admin/dashboard.html' },
            },
          },
        }),
      });
      const fcmData = await fcmResp.json();
      result.steps.fcmSend = fcmResp.ok ? '✓ FCM OK: ' + JSON.stringify(fcmData) : '✗ FCM error: ' + JSON.stringify(fcmData);
    }
  } catch (e) {
    result.steps.firestoreTokens = '✗ ' + e.message;
  }

  return jsonDebug(result);
}

// ── Firestore ──────────────────────────────────────────────────────────────
async function getAdminTokens(projectId, accessToken) {
  const url  = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admin_tokens`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.documents || []).map(d => d.fields?.token?.stringValue).filter(Boolean);
}

// ── FCM v1 ─────────────────────────────────────────────────────────────────
async function sendAll(tokens, title, body, projectId, accessToken) {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  await Promise.allSettled(
    tokens.map(token =>
      fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            webpush: {
              notification: {
                title,
                body,
                icon: 'https://astragency.it/admin/icon.png',
                badge: 'https://astragency.it/admin/icon.png',
                requireInteraction: false,
              },
              fcmOptions: { link: 'https://astragency.it/admin/dashboard.html' },
            },
          },
        }),
      })
    )
  );
}

// ── Auth JWT ───────────────────────────────────────────────────────────────
async function getAccessToken(clientEmail, privateKey) {
  const now     = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: clientEmail, scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const unsigned  = `${header}.${payload}`;
  const key       = await importPrivateKey(privateKey);
  const sigBuf    = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc(unsigned));
  const jwt       = `${unsigned}.${b64url(sigBuf)}`;
  const resp      = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error(JSON.stringify(data));
  return data.access_token;
}

async function importPrivateKey(pem) {
  const clean  = pem.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const binary = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', binary.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

function b64url(input) {
  const str = input instanceof ArrayBuffer
    ? String.fromCharCode(...new Uint8Array(input))
    : typeof input === 'string' ? input : JSON.stringify(input);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function enc(str) { return new TextEncoder().encode(str); }

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function jsonDebug(body) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
