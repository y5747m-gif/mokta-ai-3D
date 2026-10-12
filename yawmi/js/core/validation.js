/* validation.js — تحقق موحّد من مدخلات النماذج */
import { isValidSpan, toMin } from './time.js';

export function required(value, label = 'هذا الحقل') {
  if (value === undefined || value === null || String(value).trim() === '') {
    return label + ' مطلوب';
  }
  return null;
}

export function timeValue(value, label = 'الوقت') {
  if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return label + ' غير صالح';
  if (toMin(value) >= 24 * 60) return label + ' خارج النطاق';
  return null;
}

export function spanValue(start, end) {
  if (!isValidSpan(start, end)) return 'وقت النهاية يجب أن يكون بعد وقت البداية';
  return null;
}

export function listOfDays(days) {
  if (!Array.isArray(days) || days.length === 0) return 'اختر يومًا واحدًا على الأقل';
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return 'أيام غير صالحة';
  return null;
}

export function numberInRange(value, min, max, label = 'القيمة') {
  const n = Number(value);
  if (!Number.isFinite(n)) return label + ' يجب أن تكون رقمًا';
  if (n < min || n > max) return label + ' خارج النطاق (' + min + '–' + max + ')';
  return null;
}

/** تجميع الأخطاء: null = لا أخطاء */
export function combineErrors(...errors) {
  const list = errors.filter(Boolean);
  return list.length ? list : null;
}
