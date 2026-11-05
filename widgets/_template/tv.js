// Rendu du widget sur la TV.
import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';

export default class __CLASS__ extends Widget {
  mount(el, settings) {
    this.textEl = h('div', { className: 'tpl-text', text: settings.text });
    el.appendChild(this.textEl);

    // Rafraîchissement périodique (nettoyé automatiquement, erreurs affichées dans le widget) :
    // this.every(60 * 1000, () => this.refresh());
  }

  // async refresh() {
  //   const data = await this.fetchJson('https://exemple/api');
  //   this.textEl.textContent = data.value;
  // }

  // onKey(key) { if (key === 'enter') { …; return true; } return false; }  // nécessite focusable: true
  // destroy() { … libérer ce que this.every / this.after / this.listen ne gèrent pas … }
}
