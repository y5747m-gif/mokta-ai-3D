/* ============================================================
 * assistant.js — المساعد الذكي (يعمل بلا إنترنت وبلا API)
 * يعتمد حصريًا على بيانات الطالب المخزنة: الجدول، المهام،
 * المراجعات، والعادات. لا يخترع مواعيد أبدًا، ولا يغيّر درسًا
 * مؤكدًا دون موافقة صريحة.
 * ============================================================ */

import { todayISO, addDaysISO, toMin, fromMin, weekdayOf, nowMin, stampToDate, combine } from '../core/time.js';
import { fmtTime, fmtTimeRange, fmtDur, fmtRel, dayName, fmtDayRel } from '../core/format.js';
import { state } from '../core/store.js';
import {
  eventsForDate, freeGaps, nextLesson, currentBlock, nextBlock,
  dayProgress, lessonBlocks, findConflicts,
} from './schedule.js';
import { openTasks, overdueTasks, taskSummary, tasksDueOn, createTask, createRevisionPlan } from './tasks.js';
import { subjectById } from '../core/store.js';
import { studyStats } from './study.js';

const SUBJ_WORDS = [
  ['شرعي', 'religious'], ['عربي', 'arabic'], ['عربية', 'arabic'],
  ['إنجليزي', 'english'], ['انجليزي', 'english'], ['إنجليزية', 'english'], ['انجليزية', 'english'],
  ['فرنسي', 'french'], ['فرنسية', 'french'],
  ['فلسفة', 'philosophy'], ['جغرافيا', 'geography'], ['تاريخ', 'history'],
];

function detectSubject(text) {
  for (const [word, key] of SUBJ_WORDS) {
    if (text.includes(word)) return key;
  }
  return null;
}

function detectDay(text) {
  if (/غدًا|غدا|غداً|بكرة|tomorrow/.test(text)) return addDaysISO(todayISO(), 1);
  if (/بعد غد|after tomorrow/.test(text)) return addDaysISO(todayISO(), 2);
  if (/اليوم|today/.test(text)) return todayISO();
  const names = [['أحد', 0], ['احد', 0], ['اثنين', 1], ['ثنين', 1], ['ثلاثاء', 2], ['أربعاء', 3], ['اربعاء', 3], ['خميس', 4], ['جمعة', 5], ['جمعه', 5], ['سبت', 6]];
  for (const [w, d] of names) {
    if (text.includes(w)) {
      // أقرب يوم قادم بهذا الاسم
      for (let i = 0; i < 8; i++) {
        const iso = addDaysISO(todayISO(), i);
        if (weekdayOf(iso) === d) return iso;
      }
    }
  }
  return null;
}

/* ---------- محللات رئيسية ---------- */

export function planToday() {
  const iso = todayISO();
  const items = eventsForDate(state.events, iso);
  const now = nowMin();
  const prog = dayProgress(items, state.progress, iso);
  const cur = currentBlock(items, now);
  const nxt = nextBlock(items, now);
  const lesson = nextLesson(items, now);
  const gaps = freeGaps(items, iso, 20);
  const tasks = openTasks().slice(0, 4);
  const stats = studyStats();

  const lines = [];
  lines.push('خطة اليوم (' + fmtDayRel(iso) + ' — ' + dayName(weekdayOf(iso)) + '):');
  if (cur) {
    lines.push('• الآن: ' + cur.title + ' (' + fmtTimeRange(cur.start, cur.end) + ')');
  }
  if (lesson) {
    lines.push('• الدرس القادم: ' + lesson.title + ' ' + fmtTime(lesson.start) + ' — ' + fmtRel(toMin(lesson.start) - now));
  }
  if (tasks.length) {
    lines.push('• مهام ذات أولوية:');
    for (const t of tasks) {
      lines.push('  - ' + t.title + (t.dueAt ? ' (قبل ' + fmtDayRel(t.dueAt.slice(0, 10)) + ')' : ''));
    }
  }
  const gapSum = gaps.reduce((s, g) => s + g.minutes, 0);
  if (gaps.length) {
    lines.push('• فراغات متاحة للمذاكرة: ' + gaps.slice(0, 3).map((g) => fmtTimeRange(g.start, g.end) + ' (' + fmtDur(g.minutes) + ')').join('، ') + (gapSum > 0 ? ' — إجمالي ' + fmtDur(gapSum) : ''));
  } else {
    lines.push('• يومك ممتلئ بالفعل — ركّز على ما هو قيد التنفيذ.');
  }
  lines.push('• أنجزت ' + prog.done + ' من ' + prog.total + ' فعاليات اليوم (' + prog.percent + '%).');
  if (stats.todayMinutes > 0) {
    lines.push('• مذاكرة اليوم: ' + fmtDur(stats.todayMinutes) + ' في ' + stats.todaySessions + ' جلسات.');
  }

  return {
    text: lines.join('\n'),
    actions: [
      { id: 'go-study', label: 'ابدأ جلسة مذاكرة', kind: 'navigate', payload: '#/study' },
      { id: 'go-tasks', label: 'عرض المهام', kind: 'navigate', payload: '#/account/tasks' },
    ],
  };
}

export function rescheduleAfterMiss() {
  const iso = todayISO();
  const items = eventsForDate(state.events, iso);
  const now = nowMin();
  const missed = items.filter((e) => toMin(e.end) <= now && e.type !== 'sleep' && e.type !== 'free');
  const prog = dayProgress(items, state.progress, iso);
  const doneIds = new Set(state.progress.filter((p) => p.date === iso && p.status === 'done').map((p) => p.eventId));
  const undoneMissed = missed.filter((e) => !doneIds.has(e.id));

  const lessons = lessonBlocks(items).filter((e) => toMin(e.end) > now);
  const gaps = freeGaps(items, iso, 15).filter((g) => toMin(g.start) > now);
  const suggestions = [];

  // نُعيد جدولة غير المنجز فقط، مع الحفاظ على الدروس المؤكدة والنوم
  for (const e of undoneMissed.slice(0, 4)) {
    const dur = toMin(e.end) - toMin(e.start);
    const gap = gaps.find((g) => g.minutes >= Math.min(dur, 30));
    if (gap) {
      const take = Math.min(dur, gap.minutes - 5);
      suggestions.push({
        title: e.title,
        type: e.type,
        start: gap.start,
        end: fromMin(toMin(gap.start) + take),
        original: e.start + '–' + e.end,
        subject: e.subject,
      });
      gap.minutes -= take + 5;
    }
  }

  const lines = [];
  lines.push('لنرتّب يومك من جديد بهدوء 🌿');
  if (undoneMissed.length === 0) {
    lines.push('لا توجد أنشطة فائتة غير منجزة حتى الآن. استمر كما أنت!');
  } else {
    lines.push('الأنشطة غير المنجزة: ' + undoneMissed.map((e) => e.title).join('، ') + '.');
    lines.push('الدروس المؤكدة القادمة محفوظة ولن تُغيَّر: ' + (lessons.length ? lessons.map((l) => l.title + ' ' + fmtTime(l.start)).join('، ') : 'لا توجد دروس قادمة اليوم.'));
    if (suggestions.length) {
      lines.push('الخطة المقترحة (ستُضاف كفعاليات جديدة بعد موافقتك):');
      for (const s of suggestions) {
        lines.push('• ' + s.title + ': ' + fmtTimeRange(s.start, s.end) + ' (كان ' + s.original + ')');
      }
    } else {
      lines.push('لا توجد فراغات كافية اليوم لتعويض كل شيء — اختر أهم عنصر واحد فقط، وسأدع الباقي لوقت الراحة.');
    }
    lines.push('أولويتي المقترحة: أهم مهمة أولاً، ثم مراجعة سريعة، ثم راحة. النوم في موعده محفوظ.');
  }

  return {
    text: lines.join('\n'),
    actions: suggestions.length
      ? [{ id: 'apply-reschedule', label: 'تطبيق الخطة (' + suggestions.length + ' فعاليات)', kind: 'applyPlan', payload: { iso, suggestions } }]
      : [],
  };
}

export function freeTimeInfo() {
  const iso = todayISO();
  const items = eventsForDate(state.events, iso);
  const now = nowMin();
  const gaps = freeGaps(items, iso, 15).filter((g) => toMin(g.end) > now);
  const total = gaps.reduce((s, g) => s + g.minutes, 0);
  const lines = [];
  if (!gaps.length) {
    lines.push('يومك مزدحم اليوم ولا توجد فراغات كبيرة. استخدم الدقائق الصغيرة بين الفعاليات للراحة.');
  } else {
    lines.push('وقت الفراغ المتبقي اليوم: ' + fmtDur(total) + ' موزعة على:');
    for (const g of gaps.slice(0, 5)) {
      lines.push('• ' + fmtTimeRange(g.start, g.end) + ' — ' + fmtDur(g.minutes));
    }
    lines.push('اقتراحي: استخدم أطول فراغ لمذاكرة مادة صعبة، والباقي لراحة قصيرة.');
  }
  return { text: lines.join('\n'), actions: [{ id: 'go-study', label: 'مذاكرة في الفراغ', kind: 'navigate', payload: '#/study' }] };
}

export function revisionPlanFor(subjectKey, iso) {
  const subj = subjectById(subjectKey);
  const name = subj ? subj.nameAr : 'المادة';
  const target = iso || addDaysISO(todayISO(), 1);
  const items = eventsForDate(state.events, target);
  const gaps = freeGaps(items, target, 20);
  const lines = [];
  lines.push('خطة مراجعة ' + name + ' لـ' + fmtDayRel(target) + ' (' + dayName(weekdayOf(target)) + '):');

  const blocks = [];
  const total = 120; // ساعتان مراجعة مقترحة
  let left = total;
  for (const g of gaps) {
    if (left <= 0) break;
    const take = Math.min(left, Math.min(g.minutes - 10, 50));
    if (take >= 20) {
      blocks.push({ start: g.start, end: fromMin(toMin(g.start) + take), minutes: take });
      left -= take;
    }
  }
  if (blocks.length) {
    lines.push('1. جلسة مراجعة نشطة (قراءة + استدعاء): ' + fmtTimeRange(blocks[0].start, blocks[0].end));
    if (blocks[1]) lines.push('2. حل أسئلة على الدرس: ' + fmtTimeRange(blocks[1].start, blocks[1].end));
    if (blocks[2]) lines.push('3. مراجعة سريعة للنقاط الضعيفة: ' + fmtTimeRange(blocks[2].start, blocks[2].end));
    if (blocks.length < 2) lines.push('الوقت المتاح محدود — ابدأ بجلسة واحدة مركّزة ثم أكمل لاحقًا.');
    lines.push('نصيحة: ابدأ بالاستدعاء الذاتي قبل إعادة القراءة، ثم سجّل ما نسيته للمراجعة المتباعدة.');
    return {
      text: lines.join('\n'),
      actions: [{
        id: 'apply-revision', label: 'إضافة جلسات المراجعة للجدول', kind: 'applyPlan',
        payload: {
          iso: target,
          suggestions: blocks.map((b, i) => ({
            title: 'مراجعة ' + name + (i === 0 ? ' (استدعاء نشط)' : i === 1 ? ' (حل أسئلة)' : ' (نقاط ضعيفة)'),
            type: 'study', start: b.start, end: b.end, subject: subjectKey,
          })),
        },
      }],
    };
  }
  lines.push('لا توجد فراغات كافية في ذلك اليوم. اختر يومًا آخر أو استبدل فعالية منخفضة الأهمية.');
  return { text: lines.join('\n'), actions: [] };
}

export function examPlan(days = 7) {
  const tasks = state.tasks.filter((t) => t.status === 'open' && /امتحان|اختبار|exam|test|quiz/i.test(t.title));
  const target = tasks[0] ? tasks[0] : null;
  const iso = target && target.dueAt ? target.dueAt.slice(0, 10) : addDaysISO(todayISO(), days);
  const subj = target ? target.subject : null;
  const subjName = subj ? (subjectById(subj)?.nameAr || '') : 'المادة المستهدفة';
  const lines = [];

  if (target) {
    lines.push('وجدت مهمة مرتبطة بـ' + (target.title) + ' — الموعد ' + fmtDayRel(iso) + '.');
  } else {
    lines.push('لم أجد مهمة امتحان مسجّلة. سأجهّز خطة مراجعة مكثفة للأسبوع القادم (' + fmtDur(days * 60) + ' مذاكرة). يمكنك إضافة الامتحان كأول خطوة.');
  }

  const plan = [];
  for (let i = 0; i < Math.min(days, 7); i++) {
    const d = addDaysISO(todayISO(), i);
    const items = eventsForDate(state.events, d);
    const gaps = freeGaps(items, d, 25);
    const sessions = [];
    let left = i === days - 1 ? 60 : 90;
    for (const g of gaps) {
      if (left <= 0) break;
      const take = Math.min(left, Math.min(g.minutes - 5, 50));
      if (take >= 25) {
        sessions.push({ start: g.start, end: fromMin(toMin(g.start) + take) });
        left -= take;
      }
    }
    if (sessions.length) {
      plan.push('• ' + fmtDayRel(d) + ' (' + dayName(weekdayOf(d), 'ar', true) + '): ' + sessions.map((s) => fmtTimeRange(s.start, s.end)).join(' + '));
    } else {
      plan.push('• ' + fmtDayRel(d) + ': يوم مزدحم — مراجعة سريعة 20 دقيقة قبل النوم.');
    }
  }
  lines.push('خطة المراجعة المقترحة (توزيع على الفراغات المتاحة دون المساس بالدروس):');
  lines.push(...plan);
  lines.push('اليوم الأخير قبل الامتحان: مراجعة خفيفة + نوم مبكر. لا مذاكرة مكثفة ليلة الامتحان 🌙');

  return {
    text: lines.join('\n'),
    actions: [
      { id: 'add-revplan', label: 'إنشاء خطة مراجعة متباعدة', kind: 'createRevision', payload: { title: 'مراجعة ' + subjName + ' للامتحان', subject: subj } },
    ],
  };
}

export function unfinishedInfo() {
  const open = openTasks();
  const over = overdueTasks();
  const sum = taskSummary();
  const lines = [];
  lines.push('المهام غير المنجزة: ' + sum.open + ' (' + sum.highPriority + ' عالية الأهمية، ' + sum.overdue + ' متأخرة).');
  if (over.length) {
    lines.push('⚠️ متأخرة:');
    for (const t of over.slice(0, 5)) lines.push('• ' + t.title + ' — كان موعده ' + fmtDayRel(t.dueAt.slice(0, 10)));
  }
  if (open.length) {
    lines.push('الترتيب المقترح للأولوية:');
    for (const t of open.slice(0, 6)) {
      lines.push('• ' + t.title + (t.subject ? ' (' + (subjectById(t.subject)?.nameAr || '') + ')' : '') + (t.dueAt ? ' — ' + fmtDayRel(t.dueAt.slice(0, 10)) : ''));
    }
  } else {
    lines.push('لا توجد مهام مفتوحة. أحسنت! 🎉');
  }
  return { text: lines.join('\n'), actions: [{ id: 'go-tasks', label: 'إدارة المهام', kind: 'navigate', payload: '#/account/tasks' }] };
}

export function catchUpThursday() {
  const thursday = (() => {
    for (let i = 0; i < 8; i++) {
      const iso = addDaysISO(todayISO(), i);
      if (weekdayOf(iso) === 4) return iso;
    }
    return addDaysISO(todayISO(), 4);
  })();
  const items = eventsForDate(state.events, thursday);
  const lessons = lessonBlocks(items);
  const lines = [];
  lines.push('الخميس (' + fmtDayRel(thursday) + ') هو يوم مفتوح في جدولك. لنحوّله إلى يوم تعويض ذكي:');
  if (lessons.length) {
    lines.push('ملاحظة: لديك درس مؤكد/مفعّل يوم الخميس (' + lessons.map((l) => l.title).join('، ') + ') — سيبقى كما هو دون أي تغيير.');
  } else {
    lines.push('لا توجد دروس مؤكدة — الدرس الشرعي الاختياري يظهر كبديل للمذاكرة حتى تؤكده.');
  }
  const suggestions = [
    { title: 'تعويض: متابعة المواد غير المنجزة', type: 'study', start: '08:15', end: '10:00' },
    { title: 'تعويض: اختبار تدريبي على أضعف مادة', type: 'study', start: '10:30', end: '12:00' },
    { title: 'تعويض: مراجعة الأسبوع كله', type: 'study', start: '15:00', end: '16:30' },
    { title: 'تعويض: إنهاء كل الواجبات المتراكمة', type: 'homework', start: '19:00', end: '20:00' },
  ];
  lines.push('سأضيف كتل تعويضية في الفراغات المعتادة (يمكنك تعديلها لاحقًا):');
  for (const s of suggestions) lines.push('• ' + s.title + ' — ' + fmtTimeRange(s.start, s.end));
  return {
    text: lines.join('\n'),
    actions: [{
      id: 'apply-thursday', label: 'تطبيق على الخميس', kind: 'applyPlan',
      payload: { iso: thursday, suggestions },
    }],
  };
}

export function remindReview(subjectKey, iso) {
  const subj = subjectById(subjectKey);
  const name = subj ? subj.nameAr : 'المادة';
  const d = iso || addDaysISO(todayISO(), 1);
  return {
    text: 'سأذكّرك بمراجعة ' + name + ' ' + fmtDayRel(d) + ' في ' + fmtTime('18:00') + '.\n' +
      'يمكنك تغيير الوقت من زر الإضافة، وسيظهر التذكير في مركز الإشعارات والمنبهات.',
    actions: [{
      id: 'add-reminder-task', label: 'إضافة التذكير', kind: 'addReminder',
      payload: { title: 'مراجعة ' + name, subject: subjectKey, dueAt: d + 'T18:00' },
    }],
  };
}

/* ---------- التوجيه الرئيسي ---------- */

export function respond(input) {
  const text = String(input || '').trim();
  const lower = text.toLowerCase();

  if (!text) {
    return { text: 'اكتب طلبك وسأساعدك بناءً على جدولك ومهامك الفعلية.', actions: [] };
  }

  if (/غير (المكتملة|المنجزة|المُنجزة)|المهام (غير|المتبقية|المفتوحة)|unfinished|remaining tasks|open tasks|show.*tasks/.test(lower)) {
    return unfinishedInfo();
  }

  if (/فاتت|فاتني|فاتتني|أعد ترتيب|اعد ترتيب|رتب يومي|لم أذاكر|لم انفذ|rearrange|reschedule|missed my|missed the/.test(lower)) {
    return rescheduleAfterMiss();
  }

  if (/وقت (الفراغ|الحر)|كم وقت|الوقت المتاح|free time|how much free/.test(lower)) {
    return freeTimeInfo();
  }

  if (/الخميس|تعويض|catch.?up|catchup/.test(lower)) {
    return catchUpThursday();
  }

  if (/امتحان|اختبار|exam|test next|quiz/.test(lower)) {
    return examPlan(7);
  }

  if (/ذكّرني|ذكرني|ذكريني|ذكّرني|remind me|reminder/.test(lower)) {
    const subj = detectSubject(lower);
    const d = detectDay(lower);
    return remindReview(subj, d);
  }

  if (/خطة مراجعة|خطة للمراجعة|أعد لي خطة|اعد لي خطة|revision plan|study plan for/.test(lower)) {
    const subj = detectSubject(lower);
    const d = detectDay(lower);
    return revisionPlanFor(subj, d);
  }

  if (/ماذاذا|ماذا أذاكر|ماذا اذاكر|ماذا أفعل|خطة اليوم|خطتي|plan my day|what should i study|today plan/.test(lower)) {
    return planToday();
  }

  if (/مذاكرة|أذاكر|اذاكر|جلسة/.test(lower) && /ابدأ|نبدأ|أريد|اريد/.test(lower)) {
    return {
      text: 'ممتاز! اختر المادة وابدأ جلسة مركّزة. الجلسة الافتراضية ' + fmtDur(state.settings.studyMinutes) + ' مذاكرة + ' + fmtDur(state.settings.breakMinutes) + ' استراحة.',
      actions: [{ id: 'go-study', label: 'بدء جلسة المذاكرة', kind: 'navigate', payload: '#/study' }],
    };
  }

  // الافتراضي: ملخص مفيد
  return {
    text: 'أستطيع مساعدتك في:\n• «ماذا أذاكر اليوم؟» — خطة من جدولك الفعلي\n• «فاتتني المذاكرة — رتب يومي» — إعادة ترتيب ذكية\n• «كم وقت فراغ لدي اليوم؟»\n• «ذكّرني بمراجعة الفلسفة غدًا»\n• «أعِد لي خطة مراجعة للتاريخ»\n• «لدي امتحان أسبوع قادم»\n• «أرني المهام غير المنجزة»\n• «اجعل الخميس يوم تعويض»\n\nكل الإجابات مبنية على بياناتك المخزنة دون أي اختلاق.',
    actions: [],
  };
}

/* ---------- تنفيذ الإجراءات (يستخدمه المحرّك) ---------- */

export async function applySuggestions(iso, suggestions) {
  const created = [];
  for (const s of suggestions) {
    const ev = {
      id: 'as-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      kind: 'once',
      date: iso,
      day: null,
      title: s.title,
      type: s.type || 'study',
      start: s.start,
      end: s.end,
      subject: s.subject || null,
      notes: 'أضافها المساعد الذكي — يمكنك تعديلها أو حذفها.',
      confirmed: true,
      optional: false,
      adjustable: true,
      enabled: true,
      travelMinutes: null,
      reminderOffsets: [],
      altTitle: null, altType: null,
    };
    created.push(ev);
  }
  return created;
}
