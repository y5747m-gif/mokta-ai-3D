/* ============================================================
 * notify.js — إشعارات النظام (Web Notifications + Service Worker)
 * مع سياسة صادقة: لا نَعِد بتذكير مضمون إذا كانت الصلاحية ناقصة.
 * ============================================================ */

import { state, pushNotification } from './store.js';

export function permissionState() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

export function isGranted() {
  return permissionState() === 'granted';
}

/**
 * طلب الصلاحية في وقت مناسب — يجب استدعاؤها من تفاعل المستخدم
 * (مثل تفعيل منبه أو الضغط على زر «تفعيل الإشعارات»).
 */
export async function requestPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return Notification.permission;
  }
}

function registration() {
  if (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller) {
    return navigator.serviceWorker.ready.then((r) => r).catch(() => null);
  }
  return Promise.resolve(null);
}

/**
 * عرض إشعار للنظام (مع ارتداد إلى الإشعارات الداخلية دائمًا).
 */
export async function systemNotify({ title, body = '', tag = null, icon = 'icons/icon-192.png', data = {} }) {
  // دائمًا نسخة داخل التطبيق (تعمل حتى بدون صلاحية)
  await pushNotification({
    type: data.type || 'reminder',
    title,
    body,
    actionType: data.actionType || null,
    actionId: data.actionId || null,
    level: data.level || 'info',
  });

  if (!isGranted()) return false;

  const opts = {
    body,
    icon,
    badge: 'icons/icon-96.png',
    tag: tag || title,
    renotify: true,
    requireInteraction: !!data.requireInteraction,
    data,
  };

  try {
    const reg = await registration();
    if (reg && reg.showNotification) {
      await reg.showNotification(title, opts);
      return true;
    }
    if (typeof Notification !== 'undefined') {
      // eslint-disable-next-line no-new
      new Notification(title, opts);
      return true;
    }
  } catch (e) {
    console.warn('notification failed', e);
  }
  return false;
}

/** رسالة تشرح حالة الصلاحية بالأمانة */
export function permissionMessage(lang = 'ar') {
  const p = permissionState();
  if (p === 'unsupported') {
    return lang === 'en'
      ? 'This browser does not support system notifications. In-app reminders still work while the app is open.'
      : 'هذا المتصفح لا يدعم إشعارات النظام. التذكيرات داخل التطبيق تعمل أثناء فتح التطبيق.';
  }
  if (p === 'granted') {
    return lang === 'en'
      ? 'Notifications are enabled. Reminders will appear even when the app is in the background — subject to the browser and device limits described in Settings → About.'
      : 'الإشعارات مفعّلة. ستظهر التذكيرات حتى عندما يكون التطبيق في الخلفية — ضمن حدود المتصفح والجهاز الموضحة في «الإعدادات ← حول المنصة».';
  }
  if (p === 'denied') {
    return lang === 'en'
      ? 'Notification permission is blocked. Alarms and reminders will only work while the app is open. Enable notifications from your browser site settings to improve reliability.'
      : 'صلاحية الإشعارات محظورة. ستعمل المنبهات والتذكيرات فقط أثناء فتح التطبيق. فعّل الإشعارات من إعدادات الموقع في المتصفح لتحسين الموثوقية.';
  }
  return lang === 'en'
    ? 'Notification permission has not been requested yet. The app will ask for it when you enable your first alarm.'
    : 'لم تُطلب صلاحية الإشعارات بعد. سيطلبها التطبيق عند تفعيل أول منبه.';
}
