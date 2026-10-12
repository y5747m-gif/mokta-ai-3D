/* ============================================================
 * router.js — توجيه بسيط بالـ hash (#/home, #/schedule, ...)
 * ============================================================ */

const routes = new Map();
let container = null;
let currentKey = null;
let renderFn = null;
let debounceTimer = null;

export function registerRoute(key, fn) {
  routes.set(key, fn);
}

export function parseHash() {
  const h = (location.hash || '#/home').replace(/^#/, '');
  return h.startsWith('/') ? h : '/' + h;
}

export function navigate(hash) {
  if (location.hash === hash) {
    renderNow();
  } else {
    location.hash = hash;
  }
}

export function currentRoute() {
  return currentKey;
}

function resolve() {
  const key = parseHash();
  if (routes.has(key)) return { key, fn: routes.get(key), params: {} };
  // مسارات ديناميكية بسيطة: #/event/xyz
  for (const [routeKey, fn] of routes) {
    const rp = routeKey.split('/');
    const sp = key.split('/');
    if (rp.length === sp.length && rp.every((seg, i) => seg.startsWith(':') || seg === sp[i])) {
      const params = {};
      rp.forEach((seg, i) => { if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(sp[i]); });
      return { key, fn, params };
    }
  }
  return { key: '/home', fn: routes.get('/home'), params: {} };
}

export function renderNow() {
  if (!container || !renderFn) return;
  const { key, fn, params } = resolve();
  currentKey = key;
  const result = fn(params);
  const html = typeof result === 'string' ? result : result.html;
  const onMount = typeof result === 'string' ? null : result.onMount;
  container.innerHTML = html;
  window.scrollTo({ top: 0 });
  // تمييز التبويب النشط
  const mainKey = '/' + key.split('/')[1];
  for (const el of document.querySelectorAll('.nav-item')) {
    el.classList.toggle('active', el.dataset.nav && ('/' + el.dataset.nav) === mainKey);
  }
  onMount?.(container);
}

export function requestRender() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderNow, 60);
}

export function startRouter(containerEl, renderCallback) {
  container = containerEl;
  renderFn = renderCallback || renderNow;
  window.addEventListener('hashchange', renderNow);
  renderNow();
}
