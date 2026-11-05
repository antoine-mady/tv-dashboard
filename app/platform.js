// Tout ce qui dépend de la plateforme (TV Tizen ou aperçu navigateur) passe par ici.
/* global tizen, webapis */

export const isTizen = typeof window !== 'undefined' && typeof window.tizen !== 'undefined';
export const isPreview = typeof window !== 'undefined' && !!window.__PREVIEW__;

/** Empêche l'économiseur d'écran de la TV de se déclencher sur le dashboard. */
export function disableScreenSaver() {
  try {
    webapis.appcommon.setScreenSaver(webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF);
  } catch (e) { /* hors TV ou API absente */ }
}

/**
 * Dans l'aperçu navigateur, les requêtes cross-origin (DLNA de la box…) passent par le proxy
 * du serveur d'admin. Sur la TV, l'app Tizen a le droit de les faire directement.
 */
export function proxify(url) {
  if (!isPreview || !/^https?:\/\//i.test(url)) return url;
  return '/api/proxy?url=' + encodeURIComponent(url);
}

/** Lance une autre app de la TV (ex. YouTube). Retourne false hors TV. */
export function launchApp(appId) {
  if (!isTizen) {
    console.log('[aperçu] lancement de l’app TV', appId);
    return false;
  }
  try {
    tizen.application.launch(appId, function () {}, function (err) { console.warn('launch', err); });
    return true;
  } catch (e) {
    console.warn('launch', e);
    return false;
  }
}
