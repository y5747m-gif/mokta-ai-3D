/* ============================================================
 * main.js — نقطة تشغيل تطبيق "يومي | YAWMI"
 * التهيئة، التوجيه، المنبهات الحية، الاتجاه والثيم، والعمل دون إنترنت
 * ============================================================ */

import { initStore, state, subscribe, unreadCount, getSetting } from './core/store.js';
import { setLang, getLang, t } from './core/i18n.js';
import { todayISO, nowMin, fromMin, toMin, fmtCountdownSec, stampToDate } from './core/time.js';
import { fmtTime, fmtDate, fmtSmartCountdown, fmtRel, fmtTimeSpans } from './core/format.js';
import { registerRoute, startRouter, navigate, renderNow, requestRender, parseHash } from './ui/router.js';
import { qs, qsa, toast, openModal, esc } from './ui/dom.js';
import {
  runAlarmTick, catchUpMissed, bindAlarmUI, dismissAlarm, snoozeAlarm,
  categoryLabel, nextAlarm,
} from './features/alarms.js';
import { permissionState, requestPermission, permissionMessage } from './core/notify.js';
import { eventsForDate, currentBlock, nextBlock, dayReminders, dayProgress } from './features/schedule.js';
import { isFired, markFired, pushNotification, markNotificationRead } from './core/store.js';
import { systemNotify } from './core/notify.js';
import { ensureAudio, stopAll, stopVibration, startAlarmSound, startAlarmVibration, playSound, vibrate } from './audio/tone.js';
import { applyOverrides } from './features/schedule.js';

/* ---------- الشاشات ---------- */
import { renderHome } from './ui/screens/home.js';
import { renderSchedule } from './ui/screens/schedule.js';
import { renderStudy } from './ui/screens/study.js';
import { renderAlarms } from './ui/screens/alarms.js';
import { renderAccount, renderTasks } from './ui/screens/account.js';
import { renderSubjects } from './ui/screens/subjects.js';
import { renderHabits, renderSleep } from './ui/screens/habits.js';
import { renderSettings } from './ui/screens/settings.js';
import { renderNotifications } from './ui/screens/notifications.js';
import { renderAssistant } from './ui/screens/assistant.js';

/* ---------- طبقة المنبه المفتوح ---------- */

let activeAlarm = null;
let activeAlarmVib = null;

function showAlarmOverlay(alarm, at) {
  activeAlarm = { alarm, at };
  const overlay = qs('#alarm-overlay');
  qs('#alarm-overlay-kind').textContent = categoryLabel(alarm.category);
  qs('#alarm-overlay-title').textContent = alarm.title;
  qs('#alarm-overlay-message').textContent = alarm.message || 'حان الوقت!';
  qs('#alarm-overlay-time').textContent = fmtTime(fromMin(at.getHours() * 60 + at.getMinutes()));
  const snoozeBtn = qs('#alarm-btn-snooze');
  snoozeBtn.textContent = 'تأجيل ' + (alarm.snoozeMinutes || state.settings.snoozeMinutes || 10) + ' دقيقة';
  snoozeBtn.hidden = alarm.snoozeEnabled === false;
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  if (state.settings.wakeLockOnAlarm) requestWakeLock();
}

function hideAlarmOverlay() {
  qs('#alarm-overlay').hidden = true;
  document.body.style.overflow = '';
  activeAlarm = null;
  stopAll();
  if (activeAlarmVib) { stopVibration(activeAlarmVib); activeAlarmVib = null; }
  releaseWakeLock();
}

function bindOverlayButtons() {
  qs('#alarm-btn-dismiss').addEventListener('click', async () => {
    if (activeAlarm) await dismissAlarm(activeAlarm.alarm, activeAlarm.at, 'dismissed');
    hideAlarmOverlay();
    toast('تم إيقاف المنبه', '');
    requestRender();
  });
  qs('#alarm-btn-done').addEventListener('click', async () => {
    if (activeAlarm) await dismissAlarm(activeAlarm.alarm, activeAlarm.at, 'completed');
    hideAlarmOverlay();
    toast('أحسنت! تم تسجيل التنفيذ ✓', 'ok');
    requestRender();
  });
  qs('#alarm-btn-snooze').addEventListener('click', async () => {
    if (!activeAlarm) return;
    const mins = activeAlarm.alarm.snoozeMinutes || state.settings.snoozeMinutes || 10;
    await snoozeAlarm(activeAlarm.alarm, mins);
    hideAlarmOverlay();
    toast('تم التأجيل ' + mins + ' دقيقة ⏰', '');
    requestRender();
  });
}

/* ---------- Wake Lock ---------- */

let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch { /* غير مدعوم أو مرفوض */ }
}
function releaseWakeLock() {
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
}

/* ---------- التذكيرات الذكية للدروس (تُحسب دائمًا من الجدول) ---------- */

async function runReminderTick() {
  const iso = todayISO();
  const items = applyOverrides(eventsForDate(state.events, iso), state.progress, iso);
  const rems = dayReminders(items, iso, state.settings);
  const now = new Date();

  for (const r of rems) {
    const diffMs = r.at - now;
    // نافذة الإطلاق: حتى 90 ثانية تأخيرًا كتنبيه عادي، وحتى 3 ساعات كتنبيه متأخر
    // (يُسجَّل دائمًا بـ markFired لمنع التكرار)
    if (diffMs <= 90000 && diffMs > -3 * 3600 * 1000 && !isFired(r.key)) {
      const inQuiet = state.settings.quietHoursEnabled;
      const mins = now.getHours() * 60 + now.getMinutes();
      const quietStart = toMin(state.settings.quietHoursStart);
      const quietEnd = toMin(state.settings.quietHoursEnd);
      const quiet = inQuiet && (quietStart < quietEnd
        ? mins >= quietStart && mins < quietEnd
        : mins >= quietStart || mins < quietEnd);
      const late = diffMs < -90000;

      await markFired(r.key);
      const title = late ? 'فات التذكير: ' + r.title : r.title;
      const body = late ? r.body + ' (وصل متأخرًا — كان موعده ' + fmtTime(fromMin(r.at.getHours() * 60 + r.at.getMinutes())) + ')' : r.body;

      if (quiet && r.kind !== 'start') {
        // في ساعات الهدوء: إشعار داخلي فقط بدون صوت/اهتزاز
        await pushNotification({
          type: 'reminder', level: 'info',
          title, body,
          actionType: 'event', actionId: r.eventId,
        });
      } else {
        await systemNotify({
          title,
          body,
          tag: r.key,
          data: { type: 'reminder', actionType: 'event', actionId: r.eventId, level: late ? 'warn' : 'info' },
        });
        if (state.settings.soundEnabled && (r.kind === 'start' || late)) {
          playSound('chime');
          if (state.settings.vibrate) vibrate([100, 60, 100]);
        }
      }
    }
  }
}

/* ---------- الساعة الحية ---------- */

function updateLive() {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const clockEl = qs('#status-clock');
  if (clockEl) clockEl.textContent = fmtTime(fromMin(nowMins));
  const dateEl = qs('#status-date');
  if (dateEl) dateEl.textContent = fmtDate(todayISO());

  for (const el of qsa('[data-live="clock"]')) {
    el.textContent = fmtTime(fromMin(nowMins));
  }
  for (const el of qsa('[data-live="countdown"]')) {
    const target = el.dataset.target;
    if (target) {
      const mins = toMin(target) - nowMins - (now.getSeconds() / 60);
      el.textContent = mins > 0 ? fmtSmartCountdown(mins) : 'الآن';
    }
  }

  // مؤشر المنبه القادم + Wake Lock قبل منبه الاستيقاظ
  const chip = qs('#next-alarm-text');
  const n = nextAlarm(state.alarms);
  if (n) {
    const mins = Math.round((n.at - now) / 60000);
    if (chip) chip.textContent = n.alarm.title + ' — ' + fmtRel(mins);
    // إبقاء الشاشة حية قبل منبه الاستيقاظ (اختياري من الإعدادات)
    if (state.settings.keepAwakeBeforeWakeAlarm && n.alarm.category === 'wake' && mins <= 10 && !wakeLock) {
      requestWakeLock();
    }
  } else if (chip) {
    chip.textContent = 'لا توجد منبهات';
  }

  // شارة مركز الإشعارات
  const badge = qs('#bell-badge');
  if (badge) {
    const count = unreadCount();
    badge.hidden = count === 0;
    badge.textContent = count > 9 ? '9+' : String(count);
  }
}

/* ---------- التهيئة ---------- */

async function main() {
  await initStore();

  // اللغة والثيم من الإعدادات
  const lang = state.settings.profile?.lang || 'ar';
  setLang(lang);
  document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'ar');
  document.documentElement.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
  const theme = state.settings.theme || 'light';
  document.documentElement.setAttribute('data-theme', theme);

  // تسجيل المسارات
  registerRoute('/home', renderHome);
  registerRoute('/schedule', renderSchedule);
  registerRoute('/study', renderStudy);
  registerRoute('/alarms', renderAlarms);
  registerRoute('/account', renderAccount);
  registerRoute('/account/tasks', renderTasks);
  registerRoute('/account/subjects', renderSubjects);
  registerRoute('/account/habits', renderHabits);
  registerRoute('/account/sleep', renderSleep);
  registerRoute('/account/settings', renderSettings);
  registerRoute('/notifications', renderNotifications);
  registerRoute('/assistant', renderAssistant);

  // الواجهة العليا
  qs('#btn-theme').addEventListener('click', async () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    const { saveSettings } = await import('./core/store.js');
    await saveSettings({ theme: next });
  });
  qs('#btn-assistant').addEventListener('click', () => navigate('#/assistant'));
  qs('#btn-notifications').addEventListener('click', () => navigate('#/notifications'));
  qs('#next-alarm-chip').addEventListener('click', () => navigate('#/alarms'));

  bindOverlayButtons();
  bindAlarmUI({ showAlarm: showAlarmOverlay });

  // بدء التوجيه
  startRouter(qs('#screen'));

  // إعادة الرسم عند تغير البيانات
  subscribe((scope) => {
    requestRender();
    updateLive();
  });

  // الساعة كل ثانية + التذكيرات والمنبهات كل 15 ثانية
  updateLive();
  setInterval(updateLive, 1000);

  const tick = async () => {
    try {
      await runAlarmTick(new Date());
      await runReminderTick();
    } catch (e) {
      console.warn('tick error', e);
    }
  };
  setInterval(tick, 15000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
  window.addEventListener('focus', tick);

  // اكتشاف المنبهات الفائتة عند الإقلاع
  try {
    const missed = await catchUpMissed();
    if (missed > 0) {
      toast('لديك ' + missed + ' منبهات فائتة — راجع السجل', 'err');
    }
  } catch (e) {
    console.warn('catchup error', e);
  }

  // تفعيل الصوت عند أول تفاعل (سياسة المتصفحات)
  const unlock = () => { ensureAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);

  // تسجيل Service Worker للعمل دون إنترنت
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        console.log('SW registered', reg.scope);
      }).catch((e) => console.warn('SW registration failed', e));
    });

    // إشعارات الخلفية: النقر على الإشعار يفتح التطبيق
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'notification-click') {
        const d = e.data.data || {};
        if (d.actionType === 'alarm') navigate('#/alarms');
        else if (d.actionType === 'task') navigate('#/account/tasks');
        else if (d.actionType === 'event') navigate('#/schedule');
      }
    });
  }

  // رسالة ترحيب أول مرة
  if (!localStorage.getItem('yawmi-welcomed')) {
    localStorage.setItem('yawmi-welcomed', '1');
    setTimeout(() => {
      toast('أهلًا بك في «يومي» — جاهز لتنظيم يومك 🌟', 'ok');
    }, 800);
  }

  console.log('YAWMI ready — local-first, offline-capable');
}

main().catch((e) => {
  console.error('init failed', e);
  const screen = qs('#screen');
  if (screen) {
    screen.innerHTML = '<div class="card"><h2>تعذّر تشغيل التطبيق</h2><p class="muted">حدث خطأ غير متوقع. أعد تحميل الصفحة. إذا استمر الخطأ، تأكد من دعم متصفحك لـ IndexedDB.</p></div>';
  }
});
