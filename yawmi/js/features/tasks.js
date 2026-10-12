/* ============================================================
 * tasks.js — الواجبات والمهام + المراجعة المتباعدة
 * ============================================================ */

import { todayISO, addDaysISO, stampToDate, nowDate, combine, toMin } from '../core/time.js';
import { fmtDate, fmtRel, fmtDur } from '../core/format.js';
import { state, putItem, deleteItem, pushNotification } from '../core/store.js';
import { uid } from '../core/ids.js';

/* ---------- المهام ---------- */

export function createTask(data) {
  return {
    id: 'task-' + uid(),
    title: data.title,
    subject: data.subject || null,
    dueAt: data.dueAt || null,           // 'YYYY-MM-DDTHH:MM'
    estimatedMinutes: data.estimatedMinutes || 30,
    priority: data.priority || 'medium', // low | medium | high
    status: 'open',                      // open | done
    notes: data.notes || '',
    steps: (data.steps || []).map((s) => ({ id: uid(), text: s.text || s, done: !!s.done })),
    recurring: data.recurring || 'none', // none | daily | weekly
    createdAt: Date.now(),
    completedAt: null,
  };
}

export async function saveTask(task) {
  await putItem('tasks', task);
  return task;
}

export async function completeTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || t.status === 'done') return;
  const done = { ...t, status: 'done', completedAt: Date.now() };
  await putItem('tasks', done);
  await pushNotification({
    type: 'success', level: 'success',
    title: 'أحسنت! أنجزت مهمة 🎉',
    body: t.title,
    actionType: 'task', actionId: t.id,
  });
  // المهام المتكررة: أنشئ النسخة القادمة تلقائيًا
  if (t.recurring && t.recurring !== 'none' && t.dueAt) {
    const nextDate = t.recurring === 'daily'
      ? addDaysISO(t.dueAt.slice(0, 10), 1)
      : addDaysISO(t.dueAt.slice(0, 10), 7);
    const clone = createTask({
      ...t,
      dueAt: nextDate + 'T' + (t.dueAt.slice(11) || '12:00'),
    });
    await saveTask(clone);
  }
  return done;
}

export async function reopenTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  await putItem('tasks', { ...t, status: 'open', completedAt: null });
}

export async function removeTask(id) {
  await deleteItem('tasks', id);
}

export function isOverdue(task) {
  if (task.status === 'done' || !task.dueAt) return false;
  return stampToDate(task.dueAt) < nowDate();
}

export function overdueTasks() {
  return state.tasks.filter(isOverdue)
    .sort((a, b) => stampToDate(a.dueAt) - stampToDate(b.dueAt));
}

export function openTasks() {
  return state.tasks.filter((t) => t.status === 'open')
    .sort((a, b) => {
      const pa = { high: 0, medium: 1, low: 2 }[a.priority] ?? 1;
      const pb = { high: 0, medium: 1, low: 2 }[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return (stampToDate(a.dueAt || '2099-01-01T00:00')) - (stampToDate(b.dueAt || '2099-01-01T00:00'));
    });
}

export function tasksDueOn(iso) {
  return state.tasks.filter((t) => t.dueAt && t.dueAt.slice(0, 10) === iso && t.status === 'open');
}

export function taskSummary() {
  const open = openTasks();
  return {
    open: open.length,
    overdue: overdueTasks().length,
    doneToday: state.tasks.filter((t) => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length,
    highPriority: open.filter((t) => t.priority === 'high').length,
  };
}

export function toggleStep(taskId, stepId) {
  const t = state.tasks.find((x) => x.id === taskId);
  if (!t) return;
  const steps = t.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s));
  putItem('tasks', { ...t, steps });
}

/* ---------- المراجعة المتباعدة ---------- */

/**
 * إنشاء خطة مراجعة متباعدة لموضوع.
 * الفترات الافتراضية: يوم التعلم، اليوم التالي، بعد عدة أيام، بعد أسبوع —
 * وهي اقتراحات قابلة للتغيير وليست مواعيد مفروضة.
 */
export function createRevisionPlan({ title, subject, learnedDate = todayISO(), intervals = null }) {
  const iv = intervals || state.settings.revisionIntervals || [0, 1, 3, 7];
  const dueDates = iv.map((n) => addDaysISO(learnedDate, n));
  return {
    id: 'rev-' + uid(),
    title,
    subject: subject || null,
    learnedDate,
    intervals: iv,
    dueDates,
    doneDates: [],
    createdAt: Date.now(),
  };
}

export async function saveRevision(rev) {
  await putItem('revisions', rev);
  return rev;
}

export function revisionDueOn(iso) {
  return state.revisions.filter((r) => r.dueDates.includes(iso) && !r.doneDates.includes(iso));
}

export function missedRevisions() {
  const today = todayISO();
  const out = [];
  for (const r of state.revisions) {
    const missed = r.dueDates.filter((d) => d < today && !r.doneDates.includes(d));
    if (missed.length) out.push({ revision: r, missedDates: missed });
  }
  return out;
}

export async function markRevisionDone(revId, iso = todayISO()) {
  const r = state.revisions.find((x) => x.id === revId);
  if (!r) return;
  const doneDates = r.doneDates.includes(iso) ? r.doneDates : [...r.doneDates, iso];
  await putItem('revisions', { ...r, doneDates });
}

/** اقتراح وقت بديل لمراجعة فائتة: أول فراغ مناسب دون مساس بالدروس المؤكدة أو النوم */
export function suggestRevisionSlot(iso, minutes = 30) {
  // يُستخدم مع freeGaps من schedule.js — يعيد أول فراغ مناسب بعد الظهر
  const gaps = state._lastGaps || [];
  return gaps.find((g) => g.minutes >= minutes) || null;
}

/** وصف حالة المراجعة للعرض */
export function revisionStatusText(r) {
  const today = todayISO();
  const doneCount = r.doneDates.length;
  const total = r.dueDates.length;
  const next = r.dueDates.find((d) => !r.doneDates.includes(d));
  if (!next) return 'اكتملت خطة المراجعة ✓ (' + doneCount + '/' + total + ')';
  const rel = fmtRel((toMin('12:00') - toMin('12:00')) + Math.round((combine(next, '12:00') - nowDate()) / 60000));
  return 'المراجعة القادمة ' + (next === today ? 'اليوم' : (next === addDaysISO(today, 1) ? 'غدًا' : fmtDate(next))) + ' — ' + rel + ' (' + doneCount + '/' + total + ' منجزة)';
}
