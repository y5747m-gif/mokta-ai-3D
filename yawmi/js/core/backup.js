/* ============================================================
 * backup.js — تصدير واستيراد بيانات الطالب (JSON)
 * التصدير يشمل كل شيء. الاستيراد يتحقق من البنية قبل التطبيق
 * ولا يمس البيانات إلا بعد نجاح التحقق الكامل.
 * ============================================================ */

import * as db from './db.js';
import { state, initStore, emit } from './store.js';

export const EXPORT_FORMAT = 'yawmi-backup';
export const EXPORT_VERSION = 1;

export function buildBackup() {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'YAWMI — Smart Student Planner',
    data: {
      settings: state.settings,
      events: state.events,
      alarms: state.alarms,
      alarmLog: state.alarmLog.slice(-500),
      tasks: state.tasks,
      revisions: state.revisions,
      subjects: state.subjects,
      sessions: state.sessions.slice(-500),
      habits: state.habits,
      habitLog: state.habitLog.slice(-2000),
      notifications: state.notifications.slice(-200),
      progress: state.progress.slice(-2000),
      fired: state.fired.slice(-2000),
    },
  };
}

export function downloadBackup() {
  const payload = buildBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = 'yawmi-backup-' + stamp + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return payload;
}

/** التحقق من صحة ملف النسخة الاحتياطية */
export function validateBackup(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') errors.push('ملف غير صالح');
  if (obj && obj.format !== EXPORT_FORMAT) errors.push('نوع الملف غير معروف — يُتوقع نسخة احتياطية من «يومي»');
  if (obj && typeof obj.version !== 'number') errors.push('رقم الإصدار مفقود');
  if (obj && obj.version > EXPORT_VERSION) errors.push('إصدار الملف أحدث من إصدار التطبيق');
  if (obj && (!obj.data || typeof obj.data !== 'object')) errors.push('قسم البيانات مفقود');
  const arrays = ['events', 'alarms', 'tasks', 'subjects', 'habits', 'sessions', 'revisions'];
  if (obj && obj.data) {
    for (const key of arrays) {
      if (obj.data[key] !== undefined && !Array.isArray(obj.data[key])) {
        errors.push('حقل غير صالح: ' + key);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * استيراد نسخة احتياطية (يستبدل المجموعات المشمولة فقط).
 * يعيد {ok, errors, counts}.
 */
export async function restoreBackup(obj) {
  const check = validateBackup(obj);
  if (!check.ok) return { ok: false, errors: check.errors, counts: {} };

  await initStore();
  const d = obj.data;
  const counts = {};

  const collections = [
    'events', 'alarms', 'alarmLog', 'tasks', 'revisions', 'subjects',
    'sessions', 'habits', 'habitLog', 'notifications', 'progress', 'fired',
  ];

  for (const coll of collections) {
    if (Array.isArray(d[coll])) {
      // مسح ثم إعادة الكتابة — داخل مجموعة واحدة لكل عملية
      for (const old of state[coll]) await db.del(coll, old.id);
      const items = [];
      for (const rec of d[coll]) {
        if (!rec || rec.id === undefined) continue;
        await db.put(coll, rec);
        items.push(rec);
      }
      state[coll] = items;
      counts[coll] = items.length;
    }
  }

  if (d.settings && typeof d.settings === 'object') {
    const merged = { id: 'main', ...d.settings };
    await db.put('settings', merged);
    state.settings = merged;
    counts.settings = 1;
  }

  emit('data');
  return { ok: true, errors: [], counts };
}

/** قراءة ملف النسخة الاحتياطية من القرص */
export function readFileAsJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new Error('تعذّر قراءة الملف — ليس JSON صالحًا'));
      }
    };
    reader.onerror = () => reject(new Error('تعذّر فتح الملف'));
    reader.readAsText(file);
  });
}
