export default {
  type: 'music',
  name: 'Musique YouTube',
  icon: '🎵',
  description: 'Lit une playlist YouTube / YouTube Music. OK = lecture/pause, touches ⏭ ⏮ ⏯ de la télécommande, rouge = ouvrir l’app YouTube.',
  size: { default: { w: 4, h: 3 }, min: { w: 3, h: 2 } },
  focusable: true,
  schema: [
    { key: 'playlist', label: 'Playlist (lien ou ID)', type: 'text', default: '', required: true,
      placeholder: 'https://music.youtube.com/playlist?list=PL…',
      help: 'Collez le lien de partage d’une playlist YouTube Music ou YouTube.' },
    { key: 'autoplay', label: 'Lecture automatique au démarrage', type: 'bool', default: true },
    { key: 'shuffle', label: 'Lecture aléatoire', type: 'bool', default: true },
    { key: 'volume', label: 'Volume (%)', type: 'number', min: 0, max: 100, default: 60 },
    { key: 'showVideo', label: 'Afficher la vidéo (sinon la pochette)', type: 'bool', default: false },
    { key: 'youtubeAppId', label: 'ID de l’app YouTube sur la TV', type: 'text', default: '111299001912',
      help: 'Utilisé par la touche rouge. 111299001912 = YouTube sur les TV Samsung.' },
  ],
};
