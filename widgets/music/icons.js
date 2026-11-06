// Icônes SVG des boutons de lecture (dessinées en currentColor : elles prennent la couleur du texte).
const svg = (body) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';

export const ICONS = {
  prev: svg('<path d="M6 5h2.5v14H6zM20 5v14L9.5 12z" fill="currentColor"/>'),
  next: svg('<path d="M15.5 5H18v14h-2.5zM4 5v14l10.5-7z" fill="currentColor"/>'),
  play: svg('<path d="M7 4.5v15L19.5 12z" fill="currentColor"/>'),
  pause: svg('<path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z" fill="currentColor"/>'),
  library: svg('<path d="M4 6h16v2.4H4zM4 10.8h16v2.4H4zM4 15.6h10v2.4H4z" fill="currentColor"/>'),
};
