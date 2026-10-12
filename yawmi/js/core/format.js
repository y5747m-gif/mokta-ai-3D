/* ============================================================
 * format.js — تنسيق عربي للوقت (12 ساعة: صباحًا/مساءً) والتواريخ والمدد
 * يدعم العربية والإنجليزية. أرقام لاتينية واضحة (شائعة في مصر)
 * ============================================================ */

import { toMin, parseISO, todayISO, daysBetween } from './time.js';

export const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
export const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const AR_DAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
export const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const EN_DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** ترتيب الأسبوع المصري: يبدأ بالسبت */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

/** تقسيم الوقت إلى أجزاء 12-ساعة */
export function t12(hhmm) {
  const mins = toMin(hhmm);
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const isPM = h >= 12;
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return { h: h12, m, isPM, suffix: isPM ? 'مساءً' : 'صباحًا', suffixEn: isPM ? 'PM' : 'AM', h24: h };
}

/** '7:05 صباحًا' — النموذج المعتمد في الواجهة */
export function fmtTime(hhmm, lang = 'ar') {
  const t = t12(hhmm);
  const num = t.h + ':' + String(t.m).padStart(2, '0');
  return lang === 'en' ? num + ' ' + t.suffixEn : num + ' ' + t.suffix;
}

/** الوقت فقط بدون اللاحقة (للحواف الضيقة) */
export function fmtTimeBare(hhmm) {
  const t = t12(hhmm);
  return t.h + ':' + String(t.m).padStart(2, '0');
}

/** HTML معزول الاتجاه: رقم LTR + لاحقة RTL */
export function fmtTimeSpans(hhmm, lang = 'ar') {
  return '<span class="ltr">' + fmtTimeBare(hhmm) + '</span> ' + (lang === 'en' ? t12(hhmm).suffixEn : t12(hhmm).suffix);
}

/** نطاق '7:00 – 7:45 صباحًا' أو مع لاحقتين عند الاختلاف */
export function fmtTimeRange(start, end, lang = 'ar') {
  const a = t12(start), b = t12(end);
  const numA = a.h + ':' + String(a.m).padStart(2, '0');
  const numB = b.h + ':' + String(b.m).padStart(2, '0');
  if (lang === 'en') return numA + ' ' + a.suffixEn + ' – ' + numB + ' ' + b.suffixEn;
  if (a.suffix === b.suffix) return numA + ' – ' + numB + ' ' + a.suffix;
  return numA + ' ' + a.suffix + ' – ' + numB + ' ' + b.suffix;
}

export function dayName(dayIdx, lang = 'ar', short = false) {
  const i = ((dayIdx % 7) + 7) % 7;
  if (lang === 'en') return short ? EN_DAYS_SHORT[i] : EN_DAYS[i];
  return short ? AR_DAYS_SHORT[i] : AR_DAYS[i];
}

/** 'الأحد، 12 أكتوبر 2026' */
export function fmtDate(iso, lang = 'ar', { withYear = true, withDay = true } = {}) {
  const d = parseISO(iso);
  const day = d.getDate();
  const month = lang === 'en' ? EN_MONTHS[d.getMonth()] : AR_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const name = lang === 'en' ? EN_DAYS[d.getDay()] : AR_DAYS[d.getDay()];
  const dateStr = day + ' ' + month + (withYear ? ' ' + year : '');
  return withDay ? (lang === 'en' ? name + ', ' + dateStr : name + '، ' + dateStr) : dateStr;
}

export function fmtDateShort(iso, lang = 'ar') {
  const d = parseISO(iso);
  return d.getDate() + ' ' + (lang === 'en' ? EN_MONTHS[d.getMonth()] : AR_MONTHS[d.getMonth()]);
}

/** وصف اليوم نسبةً لتاريخ اليوم: اليوم / غدًا / بعد غد / أمس */
export function fmtDayRel(iso, lang = 'ar') {
  const diff = daysBetween(todayISO(), iso);
  if (lang === 'en') {
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return fmtDate(iso, 'en');
  }
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'غدًا';
  if (diff === 2) return 'بعد غد';
  if (diff === -1) return 'أمس';
  return fmtDate(iso, 'ar');
}

/** مدة نصية: 45 دقيقة / ساعة / ساعتان / 3 ساعات */
export function fmtDur(mins, lang = 'ar') {
  const m = Math.max(0, Math.round(mins));
  if (m === 0) return lang === 'en' ? '0 minutes' : 'أقل من دقيقة';
  if (lang === 'en') {
    const h = Math.floor(m / 60), r = m % 60;
    if (h === 0) return m + (m === 1 ? ' minute' : ' minutes');
    const hp = h + (h === 1 ? ' hour' : ' hours');
    return r === 0 ? hp : hp + ' ' + r + ' min';
  }
  const h = Math.floor(m / 60), r = m % 60;
  let hs = '';
  if (h === 1) hs = 'ساعة';
  else if (h === 2) hs = 'ساعتان';
  else if (h >= 3 && h <= 10) hs = h + ' ساعات';
  else if (h > 10) hs = h + ' ساعة';
  let rs = '';
  if (r === 1) rs = 'دقيقة';
  else if (r === 2) rs = 'دقيقتان';
  else if (r >= 3 && r <= 10) rs = r + ' دقائق';
  else if (r > 10) rs = r + ' دقيقة';
  if (!hs) return rs;
  return rs ? hs + ' و' + rs : hs;
}

/** 'الآن' / 'بعد 5 دقائق' / 'بعد ساعتين' / 'قبل 10 دقائق' */
export function fmtRel(minsFromNow, lang = 'ar') {
  const m = Math.round(minsFromNow);
  const abs = Math.abs(m);
  if (abs < 1) return lang === 'en' ? 'now' : 'الآن';
  if (lang === 'en') {
    return (m > 0 ? 'in ' : '') + fmtDur(abs, 'en') + (m < 0 ? ' ago' : '');
  }
  const d = fmtDur(abs, 'ar');
  return m > 0 ? 'بعد ' + d : 'قبل ' + d;
}

/** عدّاد لطيف للبطاقات: 'بعد 25 دقيقة' أو '1:05' */
export function fmtSmartCountdown(mins) {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return fmtRel(m, 'ar');
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h + ':' + String(mm).padStart(2, '0');
}

/** نسبة مئوية مؤمّنة */
export function pct(part, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}
