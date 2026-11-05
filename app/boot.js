// Copié tel quel dans dist/ (non bundlé) : doit rester en ES5.
// Diagnostic, chargé avant app.js : affiche à l'écran toute erreur JS ou un démarrage raté,
// au lieu d'un écran vide. La version du navigateur aide à repérer une TV trop ancienne.
(function () {
  var lines = [];
  function show(msg) {
    lines.push(msg);
    var box = document.getElementById('boot-error');
    if (!box) {
      if (!document.body) { document.addEventListener('DOMContentLoaded', function () { show(lines.pop()); }); return; }
      box = document.createElement('pre');
      box.id = 'boot-error';
      box.style.cssText = 'position:fixed;left:40px;top:40px;right:40px;z-index:99999;margin:0;padding:30px;' +
        'background:#2a0d0d;color:#ffd2c8;border:3px solid #ff6b57;border-radius:16px;font:26px/1.4 monospace;' +
        'white-space:pre-wrap;word-wrap:break-word;';
      document.body.appendChild(box);
    }
    box.textContent = '\u26a0 TV Dashboard : erreur\n\n' + lines.join('\n') + '\n\nNavigateur : ' + navigator.userAgent;
  }
  window.__showBootError = show;
  window.onerror = function (msg, src, line, col) {
    show(msg + (src ? ' (' + String(src).split('/').pop() + ':' + line + ':' + (col || 0) + ')' : ''));
  };
  window.addEventListener('load', function () {
    setTimeout(function () {
      if (!window.__APP_STARTED__) show("L'application n'a pas démarré (app.js non chargé ou incompatible avec ce navigateur).");
    }, 3000);
  });
})();
