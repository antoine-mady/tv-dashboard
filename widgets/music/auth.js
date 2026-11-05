// Connexion au compte Google et appels à l'API YouTube.
// Dépendances injectées (testable) : fetch(url, opts) → Response, store { get, set, remove }.
import {
  deviceCodeRequest, devicePollRequest, refreshRequest, parseDeviceCode, tokenFromResponse,
  myPlaylistsUrl, playlistItemsUrl, likedUrl, searchUrl,
  mapPlaylists, mapPlaylistItems, mapVideos, mapSearch, apiErrorMessage,
} from './google.js';

const TOKEN_KEY = 'token';

/** Erreur signalant que la connexion est perdue (il faut se reconnecter par QR code). */
export class AuthLostError extends Error {
  constructor(message) {
    super(message || 'Connexion YouTube expirée : reconnectez-vous');
    this.authLost = true;
  }
}

function readJson(res) {
  return res.text().then((t) => {
    try { return JSON.parse(t); } catch (e) { return {}; }
  });
}

export function createAuth(opts) {
  const fetchFn = opts.fetch;
  const store = opts.store;
  const now = opts.now || (() => Date.now());
  const clientId = opts.clientId;
  const clientSecret = opts.clientSecret;
  let token = store.get(TOKEN_KEY, null);
  let refreshing = null;

  function save(t) {
    token = t;
    if (t) store.set(TOKEN_KEY, t); else store.remove(TOKEN_KEY);
  }

  async function call(req) {
    const res = await fetchFn(req.url, req.opts);
    return { status: res.status, ok: res.ok, json: await readJson(res) };
  }

  async function refresh() {
    if (!token || !token.refreshToken) { save(null); throw new AuthLostError(); }
    if (!refreshing) {
      refreshing = call(refreshRequest(clientId, clientSecret, token.refreshToken)).then((r) => {
        refreshing = null;
        if (r.ok) { save(tokenFromResponse(r.json, now(), token)); return token.accessToken; }
        if (r.json.error === 'invalid_grant' || r.json.error === 'unauthorized_client') {
          save(null);
          throw new AuthLostError();
        }
        throw new Error('Connexion Google impossible (' + (r.json.error_description || r.json.error || r.status) + ')');
      }, (e) => { refreshing = null; throw e; });
    }
    return refreshing;
  }

  async function getAccessToken() {
    if (!token) throw new AuthLostError('Compte YouTube non connecté');
    if (!token.accessToken || token.expiresAt - now() < 60 * 1000) return refresh();
    return token.accessToken;
  }

  const auth = {
    isConnected() { return !!(token && token.refreshToken); },

    /** Démarre la connexion : renvoie { userCode, verificationUrl, deviceCode, interval, expiresAt }. */
    async startDeviceFlow() {
      const r = await call(deviceCodeRequest(clientId));
      if (!r.ok) {
        const e = r.json.error;
        if (e === 'invalid_client') throw new Error('Identifiant client Google invalide (vérifiez la config)');
        if (e === 'invalid_scope') throw new Error('Le client OAuth doit être de type « TV et appareils à saisie limitée »');
        throw new Error('Connexion Google impossible (' + (r.json.error_description || e || r.status) + ')');
      }
      return parseDeviceCode(r.json, now());
    },

    /**
     * Une vérification : 'pending' (pas encore validé), 'slow_down' (attendre plus) ou 'connected'.
     * Lève une erreur si l'utilisateur refuse ou si le code a expiré.
     */
    async poll(device) {
      if (now() > device.expiresAt) throw new Error('Code expiré : recommencez');
      const r = await call(devicePollRequest(clientId, clientSecret, device.deviceCode));
      if (r.ok) { save(tokenFromResponse(r.json, now())); return 'connected'; }
      switch (r.json.error) {
        case 'authorization_pending': return 'pending';
        case 'slow_down': return 'slow_down';
        case 'access_denied': throw new Error('Connexion refusée sur le téléphone');
        case 'expired_token': throw new Error('Code expiré : recommencez');
        case 'invalid_client': throw new Error('Secret client Google invalide (vérifiez la config)');
        default: throw new Error('Connexion Google impossible (' + (r.json.error_description || r.json.error || r.status) + ')');
      }
    },

    logout() { save(null); },

    getAccessToken,

    /** GET sur l'API YouTube avec le jeton ; un 401 déclenche un rafraîchissement puis un nouvel essai. */
    async api(url) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const access = attempt === 0 ? await getAccessToken() : await refresh();
        const res = await fetchFn(url, { headers: { Authorization: 'Bearer ' + access } });
        if (res.status === 401 && attempt === 0) continue;
        const json = await readJson(res);
        if (!res.ok) throw new Error(apiErrorMessage(res.status, json));
        return json;
      }
      save(null);
      throw new AuthLostError();
    },
  };
  return auth;
}

/**
 * Bibliothèque musicale du compte (avec cache pour économiser le quota).
 * Toutes les méthodes renvoient des listes d'objets simples.
 */
export function createLibrary(auth, opts) {
  const o = opts || {};
  const now = o.now || (() => Date.now());
  const ttl = o.ttl || 30 * 60 * 1000;
  const maxTracks = o.maxTracks || 200;
  const cache = {};

  function cached(key, fn) {
    const hit = cache[key];
    if (hit && now() - hit.at < ttl) return Promise.resolve(hit.value);
    return fn().then((value) => { cache[key] = { at: now(), value }; return value; });
  }

  async function paged(makeUrl, map, max) {
    let out = [];
    let pageToken;
    do {
      const json = await auth.api(makeUrl(pageToken));
      out = out.concat(map(json));
      pageToken = json.nextPageToken;
    } while (pageToken && out.length < max);
    return out.slice(0, max);
  }

  return {
    playlists() { return cached('playlists', () => paged(myPlaylistsUrl, mapPlaylists, 500)); },
    playlistTracks(id) { return cached('pl:' + id, () => paged((t) => playlistItemsUrl(id, t), mapPlaylistItems, maxTracks)); },
    liked() { return cached('liked', () => paged(likedUrl, mapVideos, maxTracks)); },
    // Une recherche coûte 100 unités de quota : une seule page, mise en cache.
    search(query) { return cached('q:' + query.toLowerCase(), () => auth.api(searchUrl(query)).then(mapSearch)); },
    clear() { Object.keys(cache).forEach((k) => delete cache[k]); },
  };
}
