/* ============================================================
 * store.js — حالة التطبيق المركزي + الحفظ التلقائي
 * كل تعديل ينعكس فورًا في الذاكرة ثم يُحفظ في قاعدة البيانات.
 * ============================================================ */

import * as db from './db.js';
import { DEFAULT_SUBJECTS, DEFAULT_HABITS, DEFAULT_ALARMS, DEFAULT_SETTINGS, DEFAULT_WEEK } from '../data/defaults.js';
import { uid } from './ids.js';

export const state = {
  ready: false,
  settings: null,
  events: [],
  alarms: [],
  alarmLog: [],
  tasks: [],
  revisions: [],
  subjects: [],
  sessions: [],
  habits: [],
  habitLog: [],
  notifications: [],
  progress: [],
  fired: [],
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(scope = 'data') {
  for (const fn of listeners) {
    try { fn(scope); } catch (e) { console.error('listener error', e); }
  }
}

/* ---------- التهيئة والبذر ---------- */

function seededEvents() {
  const out = [];
  for (const dayKey of Object.keys(DEFAULT_WEEK)) {
    const day = parseInt(dayKey, 10);
    DEFAULT_WEEK[day].forEach((e, i) => {
      out.push({
        id: 'we-' + day + '-' + i,
        kind: 'weekly',
        day,
        date: null,
        title: e.title,
        titleEn: e.titleEn || null,
        type: e.type,
        start: e.start,
        end: e.end,
        subject: e.subject || null,
        notes: e.notes || '',
        confirmed: e.confirmed !== false,
        optional: !!e.optional,
        adjustable: !!e.adjustable,
        enabled: e.enabled !== false,
        travelMinutes: e.travelMinutes ?? null,
        altTitle: e.altTitle || null,
        altType: e.altType || null,
        reminderOffsets: e.type === 'lesson' ? [...DEFAULT_SETTINGS.reminderOffsets] : [],
      });
    });
  }
  return out;
}

function seededAlarms() {
  return DEFAULT_ALARMS.map((a) => ({
    id: a.id,
    category: a.category,
    title: a.title,
    message: a.message || '',
    time: a.time,
    days: a.days || [0, 1, 2, 3, 4, 5, 6],
    repeat: a.repeat || 'daily',
    date: a.date || null,
    enabled: a.enabled !== false,
    sound: a.sound || 'gentle',
    vibrate: a.vibrate !== false,
    snoozeEnabled: a.snoozeEnabled !== false,
    snoozeMinutes: a.snoozeMinutes || 10,
    linkedEventId: a.linkedEventId || null,
    source: 'default',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
}

export async function initStore() {
  if (state.ready) return state;

  // الإعدادات
  let settings = await db.get('settings', 'main');
  if (!settings) {
    settings = { id: 'main', ...structuredCloneSafe(DEFAULT_SETTINGS) };
    await db.put('settings', settings);
  } else {
    // دمج الآمن للحقول الجديدة بعد الترقية
    settings = { id: 'main', ...structuredCloneSafe(DEFAULT_SETTINGS), ...settings };
    settings.profile = { ...DEFAULT_SETTINGS.profile, ...(settings.profile || {}) };
    await db.put('settings', settings);
  }
  state.settings = settings;

  // البذر في أول تشغيل فقط — لا يُعاد أبدًا فوق بيانات الطالب
  let meta = await db.get('meta', 'seed');
  if (!meta) {
    await db.bulkPut('events', seededEvents());
    await db.bulkPut('alarms', seededAlarms());
    await db.bulkPut(
      'subjects',
      DEFAULT_SUBJECTS.map((s) => ({ ...structuredCloneSafe(s), id: s.key }))
    );
    await db.bulkPut(
      'habits',
      DEFAULT_HABITS.map((h) => ({ ...structuredCloneSafe(h), enabled: true }))
    );
    meta = { id: 'seed', at: Date.now(), version: 1 };
    await db.put('meta', meta);
  }

  // تحميل كل شيء
  for (const name of db.COLLECTIONS) {
    if (name === 'meta' || name === 'settings') continue;
    state[name] = await db.getAll(name);
  }
  state.ready = true;
  return state;
}

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ---------- عمليات عامة على المجموعات ---------- */

export async function putItem(coll, item) {
  const exists = state[coll].some((x) => x.id === item.id);
  await db.put(coll, item);
  if (exists) {
    state[coll] = state[coll].map((x) => (x.id === item.id ? item : x));
  } else {
    state[coll] = [...state[coll], item];
  }
  emit(coll);
  return item;
}

export async function deleteItem(coll, id) {
  await db.del(coll, id);
  state[coll] = state[coll].filter((x) => x.id !== id);
  emit(coll);
}

export async function replaceCollection(coll, items) {
  for (const old of state[coll]) await db.del(coll, old.id);
  for (const it of items) await db.put(coll, it);
  state[coll] = [...items];
  emit(coll);
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await db.put('settings', state.settings);
  emit('settings');
  return state.settings;
}

/* ---------- مساعدات جاهزة ---------- */

export function getSetting(path, fallback) {
  const parts = path.split('.');
  let v = state.settings;
  for (const p of parts) {
    if (v == null) return fallback;
    v = v[p];
  }
  return v === undefined ? fallback : v;
}

export function subjectById(id) {
  return state.subjects.find((s) => s.id === id) || null;
}

export function subjectName(id) {
  const s = subjectById(id);
  return s ? s.nameAr : null;
}

export function newId(prefix) {
  return prefix + '-' + uid();
}

/* ---------- الإشعارات الداخلية ---------- */

export async function pushNotification({ type = 'info', title, body = '', actionType = null, actionId = null, level = 'info' }) {
  const n = {
    id: 'nt-' + uid(),
    type, title, body, actionType, actionId, level,
    createdAt: Date.now(),
    read: false,
  };
  // منع الإغراق: إذا كان آخر إشعار مطابقًا في آخر 5 دقائق لا نكرره
  const recent = state.notifications.find(
    (x) => x.title === title && Date.now() - x.createdAt < 5 * 60000
  );
  if (recent) return recent;
  await putItem('notifications', n);
  return n;
}

export async function markNotificationRead(id) {
  const n = state.notifications.find((x) => x.id === id);
  if (!n || n.read) return;
  await putItem('notifications', { ...n, read: true });
}

export async function markAllNotificationsRead() {
  for (const n of state.notifications) {
    if (!n.read) await putItem('notifications', { ...n, read: true });
  }
}

export function unreadCount() {
  return state.notifications.filter((n) => !n.read).length;
}

/* ---------- تسجيل التذكيرات (منع التكرار) ---------- */

export function isFired(key) {
  return state.fired.some((f) => f.id === key);
}

export async function markFired(key) {
  if (isFired(key)) return false;
  await putItem('fired', { id: key, at: Date.now() });
  // تنظيف السجل القديم (أقدم من 30 يومًا)
  const cutoff = Date.now() - 30 * 86400000;
  for (const f of state.fired) {
    if (f.at < cutoff) await deleteItem('fired', f.id);
  }
  return true;
}
