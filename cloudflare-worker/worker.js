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

    if (request.method === 'GET' && path.endsWith('/proxy-image')) {
      return handleProxyImage(request);
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

// ── Cache helpers (Firestore social_cache, TTL 6h) ────────────────────────
const SOCIAL_CACHE_TTL = 6 * 3600;

async function loadSocialCache(fsBase, token, key) {
  try {
    const r = await fetch(`${fsBase}/social_cache/${key}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const fields = (await r.json()).fields || {};
    const age = Math.floor(Date.now() / 1000) - parseInt(fields.cachedAt?.integerValue || '0');
    if (age > SOCIAL_CACHE_TTL) return null;
    const s = fields.data?.stringValue;
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function saveSocialCache(fsBase, token, key, data) {
  fetch(`${fsBase}/social_cache/${key}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {
      cachedAt: { integerValue: String(Math.floor(Date.now() / 1000)) },
      data:     { stringValue: JSON.stringify(data) },
    }}),
  }).catch(() => {});
}

function applyFilter(items, mode, managedFrom, startFrom, tsKey) {
  if (mode === 'auto' && managedFrom) {
    const from = Math.floor(new Date(managedFrom).getTime() / 1000);
    return items.filter(i => (i[tsKey] || 0) >= from);
  }
  if (mode === 'manual' && startFrom > 0) {
    return items.filter(i => (i[tsKey] || 0) >= startFrom);
  }
  return items;
}

// ── GET /api/proxy-image ───────────────────────────────────────────────────
async function handleProxyImage(request) {
  const imgUrl = new URL(request.url).searchParams.get('url');
  if (!imgUrl) return new Response('url required', { status: 400, headers: CORS });

  let parsed;
  try { parsed = new URL(imgUrl); } catch { return new Response('invalid url', { status: 400, headers: CORS }); }

  const allowed = ['.cdninstagram.com', '.fbcdn.net', '.tiktokcdn.com', '.tiktokv.com', '.tiktokcdn-us.com', '.musical.ly'];
  if (!allowed.some(h => parsed.hostname.endsWith(h))) {
    return new Response('domain not allowed', { status: 403, headers: CORS });
  }

  // Use Cloudflare edge cache
  const cacheKey = new Request(request.url);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const upstream = await fetch(imgUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  });
  if (!upstream.ok) return new Response('upstream error', { status: upstream.status, headers: CORS });

  const body = await upstream.arrayBuffer();
  const response = new Response(body, {
    headers: {
      ...CORS,
      'Content-Type': upstream.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
  caches.default.put(cacheKey, response.clone()).catch(() => {});
  return response;
}

// ── GET /api/social ────────────────────────────────────────────────────────
async function handleSocialData(request, env) {
  try {
    const url      = new URL(request.url);
    const clientId = url.searchParams.get('clientId');
    const platform = url.searchParams.get('platform');
    const wantAll  = url.searchParams.get('allPosts') === '1';

    if (!clientId || !platform) return json({ ok: false, error: 'clientId e platform richiesti' });

    // Proxy CDN images through our Worker to bypass Instagram/TikTok CORP headers
    const origin = new URL(request.url).origin;
    const px = u => u ? `${origin}/api/proxy-image?url=${encodeURIComponent(u)}` : '';
    const pxProfile = p => {
      if (!p) return p;
      const r = { ...p };
      if (p.profile_pic_url) r.profile_pic_url = px(p.profile_pic_url);
      if (p.avatarMedium)    r.avatarMedium    = px(p.avatarMedium);
      if (p.avatarLarger)    r.avatarLarger    = px(p.avatarLarger);
      if (p.avatarThumb)     r.avatarThumb     = px(p.avatarThumb);
      return r;
    };
    const pxPosts  = arr => arr.map(p => ({ ...p, thumbnail_url: px(p.thumbnail_url) }));
    const pxVideos = arr => arr.map(v => {
      const cover = v.video?.cover || v.cover_url || v.origin_cover || '';
      if (!cover) return v;
      return {
        ...v,
        cover_url:    v.cover_url    ? px(v.cover_url)    : px(cover),
        origin_cover: v.origin_cover ? px(v.origin_cover) : v.origin_cover,
        video: v.video ? { ...v.video, cover: v.video.cover ? px(v.video.cover) : v.video.cover } : v.video,
      };
    });

    const projectId = env.FCM_PROJECT_ID;
    const svcToken  = await getAccessToken(env.FCM_CLIENT_EMAIL, env.FCM_PRIVATE_KEY);
    const fsBase    = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    const clientResp = await fetch(`${fsBase}/clients/${clientId}`, { headers: { Authorization: `Bearer ${svcToken}` } });
    if (!clientResp.ok) return json({ ok: false, error: 'Client non trovato' });
    const f  = (await clientResp.json()).fields || {};
    const pf = f.social?.mapValue?.fields?.[platform]?.mapValue?.fields || {};

    if (!pf.enabled?.booleanValue) return json({ ok: false, error: `${platform} non attivato` });

    const username     = pf.username?.stringValue;
    const mode         = pf.mode?.stringValue || 'auto';
    const managedFrom  = pf.managedFrom?.stringValue || '';
    const startFromRaw = pf.startFrom?.integerValue || pf.startFrom?.doubleValue;
    const startFrom    = startFromRaw ? Number(startFromRaw) : 0;

    if (!username) return json({ ok: false, error: 'Username non configurato' });

    const cacheKey = `${clientId}_${platform}`;

    // ── Instagram — chiamata diretta, nessun servizio esterno ────────
    if (platform === 'instagram') {
      const cached = await loadSocialCache(fsBase, svcToken, cacheKey);
      if (cached) {
        const posts = wantAll ? cached.posts : applyFilter(cached.posts, mode, managedFrom, startFrom, 'taken_at');
        return json({ ok: true, platform: 'instagram', profile: pxProfile(cached.profile), posts: pxPosts(posts) });
      }

      const igResp = await fetch(
        `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
        {
          headers: {
            'x-ig-app-id': '936619743392459',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://www.instagram.com',
            'Referer': 'https://www.instagram.com/',
          },
        }
      );

      if (!igResp.ok) {
        const errText = await igResp.text().catch(() => '');
        return json({ ok: false, error: `Instagram HTTP ${igResp.status} — ${errText.slice(0, 200)}` });
      }

      const igData = await igResp.json();
      const igUser = igData.data?.user;
      if (!igUser) {
        return json({ ok: false, error: `Instagram: risposta inattesa — ${JSON.stringify(igData).slice(0, 300)}` });
      }

      const profile = {
        username:        igUser.username || username,
        full_name:       igUser.full_name || '',
        profile_pic_url: igUser.profile_pic_url_hd || igUser.profile_pic_url || '',
        followers_count: igUser.edge_followed_by?.count || 0,
        following_count: igUser.edge_follow?.count || 0,
        media_count:     igUser.edge_owner_to_timeline_media?.count || 0,
      };

      const allIgPosts = (igUser.edge_owner_to_timeline_media?.edges || []).map(({ node: p }) => ({
        id:             p.id || '',
        taken_at:       p.taken_at_timestamp || 0,
        like_count:     p.edge_liked_by?.count || 0,
        comments_count: p.edge_media_to_comment?.count || 0,
        media_type:     p.__typename === 'GraphVideo' ? 2 : 1,
        thumbnail_url:  p.thumbnail_src || p.display_url || '',
        permalink:      p.shortcode ? `https://www.instagram.com/p/${p.shortcode}/` : '',
      }));

      saveSocialCache(fsBase, svcToken, cacheKey, { profile, posts: allIgPosts });
      const posts = wantAll ? allIgPosts : applyFilter(allIgPosts, mode, managedFrom, startFrom, 'taken_at');
      return json({ ok: true, platform: 'instagram', profile: pxProfile(profile), posts: pxPosts(posts) });
    }

    // ── TikTok — direct page scraping ───────────────────────────────
    if (platform === 'tiktok') {
      const cached = await loadSocialCache(fsBase, svcToken, cacheKey);
      if (cached) {
        const videos = wantAll ? cached.videos : applyFilter(cached.videos, mode, managedFrom, startFrom, 'createTime');
        return json({ ok: true, platform: 'tiktok', profile: pxProfile(cached.profile), stats: cached.stats, videos: pxVideos(videos) });
      }

      let ttData;
      try {
        ttData = await fetchTikTokDirect(username);
      } catch (err) {
        return json({ ok: false, error: 'TikTok: ' + err.message });
      }

      const ttProfile = ttData.user;
      const ttStats   = ttData.stats;
      const allVideos = ttData.videos || [];

      saveSocialCache(fsBase, svcToken, cacheKey, { profile: ttProfile, stats: ttStats, videos: allVideos });

      const videos = wantAll ? allVideos : applyFilter(allVideos, mode, managedFrom, startFrom, 'createTime');
      return json({ ok: true, platform: 'tiktok', profile: pxProfile(ttProfile), stats: ttStats, videos: pxVideos(videos) });
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

// ── TikTok direct scraping ─────────────────────────────────────────────────
async function fetchTikTokDirect(username) {
  const resp = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('dati non trovati nella pagina (possibile bot detection)');
  let raw;
  try { raw = JSON.parse(m[1]); } catch { throw new Error('JSON non valido nella pagina TikTok'); }
  const scope = raw.__DEFAULT_SCOPE__ || {};
  const ud = scope['webapp.user-detail'] || {};
  const userInfo = ud.userInfo || {};
  if (!userInfo.user?.uniqueId) {
    for (const k of Object.keys(scope)) {
      const s = scope[k];
      if (s?.userInfo?.user?.uniqueId) {
        return { user: s.userInfo.user, stats: s.userInfo.stats || {}, videos: s.itemList || [] };
      }
    }
    throw new Error('profilo non trovato nel JSON della pagina');
  }
  return { user: userInfo.user, stats: userInfo.stats || {}, videos: ud.itemList || [] };
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
