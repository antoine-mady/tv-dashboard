export default {
  type: 'wifi-qr',
  name: 'QR code Wi-Fi',
  icon: '📶',
  description: 'QR code à scanner pour se connecter au Wi-Fi.',
  size: { default: { w: 3, h: 3 }, min: { w: 2, h: 2 } },
  focusable: true,
  schema: [
    { key: 'title', label: 'Titre', type: 'text', default: 'Wi-Fi' },
    { key: 'ssid', label: 'Nom du réseau (SSID)', type: 'text', default: '', required: true },
    { key: 'security', label: 'Sécurité', type: 'select', default: 'WPA', options: [
      { value: 'WPA', label: 'WPA / WPA2 / WPA3' },
      { value: 'WEP', label: 'WEP' },
      { value: 'nopass', label: 'Aucune (réseau ouvert)' },
    ] },
    { key: 'password', label: 'Mot de passe', type: 'password', default: '', required: true, when: { security: 'WPA' } },
    { key: 'passwordWep', label: 'Mot de passe', type: 'password', default: '', required: true, when: { security: 'WEP' } },
    { key: 'hidden', label: 'Réseau masqué', type: 'bool', default: false },
    { key: 'showPassword', label: 'Afficher le mot de passe en clair sous le QR', type: 'bool', default: false },
  ],
};
