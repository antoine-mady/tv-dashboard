// OAuth Google « TV et appareils à saisie limitée » + API YouTube Data v3. Fichier PUR (testé).
// https://developers.google.com/youtube/v3/guides/auth/devices

export const DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
export const API = 'https://www.googleapis.com/youtube/v3/';

export function formBody(params) {
  return Object.keys(params)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&');
}

function post(url, params) {
  return {
    url,
    opts: {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody(params),
    },
  };
}

export function deviceCodeRequest(clientId) {
  return post(DEVICE_CODE_URL, { client_id: clientId, scope: SCOPE });
}

export function devicePollRequest(clientId, clientSecret, deviceCode) {
  return post(TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  });
}

export function refreshRequest(clientId, clientSecret, refreshToken) {
  return post(TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
}

/** Réponse /device/code → infos à afficher. */
export function parseDeviceCode(json, now) {
  return {
    deviceCode: json.device_code,
    userCode: json.user_code,
    verificationUrl: json.verification_url || json.verification_uri || 'https://www.google.com/device',
    interval: (json.interval || 5) * 1000,
    expiresAt: now + (json.expires_in || 1800) * 1000,
  };
}

/** Réponse /token → jeton stocké (le refresh_token n'est renvoyé qu'à la 1re connexion). */
export function tokenFromResponse(json, now, previous) {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || (previous && previous.refreshToken),
    expiresAt: now + (json.expires_in || 3600) * 1000,
  };
}

// ---- URLs de l'API Data --------------------------------------------------------------

function url(path, params) {
  const p = Object.assign({}, params);
  Object.keys(p).forEach((k) => { if (p[k] === undefined || p[k] === '') delete p[k]; });
  return API + path + '?' + formBody(p);
}

export function myPlaylistsUrl(pageToken) {
  return url('playlists', { part: 'snippet,contentDetails', mine: 'true', maxResults: 50, pageToken });
}

export function playlistItemsUrl(playlistId, pageToken) {
  return url('playlistItems', { part: 'snippet,status', playlistId, maxResults: 50, pageToken });
}

export function likedUrl(pageToken) {
  return url('videos', { part: 'snippet', myRating: 'like', maxResults: 50, pageToken });
}

export function searchUrl(query, pageToken) {
  return url('search', { part: 'snippet', type: 'video', videoCategoryId: '10', q: query, maxResults: 25, pageToken });
}

// ---- Conversion des réponses ------------------------------------------------------------

export function cleanArtist(name) {
  return String(name || '').replace(/ - Topic$/, '');
}

export function bestThumb(thumbnails) {
  const t = thumbnails || {};
  const pick = t.medium || t.high || t.default || t.standard;
  return pick ? pick.url : '';
}

const UNAVAILABLE = /^(Deleted video|Private video|Vidéo supprimée|Vidéo privée)$/;

function track(id, snippet, artist) {
  return {
    id,
    title: snippet.title,
    artist: cleanArtist(artist),
    thumb: bestThumb(snippet.thumbnails),
  };
}

export function mapPlaylists(json) {
  return (json.items || []).map((p) => ({
    id: p.id,
    title: p.snippet.title,
    count: p.contentDetails ? p.contentDetails.itemCount : null,
    thumb: bestThumb(p.snippet.thumbnails),
  }));
}

export function mapPlaylistItems(json) {
  return (json.items || [])
    .filter((it) => it.snippet && it.snippet.resourceId && !UNAVAILABLE.test(it.snippet.title))
    .filter((it) => !it.status || it.status.privacyStatus !== 'private')
    .map((it) => track(it.snippet.resourceId.videoId, it.snippet, it.snippet.videoOwnerChannelTitle));
}

export function mapVideos(json) {
  return (json.items || []).map((v) => track(v.id, v.snippet, v.snippet.channelTitle));
}

export function mapSearch(json) {
  return (json.items || [])
    .filter((it) => it.id && it.id.videoId)
    .map((it) => track(it.id.videoId, it.snippet, it.snippet.channelTitle));
}

/** Message d'erreur lisible à partir d'une réponse d'erreur de l'API. */
export function apiErrorMessage(status, json) {
  const err = (json && json.error) || {};
  const reason = err.errors && err.errors[0] && err.errors[0].reason;
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') return 'Quota YouTube du jour épuisé (réessayez demain)';
  if (reason === 'accessNotConfigured') return 'API YouTube Data v3 non activée dans le projet Google Cloud';
  if (status === 404) return 'Introuvable (playlist privée ou supprimée ?)';
  return 'YouTube : ' + (err.message || ('erreur HTTP ' + status));
}
