// Scène 1920×1080 mise à l'échelle de l'écran, et placement des cellules de widgets.
import { h } from './dom.js';

export const STAGE_W = 1920;
export const STAGE_H = 1080;
const INNER_PADDING = 28; // padding interne d'une cellule encadrée (doit correspondre à styles.css)

export function createStage(root, grid, global) {
  const pad = global.padding;
  const gap = global.gap;
  const colW = (STAGE_W - 2 * pad - gap * (grid.cols - 1)) / grid.cols;
  const rowH = (STAGE_H - 2 * pad - gap * (grid.rows - 1)) / grid.rows;
  let shiftX = 0;
  let shiftY = 0;

  root.className = 'bg-' + global.background;
  root.style.setProperty('--accent', global.accent);

  function fit() {
    const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    const offX = (window.innerWidth - STAGE_W * scale) / 2;
    const offY = (window.innerHeight - STAGE_H * scale) / 2;
    root.style.transform = 'translate(' + (offX + shiftX * scale) + 'px,' + (offY + shiftY * scale) + 'px) scale(' + scale + ')';
  }
  window.addEventListener('resize', fit);
  fit();

  function rect(w) {
    return {
      left: pad + (w.col - 1) * (colW + gap),
      top: pad + (w.row - 1) * (rowH + gap),
      width: w.w * colW + (w.w - 1) * gap,
      height: w.h * rowH + (w.h - 1) * gap,
    };
  }

  return {
    /** Crée le cadre d'un widget. Retourne { cell, body, size }. */
    addCell(w, manifest) {
      const r = rect(w);
      const frameless = !!(manifest && manifest.frameless);
      const inner = frameless ? 0 : INNER_PADDING;
      const size = { width: Math.round(r.width - 2 * inner), height: Math.round(r.height - 2 * inner) };
      const body = h('div', { className: 'cell-body w-' + w.type });
      body.style.setProperty('--w', size.width + 'px');
      body.style.setProperty('--h', size.height + 'px');
      const cell = h('div', {
        className: 'cell' + (frameless ? ' frameless' : ''),
        'data-id': w.id,
        style: { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' },
      }, body);
      root.appendChild(cell);
      return { cell, body, size };
    },
    /** Décalage anti-marquage (en px de la scène). */
    setShift(x, y) { shiftX = x; shiftY = y; fit(); },
  };
}
