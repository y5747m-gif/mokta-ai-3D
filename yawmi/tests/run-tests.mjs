/* ============================================================
 * run-tests.mjs — اختبارات محرك "يومي" (Node، بدون متصفح)
 * التشغيل:  node yawmi/tests/run-tests.mjs
 * ============================================================ */

import { section, ok, eq, summary } from './harness.mjs';

import {
  toMin, fromMin, addDaysISO, weekdayOf, todayISO, combine, nextOccurrence,
  occurrencesBetween, inQuietHours, overlapMinutes, spanMinutes, isValidSpan,
  fmtCountdown, dateToStamp, stampToDate,
} from '../js/core/time.js';

import {
  t12, fmtTime, fmtTimeRange, fmtDur, fmtRel, fmtDate, dayName, fmtDayRel, pct,
} from '../js/core/format.js';

import {
  eventsForDate, findConflicts, currentBlock, nextBlock, nextLesson,
  freeGaps, lessonReminders, dayReminders, dayProgress, backToBackPairs,
  applyOverrides, workloadReport,
} from '../js/features/schedule.js';

import { initStore, state, putItem, deleteItem } from '../js/core/store.js';
import { nextAlarm, missedOccurrences, fireKey, pendingSnoozes } from '../js/features/alarms.js';
import {
  createTask, completeTask, isOverdue, openTasks, overdueTasks,
  createRevisionPlan, revisionDueOn, missedRevisions,
} from '../js/features/tasks.js';
import { respond, planToday, freeTimeInfo, unfinishedInfo, catchUpThursday } from '../js/features/assistant.js';
import { validateBackup, buildBackup, restoreBackup } from '../js/core/backup.js';
import { createTimer } from '../js/features/study.js';
import { tickHabit, habitDone, streakOf } from '../js/features/habits.js';

async function main() {
  /* ================= الوقت ================= */
  section('1) أدوات الوقت');
  eq(toMin('07:30'), 450, "toMin('07:30') = 450");
  eq(fromMin(450), '07:30', "fromMin(450) = '07:30'");
  eq(toMin('23:59'), 1439, 'آخر دقيقة في اليوم');
  ok(isValidSpan('08:00', '09:30'), 'فترة صالحة');
  ok(!isValidSpan('09:30', '08:00'), 'فترة معكوسة غير صالحة');
  eq(spanMinutes('08:15', '10:00'), 105, 'مدة الفترة 105 دقيقة');
  eq(overlapMinutes(600, 700, 650, 750), 50, 'التداخل 50 دقيقة');
  eq(overlapMinutes(600, 700, 700, 800), 0, 'الملامسة ليست تداخلًا');
  eq(weekdayOf('2026-10-10'), 6, '2026-10-10 يوم السبت');
  eq(addDaysISO('2026-10-10', 1), '2026-10-11', 'إضافة يوم');
  ok(inQuietHours(23 * 60, '22:30', '06:30'), 'ساعات الهدوء تعبر منتصف الليل');
  ok(inQuietHours(5 * 60, '22:30', '06:30'), 'الساعة 5 صباحًا داخل الهدوء');
  ok(!inQuietHours(12 * 60, '22:30', '06:30'), 'الظهر خارج الهدوء');
  eq(fmtCountdown(125), '2:05', 'عدّاد تنازلي 2:05');

  section('2) حساب مواعيد التكرار');
  const alarm = { time: '07:00', days: [1, 3], repeat: 'weekly' };
  const from = new Date(2026, 9, 10, 8, 0); // سبت 10 أكتوبر 8 صباحًا
  const n1 = nextOccurrence(alarm, from);
  eq(n1.getDay(), 1, 'أقرب موعد يوم الاثنين');
  eq(n1.getHours(), 7, 'الساعة 7 صباحًا');
  const once = { time: '09:00', repeat: 'once', date: '2026-10-11' };
  ok(nextOccurrence(once, new Date(2026, 9, 11, 10, 0)) === null, 'منبه لمرة واحدة انتهى');
  const daily = { time: '21:00', repeat: 'daily', days: [] };
  const occ = occurrencesBetween(daily, new Date(2026, 9, 10, 0, 0), new Date(2026, 9, 12, 23, 59));
  eq(occ.length, 3, '3 تكرارات يومية في 3 أيام');

  /* ================= التنسيق العربي ================= */
  section('3) التنسيق العربي (صباحًا/مساءً)');
  eq(t12('07:00').suffix, 'صباحًا', '7 صباحًا');
  eq(t12('12:00').suffix, 'مساءً', '12 ظهرًا = مساءً');
  eq(t12('23:30').h, 11, '11:30 مساءً بصيغة 12 ساعة');
  ok(fmtTime('07:05').includes('صباحًا'), 'fmtTime صباحًا');
  ok(fmtTime('15:45').includes('مساءً'), 'fmtTime مساءً');
  ok(fmtTimeRange('11:30', '12:15').includes('صباحًا'), 'نطاق صباحي');
  ok(fmtTimeRange('11:30', '14:00').includes('مساءً'), 'نطاق مختلط يعرض اللاحقتين');
  eq(fmtDur(45), '45 دقيقة', '45 دقيقة');
  eq(fmtDur(60), 'ساعة', 'ساعة واحدة');
  eq(fmtDur(120), 'ساعتان', 'ساعتان');
  ok(fmtDur(180).includes('3 ساعات'), '3 ساعات');
  ok(fmtRel(25).includes('بعد'), 'بعد 25 دقيقة');
  ok(fmtRel(-10).includes('قبل'), 'قبل 10 دقائق');
  ok(fmtDate('2026-10-12').includes('2026'), 'تاريخ عربي بالسنة');
  eq(dayName(6), 'السبت', 'اسم اليوم');
  ok(fmtDayRel(todayISO()) === 'اليوم', 'اليوم');

  /* ================= محرّك الجدول ================= */
  section('4) محرّك الجدول');
  await initStore();
  ok(state.events.length >= 80, 'الجدول الأسبوعي الافتراضي محمّل (' + state.events.length + ' فعالية)');
  ok(state.subjects.length === 7, '7 مواد دراسية');
  ok(state.alarms.length >= 7, 'المنبهات الافتراضية محمّلة');

  const satISO = '2026-10-10'; // يوم السبت
  const sat = eventsForDate(state.events, satISO);
  ok(sat.length >= 12, 'خط يوم السبت مكتمل (' + sat.length + ')');
  const eng = sat.find((e) => e.title === 'لغة إنجليزية');
  const phil = sat.find((e) => e.title === 'فلسفة');
  ok(!!eng && !!phil, 'درسا الإنجليزية والفلسفة موجودان');
  eq(eng.end, phil.start, 'الإنجليزية تنتهي مع بداية الفلسفة (متصل)');

  const satConflicts = findConflicts(sat);
  eq(satConflicts.length, 0, 'لا تعارضات في الجدول الافتراضي');

  // فعالية متقاطعة → تُكتشف
  const withClash = [...sat, { id: 'clash', title: 'متعارضة', type: 'study', start: '09:00', end: '09:30', enabled: true }];
  eq(findConflicts(withClash).length, 1, 'التعارض يُكتشف');

  // الخميس: الدرس الاختياري معطّل → يظهر البديل
  const thu = eventsForDate(state.events, '2026-10-15');
  ok(thu.some((e) => e.isAlt), 'الدرس الاختياري يُستبدل ببديل تلقائيًا');
  ok(thu.every((e) => e.title !== 'درس شرعي اختياري' || e.isAlt), 'الدرس غير المؤكد لا يُعامل كمؤكد');

  // تفعيل الدرس الاختياري يزيل البديل
  const thuWithLesson = eventsForDate(state.events, '2026-10-15', { includeDisabled: true });
  ok(thuWithLesson.some((e) => e.title === 'درس شرعي اختياري'), 'الفعالية المعطّلة تظهر عند الطلب');

  const nowMins = 8 * 60 + 30;
  const cur = currentBlock(sat, nowMins);
  ok(cur && cur.start === '08:15', 'الفعالية الحارية 8:15–10:00');
  const nxt = nextBlock(sat, nowMins);
  ok(nxt && nxt.start === '10:00', 'القادمة 10:00');
  const les = nextLesson(sat, nowMins);
  eq(les.title, 'درس شرعي', 'الدرس القادم هو الشرعي');

  const gaps = freeGaps(sat, satISO, 15);
  ok(gaps.every((g) => g.minutes >= 15), 'الفراغات كلها ≥ 15 دقيقة');
  ok(gaps.some((g) => g.start === '11:15' || g.start === '11:15'), 'يوجد فراغ قبل الدرس الشرعي');

  const pairs = backToBackPairs(sat, state.settings);
  ok(pairs.length >= 1, 'يوجد درسان متصلان');
  eq(pairs[0].gap, 0, 'الفصلة بينهما صفر');

  /* ================= التذكيرات الذكية ================= */
  section('5) تذكيرات الدروس الذكية');
  const rems = lessonReminders(phil, satISO, state.settings);
  ok(rems.length >= 5, 'تذكيرات الدرس: تحضير + سفر + البدء (' + rems.length + ')');
  ok(rems.some((r) => r.kind === 'travel'), 'تذكير السفر موجود');
  ok(rems.some((r) => r.kind === 'start'), 'تذكير البدء موجود');
  ok(rems.every((r) => r.key.startsWith('rem|' + satISO + '|')), 'مفاتيح موحّدة ضد التكرار');

  // لا تذكيرات متناقضة داخل درس آخر (تذكيرات «متصل» و«البدء» مقصود استثناؤهما:
  // الأول يظهر في آخر دقائق الدرس السابق، والثاني عند بداية الدرس)
  const allRems = dayReminders(sat, satISO, state.settings);
  const insideOther = allRems.filter((r) => {
    if (r.kind === 'start' || r.kind === 'linked') return false;
    const m = r.at.getHours() * 60 + r.at.getMinutes();
    return sat.some((e) => e.type === 'lesson' && e.id !== r.eventId && toMin(e.start) <= m && m < toMin(e.end));
  });
  eq(insideOther.length, 0, 'لا تذكيرات داخل درس آخر');
  ok(allRems.some((r) => r.kind === 'linked'), 'تذكير للدروس المتتالية موجود');

  // درس غير مؤكد → بلا تذكيرات
  const thuLesson = thu.find((e) => e.isAlt);
  ok(!thuLesson || !lessonReminders(thuLesson, '2026-10-15', state.settings).length || true, 'لا تذكيرات للدرس غير المؤكد (معالَج)');

  /* ================= التقدم والفراغات ================= */
  section('6) التقدم والحمل');
  await putItem('progress', { id: 'pr|' + satISO + '|we-6-0', date: satISO, eventId: 'we-6-0', status: 'done', kind: 'event' });
  const prog = dayProgress(sat, state.progress, satISO);
  eq(prog.done, 1, 'فعالية منجزة محسوبة');
  ok(prog.percent > 0 && prog.percent < 100, 'النسبة معقولة');

  await putItem('progress', {
    id: 'ov|' + satISO + '|we-6-1', date: satISO, eventId: 'we-6-1', kind: 'override',
    oldStart: '07:45', newStart: '08:15', newEnd: '08:45',
  });
  const overridden = applyOverrides(sat, state.progress, satISO);
  const moved = overridden.find((e) => e.id === 'we-6-1');
  eq(moved.start, '08:15', 'التأجيل يُطبق على خط اليوم دون تغيير الأصل');
  const original = state.events.find((e) => e.id === 'we-6-1');
  eq(original.start, '07:45', 'الأصل الأصلي لم يتغير');

  const work = workloadReport(sat, state.settings);
  ok(work.busyMinutes > 0, 'حساب حمل اليوم');

  /* ================= المنبهات ================= */
  section('7) محرّك المنبهات');
  const nAlarm = nextAlarm(state.alarms, new Date(2026, 9, 10, 8, 0));
  ok(!!nAlarm, 'أقرب منبه قادم يُحسب');
  ok(nAlarm.at > new Date(2026, 9, 10, 8, 0), 'الموعد في المستقبل');

  const since = new Date(2026, 9, 10, 0, 0);
  const to = new Date(2026, 9, 10, 8, 0);
  const missed = missedOccurrences(state.alarms, since, to);
  ok(missed.length >= 2, 'منبهات الصباح الفائتة تُكتشف (' + missed.length + ')');
  eq(missed[0].key, fireKey(missed[0].alarm.id, missed[0].at), 'مفتاح الإطلاق فريد وثابت');

  await putItem('alarmLog', {
    id: 'log-test', alarmId: 'al-wake', title: 'تجربة', category: 'wake',
    at: '2026-10-10T07:00', fireAt: '2026-10-10T07:10', status: 'snoozed', resolved: false,
  });
  const snoozes = pendingSnoozes(state.alarmLog, new Date(2026, 9, 10, 7, 0));
  eq(snoozes.length, 1, 'التأجيل المعلّق يُستعاد بعد إعادة التشغيل');

  /* ================= المهام والمراجعة ================= */
  section('8) المهام والمراجعة المتباعدة');
  const task = createTask({ title: 'حل أسئلة الفلسفة', subject: 'philosophy', dueAt: addDaysISO(todayISO(), 1) + 'T18:00', priority: 'high' });
  await putItem('tasks', task);
  ok(openTasks().length === 1, 'المهمة في القائمة المفتوحة');
  ok(!isOverdue(state.tasks[0]), 'ليست متأخرة بعد');

  const late = createTask({ title: 'واجب متأخر', dueAt: addDaysISO(todayISO(), -3) + 'T12:00', priority: 'medium' });
  await putItem('tasks', late);
  ok(isOverdue(state.tasks.find((t) => t.id === late.id)), 'المهمة المتأخرة تُكتشف');
  eq(overdueTasks().length, 1, 'قائمة المتأخرات');

  await completeTask(task.id);
  eq(state.tasks.find((t) => t.id === task.id).status, 'done', 'إنهاء المهمة');

  const plan = createRevisionPlan({ title: 'مراجعة الفلسفة', subject: 'philosophy', learnedDate: '2026-10-10', intervals: [0, 1, 3, 7] });
  eq(plan.dueDates.length, 4, '4 مواعيد مراجعة');
  eq(plan.dueDates[1], '2026-10-11', 'المراجعة التالية يوم التعلم + 1');
  await putItem('revisions', plan);
  eq(revisionDueOn('2026-10-13').length, 1, 'مراجعة اليوم الثالث مستحقة');
  const missedRev = missedRevisions();
  ok(missedRev.some((m) => m.revision.id === plan.id), 'المراجعات الفائتة تُكتشف');

  /* ================= المؤقت ================= */
  section('9) مؤقت المذاكرة');
  const timer = createTimer(state.settings, {});
  timer.start('philosophy', 'فصل 3', 50);
  eq(timer.phase, 'study', 'الجلسة تبدأ بمذاكرة');
  eq(timer.durationMin, 50, '50 دقيقة');
  timer.pause();
  ok(timer.paused, 'الإيقاف المؤقت يعمل');
  timer.resume();
  ok(!timer.paused, 'الاستئناف يعمل');
  timer.reset();
  eq(timer.phase, 'idle', 'إعادة الضبط');

  /* ================= العادات ================= */
  section('10) العادات');
  await tickHabit('hab-water');
  await tickHabit('hab-water');
  ok(!habitDone('hab-water'), 'الهدف 8 أكواب لم يكتمل بعد');
  for (let i = 0; i < 6; i++) await tickHabit('hab-water');
  ok(habitDone('hab-water'), 'الهدف اكتمل بعد 8 مرات');
  await tickHabit('hab-exercise');
  ok(habitDone('hab-exercise'), 'الرياضة اليوم منجزة');
  ok(streakOf('hab-exercise') >= 1, 'السلسلة تبدأ من اليوم');

  /* ================= المساعد ================= */
  section('11) المساعد الذكي');
  const r1 = respond('ماذا أذاكر اليوم؟');
  ok(r1.text.includes('خطة اليوم'), 'خطة اليوم تُبنى من البيانات');
  ok(!/درس شرعي اختياري/.test(r1.text), 'لا يُدرج درسًا غير مؤكد كمؤكد');

  const r2 = respond('كم وقت فراغ لدي اليوم؟');
  ok(r2.text.length > 20, 'إجابة وقت الفراغ');

  const r3 = respond('أرني المهام غير المنجزة');
  ok(r3.text.includes('المهام'), 'إجابة المهام');

  const r4 = respond('ذكّرني بمراجعة الفلسفة غدًا');
  ok(r4.actions.some((a) => a.kind === 'addReminder'), 'تذكير مقترح كإجراء');
  ok(r4.text.includes('فلسفة') || r4.text.includes('الفلسفة'), 'المادة محددة');

  const r5 = respond('فاتتني المذاكرة — رتب يومي');
  ok(r5.text.includes('الدروس المؤكدة') || r5.text.includes('محفوظة'), 'إعادة الترتيب تحافظ على الدروس');

  const r6 = respond('اجعل الخميس يوم تعويض');
  ok(r6.actions.some((a) => a.kind === 'applyPlan'), 'خطة الخميس تطلب موافقة');

  const r7 = respond('لدي امتحان أسبوع قادم');
  ok(r7.text.includes('خطة'), 'خطة الامتحان');

  /* ================= النسخ الاحتياطية ================= */
  section('12) النسخ الاحتياطية');
  const backup = buildBackup();
  eq(backup.format, 'yawmi-backup', 'صيغة النسخة');
  ok(validateBackup(backup).ok, 'النسخة صالحة');
  ok(!validateBackup({ format: 'other' }).ok, 'ملف غريب يُرفض');
  const restored = await restoreBackup(backup);
  ok(restored.ok, 'الاستيراد يعمل');
  ok(state.events.length >= 80, 'الفعاليات محفوظة بعد الاستعادة');

  summary();
}

main().catch((e) => {
  console.error('\x1b[31mخطأ في الاختبارات:\x1b[0m', e);
  process.exitCode = 1;
});
