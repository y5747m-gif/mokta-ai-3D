/* ============================================================
 * alarms.js — محرّك المنبهات: حساب المواعيد القادمة، اكتشاف
 * المنبهات الفائتة، التأجيل، وسجل كامل (انطلق/أُوقف/فات/تم).
 * المنطق نقي وقابل للاختبار؛ الواجهة تستدعي runAlarmTick دوريًا.
 * ============================================================ */

import {
  nextOccurrence, occurrencesBetween, nowDate, dateToStamp, stampToDate,
  combine, addMinutes, toMin,
} from '../core/time.js';
import { fmtTime } from '../core/format.js';
import { state, putItem, deleteItem, pushNotification, isFired, markFired } from '../core/store.js';
import { uid } from '../core/ids.js';
import { systemNotify } from '../core/notify.js';
import { startAlarmSound, stopAll, vibrate, startAlarmVibration, stopVibration, playSound } from '../audio/tone.js';
import { ALARM_CATEGORIES } from '../data/defaults.js';

/* ---------- حسابات نقية ---------- */

/** أقرب منبه قادم */
export function nextAlarm(alarms, from = nowDate()) {
  let best = null;
  for (const a of alarms) {
    if (!a.enabled) continue;
    if (a.snoozeUntil) {
      const at = stampToDate(a.snoozeUntil);
      if (at > from && (!best || at < best.at)) best = { alarm: a, at };
      continue;
    }
    const at = nextOccurrence(a, from);
    if (at && (!best || at < best.at)) best = { alarm: a, at };
  }
  return best;
}

/** التأجيلات المعلّقة (محفوظة في السجل حتى بعد إغلاق التطبيق) */
export function pendingSnoozes(alarmLog, from = nowDate()) {
  return alarmLog
    .filter((l) => l.status === 'snoozed' && l.fireAt && !l.resolved)
    .map((l) => ({ id: l.id, alarmId: l.alarmId, at: stampToDate(l.fireAt), title: l.title, message: l.message, category: l.category }))
    .filter((s) => s.at >= from)
    .sort((a, b) => a.at - b.at);
}

/** المنبهات التي كان يجب أن تعمل ولم تُسجَّل (فائتة) */
export function missedOccurrences(alarms, since, to = nowDate()) {
  const out = [];
  for (const a of alarms) {
    if (!a.enabled) continue;
    for (const at of occurrencesBetween(a, since, to)) {
      const key = fireKey(a.id, at);
      if (!isFired(key)) out.push({ alarm: a, at, key });
    }
  }
  return out.sort((x, y) => x.at - y.at);
}

export function fireKey(alarmId, at) {
  return 'al|' + alarmId + '|' + dateToStamp(at);
}

export function categoryLabel(cat) {
  const c = ALARM_CATEGORIES[cat] || ALARM_CATEGORIES.custom;
  return c.ar;
}

/* ---------- التنفيذ ---------- */

let overlayHandlers = null;
let vibrationHandle = null;

export function bindAlarmUI(handlers) {
  overlayHandlers = handlers;
}

/** اكتشاف المنبهات الفائتة عند الإقلاع أو العودة للتطبيق */
export async function catchUpMissed() {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const missed = missedOccurrences(state.alarms, since);
  for (const m of missed) {
    await markFired(m.key);
    await putItem('alarmLog', {
      id: 'log-' + uid(),
      alarmId: m.alarm.id,
      title: m.alarm.title,
      category: m.alarm.category,
      at: dateToStamp(m.at),
      firedAt: Date.now(),
      status: 'missed',
    });
    await pushNotification({
      type: 'alarm',
      level: 'warn',
      title: 'فات موعده: ' + m.alarm.title,
      body: 'كان موعده ' + fmtTime(m.alarm.time) + '. يمكنك إعادة جدولته من صفحة المنبهات.',
      actionType: 'alarm',
      actionId: m.alarm.id,
    });
    await systemNotify({
      title: 'فات منبه: ' + m.alarm.title,
      body: 'كان موعده ' + fmtTime(m.alarm.time) + '.',
      tag: 'missed-' + m.alarm.id,
      data: { type: 'alarm', actionType: 'alarm', actionId: m.alarm.id, level: 'warn' },
    });
  }
  return missed.length;
}

/** فتح منبه: صوت + اهتزاز + إشعار + طبقة الواجهة */
async function fireAlarm(alarm, at, { fromSnooze = false } = {}) {
  const key = fromSnooze ? 'al|' + alarm.id + '|snooze|' + dateToStamp(at) : fireKey(alarm.id, at);
  if (!isFired(key)) {
    await markFired(key);
    await putItem('alarmLog', {
      id: 'log-' + uid(),
      alarmId: alarm.id,
      title: alarm.title,
      category: alarm.category,
      at: dateToStamp(at),
      firedAt: Date.now(),
      status: 'fired',
    });
    await pushNotification({
      type: 'alarm',
      level: alarm.category === 'wake' ? 'success' : 'info',
      title: '⏰ ' + alarm.title,
      body: alarm.message || 'حان وقت ' + alarm.title,
      actionType: 'alarm',
      actionId: alarm.id,
    });
    await systemNotify({
      title: '⏰ ' + alarm.title,
      body: alarm.message || 'حان وقت ' + alarm.title,
      tag: 'alarm-' + alarm.id,
      requireInteraction: true,
      data: { type: 'alarm', actionType: 'alarm', actionId: alarm.id },
    });
  }

  if (state.settings.soundEnabled && alarm.sound !== 'none') {
    startAlarmSound(alarm.sound || 'gentle');
  }
  if (state.settings.vibrate && alarm.vibrate !== false) {
    vibrationHandle = startAlarmVibration();
    vibrate([150, 80, 150]);
  }
  if (overlayHandlers?.showAlarm) {
    overlayHandlers.showAlarm(alarm, at);
  }
}

/** حلقة الفحص — تستدعى كل 15 ثانية وعند عودة التركيز */
export async function runAlarmTick(now = nowDate()) {
  if (!state.ready) return;
  const from = new Date(now.getTime() - 20 * 60000); // نافذة سلامة 20 دقيقة

  // 1) التأجيلات المعلّقة
  for (const s of pendingSnoozes(state.alarmLog, from)) {
    if (s.at <= now && !isFired('al|' + s.alarmId + '|snooze|' + dateToStamp(s.at))) {
      const alarm = state.alarms.find((a) => a.id === s.alarmId) || {
        id: s.alarmId, title: s.title, message: s.message, category: s.category,
        sound: 'gentle', vibrate: true,
      };
      // تحديث حالة التأجيل كمُنفَّذ
      const log = state.alarmLog.find((l) => l.id === s.id);
      if (log) await putItem('alarmLog', { ...log, resolved: true });
      await fireAlarm(alarm, s.at, { fromSnooze: true });
    }
  }

  // 2) المنبهات المستحقة
  for (const a of state.alarms) {
    if (!a.enabled || a.snoozeUntil) continue;
    for (const at of occurrencesBetween(a, from, now)) {
      const key = fireKey(a.id, at);
      if (!isFired(key)) await fireAlarm(a, at);
    }
  }
}

/** إيقاف المنبه المفتوح */
export async function dismissAlarm(alarm, at, status = 'dismissed') {
  stopAll();
  stopVibration(vibrationHandle);
  vibrationHandle = null;
  await putItem('alarmLog', {
    id: 'log-' + uid(),
    alarmId: alarm.id,
    title: alarm.title,
    category: alarm.category,
    at: at ? dateToStamp(at) : null,
    firedAt: Date.now(),
    status,
  });
  if (status === 'completed') {
    await pushNotification({
      type: 'success', level: 'success',
      title: 'تم تنفيذ: ' + alarm.title,
      body: 'أحسنت! سُجّل المنبه كمُنفَّذ.',
    });
    playSound('done');
  }
}

/** تأجيل المنبه (5/10/15 حسب الإعداد) */
export async function snoozeAlarm(alarm, minutes) {
  stopAll();
  stopVibration(vibrationHandle);
  vibrationHandle = null;
  const at = addMinutes(nowDate(), minutes);
  const log = {
    id: 'log-' + uid(),
    alarmId: alarm.id,
    title: alarm.title,
    message: alarm.message,
    category: alarm.category,
    at: dateToStamp(nowDate()),
    fireAt: dateToStamp(at),
    firedAt: Date.now(),
    status: 'snoozed',
    resolved: false,
  };
  await putItem('alarmLog', log);
  await pushNotification({
    type: 'info', level: 'info',
    title: 'تم تأجيل: ' + alarm.title,
    body: 'سيُذكَّر مجددًا بعد ' + minutes + ' دقيقة (' + fmtTime(dateToStamp(at).slice(11)) + ').',
    actionType: 'alarm',
    actionId: alarm.id,
  });
  return at;
}

/* ---------- إدارة CRUD ---------- */

export async function saveAlarm(alarm) {
  const rec = {
    ...alarm,
    updatedAt: Date.now(),
    createdAt: alarm.createdAt || Date.now(),
    source: alarm.source || 'user',
  };
  await putItem('alarms', rec);
  return rec;
}

export async function removeAlarm(id) {
  await deleteItem('alarms', id);
}

export async function toggleAlarm(id, enabled) {
  const a = state.alarms.find((x) => x.id === id);
  if (!a) return;
  await saveAlarm({ ...a, enabled, snoozeUntil: null });
  if (enabled) {
    await pushNotification({
      type: 'info', level: 'info',
      title: 'تم تفعيل: ' + a.title,
      body: 'الموعد القادم: ' + fmtTime(a.time),
      actionType: 'alarm',
      actionId: a.id,
    });
  }
}

/** تجربة منبه (تشغيل فوري مع إشعار) */
export async function testAlarm(alarm) {
  await fireAlarm({ ...alarm, title: 'تجربة: ' + alarm.title }, nowDate(), { fromSnooze: true });
}

/** سجل المنبهات مرتبًا */
export function alarmHistory(limit = 30) {
  return [...state.alarmLog]
    .sort((a, b) => (b.firedAt || 0) - (a.firedAt || 0))
    .slice(0, limit);
}
