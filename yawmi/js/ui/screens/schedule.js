/* ============================================================
 * schedule.js (screen) — الجدول الأسبوعي التفاعلي
 * يوم محدد + نظرة أسبوعية، تعارضات، إضافة/تعديل/تكرار/نقل/حذف
 * ============================================================ */

import {
  esc, openModal, confirmDialog, collectForm, toast, field, selectField,
  textareaField, toggleRow, qsa,
} from '../dom.js';
import {
  timelineItem, daySelector, notice, sectionHeader, typeLabel, typeIcon,
} from '../components.js';
import { state, putItem, deleteItem, newId } from '../../core/store.js';
import {
  eventsForDate, findConflicts, statusOf, applyOverrides, backToBackPairs,
  dayProgress,
} from '../../features/schedule.js';
import { toMin, fromMin, todayISO, weekdayOf, addDaysISO, spanMinutes, isValidSpan } from '../../core/time.js';
import { fmtTimeRange, fmtTime, fmtDur, dayName, fmtDayRel, fmtDate } from '../../core/format.js';
import { EVENT_TYPES } from '../../data/defaults.js';
import { setEventStatus } from './home.js';

let selectedISO = todayISO();
let viewMode = 'day'; // day | week
let filterText = '';
let filterType = 'all';

export function renderSchedule() {
  const iso = selectedISO;
  const raw = eventsForDate(state.events, iso, { includeDisabled: true });
  const items = applyOverrides(eventsForDate(state.events, iso), state.progress, iso);
  const conflicts = findConflicts(items);
  const conflictIds = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]));
  const pairs = backToBackPairs(items, state.settings);
  const prog = dayProgress(items, state.progress, iso);

  let filtered = items;
  if (filterType !== 'all') filtered = filtered.filter((e) => e.type === filterType);
  if (filterText.trim()) {
    const q = filterText.trim();
    filtered = filtered.filter((e) =>
      e.title.includes(q) || (e.notes || '').includes(q) ||
      (e.subject && (state.subjects.find((s) => s.id === e.subject)?.nameAr || '').includes(q))
    );
  }

  const disabled = raw.filter((e) => e.enabled === false && !e.isAlt);

  return {
    html: `
      <div class="row-between" style="margin-bottom:10px">
        <h1 style="margin:0">الجدول الأسبوعي</h1>
        <button class="btn btn-primary btn-sm" data-act="add-event">+ فعالية</button>
      </div>

      <div class="segmented" style="margin-bottom:12px">
        <button class="${viewMode === 'day' ? 'active' : ''}" data-act="view" data-mode="day">يوم</button>
        <button class="${viewMode === 'week' ? 'active' : ''}" data-act="view" data-mode="week">نظرة أسبوعية</button>
      </div>

      ${viewMode === 'day' ? `
        ${daySelector(iso)}

        <div class="row" style="margin-bottom:10px">
          <input class="input" id="schedule-search" placeholder="بحث في الفعاليات…" value="${esc(filterText)}" style="flex:1">
          <select class="select" id="schedule-filter" style="width:130px">
            <option value="all">كل الأنواع</option>
            ${Object.entries(EVENT_TYPES).map(([k, v]) => `<option value="${k}" ${filterType === k ? 'selected' : ''}>${v.ar}</option>`).join('')}
          </select>
        </div>

        ${conflicts.length ? notice('danger', '<strong>تعارضات:</strong> ' + conflicts.map((c) => esc(c.a.title) + ' ↔ ' + esc(c.b.title) + ' (' + c.minutes + ' د)').join('، ') + '. الحل يعود لك — لن نغيّر مواعيدك بصمت.') : ''}
        ${pairs.length ? notice('info', pairs.map((p) => '<strong>' + esc(p.b.title) + '</strong> يبدأ مباشرة بعد ' + esc(p.a.title) + (p.gap === 0 ? ' (بدون فاصلة زمنية)' : ' (فاصلة ' + p.gap + ' دقيقة)')).join('<br>') + '<br>يمكنك ضبط «وقت التنقل» من الإعدادات.') : ''}

        <div class="row-between small muted" style="margin:4px 2px 10px">
          <span>${fmtDate(iso)} — ${fmtDayRel(iso)}</span>
          <span>إنجاز اليوم: ${prog.done}/${prog.total}</span>
        </div>

        <div class="timeline">
          ${filtered.length ? filtered.map((e) => timelineItem(e, {
            iso,
            status: statusOf(state.progress, iso, e.id),
            conflicts: conflictIds,
          })).join('') : `<div class="card"><p class="muted mb-0">لا توجد فعاليات مطابقة.</p></div>`}
        </div>

        ${disabled.length ? `
          ${sectionHeader('فعاليات معطّلة / غير مؤكدة')}
          ${disabled.map((e) => `
            <div class="card" style="opacity:.65">
              <div class="row-between">
                <div>
                  <h4 style="margin:0">${typeIcon(e.type)} ${esc(e.title)}</h4>
                  <div class="small muted">${fmtTimeRange(e.start, e.end)}${e.optional ? ' • اختياري — غير مؤكد' : ''}</div>
                </div>
                <button class="btn btn-sm btn-soft" data-act="enable-event" data-id="${esc(e.id)}">تفعيل</button>
              </div>
            </div>`).join('')}
        ` : ''}
      ` : `
        ${renderWeekOverview()}
      `}

      ${filterType !== 'all' || filterText ? `<button class="btn btn-ghost btn-block mt-1" data-act="clear-filter">مسح الفلاتر</button>` : ''}
    `,
    onMount(root) {
      wireSchedule(root);
    },
  };
}

function renderWeekOverview() {
  const order = [6, 0, 1, 2, 3, 4, 5];
  const today = todayISO();
  return `
    ${order.map((d) => {
      const iso = isoOfWeekday(d, weekdayOf(selectedISO), selectedISO);
      const items = eventsForDate(state.events, iso);
      const lessons = items.filter((e) => e.type === 'lesson');
      const isToday = iso === today;
      return `
        <div class="card ${isToday ? '' : ''}" style="${isToday ? 'border-color:var(--brand)' : ''}">
          <div class="card-title-row">
            <h3>${dayName(d)} ${isToday ? '<span class="chip chip-brand">اليوم</span>' : ''} <span class="muted small">${iso.slice(8)}/${iso.slice(5, 7)}</span></h3>
            <button class="btn btn-sm btn-ghost" data-act="select-day" data-iso="${iso}" data-goto="day">اليوم الكامل</button>
          </div>
          <div class="small muted" style="margin-bottom:6px">${items.length} فعالية • ${lessons.length} دروس</div>
          ${lessons.length
            ? lessons.map((l) => `<div class="row-between small" style="padding:3px 0"><span>🕌 ${esc(l.title)}</span><span class="muted ltr">${fmtTime(l.start)}</span></div>`).join('')
            : '<div class="small muted">لا دروس — يوم مذاكرة مفتوح</div>'}
          <details style="margin-top:8px">
            <summary class="small" style="cursor:pointer">كل الفعاليات (${items.length})</summary>
            <div class="mt-1">
              ${items.map((e) => `<div class="row-between small" style="padding:2px 0"><span>${typeIcon(e.type)} ${esc(e.title)}</span><span class="muted ltr xsmall">${e.start}–${e.end}</span></div>`).join('')}
            </div>
          </details>
        </div>`;
    }).join('')}
  `;
}

function isoOfWeekday(targetDay, currentDay, baseISO) {
  let diff = (targetDay - currentDay + 7) % 7;
  if (diff > 3) diff -= 7;
  return addDaysISO(baseISO, diff);
}

function wireSchedule(root) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'view') {
      viewMode = btn.dataset.mode;
      renderNowSafe();
      return;
    }
    if (act === 'select-day') {
      selectedISO = btn.dataset.iso;
      if (btn.dataset.goto === 'day') viewMode = 'day';
      renderNowSafe();
      return;
    }
    if (act === 'clear-filter') {
      filterText = ''; filterType = 'all';
      renderNowSafe();
      return;
    }
    if (act === 'add-event') {
      openEventModal(null, selectedISO);
      return;
    }
    if (act === 'event-details') {
      openEventDetails(btn.dataset.id, selectedISO);
      return;
    }
    if (act === 'enable-event') {
      const ev = state.events.find((x) => x.id === btn.dataset.id);
      if (ev) {
        if (ev.optional && !ev.confirmed) {
          const ok = await confirmDialog({
            title: 'تأكيد الدرس الاختياري',
            message: 'هذا الدرس اختياري. بتفعيله ستؤكده كموعد حقيقي في جدولك. هل أنت متأكد؟',
            okText: 'نعم، فعّله',
          });
          if (!ok) return;
          await putItem('events', { ...ev, enabled: true, confirmed: true });
        } else {
          await putItem('events', { ...ev, enabled: true });
        }
        toast('تم التفعيل ✓', 'ok');
      }
      return;
    }
  });

  const search = root.querySelector('#schedule-search');
  if (search) {
    search.addEventListener('input', () => {
      filterText = search.value;
      clearTimeout(search._t);
      search._t = setTimeout(() => {
        const pos = search.selectionStart;
        renderNowSafe();
        const el = document.querySelector('#schedule-search');
        if (el) { el.focus(); el.setSelectionRange(pos, pos); }
      }, 350);
    });
  }
  const filter = root.querySelector('#schedule-filter');
  if (filter) {
    filter.addEventListener('change', () => {
      filterType = filter.value;
      renderNowSafe();
    });
  }
}

function renderNowSafe() {
  import('../router.js').then((r) => r.requestRender());
}

/* ---------- تفاصيل الفعالية ---------- */

export function openEventDetails(id, iso) {
  const cleanId = id.replace('#alt', '');
  const ev = state.events.find((x) => x.id === cleanId);
  if (!ev) return;
  const item = applyOverrides(eventsForDate(state.events, iso), state.progress, iso).find((x) => x.id === id || x.originId === cleanId) || ev;
  const status = statusOf(state.progress, iso, ev.id);
  const subj = ev.subject ? state.subjects.find((s) => s.id === ev.subject) : null;

  openModal({
    title: ev.title,
    bodyHTML: `
      <div class="row wrap" style="margin-bottom:10px">
        <span class="chip chip-brand">${typeLabel(ev.type)}</span>
        ${ev.optional ? `<span class="chip ${ev.confirmed ? 'chip-green' : 'chip-amber'}">${ev.confirmed ? 'مؤكد' : 'غير مؤكد — اختياري'}</span>` : ''}
        ${ev.kind === 'weekly' ? '<span class="chip chip-purple">يتكرر أسبوعيًا</span>' : '<span class="chip chip-neutral">مرة واحدة</span>'}
        ${ev.adjustable ? '<span class="chip chip-blue">قابل للتعديل</span>' : ''}
        ${status ? `<span class="chip ${status === 'done' ? 'chip-green' : 'chip-amber'}">${status === 'done' ? 'منجز' : status === 'skipped' ? 'تخطي' : 'مؤجّل'}</span>` : ''}
        ${item.postponedFrom ? `<span class="chip chip-amber">مُرحَّل من ${esc(item.postponedFrom)}</span>` : ''}
      </div>
      <p><strong>الوقت:</strong> ${fmtTimeRange(item.start, item.end)} <span class="muted">(${fmtDur(spanMinutes(item.start, item.end))})</span></p>
      ${subj ? `<p><strong>المادة:</strong> ${subj.icon} ${esc(subj.nameAr)}</p>` : ''}
      ${ev.travelMinutes ? `<p><strong>مدة السفر المقدّرة:</strong> ${fmtDur(ev.travelMinutes)} قبل الدرس</p>` : ''}
      ${ev.notes ? `<p><strong>ملاحظات:</strong> ${esc(ev.notes)}</p>` : ''}
      ${ev.kind === 'weekly' ? `<p class="small muted">تظهر هذه الفعالية كل ${dayName(ev.day)}.</p>` : ''}
      ${ev.optional && !ev.enabled ? `<p class="small muted">يعرض التطبيق وقتًا بديلًا للمذاكرة أو الراحة ما لم تُفعّل هذا الدرس.</p>` : ''}

      <hr class="divider">
      <div class="btn-row">
        <button class="btn btn-success btn-sm" data-act2="done">✓ تم</button>
        <button class="btn btn-ghost btn-sm" data-act2="skip">تخطي</button>
        <button class="btn btn-ghost btn-sm" data-act2="postpone">تأجيل</button>
      </div>
      <div class="btn-row mt-1">
        <button class="btn btn-soft btn-sm" data-act2="edit">تعديل</button>
        <button class="btn btn-soft btn-sm" data-act2="duplicate">تكرار</button>
        <button class="btn btn-soft btn-sm" data-act2="move">نقل</button>
        <button class="btn btn-danger btn-sm" data-act2="delete">حذف</button>
      </div>
    `,
    onMount(mroot, close) {
      mroot.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act2]');
        if (!b) return;
        const act = b.dataset.act2;

        if (act === 'done' || act === 'skip') {
          await setEventStatus(iso, ev.id, act === 'done' ? 'done' : 'skipped');
          close();
          toast(act === 'done' ? 'أحسنت ✓' : 'تم التخطي', act === 'done' ? 'ok' : '');
        } else if (act === 'postpone') {
          close();
          openPostponePicker(ev, iso);
        } else if (act === 'edit') {
          close();
          openEventModal(ev, iso);
        } else if (act === 'duplicate') {
          const copy = {
            ...ev,
            id: newId('ev'),
            title: ev.title + ' (نسخة)',
            kind: 'once',
            date: iso,
            day: null,
          };
          await putItem('events', copy);
          close();
          toast('تم إنشاء نسخة ✓', 'ok');
        } else if (act === 'move') {
          close();
          openMovePicker(ev, iso);
        } else if (act === 'delete') {
          const ok = await confirmDialog({
            title: 'حذف الفعالية',
            message: 'سيتم حذف "' + ev.title + '" نهائيًا' + (ev.kind === 'weekly' ? ' من كل أسبوع' : '') + '. هل أنت متأكد؟',
            okText: 'حذف',
            danger: true,
          });
          if (ok) {
            await deleteItem('events', ev.id);
            close();
            toast('تم الحذف', 'ok');
          }
        }
      });
    },
  });
}

function openPostponePicker(ev, iso) {
  openModal({
    title: 'تأجيل: ' + ev.title,
    bodyHTML: `
      <p class="muted small">اختر مقدار التأجيل — يُنقل النشاط في خط اليوم فقط.</p>
      <div class="btn-row">
        <button class="btn btn-soft" data-min="15">15 دقيقة</button>
        <button class="btn btn-soft" data-min="30">30 دقيقة</button>
        <button class="btn btn-soft" data-min="60">ساعة</button>
      </div>`,
    onMount(mroot, close) {
      mroot.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-min]');
        if (!b) return;
        const mins = parseInt(b.dataset.min, 10);
        await putItem('progress', {
          id: 'pr|' + iso + '|' + ev.id, date: iso, eventId: ev.id,
          status: 'postponed', kind: 'event', updatedAt: Date.now(),
        });
        await putItem('progress', {
          id: 'ov|' + iso + '|' + ev.id, date: iso, eventId: ev.id, kind: 'override',
          oldStart: ev.start,
          newStart: fromMin(toMin(ev.start) + mins),
          newEnd: fromMin(toMin(ev.end) + mins),
        });
        close();
        toast('تم التأجيل ' + mins + ' دقيقة ⏰', 'ok');
      });
    },
  });
}

function openMovePicker(ev, iso) {
  openModal({
    title: 'نقل: ' + ev.title,
    bodyHTML: `
      <form id="move-form">
        ${field('date', 'إلى التاريخ', iso, { type: 'date' })}
        <div class="field-row">
          ${field('start', 'من', ev.start, { type: 'time' })}
          ${field('end', 'إلى', ev.end, { type: 'time' })}
        </div>
        <p class="hint">سيصبح هذا النسخة لمرة واحدة في اليوم الجديد (الأصل الأسبوعي يبقى كما هو).</p>
      </form>`,
    actionsHTML: `<button class="btn btn-primary" data-move>نقل</button>`,
    onMount(mroot, close) {
      mroot.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-move]')) return;
        const v = collectForm(mroot.querySelector('#move-form'));
        if (!isValidSpan(v.start, v.end)) { toast('وقت النهاية يجب أن يكون بعد البداية', 'err'); return; }
        const copy = {
          ...ev, id: newId('ev'), kind: 'once', date: v.date, day: null,
          start: v.start, end: v.end, notes: 'نقلت من ' + fmtDayRel(iso),
        };
        await putItem('events', copy);
        await putItem('progress', {
          id: 'pr|' + iso + '|' + ev.id, date: iso, eventId: ev.id,
          status: 'skipped', kind: 'event', updatedAt: Date.now(),
        });
        close();
        toast('تم النقل ✓', 'ok');
      });
    },
  });
}

/* ---------- نموذج إضافة/تعديل فعالية ---------- */

export function openEventModal(event = null, iso = todayISO()) {
  const isEdit = !!event;
  const subjects = state.subjects.filter((s) => !s.archived).map((s) => ({ value: s.id, label: s.nameAr }));
  const v = event || {
    title: '', type: 'study', start: '09:00', end: '10:00',
    subject: '', notes: '', kind: 'once', date: iso, day: weekdayOf(iso),
    travelMinutes: '', reminderOffsets: [60, 30, 15, 0], optional: false,
    confirmed: true, adjustable: false, enabled: true,
  };

  openModal({
    title: isEdit ? 'تعديل فعالية' : 'إضافة فعالية',
    bodyHTML: `
      <form id="event-form">
        ${field('title', 'العنوان', v.title, { required: true })}
        ${selectField('type', 'النوع', Object.entries(EVENT_TYPES).map(([k, x]) => ({ value: k, label: x.icon + ' ' + x.ar })), v.type)}
        ${selectField('subject', 'المادة', [{ value: '', label: 'بدون مادة' }, ...subjects], v.subject || '')}
        ${selectField('repeat', 'التكرار', [
          { value: 'once', label: 'مرة واحدة' },
          { value: 'weekly', label: 'يتكرر أسبوعيًا' },
        ], v.kind === 'weekly' ? 'weekly' : 'once')}
        <div class="field-row">
          ${field('date', 'التاريخ', v.date || iso, { type: 'date' })}
          ${selectField('day', 'يوم التكرار', [6, 0, 1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: dayName(d) })), String(v.day ?? 6))}
        </div>
        <div class="field-row">
          ${field('start', 'من', v.start, { type: 'time', required: true })}
          ${field('end', 'إلى', v.end, { type: 'time', required: true })}
        </div>
        ${field('travelMinutes', 'مدة السفر قبل الدرس (اختياري)', v.travelMinutes ?? '', { type: 'number', attrs: 'min="0" step="5"', hint: 'تُستخدم لتذكير السفر فقط' })}
        ${textareaField('notes', 'ملاحظات', v.notes || '')}
        ${toggleRow('confirmed', 'مؤكد', v.confirmed !== false, 'الفعاليات المؤكدة لا يقترح المساعد المساس بها')}
        ${toggleRow('optional', 'اختيارية (غير ملزمة)', !!v.optional, 'مثلاً: الدرس الشرعي غير المؤكد يوم الخميس')}
        ${toggleRow('adjustable', 'قابلة للتعديل', !!v.adjustable)}
        ${toggleRow('enabled', 'مفعّلة', v.enabled !== false)}
      </form>`,
    actionsHTML: `<button class="btn btn-primary" data-save-event>${isEdit ? 'حفظ التعديلات' : 'إضافة'}</button>`,
    onMount(mroot, close) {
      mroot.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-save-event]')) return;
        const form = mroot.querySelector('#event-form');
        const f = collectForm(form);
        if (!f.title.trim()) { toast('العنوان مطلوب', 'err'); return; }
        if (!isValidSpan(f.start, f.end)) { toast('وقت النهاية يجب أن يكون بعد البداية', 'err'); return; }

        const repeat = f.repeat || 'once';
        const rec = {
          id: event ? event.id : newId('ev'),
          kind: repeat === 'weekly' ? 'weekly' : 'once',
          day: repeat === 'weekly' ? parseInt(f.day, 10) : null,
          date: repeat === 'weekly' ? null : f.date,
          title: f.title.trim(),
          type: f.type,
          start: f.start,
          end: f.end,
          subject: f.subject || null,
          notes: f.notes || '',
          confirmed: !!f.confirmed,
          optional: !!f.optional,
          adjustable: !!f.adjustable,
          enabled: !!f.enabled,
          travelMinutes: f.travelMinutes ? parseInt(f.travelMinutes, 10) : null,
          reminderOffsets: f.type === 'lesson' ? [60, 30, 15, 0] : [],
          altTitle: event?.altTitle || null,
          altType: event?.altType || null,
        };

        // كشف التعارض — لا نمنع الإضافة لكن ننبّه بوضوح
        const isoTarget = rec.kind === 'weekly' ? isoOfNextWeekday(rec.day) : rec.date;
        const others = eventsForDate(state.events, isoTarget).filter((x) => x.id !== rec.id);
        const clash = others.find((x) => Math.min(toMin(x.end), toMin(rec.end)) - Math.max(toMin(x.start), toMin(rec.start)) > 0);
        if (clash) {
          const ok = await confirmDialog({
            title: 'تعارض في الجدول ⚠',
            message: 'هذه الفعالية تتداخل مع "' + clash.title + '" (' + fmtTimeRange(clash.start, clash.end) + '). لن نغيّر أي موعد تلقائيًا. هل تريد الحفظ رغم التعارض؟',
            okText: 'حفظ رغم التعارض',
            danger: true,
          });
          if (!ok) return;
        }

        await putItem('events', rec);
        close();
        toast('تم الحفظ ✓', 'ok');
      });
    },
  });
}

function isoOfNextWeekday(day) {
  let iso = todayISO();
  for (let i = 0; i < 8; i++) {
    if (weekdayOf(iso) === day) return iso;
    iso = addDaysISO(iso, 1);
  }
  return todayISO();
}
