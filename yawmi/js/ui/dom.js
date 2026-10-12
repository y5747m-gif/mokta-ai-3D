/* ============================================================
 * dom.js — أدوات DOM: هروب النصوص، نوافذ، قوائم، تنبيهات، نماذج
 * ============================================================ */

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function qs(sel, root = document) { return root.querySelector(sel); }
export function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

export function on(root, event, selector, handler) {
  root.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}

/* ---------- التنبيهات العابرة ---------- */

export function toast(message, kind = '') {
  const root = qs('#toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .35s ease';
    setTimeout(() => el.remove(), 400);
  }, 3200);
}

/* ---------- النوافذ المنبثقة ---------- */

let openModalCount = 0;

export function openModal({ title, bodyHTML, actionsHTML = '', onMount = null, wide = false }) {
  const root = qs('#modal-root');
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title || '')}">
      <div class="modal-head">
        <h3>${title ? esc(title) : ''}</h3>
        <button type="button" class="icon-btn" data-modal-close aria-label="إغلاق">
          <svg viewBox="0 0 24 24" class="ic"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5z"/></svg>
        </button>
      </div>
      <div class="modal-body">${bodyHTML || ''}</div>
      ${actionsHTML ? `<div class="modal-actions">${actionsHTML}</div>` : ''}
    </div>`;
  root.appendChild(back);
  openModalCount++;

  const close = () => {
    back.remove();
    openModalCount = Math.max(0, openModalCount - 1);
    if (openModalCount === 0) document.body.style.overflow = '';
  };
  if (openModalCount > 0) document.body.style.overflow = 'hidden';

  back.addEventListener('click', (e) => {
    if (e.target === back || e.target.closest('[data-modal-close]')) close();
  });

  onMount?.(back, close);
  return { root: back, close };
}

export function confirmDialog({ title = 'تأكيد', message = '', okText = 'تأكيد', cancelText = 'إلغاء', danger = false } = {}) {
  return new Promise((resolve) => {
    const { close } = openModal({
      title,
      bodyHTML: `<p class="muted">${esc(message)}</p>`,
      actionsHTML: `
        <button type="button" class="btn btn-ghost" data-c="0">${esc(cancelText)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-c="1">${esc(okText)}</button>`,
      onMount(root, closeFn) {
        root.addEventListener('click', (e) => {
          const b = e.target.closest('[data-c]');
          if (!b) return;
          resolve(b.dataset.c === '1');
          closeFn();
        });
      },
    });
  });
}

/* ---------- عناصر نماذج جاهزة ---------- */

export function field(name, label, value = '', { type = 'text', hint = '', attrs = '', required = false } = {}) {
  return `
    <div class="field">
      <label for="f-${name}">${esc(label)}${required ? ' *' : ''}</label>
      <input class="input" id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}>
      ${hint ? `<div class="hint">${esc(hint)}</div>` : ''}
    </div>`;
}

export function textareaField(name, label, value = '', { hint = '' } = {}) {
  return `
    <div class="field">
      <label for="f-${name}">${esc(label)}</label>
      <textarea class="textarea" id="f-${name}" name="${name}">${esc(value)}</textarea>
      ${hint ? `<div class="hint">${esc(hint)}</div>` : ''}
    </div>`;
}

export function selectField(name, label, options, value = '', { hint = '' } = {}) {
  const opts = options.map((o) =>
    `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`
  ).join('');
  return `
    <div class="field">
      <label for="f-${name}">${esc(label)}</label>
      <select class="select" id="f-${name}" name="${name}">${opts}</select>
      ${hint ? `<div class="hint">${esc(hint)}</div>` : ''}
    </div>`;
}

export function toggleRow(name, label, checked, desc = '') {
  return `
    <div class="toggle-row">
      <div class="toggle-label">
        <strong>${esc(label)}</strong>
        ${desc ? `<small>${esc(desc)}</small>` : ''}
      </div>
      <input type="checkbox" class="toggle" name="${name}" ${checked ? 'checked' : ''} aria-label="${esc(label)}">
    </div>`;
}

export function daysPicker(name, selectedDays = []) {
  const names = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  return `
    <div class="field">
      <label>أيام التكرار</label>
      <div class="days-picker" name="${name}">
        ${names.map((n, i) => `
          <label class="day-check">
            <input type="checkbox" name="${name}" value="${i}" ${selectedDays.includes(i) ? 'checked' : ''}>
            <span>${n}</span>
          </label>`).join('')}
      </div>
    </div>`;
}

/** قراءة قيم النموذج دفعة واحدة */
export function collectForm(scope) {
  const out = {};
  for (const el of qsa('input, select, textarea', scope)) {
    const name = el.name;
    if (!name) continue;
    if (el.type === 'checkbox') {
      if (el.closest('.days-picker')) {
        out[name] = out[name] || [];
        if (el.checked) out[name].push(parseInt(el.value, 10));
      } else {
        out[name] = el.checked;
      }
    } else if (el.type === 'radio') {
      if (el.checked) out[name] = el.value;
    } else {
      out[name] = el.value;
    }
  }
  return out;
}

/* ---------- قائمة سفلية (Sheet) ---------- */

export function openSheet({ title, bodyHTML, onMount = null }) {
  return openModal({ title, bodyHTML, onMount });
}
