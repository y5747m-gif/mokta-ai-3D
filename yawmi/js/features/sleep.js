/* ============================================================
 * sleep.js — روتين النوم والصباح: تقدير المدة، قوائم التجهيز،
 * وتحذيرات الحمل الزائد على اليوم.
 * ============================================================ */

import { toMin, todayISO, addDaysISO, weekdayOf } from '../core/time.js';
import { fmtTime, fmtDur, dayName } from '../core/format.js';
import { eventsForDate, workloadReport } from './schedule.js';
import { state, putItem, deleteItem } from '../core/store.js';

/** تقدير النوم المخطط: من نهاية اليوم حتى الاستيقاظ */
export function sleepEstimate(settings) {
  const bed = toMin(settings.bedTime);
  const wake = toMin(settings.wakeTime);
  let minutes = wake - bed;
  if (minutes <= 0) minutes += 24 * 60;
  return {
    minutes,
    text: fmtDur(minutes),
    enough: minutes >= 7 * 60,
    latest: settings.latestBedTime,
  };
}

/** معاينة جدول الغد */
export function tomorrowPreview(events) {
  const tomorrowISO = addDaysISO(todayISO(), 1);
  const items = eventsForDate(events, tomorrowISO);
  return {
    iso: tomorrowISO,
    dayName: dayName(weekdayOf(tomorrowISO)),
    items,
    lessons: items.filter((e) => e.type === 'lesson'),
  };
}

/** قائمة تجهيزات قابلة للتخصيص — تُحفظ لكل يوم */
export const DEFAULT_CHECKLIST = [
  { key: 'books', label: 'تجهيز الكتب والدفاتر', icon: '📚' },
  { key: 'bag', label: 'ترتيب الحقيبة', icon: '🎒' },
  { key: 'clothes', label: 'تجهيز الملابس', icon: '👕' },
  { key: 'supplies', label: 'الأدوات والمستلزمات', icon: '✏️' },
  { key: 'phone', label: 'وضع الهاتف في وضع الاسترخاء', icon: '📵' },
  { key: 'water', label: 'كوب ماء بجانب السرير', icon: '💧' },
];

function chkId(date, key) {
  return 'chk|' + date + '|' + key;
}

export function checklistState(key, date = todayISO()) {
  return state.progress.find((p) => p.id === chkId(date, key))?.done || false;
}

export async function toggleChecklist(key, date = todayISO()) {
  const id = chkId(date, key);
  const cur = state.progress.find((p) => p.id === id);
  if (cur?.done) {
    await deleteItem('progress', id);
    return false;
  }
  await putItem('progress', { id, date, key, done: true, kind: 'checklist' });
  return true;
}

export function checklistProgress(date = todayISO()) {
  const done = DEFAULT_CHECKLIST.filter((c) => checklistState(c.key, date)).length;
  return { done, total: DEFAULT_CHECKLIST.length, percent: Math.round((done / DEFAULT_CHECKLIST.length) * 100) };
}

/** تقرير النوم مع تحذيرات الحمل الزائد */
export function sleepReport(events) {
  const est = sleepEstimate(state.settings);
  const today = eventsForDate(events, todayISO());
  const tomorrow = eventsForDate(events, addDaysISO(todayISO(), 1));
  const work = workloadReport(today, state.settings);
  const workTomorrow = workloadReport(tomorrow, state.settings);
  const warnings = [...work.warnings, ...workTomorrow.warnings.map((w) => 'غدًا: ' + w)];
  if (!est.enough) {
    warnings.push('موعد النوم المخطط (' + fmtTime(state.settings.bedTime) + ') يمنحك ' + est.text + ' فقط قبل الاستيقاظ ' + fmtTime(state.settings.wakeTime) + '. الهدف الصحي 8 ساعات.');
  }
  return { ...est, warnings, work, workTomorrow };
}
