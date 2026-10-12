/* ============================================================
 * home.js — لوحة اليوم الذكية: ماذا أفعل الآن؟ ما القادم؟
 * ============================================================ */

import { esc, openModal, confirmDialog, collectForm, toast, selectField, field, qsa } from '../dom.js';
import {
  progressRing, timelineItem, daySelector, notice, sectionHeader,
  statBox, taskRow, typeIcon, typeLabel,
} from '../components.js';
import { state, putItem, pushNotification } from '../../core/store.js';
import {
  eventsForDate, currentBlock, nextBlock, nextLesson, dayProgress,
  findConflicts, statusOf, applyOverrides, workloadReport, freeGaps,
} from '../../features/schedule.js';
import { todayISO, nowMin, toMin, fromMin, addMinutes, weekdayOf } from '../../core/time.js';
import {
  fmtTime, fmtTimeRange, fmtDur, fmtRel, fmtDayRel, dayName, fmtDate, fmtSmartCountdown,
} from '../../core/format.js';
import { openTasks, overdueTasks, tasksDueOn, completeTask, createTask, saveTask } from '../../features/tasks.js';
import { revisionDueOn, missedRevisions } from '../../features/tasks.js';
import { nextAlarm } from '../../features/alarms.js';
import { studyStats } from '../../features/study.js';
import { habitsSummary } from '../../features/habits.js';
import { navigate } from '../router.js';

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'صباح الخير';
  if (h >= 12 && h < 17) return 'نهارك سعيد';
  if (h >= 17 && h < 23) return 'مساء الخير';
  return 'مساء الخير';
}

function progressRecord(iso, eventId, status, extra = {}) {
  return {
    id: 'pr|' + iso + '|' + eventId,
    date: iso,
    eventId,
    status,
    kind: 'event',
    updatedAt: Date.now(),
    ...extra,
  };
}

export async function setEventStatus(iso, eventId, status, extra = {}) {
  await putItem('progress', progressRecord(iso, eventId, status, extra));
}

export function renderHome() {
  const iso = todayISO();
  const now = nowMin();
  const rawItems = eventsForDate(state.events, iso);
  const items = applyOverrides(rawItems, state.progress, iso);
  const prog = dayProgress(items, state.progress, iso);
  const cur = currentBlock(items, now);
  const nxt = nextBlock(items, now);
  const lesson = nextLesson(items, now);
  const conflicts = findConflicts(items);
  const conflictIds = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]));
  const tasks = openTasks();
  const dueToday = tasksDueOn(iso);
  const over = overdueTasks();
  const revs = revisionDueOn(iso);
  const missedRev = missedRevisions();
  const stats = studyStats();
  const habits = habitsSummary();
  const alarm = nextAlarm(state.alarms);
  const name = state.settings.profile?.name || 'الطالب';
  const work = workloadReport(items, state.settings);

  const countdownTarget = nxt || null;
  const countdownMins = countdownTarget ? toMin(countdownTarget.start) - now : 0;

  return {
    html: `
      <!-- التحية -->
      <div class="hero-greeting">
        <h1>${greeting()}، ${esc(name)} 👋</h1>
        <div class="hero-date">${fmtDate(iso)} — ${fmtDayRel(iso)}</div>
        <div class="hero-clock" data-live="clock">${fmtTime(fromMin(now))}</div>
      </div>

      <!-- الفعالية القادمة -->
      ${countdownTarget ? `
        <div class="countdown-card">
          <div class="countdown-main">
            <div class="eyebrow">${cur ? 'بعد الفعالية الحالية — القادم:' : 'الفعالية القادمة'}</div>
            <h2>${typeIcon(countdownTarget.type)} ${esc(countdownTarget.title)}</h2>
            <div class="sub">${fmtTimeRange(countdownTarget.start, countdownTarget.end)} • ${typeLabel(countdownTarget.type)}</div>
          </div>
          <div class="countdown-value">
            <b data-live="countdown" data-target="${countdownTarget.start}">${fmtSmartCountdown(countdownMins)}</b>
            <small>حتى البدء</small>
          </div>
        </div>` : `
        <div class="countdown-card">
          <div class="countdown-main">
            <div class="eyebrow">انتهى جدول اليوم</div>
            <h2>🌙 وقت الراحة</h2>
            <div class="sub">لا توجد فعاليات متبقية اليوم — استمتع بوقتك.</div>
          </div>
        </div>`}

      <!-- ماذا أفعل الآن -->
      <div class="card pad-lg">
        <div class="card-title-row">
          <h2>ماذا أفعل الآن؟</h2>
          ${cur ? '<span class="chip chip-brand">جارٍ الآن</span>' : '<span class="chip chip-neutral">فترة مفتوحة</span>'}
        </div>
        ${cur ? `
          <h3 style="margin-bottom:2px">${typeIcon(cur.type)} ${esc(cur.title)}</h3>
          <p class="muted small" style="margin-bottom:10px">${fmtTimeRange(cur.start, cur.end)} — متبقٍ ${fmtDur(toMin(cur.end) - now)}${cur.notes ? ' • ' + esc(cur.notes) : ''}</p>
          <div class="btn-row">
            <button class="btn btn-success" data-act="mark" data-id="${esc(cur.id)}" data-status="done">✓ تم</button>
            <button class="btn btn-ghost" data-act="mark" data-id="${esc(cur.id)}" data-status="skipped">تخطي</button>
            <button class="btn btn-ghost" data-act="postpone" data-id="${esc(cur.id)}">تأجيل</button>
          </div>`
        : nxt ? `
          <p class="muted small">لا توجد فعالية جارية الآن. القادمة: <strong>${esc(nxt.title)}</strong> في ${fmtTime(nxt.start)} (${fmtRel(toMin(nxt.start) - now)}).</p>
          <div class="btn-row">
            <button class="btn btn-primary" data-act="start-study">📚 ابدأ جلسة مذاكرة</button>
            <button class="btn btn-ghost" data-act="add-task">📝 أضف مهمة</button>
          </div>`
        : `
          <p class="muted small">يومك حر الآن.</p>
          <div class="btn-row">
            <button class="btn btn-primary" data-act="start-study">📚 ابدأ جلسة مذاكرة</button>
            <button class="btn btn-ghost" data-act="assistant">🤖 اسأل المساعد</button>
          </div>`}
      </div>

      ${conflicts.length ? notice('danger', '<strong>تعارض في جدول اليوم:</strong> ' + conflicts.map((c) => esc(c.a.title) + ' ↔ ' + esc(c.b.title) + ' (' + c.minutes + ' دقيقة)').join('، ') + ' — <a href="#/schedule" data-act="nav" data-href="#/schedule">راجع الجدول</a>') : ''}
      ${over.length ? notice('warn', '<strong>' + over.length + ' مهمة متأخرة.</strong> راجعها لتلحق بمواعيدها. — <a href="#/account/tasks" data-act="nav" data-href="#/account/tasks">عرض المهام</a>') : ''}
      ${work.warnings.length ? notice('warn', work.warnings.map(esc).join('<br>')) : ''}

      <!-- الإجراءات السريعة -->
      <div class="quick-grid">
        <button class="quick-action" data-act="start-study">
          <svg viewBox="0 0 24 24" class="ic"><path d="M12 3L1 8l11 5 9-4.1V16h2V8L12 3zM5 12.5V16c0 1.7 3.1 3.5 7 3.5s7-1.8 7-3.5v-3.5l-7 3.2-7-3.2z"/></svg>
          ابدأ المذاكرة
        </button>
        <button class="quick-action" data-act="add-task">
          <svg viewBox="0 0 24 24" class="ic"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          أضف مهمة
        </button>
        <button class="quick-action" data-act="nav" data-href="#/schedule">
          <svg viewBox="0 0 24 24" class="ic"><path d="M7 2v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2V2h-2v2H9V2H7zm12 8v10H5V10h14z"/></svg>
          الجدول الأسبوعي
        </button>
        <button class="quick-action" data-act="assistant">
          <svg viewBox="0 0 24 24" class="ic"><path d="M12 3l1.6 4.2L18 8.8l-4.4 1.6L12 15l-1.6-4.6L6 8.8l4.4-1.6L12 3z"/></svg>
          المساعد الذكي
        </button>
      </div>

      <!-- التقدم اليومي -->
      <div class="card pad-lg">
        <div class="card-title-row"><h2>إنجاز اليوم</h2><a class="link small" href="#/schedule">التفاصيل</a></div>
        <div class="ring-wrap">
          ${progressRing(prog.percent, { label: 'منجز' })}
          <div style="flex:1">
            <div class="stat-grid">
              ${statBox(prog.done + '/' + prog.total, 'فعاليات مكتملة')}
              ${statBox(fmtDur(stats.todayMinutes), 'مذاكرة اليوم')}
              ${statBox(habits.done + '/' + habits.total, 'عادات اليوم')}
            </div>
            ${prog.postponed ? `<p class="small muted mt-1">مؤجّلة: ${prog.postponed} — يمكنك إنجازها لاحقًا دون ضغط 🌿</p>` : ''}
          </div>
        </div>
      </div>

      <!-- الدرس القادم والمنبه -->
      <div class="card">
        <div class="card-title-row"><h2>الدرس القادم</h2></div>
        ${lesson ? `
          <div class="row" style="align-items:flex-start">
            <div style="flex:1">
              <h3 style="margin-bottom:2px">🕌 ${esc(lesson.title)}</h3>
              <div class="muted small">${fmtTimeRange(lesson.start, lesson.end)} • ${fmtRel(toMin(lesson.start) - now)}</div>
              ${lesson.notes ? `<div class="small muted mt-1">${esc(lesson.notes)}</div>` : ''}
            </div>
          </div>`
        : `<p class="muted small mb-0">لا توجد دروس أخرى اليوم.</p>`}
      </div>

      <div class="card">
        <div class="card-title-row"><h2>المنبه القادم</h2><a class="link small" href="#/alarms">كل المنبهات</a></div>
        ${alarm ? `
          <div class="row">
            <div class="alarm-time-big" style="font-size:1.25rem">${esc(fmtTime(alarm.alarm.time).split(' ')[0])}<small>${esc(fmtTime(alarm.alarm.time).split(' ').slice(1).join(' '))}</small></div>
            <div style="flex:1">
              <strong>${esc(alarm.alarm.title)}</strong>
              <div class="muted small">${fmtRel(Math.round((alarm.at - new Date()) / 60000))} — ${fmtDayRel(isoOfDate(alarm.at))}</div>
            </div>
          </div>`
        : `<p class="muted small mb-0">لا توجد منبهات مفعّلة. <a href="#/alarms">فعّل منبهًا</a></p>`}
      </div>

      <!-- مهام اليوم -->
      ${sectionHeader('مهام اليوم', '<a class="link small" href="#/account/tasks">كل المهام</a>')}
      ${(dueToday.length || over.length) ? `
        ${over.slice(0, 2).map((t) => taskRow(t, { subjectName: subjectLabel(t.subject) })).join('')}
        ${dueToday.slice(0, 4).map((t) => taskRow(t, { subjectName: subjectLabel(t.subject) })).join('')}
      ` : `
        <div class="card"><p class="muted small mb-0">لا توجد مهام مستحقة اليوم. أضف مهمة لتبقى منظمًا ✨</p></div>
      `}

      ${revs.length ? `
        <div class="card">
          <div class="card-title-row"><h2>مراجعات اليوم</h2><span class="chip chip-amber">${revs.length}</span></div>
          ${revs.slice(0, 3).map((r) => `<div class="row-between small" style="padding:4px 0"><span>🔁 ${esc(r.title)}</span><button class="btn btn-sm btn-soft" data-act="rev-done" data-id="${esc(r.id)}">تمت المراجعة</button></div>`).join('')}
        </div>` : ''}
      ${missedRev.length ? notice('warn', 'لديك ' + missedRev.length + ' مراجعة متأخرة. سأقترح أوقاتًا بديلة دون المساس بالدروس — <a href="#/account/tasks" data-act="nav" data-href="#/account/tasks">التفاصيل</a>') : ''}

      <!-- خط اليوم -->
      ${sectionHeader('خط اليوم', '<span class="small muted">' + esc(dayName(weekdayOf(iso))) + '</span>')}
      <div class="timeline">
        ${items.map((e) => timelineItem(e, {
          iso,
          status: statusOf(state.progress, iso, e.id),
          conflict: conflictIds.has(e.id),
          conflicts: conflictIds,
        })).join('')}
      </div>
    `,
    onMount(root) {
      wireHome(root);
    },
  };
}

function subjectLabel(id) {
  if (!id) return '';
  return state.subjects.find((s) => s.id === id)?.nameAr || '';
}

function isoOfDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function wireHome(root) {
  const iso = todayISO();

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'nav') { navigate(btn.dataset.href); return; }
    if (act === 'start-study') { navigate('#/study'); return; }
    if (act === 'assistant') { navigate('#/assistant'); return; }

    if (act === 'mark') {
      const status = btn.dataset.status;
      await setEventStatus(iso, btn.dataset.id, status);
      toast(status === 'done' ? 'أحسنت! تم تسجيل الإنجاز ✓' : 'تم التخطي — لا بأس 🌿', status === 'done' ? 'ok' : '');
      return;
    }

    if (act === 'postpone') {
      openModal({
        title: 'تأجيل النشاط',
        bodyHTML: `
          <p class="muted small">كم دقيقة تريد التأجيل؟ سيُنقل النشاط في خط اليوم دون المساس ببقية الجدول.</p>
          <div class="btn-row">
            <button class="btn btn-soft" data-min="15">15 دقيقة</button>
            <button class="btn btn-soft" data-min="30">30 دقيقة</button>
            <button class="btn btn-soft" data-min="60">ساعة</button>
          </div>`,
        onMount(mroot, close) {
          mroot.addEventListener('click', async (ev2) => {
            const b = ev2.target.closest('[data-min]');
            if (!b) return;
            const mins = parseInt(b.dataset.min, 10);
            const all = applyOverrides(eventsForDate(state.events, iso), state.progress, iso);
            const item = all.find((x) => x.id === btn.dataset.id || x.originId === btn.dataset.id);
            if (item) {
              await putItem('progress', {
                id: 'pr|' + iso + '|' + btn.dataset.id,
                date: iso, eventId: btn.dataset.id, status: 'postponed', kind: 'event',
                updatedAt: Date.now(),
              });
              await putItem('progress', {
                id: 'ov|' + iso + '|' + btn.dataset.id,
                date: iso, eventId: btn.dataset.id, kind: 'override',
                oldStart: item.start,
                newStart: fromMin(toMin(item.start) + mins),
                newEnd: fromMin(toMin(item.end) + mins),
              });
              toast('تم التأجيل ' + mins + ' دقيقة ⏰', 'ok');
            }
            close();
          });
        },
      });
      return;
    }

    if (act === 'add-task') {
      openTaskModal();
      return;
    }

    if (act === 'rev-done') {
      const { markRevisionDone } = await import('../../features/tasks.js');
      await markRevisionDone(btn.dataset.id);
      toast('تمت المراجعة ✓', 'ok');
      return;
    }

    if (act === 'event-details') {
      const { openEventDetails } = await import('./schedule.js');
      openEventDetails(btn.dataset.id, iso);
      return;
    }

    if (act === 'toggle-task') {
      const t = state.tasks.find((x) => x.id === btn.dataset.id);
      if (!t) return;
      if (t.status === 'done') {
        const { reopenTask } = await import('../../features/tasks.js');
        await reopenTask(t.id);
      } else {
        await completeTask(t.id);
        toast('أحسنت! مهمة منجزة 🎉', 'ok');
      }
      return;
    }

    if (act === 'edit-task') {
      const { openTaskModal } = await import('./account.js');
      openTaskModal(btn.dataset.id);
    }
  });
}

/* ---------- نافذة إضافة مهمة سريعة ---------- */

export function openTaskModal(prefillSubject = null) {
  const subjects = state.subjects.filter((s) => !s.archived).map((s) => ({ value: s.id, label: s.nameAr }));
  openModal({
    title: 'إضافة مهمة',
    bodyHTML: `
      <form id="quick-task-form">
        ${field('title', 'عنوان المهمة', '', { required: true })}
        ${selectField('subject', 'المادة', [{ value: '', label: 'بدون مادة' }, ...subjects], prefillSubject || '')}
        <div class="field-row">
          ${field('dueDate', 'تاريخ الاستحقاق', todayISO(), { type: 'date' })}
          ${field('dueTime', 'الوقت', '18:00', { type: 'time' })}
        </div>
        <div class="field-row">
          ${selectField('priority', 'الأولوية', [
            { value: 'high', label: 'عالية' },
            { value: 'medium', label: 'متوسطة' },
            { value: 'low', label: 'منخفضة' },
          ], 'medium')}
          ${field('estimatedMinutes', 'المدة المتوقعة (دقيقة)', '30', { type: 'number', attrs: 'min="5" step="5"' })}
        </div>
      </form>`,
    actionsHTML: `<button class="btn btn-primary" data-save>حفظ</button>`,
    onMount(mroot, close) {
      mroot.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-save]')) return;
        const form = mroot.querySelector('#quick-task-form');
        const v = collectForm(form);
        if (!v.title.trim()) { toast('اكتب عنوان المهمة', 'err'); return; }
        const task = createTask({
          title: v.title.trim(),
          subject: v.subject || null,
          dueAt: v.dueDate ? v.dueDate + 'T' + (v.dueTime || '18:00') : null,
          estimatedMinutes: parseInt(v.estimatedMinutes, 10) || 30,
          priority: v.priority,
        });
        await saveTask(task);
        close();
        toast('أُضيفت المهمة ✓', 'ok');
      });
    },
  });
}
