// Génère un formulaire à partir d'un `schema` (manifest.js d'un widget ou app/global-schema.js).
// Types : text, password, number, bool, select, color, time, textarea. Option `group` : titre de section.

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
      eye.className = 'ghost';
      eye.textContent = '👁';
      eye.title = 'Afficher / masquer';
      eye.onclick = () => { input.type = input.type === 'password' ? 'text' : 'password'; };
      wrap.append(input, eye);
      return wrap;
    }
    default:
      input = document.createElement('input');
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
      const row = document.createElement('label');
      row.className = 'field' + (field.type === 'bool' ? ' field-bool' : '');
      const title = document.createElement('span');
      title.className = 'field-label';
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
