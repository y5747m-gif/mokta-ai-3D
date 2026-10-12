/* ============================================================
 * habits.js — متتبع العادات اليومية (بتشجيع لطيف بلا لوم)
 * ============================================================ */

import { todayISO, addDaysISO } from '../core/time.js';
import { state, putItem, deleteItem, pushNotification } from '../core/store.js';
import { uid } from '../core/ids.js';

function logId(habitId, iso) {
  return 'hl|' + habitId + '|' + iso;
}

export function habitLogFor(habitId, iso = todayISO()) {
  return state.habitLog.find((l) => l.id === logId(habitId, iso)) || null;
}

export function habitCount(habitId, iso = todayISO()) {
  return habitLogFor(habitId, iso)?.count || 0;
}

export function habitDone(habitId, iso = todayISO()) {
  const h = state.habits.find((x) => x.id === habitId);
  const count = habitCount(habitId, iso);
  return h ? count >= (h.goal || 1) : count > 0;
}

/** زيادة الإنجاز (+1) مع حد الهدف */
export async function tickHabit(habitId, iso = todayISO()) {
  const h = state.habits.find((x) => x.id === habitId);
  if (!h) return null;
  const goal = h.goal || 1;
  const current = habitCount(habitId, iso);
  if (current >= goal) return current; // مكتمل بالفعل
  const count = current + 1;
  await putItem('habitLog', {
    id: logId(habitId, iso),
    habitId,
    date: iso,
    count,
    updatedAt: Date.now(),
  });
  if (count >= goal) {
    await pushNotification({
      type: 'success', level: 'success',
      title: 'أحسنت! ' + h.nameAr + ' 🎉',
      body: 'استمر بهدوء، التقدم اليومي يصنع الفرق.',
    });
  }
  return count;
}

export async function untickHabit(habitId, iso = todayISO()) {
  const log = habitLogFor(habitId, iso);
  if (!log) return 0;
  if (log.count <= 1) {
    await deleteItem('habitLog', log.id);
    return 0;
  }
  await putItem('habitLog', { ...log, count: log.count - 1 });
  return log.count - 1;
}

/** سلسلة الأيام المتتالية التي حقق فيها العادة هدفها */
export function streakOf(habitId) {
  const h = state.habits.find((x) => x.id === habitId);
  if (!h) return 0;
  const goal = h.goal || 1;
  let streak = 0;
  let iso = todayISO();
  // لا نحسب اليوم غير المكتمل ككسر للسلسلة
  if (habitCount(habitId, iso) < goal) {
    iso = addDaysISO(iso, -1);
  }
  for (let i = 0; i < 365; i++) {
    const log = habitLogFor(habitId, iso);
    if (!log || log.count < goal) break;
    streak++;
    iso = addDaysISO(iso, -1);
  }
  return streak;
}

export function habitsSummary() {
  const list = state.habits.filter((h) => h.enabled !== false);
  const done = list.filter((h) => habitDone(h.id)).length;
  return { total: list.length, done, percent: list.length ? Math.round((done / list.length) * 100) : 0 };
}

export async function addHabit({ nameAr, icon = '⭐', goal = 1 }) {
  const h = { id: 'hab-' + uid(), nameAr, nameEn: nameAr, icon, goal, unit: 'مرة', enabled: true };
  await putItem('habits', h);
  return h;
}

export async function updateHabit(h) {
  await putItem('habits', h);
}

export async function removeHabit(id) {
  await deleteItem('habits', id);
}

/** رسالة تشجيعية داعمة */
export function encouragement() {
  const s = habitsSummary();
  if (s.total === 0) return 'أضف عاداتك اليومية لتتابع تقدمك 🌱';
  if (s.percent === 100) return 'يوم كامل! أنجزت كل عاداتك اليوم 🌟';
  if (s.percent >= 60) return 'أداء رائع، أنت على الطريق الصحيح 💪';
  if (s.percent > 0) return 'بداية جيدة! كل خطوة صغيرة تُحتسب ✨';
  return 'يوم جديد وفرصة جديدة — ابدأ بعادة واحدة صغيرة 🌱';
}
