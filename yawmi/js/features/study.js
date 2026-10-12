/* ============================================================
 * study.js — مؤقت المذاكرة (جلسات مركّزة + استراحات) + الإحصاءات
 * 50 دقيقة مذاكرة / 10 استراحة / استراحة طويلة بعد 4 جلسات
 * ============================================================ */

import { todayISO, fmtCountdownSec } from '../core/time.js';
import { state, putItem } from '../core/store.js';
import { uid } from '../core/ids.js';
import { playSound, vibrate } from '../audio/tone.js';

/** إنشاء مؤقت مستقل (قابل للاختبار) */
export function createTimer(settings, callbacks = {}) {
  const cfg = {
    study: settings.studyMinutes ?? 50,
    brk: settings.breakMinutes ?? 10,
    long: settings.longBreakMinutes ?? 25,
    every: settings.sessionsUntilLongBreak ?? 4,
    short: settings.shortSessionMinutes ?? 25,
  };

  const timer = {
    phase: 'idle',        // idle | study | break | longBreak | paused
    phaseBeforePause: null,
    subject: null,
    goal: '',
    durationMin: cfg.study,
    endsAt: null,          // timestamp
    remainingMs: 0,
    completedSessions: 0,  // في الجلسة الحالية
    sessionStart: null,
    totalStudyMs: 0,
    paused: false,
  };

  function remaining() {
    if (timer.paused) return timer.remainingMs;
    if (!timer.endsAt) return 0;
    return Math.max(0, timer.endsAt - Date.now());
  }

  function tick() {
    const rem = remaining();
    callbacks.onTick?.(fmtCountdownSec(rem / 1000), rem, timer);
    if (!timer.paused && timer.endsAt && rem <= 0) {
      completePhase();
    }
  }

  function completePhase() {
    const finished = timer.phase;
    if (finished === 'study') {
      timer.completedSessions += 1;
      timer.totalStudyMs += timer.durationMin * 60000;
      callbacks.onPhaseEnd?.('study', timer);
      playSound('done');
      vibrate([120, 60, 120]);
      // انتقل إلى الاستراحة
      const isLong = timer.completedSessions % cfg.every === 0;
      timer.phase = isLong ? 'longBreak' : 'break';
      timer.durationMin = isLong ? cfg.long : cfg.brk;
      timer.endsAt = Date.now() + timer.durationMin * 60000;
    } else {
      callbacks.onPhaseEnd?.(timer.phase, timer);
      playSound('break');
      timer.phase = 'study';
      timer.durationMin = cfg.study;
      timer.endsAt = Date.now() + timer.durationMin * 60000;
    }
    callbacks.onState?.(timer);
  }

  timer.start = (subject, goal, durationMin = cfg.study) => {
    timer.phase = 'study';
    timer.subject = subject;
    timer.goal = goal || '';
    timer.durationMin = durationMin;
    timer.endsAt = Date.now() + durationMin * 60000;
    timer.sessionStart = Date.now();
    timer.paused = false;
    callbacks.onState?.(timer);
  };

  timer.pause = () => {
    if (timer.paused || timer.phase === 'idle') return;
    timer.remainingMs = remaining();
    timer.paused = true;
    timer.phaseBeforePause = timer.phase;
    callbacks.onState?.(timer);
  };

  timer.resume = () => {
    if (!timer.paused) return;
    timer.endsAt = Date.now() + timer.remainingMs;
    timer.paused = false;
    callbacks.onState?.(timer);
  };

  timer.reset = () => {
    timer.phase = 'idle';
    timer.paused = false;
    timer.endsAt = null;
    timer.remainingMs = 0;
    timer.completedSessions = 0;
    timer.totalStudyMs = 0;
    callbacks.onState?.(timer);
    callbacks.onTick?.(fmtCountdownSec((timer.durationMin || cfg.study) * 60), (timer.durationMin || cfg.study) * 60000, timer);
  };

  timer.skipPhase = () => completePhase();

  timer.remaining = remaining;
  timer.config = cfg;

  return timer;
}

/** حفظ جلسة مذاكرة في السجل */
export async function logSession({ subject, goal, durationMin, startedAt, reflection = {} }) {
  const rec = {
    id: 'ses-' + uid(),
    subject: subject || null,
    goal: goal || '',
    durationMin: durationMin || 0,
    startedAt: startedAt || Date.now(),
    endedAt: Date.now(),
    date: todayISO(),
    finishedTask: reflection.finishedTask ?? null,   // هل أنجزت المطلوب؟
    understanding: reflection.understanding ?? null, // 1-5
    needAnother: reflection.needAnother ?? null,
    reviewLater: reflection.reviewLater ?? '',
  };
  await putItem('sessions', rec);
  return rec;
}

/** إحصاءات اليوم والأسبوع */
export function studyStats() {
  const today = todayISO();
  const dayMs = 86400000;
  const weekAgo = Date.now() - 7 * dayMs;

  const todays = state.sessions.filter((s) => s.date === today);
  const week = state.sessions.filter((s) => (s.endedAt || 0) >= weekAgo);

  const sum = (arr) => arr.reduce((a, s) => a + (s.durationMin || 0), 0);

  // توزيع آخر 7 أيام
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * dayMs);
    const iso = d.toISOString().slice(0, 10);
    // استخدام التاريخ المحلي بدل UTC
    const localISO = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const minutes = sum(state.sessions.filter((s) => s.date === localISO));
    daily.push({ iso: localISO, minutes });
  }

  return {
    todayMinutes: sum(todays),
    todaySessions: todays.length,
    weekMinutes: sum(week),
    weekSessions: week.length,
    daily,
  };
}

/** توزيع المذاكرة على المواد */
export function subjectBreakdown(days = 7) {
  const since = Date.now() - days * 86400000;
  const map = new Map();
  for (const s of state.sessions) {
    if ((s.endedAt || 0) < since) continue;
    const k = s.subject || 'other';
    map.set(k, (map.get(k) || 0) + (s.durationMin || 0));
  }
  return Array.from(map.entries())
    .map(([subject, minutes]) => ({ subject, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}
