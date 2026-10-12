/* ============================================================
 * schedule.js — محرّك الجدول: بناء خط اليوم، الكشف عن التعارضات،
 * تذكيرات الدروس الذكية، الفراغات الحرة، وإحصاءات الإنجاز.
 * ============================================================ */

import {
  toMin, fromMin, weekdayOf, isoOf, combine, addMinutes, todayISO,
  overlapMinutes, spanMinutes, nowMin,
} from '../core/time.js';
import { fmtTime, fmtDur, dayName } from '../core/format.js';

/** أحداث يوم معيّن (أسبوعية + أحادية) مع دعم البديل للفعاليات الاختيارية */
export function eventsForDate(events, iso, { includeDisabled = false } = {}) {
  const day = weekdayOf(iso);
  const out = [];
  for (const e of events) {
    if (e.kind === 'weekly') {
      if (e.day !== day) continue;
      if (!e.enabled && !includeDisabled) {
        // فعالية اختيارية معطّلة → اعرض البديل إن وُجد
        if (e.optional && e.altTitle) {
          out.push({
            ...e,
            id: e.id + '#alt',
            originId: e.id,
            title: e.altTitle,
            type: e.altType || 'study',
            isAlt: true,
            optional: false,
          });
        }
        continue;
      }
      out.push({ ...e, date: iso });
    } else if (e.kind === 'once' && e.date === iso) {
      if (!e.enabled && !includeDisabled) continue;
      out.push({ ...e });
    }
  }
  return sortTimeline(out);
}

export function sortTimeline(items) {
  return [...items].sort((a, b) => toMin(a.start) - toMin(b.start) || toMin(a.end) - toMin(b.end));
}

/** الفعالية الجارية الآن */
export function currentBlock(items, minutes = nowMin()) {
  return items.find((e) => toMin(e.start) <= minutes && minutes < toMin(e.end)) || null;
}

/** الفعالية القادمة (تبدأ بعد الآن) */
export function nextBlock(items, minutes = nowMin()) {
  return items.find((e) => toMin(e.start) > minutes) || null;
}

/** آخر فعالية انتهت */
export function lastBlock(items, minutes = nowMin()) {
  let last = null;
  for (const e of items) {
    if (toMin(e.end) <= minutes) last = e;
  }
  return last;
}

export function lessonBlocks(items) {
  return items.filter((e) => e.type === 'lesson');
}

export function nextLesson(items, minutes = nowMin()) {
  return items.find((e) => e.type === 'lesson' && toMin(e.start) > minutes) || null;
}

/** كشف التعارضات بين فعاليات اليوم — لا نُزيح شيئًا بصمت أبدًا */
export function findConflicts(items) {
  const conflicts = [];
  const list = sortTimeline(items.filter((e) => e.enabled !== false));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const ov = overlapMinutes(toMin(a.start), toMin(a.end), toMin(b.start), toMin(b.end));
      if (ov > 0) {
        conflicts.push({
          a, b, minutes: ov,
          severity: (a.type === 'lesson' || b.type === 'lesson') ? 'high' : 'medium',
        });
      }
    }
  }
  return conflicts;
}

/** أزواج الدروس المتتالية (بدون فاصلة أو بفاصلة قصيرة) */
export function backToBackPairs(items, settings) {
  const lessons = lessonBlocks(sortTimeline(items));
  const pairs = [];
  for (let i = 0; i < lessons.length - 1; i++) {
    const a = lessons[i], b = lessons[i + 1];
    const gap = toMin(b.start) - toMin(a.end);
    if (gap <= (settings?.transitionMinutes ?? 0) || gap === 0) {
      pairs.push({ a, b, gap });
    }
  }
  return pairs;
}

/** فراغات حرة بين الفعاليات */
export function freeGaps(items, iso, minGap = 15) {
  const list = sortTimeline(items);
  const gaps = [];
  let cursor = 6 * 60; // من 6 صباحًا
  const endOfDay = 24 * 60;
  for (const e of list) {
    const s = toMin(e.start);
    if (s - cursor >= minGap) {
      gaps.push({ start: fromMin(cursor), end: fromMin(s), minutes: s - cursor, date: iso });
    }
    cursor = Math.max(cursor, toMin(e.end));
  }
  if (endOfDay - cursor >= minGap) {
    gaps.push({ start: fromMin(cursor), end: fromMin(endOfDay), minutes: endOfDay - cursor, date: iso });
  }
  return gaps;
}

export function totalFreeMinutes(items) {
  return freeGaps(items, null, 10).reduce((sum, g) => sum + g.minutes, 0);
}

/**
 * تذكيرات ذكية لكل درس:
 * - 60/30/15 دقيقة قبل + عند بداية الدرس
 * - تذكير السفر (قابل للتهيئة)
 * - منع التذكيرات المتناقضة أثناء درس سابق متصل/متداخل
 * المفتاح الموحّد يمنع التكرار: rem|{iso}|{eventId}|{offset}
 */
export function lessonReminders(lesson, iso, settings) {
  const startAt = combine(iso, lesson.start);
  const travel = lesson.travelMinutes ?? settings.lessonTravelMinutes ?? 45;
  const offsets = (lesson.reminderOffsets && lesson.reminderOffsets.length)
    ? lesson.reminderOffsets
    : (settings.reminderOffsets || [60, 30, 15, 0]);

  const texts = {
    60: (l) => 'جهّز كتبك ومستلزماتك — ' + l.title + ' بعد ساعة',
    30: (l) => 'ابدأ الاستعداد — ' + l.title + ' بعد 30 دقيقة',
    15: (l) => 'التحضير الأخير — ' + l.title + ' بعد 15 دقيقة',
    0: (l) => 'بدأ درس ' + l.title + ' الآن',
  };

  const reminders = [];
  for (const off of offsets) {
    const at = addMinutes(startAt, -off);
    const msg = texts[off] ? texts[off](lesson) : (lesson.title + ' بعد ' + fmtDur(off));
    reminders.push({
      key: 'rem|' + iso + '|' + lesson.id + '|' + off,
      at, offset: off, kind: off === 0 ? 'start' : 'prepare',
      title: 'تذكير درس: ' + lesson.title,
      body: msg,
      eventId: lesson.id,
    });
  }

  if (settings?.travelReminder !== false && travel > 0) {
    const at = addMinutes(startAt, -travel);
    reminders.push({
      key: 'rem|' + iso + '|' + lesson.id + '|travel' + travel,
      at, offset: travel, kind: 'travel',
      title: 'تذكير سفر: ' + lesson.title,
      body: 'وقت التوجّه نحو ' + lesson.title + ' — مدة الرحلة المقدّرة ' + fmtDur(travel) + '.',
      eventId: lesson.id,
    });
  }

  return reminders;
}

/** كل تذكيرات يوم معيّن، مع منع التناقض أثناء درس جارٍ */
export function dayReminders(items, iso, settings) {
  const lessons = lessonBlocks(items);
  const out = [];
  for (const lesson of lessons) {
    if (lesson.optional && lesson.confirmed === false) continue; // لا تذكيرات لدرس غير مؤكد
    let rems = lessonReminders(lesson, iso, settings);

    // إسقاط التذكيرات التي تقع داخل درس آخر (تجنّب التذكيرات المتناقضة)
    rems = rems.filter((r) => {
      if (r.kind === 'start') return true;
      const m = r.at.getHours() * 60 + r.at.getMinutes();
      return !lessons.some((other) =>
        other.id !== lesson.id &&
        toMin(other.start) <= m && m < toMin(other.end)
      );
    });

    // درس متصل بآخر: تذكير واحد واضح قبل 5 دقائق من نهاية الدرس السابق
    for (const prev of lessons) {
      if (prev.id === lesson.id) continue;
      const gap = toMin(lesson.start) - toMin(prev.end);
      if (gap >= 0 && gap <= (settings?.transitionMinutes ?? 0) + 5) {
        rems.push({
          key: 'rem|' + iso + '|' + lesson.id + '|linked',
          at: addMinutes(combine(iso, prev.end), -5),
          offset: 5, kind: 'linked',
          title: 'الدرس القادم متصل: ' + lesson.title,
          body: 'ينتهي ' + prev.title + ' ويبدأ ' + lesson.title + ' مباشرة (' + fmtTime(lesson.start) + ') — تابع بتركيز.',
          eventId: lesson.id,
        });
      }
    }
    out.push(...rems);
  }
  return out.sort((x, y) => x.at - y.at);
}

/** إحصاء إنجاز اليوم */
export function dayProgress(items, progressList, iso) {
  const trackable = items.filter((e) => !e.isAlt && e.type !== 'sleep' && e.type !== 'free');
  const map = new Map(progressList.filter((p) => p.date === iso).map((p) => [p.eventId, p.status]));
  let done = 0, skipped = 0, postponed = 0;
  for (const e of trackable) {
    const st = map.get(e.id);
    if (st === 'done') done++;
    else if (st === 'skipped') skipped++;
    else if (st === 'postponed') postponed++;
  }
  return {
    total: trackable.length,
    done, skipped, postponed,
    remaining: trackable.length - done - skipped,
    percent: trackable.length ? Math.round((done / trackable.length) * 100) : 0,
  };
}

export function statusOf(progressList, iso, eventId) {
  const p = progressList.find((x) => x.date === iso && x.eventId === eventId);
  return p ? p.status : null;
}

/** تقييم عبء اليوم مقارنة بساعات اليقظة والراحة */
export function workloadReport(items, settings) {
  const busy = items
    .filter((e) => e.type !== 'sleep' && e.type !== 'free')
    .reduce((s, e) => s + spanMinutes(e.start, e.end), 0);
  const sleepBlocks = items.filter((e) => e.type === 'sleep');
  const sleepMin = sleepBlocks.reduce((s, e) => s + spanMinutes(e.start, e.end), 0);
  const warnings = [];
  const recommended = 8 * 60;
  if (sleepMin > 0 && sleepMin < recommended - 30) {
    warnings.push('وقت النوم المخطط أقل من 8 ساعات (' + fmtDur(sleepMin) + '). حاول تخفيف الأعباء أو تقديم موعد النوم.');
  }
  if (busy > 12 * 60) {
    warnings.push('يوم مزدحم جدًا: ' + fmtDur(busy) + ' من الأنشطة. راجع أولوياتك.');
  }
  return { busyMinutes: busy, sleepMinutes: sleepMin, warnings };
}

/** اسم اليوم المختصر لليوم الحالي */
export function todayName() {
  return dayName(weekdayOf(todayISO()));
}

/** تطبيق تأجيلات الطالب على خط اليوم (لا يُغيَّر الأصل — يُضاف تجاوز مؤقت) */
export function applyOverrides(items, progressList, iso) {
  return items.map((e) => {
    const p = progressList.find((x) => x.date === iso && x.eventId === e.id && x.kind === 'override');
    return p ? { ...e, start: p.newStart, end: p.newEnd, postponedFrom: p.oldStart } : e;
  }).sort((a, b) => toMin(a.start) - toMin(b.start));
}
