import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';
import WORDS, { PROVERBS } from './words.js';
import { parseCustomWords, buildList, builtInFor, wordFor, yesterday } from './creole.js';

export default class CreoleWidget extends Widget {
  mount(el, s) {
    this.list = buildList(builtInFor(s.mode, WORDS, PROVERBS), parseCustomWords(s.customWords), s.onlyCustom);
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
    if (this.shownDay) this.refreshed(this.root); // nouveau mot du jour (pas au premier affichage)
    this.shownDay = key;
    const w = wordFor(this.list, now);
    this.root.innerHTML = '';
    const y = s.showYesterday && this.list.length > 1 ? wordFor(this.list, yesterday(now)) : null;
    if (s.title) this.root.appendChild(h('div', { className: 'cr-title', text: w.proverb ? 'Proverbe kréol du jour' : s.title }));
    this.root.className = 'cr-inner' + (w.proverb ? ' is-proverb' : '');
    this.root.appendChild(h('div', { className: 'cr-word', text: w.proverb ? '« ' + w.word + ' »' : w.word }));
    this.root.appendChild(h('div', { className: 'cr-meaning', text: w.proverb ? 'Mot à mot : ' + w.meaning.charAt(0).toLowerCase() + w.meaning.slice(1) : w.meaning }));
    if (s.showExample && w.example) {
      this.root.appendChild(h('div', { className: 'cr-example', text: w.proverb ? w.example : '« ' + w.example + ' »' }));
    }
    if (y) this.root.appendChild(h('div', { className: 'cr-yesterday muted', text: 'Hier : ' + y.word + (y.proverb ? '' : ' = ' + y.meaning) }));
  }
}
