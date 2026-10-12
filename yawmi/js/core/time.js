/* ============================================================
 * time.js — أدوات الوقت والتاريخ (نقية، قابلة للاختبار بدون DOM)
 * التمثيل الداخلي: 'HH:MM' للوقت المحلي + 'YYYY-MM-DD' للتاريخ
 * أيام الأسبوع: 0=الأحد ... 6=السبت (متوافق مع Date.getDay)
 * ============================================================ */

/** تحويل 'HH:MM' إلى دقائق من منتصف الليل */
export function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return 0;
  return Math.min(24 * 60 - 1, Math.max(0, parseInt(m[1], 10) * 60 + parseInt(m[2], 10)));
}

/** تحويل الدقائق إلى 'HH:MM' */
export function fromMin(mins) {
  const m = ((Math.round(mins) % (24 * 60)) + 24 * 60) % (24 * 60);
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

export const DAY_MS = 86400000;

/** تاريخ اليوم بصيغة YYYY-MM-DD (بالتوقيت المحلي) */
export function todayISO(d = new Date()) {
  return isoOf(d);
}

export function isoOf(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** تحويل YYYY-MM-DD إلى Date عند منتصف الليل المحلي */
export function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return new Date();
  return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
}

export function addDaysISO(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

/** يوم الأسبوع: 0=الأحد ... 6=السبت */
export function weekdayOf(iso) {
  return parseISO(iso).getDay();
}

export function daysBetween(aISO, bISO) {
  return Math.round((parseISO(bISO) - parseISO(aISO)) / DAY_MS);
}

/** دمج تاريخ + وقت في Date محلي */
export function combine(iso, hhmm) {
  const d = parseISO(iso);
  const mins = toMin(hhmm);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

/** لصق دقائق على Date */
export function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60000);
}

export function nowDate() { return new Date(); }

export function nowMin(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

export function nowHHMM(d = new Date()) {
  return fromMin(nowMin(d));
}

/** الطابع الزمني المحلي 'YYYY-MM-DDTHH:MM' */
export function nowStamp(d = new Date()) {
  return isoOf(d) + 'T' + fromMin(nowMin(d));
}

export function stampToDate(stamp) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(stamp || ''));
  if (!m) return new Date();
  return combine(m[1], m[2]);
}

export function dateToStamp(d) {
  return isoOf(d) + 'T' + fromMin(d.getHours() * 60 + d.getMinutes());
}

/** هل التاريخان نفس اليوم؟ */
export function isSameDay(a, b) {
  return isoOf(a) === isoOf(b);
}

/** الفرق بالدقائق (b - a) */
export function minsBetween(a, b) {
  return Math.round((b - a) / 60000);
}

/** تداخل فترتين بالدقائق */
export function overlapMinutes(aS, aE, bS, bE) {
  return Math.max(0, Math.min(aE, bE) - Math.max(aS, bS));
}

export function rangesOverlap(aS, aE, bS, bE) {
  return overlapMinutes(aS, aE, bS, bE) > 0;
}

/** التحقق من صحة وقت البداية والنهاية */
export function isValidSpan(start, end) {
  return /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && toMin(end) > toMin(start);
}

/** مدة الفترة بالدقائق */
export function spanMinutes(start, end) {
  return Math.max(0, toMin(end) - toMin(start));
}

/**
 * الموعد التالي للمنبه/التذكير.
 * alarm: { time:'HH:MM', days:[0..6], repeat:'weekly'|'daily'|'once', date:'YYYY-MM-DD'|null }
 * يرجع Date|null (null إذا انتهى التكرار)
 */
export function nextOccurrence(alarm, from = new Date()) {
  const time = alarm.time || '00:00';
  if (alarm.repeat === 'once') {
    if (!alarm.date) return null;
    const dt = combine(alarm.date, time);
    return dt > from ? dt : null;
  }
  const days = (alarm.repeat === 'daily' || !alarm.days || alarm.days.length === 0)
    ? [0, 1, 2, 3, 4, 5, 6]
    : alarm.days;
  const fromISO = isoOf(from);
  for (let i = 0; i < 15; i++) {
    const iso = addDaysISO(fromISO, i);
    if (!days.includes(weekdayOf(iso))) continue;
    const dt = combine(iso, time);
    if (dt > from) return dt;
  }
  return null;
}

/** كل مواعيد التكرار بين تاريخين (محدودة بـ 128 لتفادي القفزات) */
export function occurrencesBetween(alarm, from, to, limit = 128) {
  const out = [];
  if (alarm.repeat === 'once') {
    if (alarm.date) {
      const dt = combine(alarm.date, alarm.time || '00:00');
      if (dt >= from && dt <= to) out.push(dt);
    }
    return out;
  }
  const days = (alarm.repeat === 'daily' || !alarm.days || alarm.days.length === 0)
    ? [0, 1, 2, 3, 4, 5, 6]
    : alarm.days;
  let iso = isoOf(from);
  for (let i = 0; i < 64 && out.length < limit; i++) {
    if (days.includes(weekdayOf(iso))) {
      const dt = combine(iso, alarm.time || '00:00');
      if (dt >= from && dt <= to) out.push(dt);
    }
    iso = addDaysISO(iso, 1);
  }
  return out;
}

/** هل يقع يوم/وقت ضمن ساعات الهدوء (قد تعبر منتصف الليل) */
export function inQuietHours(mins, quietStart, quietEnd) {
  const s = toMin(quietStart);
  const e = toMin(quietEnd);
  if (s === e) return false;
  if (s < e) return mins >= s && mins < e;
  return mins >= s || mins < e; // تتقاطع منتصف الليل
}

/** عدّاد تنازلي بصيغة HH:MM أو H:MM (دقائق كحد أقصى) */
export function fmtCountdown(minsTotal) {
  const m = Math.max(0, Math.round(minsTotal));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? h + ':' + String(mm).padStart(2, '0') : '0:' + String(mm).padStart(2, '0');
}

/** عدّاد بالثواني بصيغة HH:MM:SS */
export function fmtCountdownSec(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
}

/** مفتاح تجميع يومي للتاريخ ISO */
export function dayKey(iso, eventId) {
  return iso + '|' + eventId;
}
