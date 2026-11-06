import Widget from '../../app/Widget.js';
import { h } from '../../app/dom.js';

export default class TextWidget extends Widget {
  mount(el, settings) {
    this.textEl = h('div', { className: 'text-content' });
    el.appendChild(this.textEl);

    this.settings = settings;
    this.text = this.store.get('text', '');
    this.applySettings();
    this.render();
  }

  applySettings() {
    const size = Number(this.settings.fontSize);
    this.textEl.style.fontSize = (size >= 14 && size <= 32 ? size : 28) + 'px';
    this.textEl.style.textAlign = ['left', 'center', 'right'].indexOf(this.settings.align) >= 0
      ? this.settings.align
      : 'center';
    this.textEl.style.color = this.settings.color || '#ffffff';
  }

  render() {
    this.textEl.textContent = this.text || 'Appuyez sur OK pour écrire un texte';
    this.textEl.classList.toggle('is-empty', !this.text);
  }

  openEditor() {
    if (this.panelOpen) return;
    const panel = this.openPanel();
    panel.classList.add('w-text-panel');

    const title = h('h1', { className: 'text-editor-title', text: 'Modifier le texte' });
    const help = h('p', {
      className: 'text-editor-help',
      text: 'Saisissez votre message avec le clavier de la TV, ou dictez-le avec le bouton micro.',
    });
    const input = h('textarea', {
      className: 'text-editor-input',
      rows: '5',
      maxlength: '500',
      'aria-label': 'Texte à afficher sur la TV',
      placeholder: 'Écrivez votre texte…',
    });
    input.value = this.text;
    const done = h('button', { className: 'text-editor-done', text: 'Terminé' });
    panel.appendChild(h('div', { className: 'text-editor' }, title, help, input, done));

    input.addEventListener('input', () => {
      this.text = input.value;
      this.store.set('text', this.text);
      this.render();
    });
    done.addEventListener('click', () => this.closePanel());
    input.focus();
  }

  onKey(key) {
    if (!this.panelOpen && key === 'enter') {
      this.openEditor();
      return true;
    }
    return false;
  }
}
