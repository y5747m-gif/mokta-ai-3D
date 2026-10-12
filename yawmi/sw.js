/* ============================================================
 * sw.js — Service Worker لتطبيق "يومي | YAWMI"
 * يعمل التطبيق دون إنترنت بعد أول زيارة، ويعالج نقر الإشعارات.
 * ملاحظة صريحة: جدولة المنبهات في الخلفية محدودة في المتصفحات،
 * والتطبيق يعوض ذلك بحلقة داخل التطبيق + الإشعارات عند الإقلاع.
 * ============================================================ */

const CACHE = 'yawmi-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/app.css',
  'js/main.js',
  'js/core/db.js',
  'js/core/store.js',
  'js/core/i18n.js',
  'js/core/format.js',
  'js/core/time.js',
  'js/core/ids.js',
  'js/core/validation.js',
  'js/core/backup.js',
  'js/core/notify.js',
  'js/data/defaults.js',
  'js/features/schedule.js',
  'js/features/alarms.js',
  'js/features/tasks.js',
  'js/features/study.js',
  'js/features/habits.js',
  'js/features/sleep.js',
  'js/features/assistant.js',
  'js/ui/dom.js',
  'js/ui/components.js',
  'js/ui/router.js',
  'js/ui/screens/home.js',
  'js/ui/screens/schedule.js',
  'js/ui/screens/study.js',
  'js/ui/screens/alarms.js',
  'js/ui/screens/account.js',
  'js/ui/screens/subjects.js',
  'js/ui/screens/habits.js',
  'js/ui/screens/settings.js',
  'js/ui/screens/notifications.js',
  'js/ui/screens/assistant.js',
  'js/audio/tone.js',
  'icons/icon.svg',
  'icons/icon-96.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // التنقلات: شبكة أولًا مع ارتداد للكاش (لتحديث المحتوى عند توفر الشبكة)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('index.html', copy));
          return res;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // الأصول: كاش أولًا مع تحديث في الخلفية
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});

/* ---------- الإشعارات ---------- */

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-click', data });
          return client.focus();
        }
      }
      return self.clients.openWindow('./index.html');
    })
  );
});

self.addEventListener('notificationclose', (e) => {
  // يمكن تسجيل الإغلاق هنا عند الحاجة
});
