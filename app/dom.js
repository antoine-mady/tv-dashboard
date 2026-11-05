// Mini helper DOM pour les widgets : h('div', { className: 'x', text: 'y' }, enfant1, enfant2…)
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  const p = props || {};
  Object.keys(p).forEach((k) => {
    const v = p[k];
    if (v === undefined || v === null || v === false) return;
    if (k === 'className') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  });
  children.forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  });
  return el;
}
