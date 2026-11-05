import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import WORDS from './words.js';
import { parseCustomWords, buildList, wordFor, yesterday } from './creole.js';

export default class CreoleWidget extends Widget {
  mount(el, s) {
    this.list = buildList(WORDS, parseCustomWords(s.customWords), s.onlyCustom);
    if (!this.list.length) throw new Error('Ajoutez au moins un mot personnel');
    this.root = h('div', { className: 'cr-inner' });
    el.appendChild(this.root);
    // Vérifie régulièrement si le jour a changé (minuit) ; rien à télécharger.
    this.every(5 * 60 * 1000, () => this.render());
  }

  render() {
    const s = this.settings;
    const now = new Date();
    const key = now.toDateString();
    if (key === this.shownDay) return;
    this.shownDay = key;
    const w = wordFor(this.list, now);
    const y = s.showYesterday && this.list.length > 1 ? wordFor(this.list, yesterday(now)) : null;
    this.root.innerHTML = '';
    if (s.title) this.root.appendChild(h('div', { className: 'cr-title', text: s.title }));
    this.root.appendChild(h('div', { className: 'cr-word', text: w.word }));
    this.root.appendChild(h('div', { className: 'cr-meaning', text: w.meaning }));
    if (s.showExample && w.example) this.root.appendChild(h('div', { className: 'cr-example', text: '« ' + w.example + ' »' }));
    if (y) this.root.appendChild(h('div', { className: 'cr-yesterday muted', text: 'Hier : ' + y.word + ' = ' + y.meaning }));
  }
}
