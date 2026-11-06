// Génère un formulaire à partir d'un `schema` (manifest.js d'un widget ou app/global-schema.js).
// Types : text, password, number, bool, select, color, time, textarea. Option `group` : titre de section.
// Présentation (facultative) : number + `slider: true` (+ `unit`) → curseur ; select dont chaque option a un
// `swatch` (fond CSS) → vignettes à choisir ; color + `presets: ['#…']` → pastilles de couleurs proposées.
import { icon } from '/admin/icons.js';

let uid = 0;

function hasSwatches(field) {
  return field.type === 'select' && (field.options || []).length > 0 && field.options.every((o) => o && o.swatch);
}

function isVisible(field, values) {
  if (!field.when) return true;
  return Object.keys(field.when).every((k) => values[k] === field.when[k]);
}

function control(field, value, emit) {
  let input;
  switch (field.type) {
    case 'bool':
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!value;
      input.onchange = () => emit(input.checked);
      return input;
    case 'select':
      if (hasSwatches(field)) return swatchControl(field, value, emit);
      input = document.createElement('select');
      (field.options || []).forEach((o) => {
        const opt = typeof o === 'object' ? o : { value: o, label: o };
        input.append(new Option(opt.label, opt.value, false, String(opt.value) === String(value)));
      });
      input.onchange = () => emit(input.value);
      return input;
    case 'textarea':
      input = document.createElement('textarea');
      input.rows = 4;
      input.value = value;
      input.oninput = () => emit(input.value);
      return input;
    case 'password': {
      const wrap = document.createElement('div');
      wrap.className = 'pw';
      input = document.createElement('input');
      input.type = 'password';
      input.value = value;
      input.autocomplete = 'off';
      input.oninput = () => emit(input.value);
      const eye = document.createElement('button');
      eye.type = 'button';
      eye.className = 'ghost icon';
      eye.innerHTML = icon('eye');
      eye.title = 'Afficher / masquer';
      eye.setAttribute('aria-label', 'Afficher le mot de passe');
      eye.setAttribute('aria-pressed', 'false');
      eye.onclick = (e) => {
        e.preventDefault();
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        eye.setAttribute('aria-pressed', String(show));
      };
      wrap.append(input, eye);
      return wrap;
    }
    case 'number':
      if (field.slider && typeof field.min === 'number' && typeof field.max === 'number') return sliderControl(field, value, emit);
      return plainInput(field, value, emit);
    case 'color':
      if (Array.isArray(field.presets) && field.presets.length) return colorControl(field, value, emit);
      return plainInput(field, value, emit);
    default:
      return plainInput(field, value, emit);
  }
}

function plainInput(field, value, emit) {
  const input = document.createElement('input');
  input.type = { number: 'number', color: 'color', time: 'time' }[field.type] || 'text';
  if (field.type === 'number') {
    ['min', 'max', 'step'].forEach((k) => { if (field[k] !== undefined) input[k] = field[k]; });
    if (field.step === undefined) input.step = 'any';
  }
  if (field.placeholder) input.placeholder = field.placeholder;
  input.value = value === undefined ? '' : value;
  input.oninput = () => {
    if (field.type !== 'number') return emit(input.value);
    if (input.value !== '' && !isNaN(Number(input.value))) emit(Number(input.value));
  };
  return input;
}

/** Curseur + valeur affichée (ex. « 90 % »). */
function sliderControl(field, value, emit) {
  const wrap = document.createElement('div');
  wrap.className = 'slider';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = field.min;
  input.max = field.max;
  input.step = field.step || 1;
  input.value = value;
  const out = document.createElement('output');
  const show = () => { out.textContent = input.value + (field.unit ? ' ' + field.unit : ''); };
  input.oninput = () => { show(); emit(Number(input.value)); };
  show();
  wrap.append(input, out);
  return wrap;
}

/** Vignettes (ex. fonds d'écran) : groupe de boutons radio. */
function swatchControl(field, value, emit) {
  const wrap = document.createElement('div');
  wrap.className = 'swatches';
  wrap.setAttribute('role', 'radiogroup');
  const buttons = [];
  const set = (v) => buttons.forEach((b) => {
    const on = b.dataset.value === String(v);
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  field.options.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.value = o.value;
    b.setAttribute('role', 'radio');
    b.innerHTML = '<span class="swatch-preview"></span><span class="swatch-label"></span>';
    b.querySelector('.swatch-preview').style.background = o.swatch;
    b.querySelector('.swatch-label').textContent = o.label;
    b.onclick = () => { set(o.value); emit(o.value); };
    buttons.push(b);
    wrap.append(b);
  });
  wrap.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const i = buttons.indexOf(document.activeElement);
    if (!step || i === -1) return;
    e.preventDefault();
    const next = buttons[(i + step + buttons.length) % buttons.length];
    next.focus();
    next.click();
  });
  set(value);
  return wrap;
}

/** Couleur libre + pastilles proposées. */
function colorControl(field, value, emit) {
  const wrap = document.createElement('div');
  wrap.className = 'color-field';
  const input = plainInput(field, value, (v) => { mark(v); emit(v); });
  const presets = document.createElement('div');
  presets.className = 'presets';
  const mark = (v) => presets.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value.toLowerCase() === String(v).toLowerCase())));
  field.presets.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.dataset.value = c;
    b.style.background = c;
    b.title = c;
    b.setAttribute('aria-label', 'Couleur ' + c);
    b.onclick = (e) => { e.preventDefault(); input.value = c; mark(c); emit(c); };
    presets.append(b);
  });
  mark(value);
  wrap.append(input, presets);
  return wrap;
}

/**
 * container : élément à remplir ; values : réglages complets ; onChange(key, value).
 * Se re-dessine tout seul quand un champ dont dépendent d'autres champs (`when`) change.
 */
export function renderForm(container, schema, values, onChange) {
  const vals = Object.assign({}, values);
  const draw = () => {
    container.innerHTML = '';
    let group = null;
    schema.filter((f) => isVisible(f, vals)).forEach((field) => {
      // `group` (optionnel) : titre de section affiché quand il change d'un champ à l'autre.
      if (field.group && field.group !== group) {
        const head = document.createElement('h3');
        head.className = 'form-group';
        head.textContent = field.group;
        container.append(head);
      }
      group = field.group || group;
      // Vignettes : groupe de boutons, pas un <label> (un clic sur le titre choisirait la 1re vignette).
      const grouped = hasSwatches(field);
      const row = document.createElement(grouped ? 'div' : 'label');
      row.className = 'field' + (field.type === 'bool' ? ' field-bool' : '');
      const title = document.createElement('span');
      title.className = 'field-label';
      if (grouped) {
        title.id = 'field-' + (++uid);
        row.setAttribute('role', 'group');
        row.setAttribute('aria-labelledby', title.id);
      }
      title.textContent = field.label + (field.required ? ' *' : '');
      const ctrl = control(field, vals[field.key], (v) => {
        vals[field.key] = v;
        onChange(field.key, v);
        if (schema.some((f) => f.when && field.key in f.when)) draw();
      });
      if (field.type === 'bool') row.append(ctrl, title);
      else row.append(title, ctrl);
      if (field.help) {
        const help = document.createElement('small');
        help.className = 'help';
        help.textContent = field.help;
        row.append(help);
      }
      container.append(row);
    });
  };
  draw();
}
