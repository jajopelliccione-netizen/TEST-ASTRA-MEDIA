// Cloudflare Worker — gestisce /api/notify e /api/debug
const SA_PROJECT_ID   = 'astragency-88b1a';
const SA_CLIENT_EMAIL = 'firebase-adminsdk-fbsvc@astragency-88b1a.iam.gserviceaccount.com';
const SA_PRIVATE_KEY  = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDsFKX4IbvxWvqH
vZxqNRWvgrAwyOZ2OYxraEslHpJGlQvWSOc6bvngyxfm54W6tcQ15jsZQPC9qmH4
c0dXmRwivwcK0Hdw/V09SpxJGPAFcofo3xjS6FzIO47Zzc9n6bPUVxp8cFl12g30
nfG1SpiUnJSZd1Xips+FmbuCQF6ngxFo7pDqs++astXIiGQ/rkYCfCHPG+waGwDm
9v1RUznrrjrDdelcL+bWirEoqICbr6R+ypXXGtXRacTPigENoY3YfwSNOzQWI9hm
XvSonDvHxr/tUqPmnmv+Y2NO7yo095VEH6tkxBHtF27qpm93QqDUV/r3KUJqOYAV
nSfZ0NZTAgMBAAECggEADUPpwYQPvfOZQThXyiX6dna29L7NKFZ6e+yL0GWj3YBx
flRxXbivpMB0st5OhtvAzzCFIJmkDVw+DgpYN2Vcjd1DBYoKNBigfRmsp3TVw9CY
L28dw3gYAo5KLBXi8hlRJ/zO+bAMbtFWWGjplIDBCxSzSt5IPqiV35FwVlTMnMfm
drOXEQIFjz51vzODrKubSpQsWi/idvw+bruQcPEV7AuZvISnXbOFDC4vGqQyxdnW
TbkY6EuJMDevVRQDmPKfLatEsVVvod/WzScHz4Y7+i/X2F9aeHHB2LdeTYfsz2ta
SMydWBCz+tFZAbfrJgUxaUPQXVr3G310mkQXhLss6QKBgQD8sK+CD2HmgT3lhjwl
1f8d9qGD0RDpsbzmW9nwUdDPXnHc8PsssUg1rYKdTRrsR+j9YxHS5XXvN66mHVd6
MBpT8y4qHfzF5jIqpvZF4gPa/zYxwlyQWRVRUwzAcRLifFkp9QY0V+evfjp+SZ2C
7FsrnmWn5QE9AKOaT9ZUsjPs2wKBgQDvLESitvTXjKWRJaxKopmS4e/k+t0MJjTr
hCCMofibNId+8HMHTiQnx2Cfq6JWI9XvnIK8qPePD0tvj928x3nM5/YSh0nDo1iN
mKErLKT+1ozeYGghrdh5NzGU727D/tIXdbBg7lbWWlUdL3t/t2gbDH+KkbvRqM7K
pSjBgmy56QKBgQDb1AH7jdJHq6vjX7I34EF/Ga5NdLXX+G4zoTiqHyMfJDS+V07M
BLajK/1zRz7iy3Rf66334POGVtSzYtdVTz+4RNimf0wGBksiW/nntcZQ4LGO/F12
nmkzRKLVUAlzy2XuYGEzbD38qD3O29ARs/lkqvoY49r97O5nMoltSVJu/QKBgEAx
i4J4xKKN92pLyECH/9wylCbLRkUahB2qauoUFxvhL3TcqKMPUBj1JHP2py2jlKop
QdXNLBTTsBWTcZpXl9NtdthmQ2AlGYF3s9pYszhK8ahGC+zuMinmrIIi+YHVhSIS
znJVxizmNe4NboJLAcAwzJKuptCRFF/DkHrPvMrxAoGBAKbJnDzIvT2syE+aNJ2k
GrNB3hyA8BsHX2nhq1Bgj2BajKoOiA7c4MW6qtz8+AT/oaq0s/uS2RuHGCN3kqjH
2rzVU0nHQvytyL8yoAFWD99K7MfEXE6euFuQERv1TMEEAeksgJOii5wDN0hpObZw
cPilE1bNzaYVbNZnNJ/ckSZF
-----END PRIVATE KEY-----`;

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

    if (request.method === 'GET' && path.endsWith('/debug')) {
      return handleDebug(env);
    }

    return new Response('Not found', { status: 404 });
  },
};

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

    const projectId   = env.FCM_PROJECT_ID   || SA_PROJECT_ID;
    const clientEmail = env.FCM_CLIENT_EMAIL  || SA_CLIENT_EMAIL;
    const privateKey  = env.FCM_PRIVATE_KEY   || SA_PRIVATE_KEY;

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
  const projectId   = env.FCM_PROJECT_ID   || SA_PROJECT_ID;
  const clientEmail = env.FCM_CLIENT_EMAIL  || SA_CLIENT_EMAIL;
  const privateKey  = env.FCM_PRIVATE_KEY   || SA_PRIVATE_KEY;
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
              notification: { icon: 'https://astragency.it/admin/icon.png' },
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
              notification: { icon: 'https://astragency.it/admin/icon.png' },
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
