// Page « lecteur » : pont entre l'app TV (iframe parente) et le lecteur YouTube.
// ⚠ ES5 uniquement : ce fichier est servi tel quel et tourne dans le navigateur de la TV (Chrome 56).
//
// Protocole (postMessage, objets simples) :
//   app → page : { tvdash: 'cmd', cmd: 'load', ids: [...], index } | 'play' | 'pause' | 'stop' | 'next' | 'prev'
//                | { cmd: 'playAt', index } | { cmd: 'volume', value }
//   page → app : { tvdash: 'evt', type: 'ready' } | { type: 'state', state } | { type: 'error', code }
//                | { type: 'status', state, time, duration, index, videoId, title, author }  (chaque seconde)
(function () {
  var player = null;
  var ready = false;
  var pending = [];

  function send(msg) {
    msg.tvdash = 'evt';
    // L'app TV est servie en file:// (origine « null ») : impossible de cibler une origine précise.
    // Les messages ne contiennent que l'état de lecture.
    window.parent.postMessage(msg, '*');
  }

  function status() {
    if (!ready) return;
    var data = (player.getVideoData && player.getVideoData()) || {};
    send({
      type: 'status',
      state: player.getPlayerState(),
      time: player.getCurrentTime() || 0,
      duration: player.getDuration() || 0,
      index: player.getPlaylistIndex(),
      videoId: data.video_id || '',
      title: data.title || '',
      author: data.author || '',
    });
  }

  function run(m) {
    switch (m.cmd) {
      case 'load':
        player.loadPlaylist(m.ids, m.index || 0);
        player.setLoop(true);
        break;
      case 'play': player.playVideo(); break;
      case 'pause': player.pauseVideo(); break;
      case 'stop': player.stopVideo(); break;
      case 'next': player.nextVideo(); break;
      case 'prev': player.previousVideo(); break;
      case 'playAt': player.playVideoAt(m.index); break;
      case 'volume': player.setVolume(m.value); break;
      default: return;
    }
    setTimeout(status, 300);
  }

  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.tvdash !== 'cmd' || e.source !== window.parent) return;
    if (ready) run(m);
    else pending.push(m);
  });

  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('player', {
      width: '100%',
      height: '100%',
      playerVars: { controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, fs: 0 },
      events: {
        onReady: function () {
          ready = true;
          send({ type: 'ready' });
          while (pending.length) run(pending.shift());
          setInterval(status, 1000);
        },
        onStateChange: function (e) { send({ type: 'state', state: e.data }); status(); },
        onError: function (e) { send({ type: 'error', code: e.data }); },
      },
    });
  };

  var s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = function () { send({ type: 'error', code: 'api' }); };
  document.head.appendChild(s);
})();
